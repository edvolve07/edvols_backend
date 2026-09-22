import { v4 as uuidv4 } from 'uuid';
import { JourneyBlueprint, StudentJourney, JourneyInterview, InterviewSession, InterviewReport, User, ResumeVersion, Subscription, Plan, Institution } from '../database/index.js';
import { LEVELS, BLUEPRINTS, getLevelForInterview, getBlueprintByNumber, isInterviewAccessible, getNextLockedInterview, normalizePlanTier } from './blueprints.js';
import { getSequelize, Op } from '../database/index.js';
import { buildStudentWhere } from '../aptitude/utils/adminScope.js';

export class JourneyService {

  async getEffectiveAccessLevel(studentId, journey = null) {
    if (!journey) {
      journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    }
    const user = await User.findByPk(studentId);
    // Institutional cohort students get full access to all 3 levels (30 interviews)
    if (user?.role === 'student' || Boolean(journey?.institution_id)) {
      return 3;
    }

    try {
      const subscription = await Subscription.findOne({
        where: { student_id: studentId, status: 'active' },
        order: [['created_at', 'DESC']],
      });
      if (subscription) {
        const norm = normalizePlanTier(subscription.plan_key, subscription.amount_paid, subscription.access_level);
        if (subscription.access_level !== norm.level || subscription.interviews_total !== norm.interviews) {
          await subscription.update({
            access_level: norm.level,
            interviews_total: norm.interviews,
            plan_name: norm.name,
          }).catch(() => {});
        }
        if (journey && (journey.journey_access_level !== norm.level || journey.total_interviews !== 30)) {
          await journey.update({
            journey_access_level: norm.level,
            total_interviews: 30,
          }).catch(() => {});
        }
        return norm.level;
      }
    } catch (_err) {}

    return Number(journey?.journey_access_level) || 0;
  }

  async getOrCreateJourney(studentId, studentName, studentEmail, institutionId) {
    let journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) {
      let accessLevel = 0;
      try {
        const user = await User.findByPk(studentId);
        if (user?.role === 'individual_student') {
          const subscription = await Subscription.findOne({
            where: { student_id: studentId, status: 'active' },
            order: [['created_at', 'DESC']],
          });
          if (subscription) {
            const norm = normalizePlanTier(subscription.plan_key, subscription.amount_paid, subscription.access_level);
            accessLevel = norm.level;
            if (subscription.access_level !== norm.level || subscription.interviews_total !== norm.interviews) {
              await subscription.update({
                access_level: norm.level,
                interviews_total: norm.interviews,
                plan_name: norm.name,
              }).catch(() => {});
            }
            await getSequelize().query(
              `UPDATE individual_students SET subscription_id = :subId, subscription_status = 'active', journey_access = :access, updated_at = NOW() WHERE user_id = :uid`,
              { replacements: { subId: subscription._id, access: accessLevel, uid: studentId } }
            );
          } else {
            const [[paymentTx]] = await getSequelize().query(
              `SELECT * FROM payment_transactions WHERE student_id = :uid AND status = 'completed' ORDER BY created_at DESC LIMIT 1`,
              { replacements: { uid: studentId } }
            );
            if (paymentTx) {
              const planKey = paymentTx.plan_key;
              const norm = normalizePlanTier(planKey, paymentTx.amount);
              accessLevel = norm.level;
              const sub = await Subscription.create({
                student_id: studentId,
                plan_key: planKey || `level_${accessLevel}`,
                plan_name: norm.name,
                plan_id: null,
                access_level: norm.level,
                interviews_total: norm.interviews,
                status: 'active',
                amount_paid: paymentTx.amount || 0,
                currency: 'INR',
                gst_amount: 0,
                start_date: new Date(),
                end_date: null,
              });
              await getSequelize().query(
                `UPDATE individual_students SET subscription_id = :subId, subscription_status = 'active', journey_access = :access, updated_at = NOW() WHERE user_id = :uid`,
                { replacements: { subId: sub._id, access: accessLevel, uid: studentId } }
              );
            }
          }
        }
      } catch (_healErr) {
        console.log('Journey self-heal skipped:', _healErr.message);
      }
      journey = await StudentJourney.create({
        student_id: studentId,
        student_name: studentName || '',
        student_email: studentEmail || '',
        institution_id: institutionId || null,
        journey_access_level: accessLevel,
        total_interviews: 30,
        current_level: accessLevel > 0 ? 1 : 1,
        current_interview_number: 1,
        completed_interviews: 0,
        status: 'not_started',
      });
    } else if (journey.completed_interviews === 0 || !journey.started_at) {
      try {
        const [[synced]] = await getSequelize().query(`
          SELECT
            COUNT(*)::int AS cnt,
            ROUND(AVG(COALESCE((overall->>'percentage')::float, 0))::numeric, 1)::float AS avg_score,
            MIN(created_at) AS first_started,
            MAX(created_at) AS last_completed
          FROM interview_reports
          WHERE student_id = :sid
        `, { replacements: { sid: studentId } });
        if (synced && synced.cnt > 0) {
          let newLevel = 1;
          if (synced.cnt >= 20) newLevel = 3;
          else if (synced.cnt >= 10) newLevel = 2;
          else newLevel = 1;
          const readiness = Math.min(100, Math.round(
            (synced.cnt / 30) * 40 +
            (synced.avg_score / 100) * 35 +
            (synced.cnt >= 5 ? 10 : (synced.cnt / 5) * 10) +
            Math.min(15, (synced.cnt / 30) * 15)
          ));
          await journey.update({
            completed_interviews: synced.cnt,
            overall_score: synced.avg_score,
            current_level: newLevel,
            readiness_score: readiness,
            started_at: synced.first_started,
            last_interview_at: synced.last_completed,
            status: synced.cnt >= 30 ? 'completed' : 'in_progress',
          });
          journey = await StudentJourney.findOne({ where: { student_id: studentId } });
        }
      } catch (_syncErr) {
        console.log('Journey data sync skipped:', _syncErr.message);
      }
    }
    return journey;
  }

  async getJourney(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    return journey;
  }

  async getLevels(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);
    const completedInterviews = journey?.completed_interviews || 0;
    const currentLevel = Math.min(accessLevel || 1, completedInterviews >= 20 ? 3 : completedInterviews >= 10 ? 2 : 1);

    return {
      levels: LEVELS.map(lvl => ({
        level: lvl.level,
        name: lvl.name,
        unlock_after_interviews: lvl.unlock_after_interviews,
        features: lvl.features,
        color: lvl.color,
        accessible: lvl.level <= accessLevel,
        completed: lvl.level < currentLevel,
        is_current: lvl.level === currentLevel,
      })),
      current_level: currentLevel,
      journey_access_level: accessLevel,
    };
  }

  async getJourneyInterviews(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);

    const interviews = await JourneyInterview.findAll({
      where: { student_id: studentId },
      order: [['interview_number', 'ASC']],
    });

    const interviewMap = new Map();
    for (const iv of interviews) {
      interviewMap.set(iv.interview_number, iv);
    }

    try {
      const sessions = await InterviewSession.findAll({
        where: { student_id: studentId },
        order: [['created_at', 'DESC']],
      });
      for (const s of sessions) {
        if (s.interview_number && !interviewMap.has(s.interview_number)) {
          interviewMap.set(s.interview_number, {
            interview_number: s.interview_number,
            status: s.status,
            session_id: s.session_id,
            overall_score: s.score,
            grade: s.grade,
            started_at: s.created_at,
            completed_at: s.completed_at,
          });
        }
      }
    } catch (_err) {}

    const completedCount = Math.max(
      journey?.completed_interviews || 0,
      [...interviewMap.values()].filter(iv => iv.status === 'completed' || iv.status === 'ended' || iv.completed_at || iv.grade || (Number(iv.overall_score) > 0)).length
    );

    let nextFound = false;
    const result = [];
    for (const blueprint of BLUEPRINTS) {
      const existing = interviewMap.get(blueprint.interview_number);
      const isCompleted = blueprint.interview_number <= completedCount || existing?.status === 'completed' || existing?.status === 'ended' || Boolean(existing?.completed_at) || Boolean(existing?.grade) || (Number(existing?.overall_score) > 0);
      const accessible = blueprint.level <= accessLevel;
      const isMilestone = [10, 20, 30].includes(blueprint.interview_number);
      const milestoneBadge =
        blueprint.interview_number === 10 ? 'Foundation Mock Evaluation' :
        blueprint.interview_number === 20 ? 'Intermediate Mock Evaluation' :
        blueprint.interview_number === 30 ? 'Final Placement Simulation' : null;

      let status = 'locked';
      let isNext = false;

      if (existing?.status === 'active') {
        status = 'in_progress';
      } else if (isCompleted) {
        status = 'completed';
      } else if (!nextFound && accessible) {
        status = 'next';
        isNext = true;
        nextFound = true;
      } else if (accessible) {
        status = 'upcoming';
      } else {
        status = 'locked';
      }

      result.push({
        interview_number: blueprint.interview_number,
        blueprint_id: existing?.blueprint_id || null,
        title: blueprint.title,
        level: blueprint.level,
        level_name: blueprint.level === 1 ? 'Foundation' : blueprint.level === 2 ? 'Skill Development' : 'Placement Ready',
        objective: blueprint.objective,
        focus_areas: blueprint.focus_areas,
        difficulty: blueprint.difficulty,
        category: blueprint.category,
        status, // 'completed' | 'next' | 'upcoming' | 'locked'
        is_completed: isCompleted,
        is_next: isNext,
        is_milestone: isMilestone,
        milestone_badge: milestoneBadge,
        session_id: existing?.session_id || null,
        report_id: existing?.report_id || null,
        overall_score: isCompleted ? Math.round(Number(existing?.overall_score || 75)) : null,
        grade: existing?.grade || (isCompleted ? 'B' : ''),
        started_at: existing?.started_at || null,
        completed_at: existing?.completed_at || null,
        accessible,
      });
    }

    return result;
  }

  async getAvailableInterview(studentId, transaction) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId }, transaction });
    if (!journey) return null;
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);

    const interviews = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
      order: [['interview_number', 'DESC']],
      transaction,
    });

    const completedNumbers = new Set(interviews.map(iv => iv.interview_number));

    for (const blueprint of BLUEPRINTS) {
      if (!completedNumbers.has(blueprint.interview_number) && blueprint.level <= accessLevel) {
        const dbBp = await JourneyBlueprint.findOne({ where: { interview_number: blueprint.interview_number }, transaction });
        return {
          interview_number: blueprint.interview_number,
          blueprint_id: dbBp?._id || null,
          title: blueprint.title,
          level: blueprint.level,
          objective: blueprint.objective,
          focus_areas: blueprint.focus_areas,
          difficulty: blueprint.difficulty,
        };
      }
    }
    return null;
  }

  async startInterview(studentId, studentName, studentEmail) {
    let journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) {
      journey = await this.getOrCreateJourney(studentId, studentName, studentEmail);
    }
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);

    if (journey.institution_id) {
      const institution = await Institution.findByPk(journey.institution_id);
      const gapDays = institution?.interview_gap_days || 0;
      if (gapDays > 0 && journey.last_interview_at) {
        const elapsedMs = Date.now() - new Date(journey.last_interview_at).getTime();
        const gapMs = gapDays * 24 * 60 * 60 * 1000;
        if (elapsedMs < gapMs) {
          const remainingDays = Math.ceil((gapMs - elapsedMs) / (24 * 60 * 60 * 1000));
          throw new Error(`You must wait ${remainingDays} more day(s) before starting the next interview.`);
        }
      }
    }

    let nextInterview = await this.getAvailableInterview(studentId);
    if (!nextInterview) {
      const firstAccessible = BLUEPRINTS.find(b => b.level <= accessLevel) || BLUEPRINTS[0];
      const dbBp = await JourneyBlueprint.findOne({ where: { interview_number: firstAccessible.interview_number } });
      nextInterview = {
        interview_number: firstAccessible.interview_number,
        blueprint_id: dbBp?._id || null,
        title: firstAccessible.title,
        level: firstAccessible.level,
        objective: firstAccessible.objective,
        focus_areas: firstAccessible.focus_areas,
        difficulty: firstAccessible.difficulty,
      };
    }

    const blueprint = getBlueprintByNumber(nextInterview.interview_number);
    if (!blueprint) throw new Error('Blueprint not found for interview ' + nextInterview.interview_number);

    const existing = await JourneyInterview.findOne({
      where: { student_id: studentId, interview_number: nextInterview.interview_number, status: 'active' }
    });
    if (existing && existing.session_id) {
      return {
        session_id: existing.session_id,
        interview_number: nextInterview.interview_number,
        blueprint_title: nextInterview.title,
        level: nextInterview.level,
        question_number: 1,
        question: '',
        ats_score: 0,
      };
    }

    const sessionId = uuidv4();
    await JourneyInterview.upsert({
      student_id: studentId,
      interview_number: nextInterview.interview_number,
      blueprint_id: nextInterview.blueprint_id,
      blueprint_title: nextInterview.title,
      level: nextInterview.level,
      status: 'active',
      session_id: sessionId,
      started_at: new Date(),
      level_at_time: journey.current_level,
    });

    if (journey.status === 'not_started') {
      await journey.update({ status: 'in_progress', started_at: new Date() });
    }

    return {
      session_id: sessionId,
      interview_number: nextInterview.interview_number,
      blueprint_title: nextInterview.title,
      level: nextInterview.level,
      objective: blueprint.objective,
      focus_areas: blueprint.focus_areas,
      difficulty: blueprint.difficulty,
      question_number: 1,
      question: '',
      ats_score: 0,
    };
  }

  async startInterviewById(studentId, interviewNumber, studentName, studentEmail) {
    let journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) {
      journey = await this.getOrCreateJourney(studentId, studentName, studentEmail);
    }
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);

    if (journey.institution_id) {
      const institution = await Institution.findByPk(journey.institution_id);
      const gapDays = institution?.interview_gap_days || 0;
      if (gapDays > 0 && journey.last_interview_at) {
        const elapsedMs = Date.now() - new Date(journey.last_interview_at).getTime();
        const gapMs = gapDays * 24 * 60 * 60 * 1000;
        if (elapsedMs < gapMs) {
          const remainingDays = Math.ceil((gapMs - elapsedMs) / (24 * 60 * 60 * 1000));
          throw new Error(`You must wait ${remainingDays} more day(s) before starting the next interview.`);
        }
      }
    }

    const blueprint = getBlueprintByNumber(interviewNumber);
    if (!blueprint) throw new Error('Invalid interview number: ' + interviewNumber);

    const existing = await JourneyInterview.findOne({
      where: { student_id: studentId, interview_number: interviewNumber }
    });

    if (!isInterviewAccessible(interviewNumber, accessLevel) && !existing) {
      throw new Error('Interview ' + interviewNumber + ' is locked. Complete previous interviews or upgrade your journey access.');
    }

    // Attended interviews can be attended ANY times or multiple times!
    const sessionId = uuidv4();
    const dbBp = await JourneyBlueprint.findOne({ where: { interview_number: interviewNumber } });
    await JourneyInterview.upsert({
      student_id: studentId,
      interview_number: interviewNumber,
      blueprint_id: dbBp?._id || null,
      blueprint_title: blueprint.title,
      level: blueprint.level,
      status: 'active',
      session_id: sessionId,
      started_at: new Date(),
      level_at_time: journey.current_level,
    });

    return {
      session_id: sessionId,
      interview_number: interviewNumber,
      blueprint_title: blueprint.title,
      level: blueprint.level,
      objective: blueprint.objective,
      focus_areas: blueprint.focus_areas,
      difficulty: blueprint.difficulty,
    };
  }

  async generateBlueprintQuestion(sessionId, studentId) {
    const journeyInt = await JourneyInterview.findOne({
      where: { session_id: sessionId, student_id: studentId }
    });
    if (!journeyInt) throw new Error('Journey interview not found');

    const blueprint = getBlueprintByNumber(journeyInt.interview_number);
    if (!blueprint) throw new Error('Blueprint not found');

    const session = await InterviewSession.findOne({ where: { session_id: sessionId } });
    const resumeText = session?.resume_text || '';

    return {
      blueprint_prompt: blueprint.ai_prompt,
      objective: blueprint.objective,
      focus_areas: blueprint.focus_areas,
      difficulty: blueprint.difficulty,
      interview_number: journeyInt.interview_number,
      title: blueprint.title,
      level: blueprint.level,
      resume_text: resumeText,
    };
  }

  async completeInterview(studentId, sessionId, score, grade) {
    return getSequelize().transaction(async transaction => {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!journey) throw new Error('Journey not found');
    const journeyInt = await JourneyInterview.findOne({
      where: { session_id: sessionId, student_id: studentId }, transaction
    });
    if (!journeyInt) throw new Error('Journey interview not found');

    await journeyInt.update({
      status: 'completed',
      overall_score: score || 0,
      grade: grade || '',
      completed_at: journeyInt.completed_at || new Date(),
    }, { transaction });

    const completedCount = await JourneyInterview.count({
      where: { student_id: studentId, status: 'completed' }, transaction
    });

    const allCompleted = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
      attributes: ['overall_score', 'completed_at'],
      transaction,
    });

    const avgScore = allCompleted.length > 0
      ? allCompleted.reduce((sum, iv) => sum + (iv.overall_score || 0), 0) / allCompleted.length
      : 0;

    let newLevel = 1;
    for (const level of LEVELS) {
      if (completedCount >= level.unlock_after_interviews) {
        newLevel = level.level;
      }
    }

    const nextInterview = await this.getAvailableInterview(studentId, transaction);
    const readinessScore = this.calculateReadiness(completedCount, avgScore, allCompleted);

    await StudentJourney.update({
      completed_interviews: completedCount,
      current_level: newLevel,
      current_interview_number: nextInterview?.interview_number || null,
      overall_score: Math.round(avgScore * 10) / 10,
      readiness_score: readinessScore,
      last_interview_at: new Date(Math.max(...allCompleted.map(iv => new Date(iv.completed_at || 0).getTime()))),
      status: completedCount >= 30 ? 'completed' : 'in_progress',
      completed_at: completedCount >= 30 ? (journey.completed_at || new Date()) : null,
    }, { where: { student_id: studentId }, transaction });

    return {
      completed: true,
      interview_number: journeyInt.interview_number,
      completed_count: completedCount,
      new_level: newLevel,
      overall_score: Math.round(avgScore * 10) / 10,
      readiness_score: readinessScore,
      next_interview: nextInterview,
      journey_completed: completedCount >= 30,
    };
    });
  }

  calculateReadiness(completedCount, avgScore, completedInterviews) {
    const completionWeight = (completedCount / 30) * 40;
    const scoreWeight = (avgScore / 100) * 35;
    const consistencyBonus = completedCount >= 5 ? 10 : (completedCount / 5) * 10;
    const levelBonus = Math.min(15, (completedCount / 30) * 15);
    return Math.min(100, Math.round(completionWeight + scoreWeight + consistencyBonus + levelBonus));
  }

  async getPlacementProgress(studentId, userInfo = {}) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    const targetRole = journey?.target_career_goal || userInfo.interestedRole || '';
    const stream = userInfo.stream || '';
    if (!journey) {
      return {
        currentLevel: 1,
        currentLevelName: 'Foundation',
        placementReadiness: 0,
        averageScore: 0,
        completedInterviews: 0,
        completed_interviews: 0,
        totalAccessed: 0,
        total_accessed: 0,
        inProgressInterviews: 0,
        in_progress_interviews: 0,
        allowedInterviews: 0,
        remainingInterviews: 0,
        progressPercentage: 0,
        currentPlan: null,
        nextInterviewAvailable: null,
        levels: LEVELS.map(l => ({
          id: l.level, name: l.name, status: l.level === 1 ? 'current' : 'locked',
          completedInterviews: 0, requiredInterviews: l.unlock_after_interviews,
        })),
        recentInterviews: [],
        trends: [],
        interviewsHistory: [],
        history: [],
        stream,
        targetRole,
        targetCareerGoal: targetRole,
      };
    }

    const completedCount = Math.max(
      await JourneyInterview.count({ where: { student_id: studentId, status: 'completed' } }),
      journey.completed_interviews || 0
    );

    const allCompleted = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
      order: [['interview_number', 'ASC']],
    });

    const avgScore = allCompleted.length > 0
      ? allCompleted.reduce((sum, iv) => sum + (iv.overall_score || 0), 0) / allCompleted.length
      : (journey.overall_score || 0);

    let currentLevel = 1;
    for (const level of LEVELS) {
      if (completedCount >= level.unlock_after_interviews) {
        currentLevel = level.level;
      }
    }
    const currentLevelObj = LEVELS.find(l => l.level === currentLevel);
    const nextLevelObj = LEVELS.find(l => l.level === currentLevel + 1);
    const currentThreshold = currentLevelObj?.unlock_after_interviews || 0;
    const nextThreshold = nextLevelObj?.unlock_after_interviews;

    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);
    const maxInterviews = this._getMaxInterviewsForAccess(accessLevel);
    const remaining = Math.max(0, maxInterviews - completedCount);
    const progressPct = nextThreshold != null
      ? Math.max(0, Math.min(100, Math.round(((completedCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100)))
      : (completedCount > 0 ? 100 : 0);

    const readinessScore = journey.readiness_score || this.calculateReadiness(completedCount, avgScore, allCompleted);

    let subscription = null;
    try {
      const sub = await Subscription.findOne({
        where: { student_id: studentId, status: 'active' },
        order: [['created_at', 'DESC']],
      });
      if (sub) {
        const norm = normalizePlanTier(sub.plan_key, sub.amount_paid, sub.access_level);
        subscription = {
          name: norm.name,
          plan_name: norm.name,
          plan_key: sub.plan_key,
          status: sub.status,
          expiryDate: sub.expires_at,
          accessLevel: norm.level,
          access_level: norm.level,
          interviewsTotal: norm.interviews,
          interviews_total: norm.interviews,
          amount_paid: sub.amount_paid,
          amountPaid: sub.amount_paid,
        };
      }
    } catch (_e) {}

    let nextAvailable = null;
    try {
      const lockInfo = await this._getLockStatus(studentId, journey);
      nextAvailable = lockInfo?.nextUnlockAt || null;
    } catch (_e) {}

    const journeyInterviews = await this.getJourneyInterviews(studentId);
    const nextInterview = journeyInterviews.find(iv => iv.is_next) || null;

    const levels = LEVELS.map(l => {
      const levelTotal = 10;
      const levelCompleted = Math.max(0, Math.min(10, completedCount - l.unlock_after_interviews));
      const levelInterviews = journeyInterviews.filter(iv => iv.level === l.level);
      const isAccessible = l.level <= accessLevel;
      return {
        id: l.level,
        name: l.name,
        status: l.level < currentLevel ? 'completed' : l.level === currentLevel ? (isAccessible ? 'current' : 'locked') : 'locked',
        completedInterviews: levelCompleted,
        requiredInterviews: levelTotal,
        features: l.features,
        color: l.color,
        accessible: isAccessible,
        interviews: levelInterviews,
      };
    });

    const historyData = await this.getInterviewHistory(studentId);

    const recentInterviews = (historyData.history.length > 0 ? historyData.history.slice(0, 10) : allCompleted.slice(-10).reverse()).map(iv => {
      const isCompleted = iv.is_completed ?? (iv.status === 'completed' || iv.status === 'ended' || Boolean(iv.completedAt || iv.completed_at) || Boolean(iv.grade));
      return {
        id: iv.id || iv._id || iv.sessionId || iv.session_id,
        sessionId: iv.sessionId || iv.session_id,
        interviewNumber: iv.interviewNumber || iv.interview_number,
        blueprintTitle: iv.title || iv.blueprintTitle || iv.blueprint_title,
        score: iv.score ?? iv.overall_score,
        grade: iv.grade,
        completedAt: iv.completedAt || iv.completed_at,
        level: iv.level,
        status: isCompleted ? 'completed' : (iv.status || 'in_progress'),
        is_completed: isCompleted,
        can_retake: true,
      };
    });

    const trends = (historyData.history.filter(h => h.is_completed && h.score != null).length > 0
      ? historyData.history.filter(h => h.is_completed && h.score != null)
      : allCompleted
    ).map(iv => ({
      score: iv.score ?? iv.overall_score,
      date: iv.completedAt || iv.completed_at,
      interviewNumber: iv.interviewNumber || iv.interview_number,
      title: iv.title || iv.blueprintTitle || iv.blueprint_title,
      sessionId: iv.sessionId || iv.session_id,
    }));

    return {
      currentLevel: Math.min(accessLevel || 1, currentLevel),
      currentLevelName: LEVELS.find(l => l.level === Math.min(accessLevel || 1, currentLevel))?.name || 'Foundation',
      placementReadiness: readinessScore,
      averageScore: Math.round(avgScore * 10) / 10,
      completedInterviews: Math.max(completedCount, historyData.completed_count),
      completed_interviews: Math.max(completedCount, historyData.completed_count),
      totalAccessed: historyData.total_accessed,
      total_accessed: historyData.total_accessed,
      inProgressInterviews: historyData.in_progress_count,
      in_progress_interviews: historyData.in_progress_count,
      allowedInterviews: maxInterviews,
      remainingInterviews: remaining,
      progressPercentage: progressPct,
      currentPlan: subscription,
      nextInterviewAvailable: nextAvailable,
      nextInterview,
      next_interview: nextInterview,
      levels,
      journeyInterviews,
      allInterviews: journeyInterviews,
      recentInterviews,
      trends,
      interviewsHistory: historyData.history,
      history: historyData.history,
      accessLevel,
      access_level: accessLevel,
      targetCareerGoal: journey.target_career_goal || '',
      stream,
      targetRole,
    };
  }

  async _getLockStatus(studentId, journey) {
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);
    const completedCount = journey?.completed_interviews || 0;
    const maxInterviews = this._getMaxInterviewsForAccess(accessLevel);
    const lastInterviewAt = journey?.last_interview_at;

    const gapDays = 0;
    let nextUnlockAt = null;

    return {
      allowed: true, // Attended interviews can be attended ANY times or multiple times!
      can_start: true,
      can_retake: true,
      interviewsUsed: completedCount,
      interviewsTotal: maxInterviews,
      remaining: Math.max(0, maxInterviews - completedCount),
      nextUnlockAt,
      lastInterviewAt: lastInterviewAt || null,
      gapDays,
    };
  }

  async getProgress(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) return null;
    const accessLevel = await this.getEffectiveAccessLevel(studentId, journey);

    const completedInterviews = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
      order: [['interview_number', 'ASC']],
    });

    const totalInterviews = Math.max(completedInterviews.length, journey.completed_interviews || 0);

    return {
      total_interviews: totalInterviews,
      total_available: accessLevel > 0 ? this._getMaxInterviewsForAccess(accessLevel) : 0,
      average_score: journey.overall_score,
      current_level: Math.min(accessLevel || 1, journey.current_level),
      journey_access_level: accessLevel,
      readiness_score: journey.readiness_score,
      scores: {
        overall: journey.overall_score,
      },
    };
  }

  _getMaxInterviewsForAccess(accessLevel) {
    const access = parseInt(accessLevel) || 0;
    if (access >= 3) return 30;
    if (access === 2) return 20;
    if (access === 1) return 10;
    return 0;
  }

  async getTrends(studentId) {
    const completedInterviews = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
      order: [['completed_at', 'ASC']],
    });

    const trends = completedInterviews.map(iv => ({
      value: iv.overall_score,
      score: iv.overall_score,
      date: iv.completed_at,
      interview_number: iv.interview_number,
      title: iv.blueprint_title,
      session_id: iv.session_id,
    }));

    return { trends };
  }

  async getReadiness(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) return { score: 0, components: {} };

    const completedInterviews = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
    });

    const completion = (completedInterviews.length / 30) * 100;
    const avgScore = completedInterviews.length > 0
      ? completedInterviews.reduce((sum, iv) => sum + (iv.overall_score || 0), 0) / completedInterviews.length
      : 0;

    const resume = await ResumeVersion.findOne({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
    });
    const resumeScore = resume?.ats_analysis?.ats_score || 0;

    return {
      score: journey.readiness_score,
      components: {
        aptitude: Math.min(100, Math.round(completion * 0.8)),
        coding: Math.min(100, Math.round(avgScore * 0.9)),
        interview: Math.min(100, Math.round(avgScore)),
        consistency: Math.min(100, Math.round(completion)),
        resume: Math.min(100, Math.round(resumeScore)),
      },
    };
  }

  async getResumeComparisons(studentId) {
    const versions = await ResumeVersion.findAll({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
      limit: 6,
    });

    return {
      comparisons: versions.map((v, idx) => ({
        _id: v._id,
        name: v.title || `Version ${idx + 1}`,
        version: v.version,
        ats_score: v.ats_analysis?.ats_score || 0,
        improvement: idx < versions.length - 1
          ? (v.ats_analysis?.ats_score || 0) - (versions[idx + 1]?.ats_analysis?.ats_score || 0)
          : 0,
        uploaded_at: v.created_at,
      })),
    };
  }

  async getInterviewHistory(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });

    const journeyInterviews = await JourneyInterview.findAll({
      where: { student_id: studentId },
      order: [['updated_at', 'DESC'], ['interview_number', 'ASC']],
    });

    const sessions = await InterviewSession.findAll({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    const reports = await InterviewReport.findAll({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    const reportMap = new Map();
    for (const rep of reports) {
      if (rep.session_id) reportMap.set(rep.session_id, rep);
    }

    const history = [];
    const seenSessionIds = new Set();

    for (const s of sessions) {
      if (!s.session_id) continue;
      seenSessionIds.add(s.session_id);

      const rep = reportMap.get(s.session_id);
      const isCompleted = s.status === 'ended' || s.status === 'completed' || Boolean(rep) || Boolean(s.completed_at) || Boolean(s.grade);
      const score = rep?.overall?.percentage ?? (s.score != null ? s.score : null);
      const grade = rep?.overall?.grade ?? s.grade ?? '';
      const gradeLabel = rep?.overall?.grade_label ?? (score != null ? (score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Practice') : '');

      history.push({
        id: s._id || s.session_id,
        session_id: s.session_id,
        interview_number: s.interview_number || null,
        title: s.blueprint_title || `${s.role || 'Mock Interview'} Practice`,
        role: s.role || 'Software Engineer',
        domain: s.domain || 'General',
        level: s.blueprint_level || 1,
        status: isCompleted ? 'completed' : (s.status === 'active' ? 'in_progress' : 'incomplete'),
        is_completed: isCompleted,
        score: score != null ? Math.round(Number(score)) : null,
        grade,
        grade_label: gradeLabel,
        question_count: s.question_count || 1,
        max_questions: s.max_questions || 10,
        started_at: s.created_at,
        completed_at: rep?.created_at || s.completed_at || (isCompleted ? s.updated_at : null),
        can_retake: true,
        report_id: rep?.report_id || null,
      });
    }

    for (const ji of journeyInterviews) {
      if (ji.session_id && seenSessionIds.has(ji.session_id)) {
        continue;
      }
      const rep = ji.session_id ? reportMap.get(ji.session_id) : null;
      const isCompleted = ji.status === 'completed' || ji.status === 'ended' || Boolean(ji.completed_at) || Boolean(ji.grade) || Boolean(rep);
      const score = isCompleted ? Math.round(Number(ji.overall_score ?? rep?.overall?.percentage ?? 0)) : null;

      history.push({
        id: ji._id || `ji-${ji.interview_number}`,
        session_id: ji.session_id || null,
        interview_number: ji.interview_number,
        title: ji.blueprint_title || `Interview #${ji.interview_number}`,
        role: 'Journey Interview',
        domain: 'Placement Blueprint',
        level: ji.level || 1,
        status: isCompleted ? 'completed' : (ji.status === 'active' ? 'in_progress' : 'available'),
        is_completed: isCompleted,
        score,
        grade: ji.grade || rep?.overall?.grade || '',
        grade_label: ji.grade ? `Grade ${ji.grade}` : (isCompleted ? 'Completed' : 'In Progress'),
        question_count: isCompleted ? 10 : 1,
        max_questions: 10,
        started_at: ji.started_at,
        completed_at: ji.completed_at || rep?.created_at,
        can_retake: true,
        report_id: ji.report_id || rep?.report_id || null,
      });
    }

    history.sort((a, b) => {
      const dateA = new Date(a.completed_at || a.started_at || 0).getTime();
      const dateB = new Date(b.completed_at || b.started_at || 0).getTime();
      return dateB - dateA;
    });

    const totalAccessed = history.length;
    const completedCount = history.filter(h => h.is_completed).length;
    const inProgressCount = history.filter(h => !h.is_completed).length;

    return {
      total_accessed: totalAccessed,
      completed_count: completedCount,
      in_progress_count: inProgressCount,
      history,
    };
  }

  async getReplays(studentId) {
    const replays = await JourneyInterview.findAll({
      where: { student_id: studentId, status: 'completed' },
      order: [['interview_number', 'ASC']],
    });

    return {
      replays: replays.map(iv => ({
        session_id: iv.session_id,
        interview_number: iv.interview_number,
        blueprint_title: iv.blueprint_title,
        overall_score: iv.overall_score,
        grade: iv.grade,
        completed_at: iv.completed_at,
        level_at_time: iv.level_at_time,
      })),
    };
  }

  async getReplayDetail(studentId, sessionId) {
    const report = await InterviewReport.findOne({ where: { session_id: sessionId } });
    if (!report) return null;

    return {
      session_id: sessionId,
      total_questions: report.question_breakdown?.length || 0,
      overall: report.overall,
      strengths: report.strengths,
      areas_to_improve: report.areas_to_improve,
      questions: (report.question_breakdown || []).map(qb => ({
        question: qb.question,
        answer: qb.answer,
        evaluation: qb.evaluation,
      })),
    };
  }

  async getSubscription(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) return { subscription: null, lock_status: null };

    const accessLevel = journey.journey_access_level;
    const completedInterviews = journey.completed_interviews;
    const maxInterviews = this._getMaxInterviewsForAccess(accessLevel);

    return {
      subscription: {
        plan_key: accessLevel > 0 ? `level_${accessLevel}` : null,
        status: accessLevel > 0 ? 'active' : 'none',
        interviews_used: completedInterviews,
        interviews_total: maxInterviews,
        expires_at: null,
        level_access: accessLevel,
      },
      lock_status: {
        allowed: completedInterviews < maxInterviews,
        interviewsUsed: completedInterviews,
        interviewsTotal: maxInterviews,
        remaining: Math.max(0, maxInterviews - completedInterviews),
        nextUnlockAt: null,
        daysRemaining: null,
        lastInterviewAt: journey.last_interview_at,
        gapDays: 0,
        reason: completedInterviews >= maxInterviews ? 'level_limit' : null,
      },
    };
  }

  async getLockStatus(studentId) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) return { allowed: false };

    const maxInterviews = this._getMaxInterviewsForAccess(journey.journey_access_level);
    const completed = journey.completed_interviews;

    let gapDays = 0;
    let gapRemainingDays = 0;
    if (journey.institution_id) {
      const institution = await Institution.findByPk(journey.institution_id);
      gapDays = institution?.interview_gap_days || 0;
      if (gapDays > 0 && journey.last_interview_at) {
        const elapsedMs = Date.now() - new Date(journey.last_interview_at).getTime();
        const gapMs = gapDays * 24 * 60 * 60 * 1000;
        if (elapsedMs < gapMs) {
          gapRemainingDays = Math.ceil((gapMs - elapsedMs) / (24 * 60 * 60 * 1000));
        }
      }
    }

    const atLimit = completed >= maxInterviews;
    const inGap = gapRemainingDays > 0;

    return {
      allowed: !atLimit && !inGap,
      interviewsUsed: completed,
      interviewsTotal: maxInterviews,
      remaining: Math.max(0, maxInterviews - completed),
      nextUnlockAt: null,
      daysRemaining: 0,
      lastInterviewAt: journey.last_interview_at,
      gapDays,
      gapRemainingDays,
      reason: atLimit ? 'level_limit' : inGap ? 'gap_restriction' : null,
    };
  }

  async subscribe(studentId, planKey) {
    throw new Error('Enterprise students do not purchase plans. Contact your administrator for journey access.');
  }

  // ═══════════════════════════════════════════════════════
  // ADMIN METHODS
  // ═══════════════════════════════════════════════════════

  async assignJourneyAccess(studentId, accessLevel, assignedBy) {
    if (accessLevel < 0 || accessLevel > 3) {
      throw new Error('Invalid access level. Must be 0-3.');
    }

    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) {
      const student = await User.findOne({ where: { _id: studentId } });
      if (!student) throw new Error('Student not found');

      await StudentJourney.create({
        student_id: studentId,
        student_name: student.name || '',
        student_email: student.email || '',
        institution_id: student.institutionId || null,
        journey_access_level: accessLevel,
        total_interviews: 30,
        current_level: accessLevel > 0 ? 1 : 1,
        current_interview_number: 1,
        completed_interviews: 0,
        status: accessLevel > 0 ? 'not_started' : 'locked',
      });
    } else {
      await journey.update({
        journey_access_level: accessLevel,
        total_interviews: 30,
        current_level: accessLevel > 0 ? Math.max(journey.current_level, 1) : 1,
        status: accessLevel > 0 ? (journey.status === 'locked' ? 'not_started' : journey.status) : 'locked',
      });
    }

    // Synchronize active subscription for the student
    try {
      if (accessLevel > 0) {
        const planKey = accessLevel === 3 ? 'placement_pro' : accessLevel === 2 ? 'career' : 'starter';
        const planName = accessLevel === 3 ? 'Placement Pro' : accessLevel === 2 ? 'Career' : 'Starter';
        const maxInterviews = accessLevel === 3 ? 30 : accessLevel === 2 ? 20 : 10;
        let negotiatedPrice = null;
        const studentUser = await User.findByPk(studentId);
        if (studentUser?.institutionId) {
          const inst = await Institution.findByPk(studentUser.institutionId);
          const pKey = accessLevel === 3 ? 'professional_price' : accessLevel === 2 ? 'advanced_price' : 'basic_price';
          negotiatedPrice = inst?.[pKey] ?? null;
        }

        const existingSub = await Subscription.findOne({
          where: { student_id: studentId, status: 'active' },
          order: [['created_at', 'DESC']],
        });
        if (existingSub) {
          await existingSub.update({
            access_level: accessLevel,
            interviews_total: maxInterviews,
            plan_key: planKey,
            plan_name: planName,
            ...(negotiatedPrice != null && (!existingSub.amount_paid || existingSub.amount_paid === 0) ? { amount_paid: negotiatedPrice } : {}),
          });
        } else {
          await Subscription.create({
            student_id: studentId,
            plan_key: planKey,
            plan_name: planName,
            plan_id: null,
            access_level: accessLevel,
            interviews_total: maxInterviews,
            status: 'active',
            amount_paid: negotiatedPrice ?? 0,
            currency: 'INR',
            gst_amount: 0,
            start_date: new Date(),
            end_date: null,
            invoices: [],
          });
        }
      } else {
        await Subscription.update(
          { status: 'cancelled' },
          { where: { student_id: studentId, status: 'active' } }
        );
      }
    } catch (_subSyncErr) {
      console.log('Subscription sync on assignJourneyAccess skipped:', _subSyncErr.message);
    }

    return { success: true, student_id: studentId, access_level: accessLevel };
  }

  async upgradeJourneyAccess(studentId, newLevel, upgradedBy) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) throw new Error('Student journey not found');

    if (newLevel <= journey.journey_access_level) {
      throw new Error('New level must be higher than current level');
    }

    await journey.update({ journey_access_level: newLevel });
    return { success: true, student_id: studentId, new_level: newLevel };
  }

  async downgradeJourneyAccess(studentId, newLevel, downgradedBy) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (!journey) throw new Error('Student journey not found');

    if (newLevel >= journey.journey_access_level) {
      throw new Error('New level must be lower than current level');
    }

    await journey.update({ journey_access_level: newLevel });
    return { success: true, student_id: studentId, new_level: newLevel };
  }

  async bulkAssignAccess(studentIds, accessLevel, assignedBy) {
    const results = [];
    for (const studentId of studentIds) {
      try {
        await this.assignJourneyAccess(studentId, accessLevel, assignedBy);
        results.push({ student_id: studentId, success: true });
      } catch (err) {
        results.push({ student_id: studentId, success: false, error: err.message });
      }
    }
    return results;
  }

  async getAdminDashboard(user) {
    const studentWhere = buildStudentWhere(user);

    const totalStudents = await User.count({ where: studentWhere });
    const studentIds = (await User.findAll({ where: studentWhere, attributes: ['_id'], raw: true })).map(s => s._id);

    const totalJourneys = await StudentJourney.count({ where: studentIds.length ? { student_id: { [Op.in]: studentIds } } : { student_id: null } });
    const totalSubscriptions = await StudentJourney.count({ where: { student_id: { [Op.in]: studentIds }, journey_access_level: { [Op.gt]: 0 } } });
    const activeSubscriptions = await StudentJourney.count({ where: { student_id: { [Op.in]: studentIds }, journey_access_level: { [Op.gt]: 0 }, status: { [Op.ne]: 'locked' } } });
    const activeJourneys = await StudentJourney.count({ where: { student_id: { [Op.in]: studentIds }, status: 'in_progress' } });
    const completedJourneys = await StudentJourney.count({ where: { student_id: { [Op.in]: studentIds }, status: 'completed' } });
    const avgReadiness = await StudentJourney.findAll({
      attributes: [[getSequelize().fn('AVG', getSequelize().col('readiness_score')), 'avg_readiness']],
      where: { student_id: { [Op.in]: studentIds }, readiness_score: { [Op.gt]: 0 } },
      raw: true,
    });

    return {
      total_students: totalStudents,
      total_journeys: totalJourneys,
      total_subscriptions: totalSubscriptions,
      active_subscriptions: activeSubscriptions,
      active_journeys: activeJourneys,
      completed_journeys: completedJourneys,
      average_readiness: Math.round(avgReadiness[0]?.avg_readiness || 0),
    };
  }

  async getAdminStudents(user, institutionId, search, page = 1, limit = 20) {
    const studentWhere = buildStudentWhere(user);
    if (institutionId) {
      studentWhere.institutionId = institutionId;
    }

    const allStudents = await User.findAll({
      where: studentWhere,
      order: [['created_at', 'DESC']],
      raw: true,
    });

    const journeys = await StudentJourney.findAll({ raw: true });
    const journeyMap = new Map();
    for (const j of journeys) {
      journeyMap.set(j.student_id, j);
    }

    let subscriptions = [];
    try {
      subscriptions = await Subscription.findAll({
        where: { status: 'active' },
        order: [['created_at', 'DESC']],
        raw: true,
      });
    } catch (_e) {}
    const subMap = new Map();
    for (const sub of subscriptions) {
      if (!subMap.has(sub.student_id)) subMap.set(sub.student_id, sub);
    }

    let filtered = allStudents.map(s => {
      const j = journeyMap.get(s._id);
      const sub = subMap.get(s._id);
      const accessLevel = Math.max(j?.journey_access_level || 0, sub?.access_level || 0);
      const maxInterviews = sub?.interviews_total || this._getMaxInterviewsForAccess(accessLevel);
      const planName = sub?.plan_name || (accessLevel > 0 ? (LEVELS.find(l => l.level === accessLevel)?.name || `Level ${accessLevel}`) : '—');
      const planKey = sub?.plan_key || (accessLevel > 0 ? `level_${accessLevel}` : null);
      return {
        id: s._id,
        name: s.name,
        email: s.email,
        institution_id: s.institutionId || null,
        journey: j ? {
          _id: j._id,
          journey_access_level: accessLevel,
          current_level: j.current_level,
          readiness_score: j.readiness_score,
          completed_interviews: j.completed_interviews,
          status: j.status,
        } : null,
        subscription: accessLevel > 0 ? {
          plan_key: planKey,
          plan_name: planName,
          status: 'active',
          interviews_used: j?.completed_interviews || 0,
          interviews_total: maxInterviews,
          level_access: accessLevel,
        } : null,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
      );
    }

    const count = filtered.length;
    const offset = (page - 1) * limit;
    const students = filtered.slice(offset, offset + limit);

    return {
      students,
      total: count,
      page,
      limit,
      total_pages: Math.ceil(count / limit),
    };
  }

  async getAdminStudentDetail(user, studentId) {
    const studentWhere = buildStudentWhere(user);
    studentWhere._id = studentId;
    const student = await User.findOne({ where: studentWhere });
    if (!student) return null;

    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });

    const interviews = journey ? await JourneyInterview.findAll({
      where: { student_id: studentId },
      order: [['interview_number', 'ASC']],
    }) : [];

    // Aggregate per-skill averages from completed interview reports (metrics are 0-10 → report as %)
    const completedSessionIds = interviews
      .filter(iv => iv.status === 'completed' && iv.session_id)
      .map(iv => iv.session_id);

    const METRIC_KEYS = ['confidence', 'body_language', 'knowledge', 'fluency', 'skill_relevance'];
    const skillTotals = Object.fromEntries(METRIC_KEYS.map(k => [k, 0]));
    let reportsCounted = 0;

    if (completedSessionIds.length) {
      const reports = await InterviewReport.findAll({
        where: { session_id: { [Op.in]: completedSessionIds } },
        attributes: ['session_id', 'overall'],
      });
      for (const report of reports) {
        const m = report.overall?.metrics || {};
        if (!METRIC_KEYS.some(k => Number.isFinite(Number(m[k])))) continue;
        reportsCounted += 1;
        for (const k of METRIC_KEYS) {
          skillTotals[k] += Number(m[k]) || 0;
        }
      }
    }

    const skillScores = reportsCounted > 0
      ? Object.fromEntries(METRIC_KEYS.map(k => [k, Math.round((skillTotals[k] / reportsCounted) * 10)]))
      : null;

    const accessLevel = await this.getEffectiveAccessLevel(student._id, journey);
    const maxInterviews = this._getMaxInterviewsForAccess(accessLevel);

    return {
      student: { _id: student._id, name: student.name, email: student.email, institutionId: student.institutionId },
      journey: journey ? {
        _id: journey._id,
        student_id: journey.student_id,
        current_level: journey.current_level,
        current_interview_number: journey.current_interview_number,
        completed_interviews: journey.completed_interviews,
        overall_score: journey.overall_score,
        readiness_score: journey.readiness_score,
        status: journey.status,
        journey_access_level: journey.journey_access_level,
        ...(skillScores ? {
          confidence_score: skillScores.confidence,
          body_language_score: skillScores.body_language,
          technical_score: skillScores.knowledge,
          communication_score: skillScores.fluency,
          skill_relevance_score: skillScores.skill_relevance,
        } : {}),
      } : null,
      interview_skill_averages: skillScores,
      interview_reports_counted: reportsCounted,
      subscription: {
        id: journey?._id || null,
        plan_key: accessLevel > 0 ? `level_${accessLevel}` : null,
        status: accessLevel > 0 ? 'active' : 'none',
        interviews_used: journey?.completed_interviews || 0,
        interviews_total: maxInterviews,
        level_access: accessLevel,
      },
      interview_entries: interviews.map(iv => ({
        _id: iv._id,
        interview_number: iv.interview_number,
        blueprint_title: iv.blueprint_title,
        status: iv.status,
        overall_score: iv.overall_score,
        grade: iv.grade,
        session_id: iv.session_id,
        started_at: iv.started_at,
        completed_at: iv.completed_at,
      })),
      reports: interviews.filter(iv => iv.status === 'completed').map(iv => ({
        session_id: iv.session_id,
        interview_number: iv.interview_number,
        blueprint_title: iv.blueprint_title,
        overall_score: iv.overall_score,
        grade: iv.grade,
      })),
    };
  }

  async getAdminPlans() {
    const CANONICAL_PLANS = [
      {
        key: 'starter',
        name: 'Starter',
        level_access: 1,
        access_level: 1,
        interviews_total: 10,
        interviews: 10,
        price: 299,
        features: [
          'Foundation Journey Access (Interviews 1–10)',
          '10 AI Interviews',
          'Aptitude Fundamentals',
          'Technical Assessment',
          'Communication Assessment',
          'Resume ATS Analysis',
        ],
      },
      {
        key: 'career',
        name: 'Career',
        level_access: 2,
        access_level: 2,
        interviews_total: 20,
        interviews: 20,
        price: 599,
        features: [
          'Skill Development Access (Interviews 1–20)',
          'All Level 1 & Level 2 Features',
          '20 AI Interviews',
          'Role-Based Practice',
          'Behavioral & STAR Method',
          'Progress Analytics',
        ],
      },
      {
        key: 'placement_pro',
        name: 'Placement Pro',
        level_access: 3,
        access_level: 3,
        interviews_total: 30,
        interviews: 30,
        price: 899,
        features: [
          'Full Placement Ready Access (Interviews 1–30)',
          'All 30 AI Interviews Across All 3 Levels',
          'Company-Style Mock Interviews',
          'Final Placement Assessment',
          'Verified Placement Certificate',
          'Priority Support',
        ],
      },
    ];

    let dbPlans = [];
    try {
      dbPlans = await Plan.findAll({ where: { status: 'active' }, order: [['price', 'ASC']], raw: true });
    } catch (_e) {
      dbPlans = [];
    }

    const subscriptionPlans = CANONICAL_PLANS.map((canon) => {
      const dbMatch = dbPlans.find(
        (p) =>
          p.plan_key === canon.key ||
          (canon.key === 'starter' && p.plan_key === 'basic') ||
          (canon.key === 'career' && p.plan_key === 'advanced') ||
          (canon.key === 'placement_pro' && p.plan_key === 'professional')
      );
      return {
        key: canon.key,
        name: dbMatch?.plan_name || canon.name,
        price: dbMatch ? Number(dbMatch.price) : canon.price,
        access_level: canon.access_level,
        interviews_total: canon.interviews_total,
        features: dbMatch?.features?.length ? dbMatch.features : canon.features,
      };
    });

    return {
      plans: LEVELS.map(lvl => ({
        key: `level_${lvl.level}`,
        name: lvl.name,
        level_access: lvl.level,
        interviews_total: lvl.interview_range[1],
        interviews: lvl.interview_range[1],
        duration_months: lvl.level,
        features: lvl.features || [],
      })),
      subscription_plans: subscriptionPlans,
    };
  }

  async assignSubscription(studentId, planKey) {
    const level = this._levelFromPlanKey(planKey);
    await this.assignJourneyAccess(studentId, level, 'admin');

    let planInfo = null;
    try {
      planInfo = await Plan.findOne({
        where: {
          plan_key: {
            [Op.in]: [
              planKey,
              planKey === 'starter' ? 'basic' : planKey === 'basic' ? 'starter' : null,
              planKey === 'career' ? 'advanced' : planKey === 'advanced' ? 'career' : null,
              planKey === 'placement_pro' ? 'professional' : planKey === 'professional' ? 'placement_pro' : null,
            ].filter(Boolean)
          }
        }
      });
    } catch (_e) {}

    const PLAN_DETAILS = {
      starter: { name: 'Starter', price: 299, interviews: 10 },
      career: { name: 'Career', price: 599, interviews: 20 },
      placement_pro: { name: 'Placement Pro', price: 899, interviews: 30 },
      basic: { name: 'Starter', price: 299, interviews: 10 },
      advanced: { name: 'Career', price: 599, interviews: 20 },
      professional: { name: 'Placement Pro', price: 899, interviews: 30 },
    };
    const fallback = PLAN_DETAILS[planKey] || { name: planKey, price: 0, interviews: 0 };

    let negotiatedPrice = null;
    try {
      const user = await User.findByPk(studentId);
      if (user?.institutionId) {
        const institution = await Institution.findByPk(user.institutionId);
        const priceKey = {
          starter: 'basic_price',
          basic: 'basic_price',
          level_1: 'basic_price',
          career: 'advanced_price',
          advanced: 'advanced_price',
          level_2: 'advanced_price',
          placement_pro: 'professional_price',
          professional: 'professional_price',
          level_3: 'professional_price',
        }[planKey] || `${planKey}_price`;
        negotiatedPrice = institution?.[priceKey] ?? null;
      }
    } catch (_e) {
      negotiatedPrice = null;
    }

    const finalPrice = negotiatedPrice ?? planInfo?.price ?? fallback.price;
    const finalInterviews = planInfo?.total_interviews || fallback.interviews || (level === 3 ? 30 : level === 2 ? 20 : 10);
    const finalPlanName = planInfo?.plan_name || fallback.name;

    const existingSubs = await Subscription.findAll({
      where: { student_id: studentId, status: 'active' },
      order: [['created_at', 'DESC']],
    });
    if (existingSubs.length > 0) {
      const [latest, ...older] = existingSubs;
      for (const old of older) {
        await old.update({ status: 'upgraded' });
      }
      await latest.update({
        plan_key: planKey,
        plan_name: finalPlanName,
        plan_id: planInfo?._id || null,
        access_level: planInfo?.journey_access || level,
        interviews_total: finalInterviews,
        status: 'active',
        amount_paid: finalPrice,
      });
      return { success: true, student_id: studentId, plan_key: planKey, access_level: level, amount_paid: finalPrice };
    }

    await Subscription.create({
      student_id: studentId,
      plan_key: planKey,
      plan_name: finalPlanName,
      plan_id: planInfo?._id || null,
      access_level: planInfo?.journey_access || level,
      interviews_total: finalInterviews,
      status: 'active',
      amount_paid: finalPrice,
      currency: 'INR',
      gst_amount: 0,
      start_date: new Date(),
      end_date: null,
      invoices: [],
    });
    return { success: true, student_id: studentId, plan_key: planKey, access_level: level, amount_paid: finalPrice };
  }

  async bulkAssignSubscription(studentIds, planKey) {
    const results = [];
    for (const studentId of studentIds) {
      try {
        await this.assignSubscription(studentId, planKey);
        results.push({ student_id: studentId, success: true });
      } catch (err) {
        results.push({ student_id: studentId, success: false, error: err.message });
      }
    }
    return results;
  }

  async extendSubscription(subscriptionId, days) {
    return { success: true, message: 'Enterprise subscriptions are level-based, not time-based.' };
  }

  async cancelSubscription(subscriptionId) {
    return { success: true, message: 'Enterprise subscription cancelled.' };
  }

  async getSubscriptionImpact(institutionId, planKey) {
    const students = await User.findAll({
      where: { institutionId, role: 'student' },
    });
    const affectedIds = students.map(s => s._id);
    const withJourney = affectedIds.length
      ? await StudentJourney.count({ where: { student_id: { [Op.in]: affectedIds } } })
      : 0;
    return {
      total_affected: students.length,
      with_journey: withJourney,
      institution_id: institutionId,
      plan_key: planKey,
    };
  }

  async assignInstitutionSubscription(institutionId, planKey, filters = {}) {
    const where = { institutionId, role: 'student' };
    if (filters.department_id) where.department_id = filters.department_id;
    if (filters.year) where.year = filters.year;
    const students = await User.findAll({ where });
    const studentIds = students.map(s => s._id);
    return this.bulkAssignSubscription(studentIds, planKey);
  }

  async assignInstitutionJourneyAccess(institutionId, accessLevel, assignedBy, filters = {}) {
    const where = { institutionId, role: 'student' };
    if (filters.department_id) where.department_id = filters.department_id;
    if (filters.year) where.year = filters.year;
    const students = await User.findAll({ where });
    const studentIds = students.map(s => s._id);
    return this.bulkAssignAccess(studentIds, accessLevel, assignedBy);
  }

  async getJourneyAccessImpact(institutionId, filters = {}) {
    const studentWhere = { institutionId, role: 'student' };
    if (filters.department_id) studentWhere.department_id = filters.department_id;
    if (filters.year) studentWhere.year = filters.year;
    const totalStudents = await User.count({ where: studentWhere });
    const journeyWhere = {};
    if (institutionId) journeyWhere.institution_id = institutionId;
    const count = await StudentJourney.count({ where: journeyWhere });
    return {
      total_affected: totalStudents,
      with_journey: count,
      institution_id: institutionId,
    };
  }

  _levelFromPlanKey(planKey) {
    if (!planKey) return 1;
    const match = String(planKey).match(/level[_-]?(?:1[_-])?(\d+)/i);
    if (match) return Math.min(3, Math.max(1, parseInt(match[1])));
    const PLAN_LEVEL_MAP = {
      level_1: 1,
      level_2: 2,
      level_3: 3,
      starter: 1,
      career: 2,
      placement_pro: 3,
      basic: 1,
      advanced: 2,
      professional: 3,
    };
    return PLAN_LEVEL_MAP[planKey] || 1;
  }

  async getAdminDepartments() {
    const { Department } = await import('../database/index.js');
    const departments = await Department.findAll();
    return { departments };
  }

  async getStudentUsers(studentId) {
    const student = await User.findOne({ where: { _id: studentId } });
    return student ? { student } : null;
  }

  async assignStudentAdmin(studentId, adminId) {
    const student = await User.findOne({ where: { _id: studentId } });
    if (!student) throw new Error('Student not found');
    await student.update({ assigned_admin: adminId });
    return { success: true };
  }

  async updateStudentProfile(studentId, body, admin) {
    const student = await User.findOne({ where: { _id: studentId } });
    if (!student) throw new Error('Student not found');

    const updates = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase();
    if (body.phone !== undefined) updates.phone = String(body.phone).trim();
    if (body.usn !== undefined) updates.usn = String(body.usn).trim() || null;
    if (body.department_id !== undefined) updates.department_id = body.department_id || null;
    if (body.year !== undefined) updates.year = String(body.year).trim() || null;
    if (body.organization !== undefined) updates.organization = String(body.organization).trim();
    if (body.assigned_admin !== undefined) updates.assigned_admin = body.assigned_admin || null;

    if (Object.keys(updates).length === 0) {
      return { success: true, student: student.toJSON() };
    }

    await student.update(updates);

    if (student.role === 'student' && (updates.department_id !== undefined || updates.assigned_admin !== undefined)) {
      const { EnterpriseStudent } = await import('../database/index.js');
      const profile = await EnterpriseStudent.findOne({ where: { user_id: studentId } });
      if (profile) {
        const profileUpdates = {};
        if (updates.department_id !== undefined) profileUpdates.department_id = updates.department_id;
        if (updates.assigned_admin !== undefined) profileUpdates.assigned_admin = updates.assigned_admin;
        if (Object.keys(profileUpdates).length > 0) await profile.update(profileUpdates);
      }
    }

    return { success: true, student: student.toJSON() };
  }
}

export const journeyService = new JourneyService();
