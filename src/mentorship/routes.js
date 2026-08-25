import { Router } from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { journeyService } from './journeyService.js';
import { requireAuth, requireRole } from '../aptitude/middleware/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import { HttpError } from '../utils/httpError.js';
import { InterviewReport, InterviewSession, JourneyInterview, StudentJourney, User, Subscription, getSequelize } from '../database/index.js';
import { buildStudentWhere } from '../aptitude/utils/adminScope.js';
import { extractTextFromPdf } from '../services/resumeParser.js';
import { aiService } from '../services/aiService.js';
import { sanitizeClientVideoMetrics } from '../services/mediaService.js';
import { getBlueprintByNumber, BLUEPRINTS, LEVELS } from './blueprints.js';
import fs from 'fs/promises';

const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

function getStudentId(req) {
  return req.user?._id || req.user?.user_id;
}

function getStudentInfo(req) {
  return {
    id: req.user?._id || req.user?.user_id,
    name: req.user?.name || '',
    email: req.user?.email || '',
    institutionId: req.user?.institutionId || null,
    stream: req.user?.stream || '',
    interestedRole: req.user?.interested_role || '',
  };
}

async function generateFirstQuestion(resumeText, blueprint, studentContext) {
  let question = '';
  if (blueprint && resumeText) {
    try {
      question = await aiService.generateBlueprintFirstQuestion(resumeText, blueprint, studentContext);
    } catch (err) {
      console.error('Failed to generate first blueprint question:', err.message);
    }
  }
  if (!question) {
    try {
      question = await aiService.generateFirstQuestion(
        resumeText || 'the candidate did not provide a resume',
        studentContext.stream || 'General',
        studentContext.target_role || 'Software Engineer',
      );
    } catch (err) {
      console.error('Fallback first question also failed:', err.message);
    }
  }
  if (!question) {
    const topic = blueprint?.objective || blueprint?.title || '';
    const prefix = topic ? `We're starting an interview focused on ${topic.toLowerCase()}. ` : '';
    question = `${prefix}To begin, tell me about your background and the experiences most relevant to this interview.`;
  }
  return question;
}

// ═══════════════════════════════════════════════════════
// STUDENT ENDPOINTS
// ═══════════════════════════════════════════════════════

router.get('/journey', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const info = getStudentInfo(req);
  await journeyService.getOrCreateJourney(studentId, info.name, info.email, info.institutionId);
  const journey = await journeyService.getJourney(studentId);
  res.json({ journey });
}));

router.get('/levels', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await journeyService.getLevels(studentId);
  res.json(result);
}));

router.get('/journey/interviews', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const interviews = await journeyService.getJourneyInterviews(studentId);
  res.json({ interviews });
}));

router.get('/interview/next', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const info = getStudentInfo(req);

  try {
    await journeyService.getOrCreateJourney(studentId, info.name, info.email, info.institutionId);
  } catch (err) {
    console.log('Next-interview journey setup skipped:', err.message);
  }

  const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
  let completedCount = journey?.completed_interviews || 0;

  try {
    const { count } = await JourneyInterview.findAndCountAll({
      where: { student_id: studentId, status: 'completed' },
    });
    completedCount = Math.max(completedCount, count || 0);
  } catch (err) {
    console.log('Next-interview count skipped:', err.message);
  }

  const accessLevel = journey?.journey_access_level || 0;
  let accessibleTotal = 0;
  for (const level of LEVELS) {
    if (level.level <= accessLevel) {
      accessibleTotal = level.interview_range[1];
    }
  }
  if (accessibleTotal < 1) accessibleTotal = BLUEPRINTS.length;

  const interviewNumber = Math.min(completedCount + 1, accessibleTotal);
  const blueprint = getBlueprintByNumber(interviewNumber) || BLUEPRINTS[0];

  res.json({
    interview_number: interviewNumber,
    title: blueprint.title,
    level: blueprint.level,
    difficulty: blueprint.difficulty,
    objective: blueprint.objective,
    focus_areas: blueprint.focus_areas,
    completed_interviews: completedCount,
    total_interviews: accessibleTotal,
    all_completed: completedCount >= accessibleTotal,
  });
}));

router.get('/placement-progress', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const info = getStudentInfo(req);
  await journeyService.getOrCreateJourney(studentId, info.name, info.email, info.institutionId);
  const data = await journeyService.getPlacementProgress(studentId, info);
  res.json(data);
}));

router.get('/progress', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const progress = await journeyService.getProgress(studentId);
  res.json({ progress: progress || {} });
}));

router.get('/progress/trends', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const trends = await journeyService.getTrends(studentId);
  res.json(trends);
}));

router.get('/progress/readiness', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const readiness = await journeyService.getReadiness(studentId);
  res.json({ readiness });
}));

router.get('/resume/comparisons', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await journeyService.getResumeComparisons(studentId);
  res.json(result);
}));

router.get('/interview/replays', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await journeyService.getReplays(studentId);
  res.json(result);
}));

router.get('/interview/replay/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const replay = await journeyService.getReplayDetail(studentId, req.params.sessionId);
  if (!replay) throw new HttpError(404, 'Replay not found');
  res.json({ replay });
}));

router.get('/subscription', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await journeyService.getSubscription(studentId);
  res.json(result);
}));

router.get('/lock-status', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await journeyService.getLockStatus(studentId);
  res.json(result);
}));

router.post('/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const { plan_key } = req.body || {};
  const result = await journeyService.subscribe(studentId, plan_key);
  res.json(result);
}));

router.post('/interview/start', requireAuth, upload.single('resume'), asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const info = getStudentInfo(req);
  const useSaved = req.body?.use_saved === 'true' || req.body?.use_saved === true;
  const result = await journeyService.startInterview(studentId, info.name, info.email);

  let resumeText = '';

  if (useSaved && !req.file) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    resumeText = journey?.saved_resume_text || '';
  }

  if (!resumeText && req.file) {
    try {
      const fileBuffer = await fs.readFile(req.file.path);
      resumeText = await extractTextFromPdf(fileBuffer);
    } catch (err) {
      console.error('Failed to extract resume text:', err.message);
    } finally {
      try { await fs.unlink(req.file.path); } catch {}
    }
  }

  const blueprint = getBlueprintByNumber(result.interview_number);
  const studentContext = { stream: req.user?.stream || '', target_role: req.user?.interested_role || '' };
  const firstQuestion = await generateFirstQuestion(resumeText, blueprint, studentContext);
  const maxQuestions = Number(process.env.MAX_QUESTIONS || 10);

  await InterviewSession.create({
    session_id: result.session_id,
    student_id: studentId,
    student_name: info.name || '',
    student_email: info.email || '',
    student_role: req.user?.role || 'student',
    domain: studentContext.stream || blueprint?.domain || 'General',
    role: studentContext.target_role || blueprint?.role || 'Software Engineer',
    resume_text: resumeText,
    ats_analysis: null,
    history: [],
    current_question: firstQuestion,
    question_count: 1,
    max_questions: maxQuestions,
    status: 'active',
  });

  res.json({ ...result, question: firstQuestion, question_number: 1, max_questions: maxQuestions });
}));

router.post('/interview/start/:interviewNumber', requireAuth, upload.single('resume'), asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const interviewNumber = parseInt(req.params.interviewNumber);
  const useSaved = req.body?.use_saved === 'true' || req.body?.use_saved === true;
  const result = await journeyService.startInterviewById(studentId, interviewNumber);

  let resumeText = '';

  if (useSaved && !req.file) {
    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    resumeText = journey?.saved_resume_text || '';
  }

  if (!resumeText && req.file) {
    try {
      const fileBuffer = await fs.readFile(req.file.path);
      resumeText = await extractTextFromPdf(fileBuffer);
    } catch (err) {
      console.error('Failed to extract resume text:', err.message);
    } finally {
      try { await fs.unlink(req.file.path); } catch {}
    }
  }

  const blueprint = getBlueprintByNumber(interviewNumber);
  const studentContext = { stream: req.user?.stream || '', target_role: req.user?.interested_role || '' };
  const firstQuestion = await generateFirstQuestion(resumeText, blueprint, studentContext);
  const maxQuestions = Number(process.env.MAX_QUESTIONS || 10);

  const existingSession = await InterviewSession.findOne({ where: { session_id: result.session_id } });
  if (!existingSession) {
    await InterviewSession.create({
      session_id: result.session_id,
      student_id: studentId,
      student_name: req.user?.name || '',
      student_email: req.user?.email || '',
      student_role: req.user?.role || 'student',
      domain: studentContext.stream || blueprint?.domain || 'General',
      role: studentContext.target_role || blueprint?.role || 'Software Engineer',
      resume_text: resumeText,
      ats_analysis: null,
      history: [],
      current_question: firstQuestion,
      question_count: 1,
      max_questions: maxQuestions,
      status: 'active',
    });
  } else if (resumeText) {
    await existingSession.update({ resume_text: resumeText, current_question: firstQuestion || existingSession.current_question });
  }

  res.json({ ...result, question: firstQuestion, question_number: 1, max_questions: maxQuestions });
}));

router.get('/interview/blueprint/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await journeyService.generateBlueprintQuestion(req.params.sessionId, studentId);
  res.json(result);
}));

router.post('/interview/answer', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const { session_id: sessionId, answer, video_metrics: rawVideoMetrics } = req.body || {};
  if (!sessionId || !answer) throw new HttpError(400, 'session_id and answer are required');

  const session = await InterviewSession.findOne({ where: { session_id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== studentId) throw new HttpError(403, 'Not your session');
  if (session.status !== 'active') throw new HttpError(400, 'Interview already completed');

  const journeyInt = await JourneyInterview.findOne({
    where: { session_id: sessionId, student_id: studentId }
  });
  if (!journeyInt) throw new HttpError(404, 'Journey interview not found');

  const blueprint = getBlueprintByNumber(journeyInt.interview_number);
  if (!blueprint) throw new HttpError(500, 'Blueprint not found');

  const studentContext = { stream: req.user?.stream || '', target_role: req.user?.interested_role || '' };
  const videoMetrics = sanitizeClientVideoMetrics(rawVideoMetrics);
  const evaluation = await aiService.evaluateBlueprintAnswer(session.current_question, answer, blueprint, videoMetrics, studentContext);

  const historyEntry = {
    question_number: session.question_count,
    question: session.current_question,
    answer,
    evaluation,
    video_metrics: videoMetrics,
    timestamp: new Date(),
  };
  const updatedHistory = [...(session.history || []), historyEntry];
  const maxQuestions = Number(process.env.MAX_QUESTIONS || 10);
  const isLast = session.question_count >= maxQuestions;

  await session.update({
    history: updatedHistory,
    ...(isLast ? { status: 'completed' } : {}),
  });

  if (isLast) {
    return res.json({
      completed: true,
      feedback: evaluation.feedback || '',
      metrics: Object.fromEntries(
        ['confidence', 'body_language', 'knowledge', 'fluency', 'skill_relevance']
          .map((k) => [k, evaluation[k] || 0])
      ),
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || [],
      blueprint_score: evaluation.blueprint_score || 0,
    });
  }

  const resumeText = session.resume_text || '';
  let nextQuestion = '';
  try {
    nextQuestion = await aiService.generateBlueprintNextQuestion(resumeText, updatedHistory, blueprint, studentContext);
  } catch (err) {
    console.error('Failed to generate next blueprint question:', err.message);
  }
  if (!nextQuestion) {
    const last = updatedHistory[updatedHistory.length - 1];
    nextQuestion = last?.question
      ? `Let's go deeper on that — could you elaborate on your last answer with a concrete example?`
      : 'Tell me more about an experience that helped you build the relevant skills for this role.';
  }

  const nextQuestionNumber = session.question_count + 1;

  await session.update({
    current_question: nextQuestion,
    question_count: nextQuestionNumber,
  });

  return res.json({
    completed: false,
    next_question: nextQuestion,
    question_number: nextQuestionNumber,
    feedback: evaluation.feedback || '',
    metrics: Object.fromEntries(
      ['confidence', 'body_language', 'knowledge', 'fluency', 'skill_relevance']
        .map((k) => [k, evaluation[k] || 0])
    ),
    strengths: evaluation.strengths || [],
    improvements: evaluation.improvements || [],
    blueprint_score: evaluation.blueprint_score || 0,
  });
}));

router.post('/interview/end', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const { session_id: sessionId } = req.body || {};
  if (!sessionId) throw new HttpError(400, 'session_id is required');

  const session = await InterviewSession.findOne({ where: { session_id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== studentId) throw new HttpError(403, 'Not your session');

  const existingReport = await InterviewReport.findOne({ where: { session_id: sessionId } });
  if (existingReport) {
    await journeyService.completeInterview(studentId, sessionId, existingReport.overall?.percentage || 0, existingReport.overall?.grade || '');
    return res.json(existingReport);
  }

  const history = session.history || [];
  if (!history.length) throw new HttpError(400, 'No answers recorded. Complete the interview first.');

  const journeyInt = await JourneyInterview.findOne({
    where: { session_id: sessionId, student_id: studentId }
  });
  const blueprint = journeyInt ? getBlueprintByNumber(journeyInt.interview_number) : null;

  const avgBlueprintScore = history.reduce((sum, h) => sum + (h.evaluation?.blueprint_score || 0), 0) / history.length;
  const avgMetrics = {};
  for (const key of ['confidence', 'body_language', 'knowledge', 'fluency', 'skill_relevance']) {
    avgMetrics[key] = history.reduce((sum, h) => sum + (h.evaluation?.[key] || 0), 0) / history.length;
  }
  const avgAll = Object.values(avgMetrics).reduce((s, v) => s + v, 0) / Object.keys(avgMetrics).length;
  const pct = Math.round(avgAll * 10);

  const reportData = {
    session_id: sessionId,
    student_id: studentId,
    interview_role: session.role || blueprint?.role || '',
    interview_domain: session.domain || blueprint?.domain || '',
    blueprint_title: blueprint?.title || '',
    blueprint_level: blueprint?.level || 0,
    overall: {
      percentage: pct,
      grade: pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D',
      grade_label: pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Average' : 'Needs Improvement',
      average_score: avgAll,
      blueprint_avg: avgBlueprintScore,
      metrics: avgMetrics,
    },
    question_breakdown: history.map((h) => ({
      question: h.question,
      answer: h.answer,
      question_number: h.question_number,
      scores: {
        confidence: h.evaluation?.confidence || 0,
        body_language: h.evaluation?.body_language || 0,
        knowledge: h.evaluation?.knowledge || 0,
        fluency: h.evaluation?.fluency || 0,
        skill_relevance: h.evaluation?.skill_relevance || 0,
      },
      feedback: h.evaluation?.feedback || '',
      strengths: h.evaluation?.strengths || [],
      improvements: h.evaluation?.improvements || [],
      blueprint_score: h.evaluation?.blueprint_score || 0,
    })),
    strengths: history.flatMap((h) => h.evaluation?.strengths || []).slice(0, 5),
    improvements: history.flatMap((h) => h.evaluation?.improvements || []).slice(0, 5),
    created_at: new Date(),
  };

  const report = await InterviewReport.create(reportData);
  await session.update({ status: 'completed' });
  await journeyService.completeInterview(studentId, sessionId, pct, reportData.overall.grade);

  res.json(report);
}));

// ═══════════════════════════════════════════════════════
// SAVED RESUME ENDPOINTS
// ═══════════════════════════════════════════════════════

router.get('/resume/saved', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
  if (!journey || !journey.saved_resume_text) {
    return res.json({ hasSaved: false });
  }
  res.json({
    hasSaved: true,
    name: journey.saved_resume_name || 'Resume',
    preview: journey.saved_resume_text.slice(0, 200),
  });
}));

router.put('/resume/saved', requireAuth, upload.single('resume'), asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  let resumeText = '';
  let resumeName = req.file?.originalname || 'Resume';

  if (req.file) {
    try {
      const fileBuffer = await fs.readFile(req.file.path);
      resumeText = await extractTextFromPdf(fileBuffer);
    } catch (err) {
      console.error('Failed to extract resume text:', err.message);
    } finally {
      try { await fs.unlink(req.file.path); } catch {}
    }
  }

  if (!resumeText) throw new HttpError(400, 'Could not extract text from resume');

  const [journey] = await StudentJourney.findOrCreate({
    where: { student_id: studentId },
    defaults: { student_id: studentId, saved_resume_text: resumeText, saved_resume_name: resumeName },
  });
  if (journey.saved_resume_text !== undefined) {
    await journey.update({ saved_resume_text: resumeText, saved_resume_name: resumeName });
  }

  res.json({ hasSaved: true, name: resumeName, preview: resumeText.slice(0, 200) });
}));

router.delete('/resume/saved', requireAuth, asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
  if (journey) {
    await journey.update({ saved_resume_text: null, saved_resume_name: null });
  }
  res.json({ hasSaved: false });
}));

// ═══════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════

router.get('/admin/dashboard', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.getAdminDashboard(req.user);
  res.json(result);
}));

router.get('/admin/students', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { institution_id, search, page = 1, limit = 20 } = req.query;
  const result = await journeyService.getAdminStudents(req.user, institution_id, search, parseInt(page), parseInt(limit));
  res.json(result);
}));

router.get('/admin/students/:studentId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.getAdminStudentDetail(req.user, req.params.studentId);
  if (!result) throw new HttpError(404, 'Student not found');
  res.json(result);
}));

router.get('/admin/plans', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.getAdminPlans();
  res.json(result);
}));

router.post('/admin/subscriptions', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { student_id, plan_key } = req.body || {};
  if (!student_id || !plan_key) throw new HttpError(400, 'student_id and plan_key are required');
  const result = await journeyService.assignSubscription(student_id, plan_key);
  res.json(result);
}));

router.post('/admin/subscriptions/bulk', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { student_ids, plan_key } = req.body || {};
  if (!student_ids?.length || !plan_key) throw new HttpError(400, 'student_ids and plan_key are required');
  const result = await journeyService.bulkAssignSubscription(student_ids, plan_key);
  res.json({ results: result });
}));

router.post('/admin/subscriptions/:id/extend', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { days } = req.body || {};
  const result = await journeyService.extendSubscription(req.params.id, days);
  res.json({ subscription: result });
}));

router.patch('/admin/subscriptions/:id/extend', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { days } = req.body || {};
  const result = await journeyService.extendSubscription(req.params.id, days);
  res.json({ subscription: result });
}));

router.post('/admin/subscriptions/:id/cancel', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.cancelSubscription(req.params.id);
  res.json({ subscription: result });
}));

router.patch('/admin/subscriptions/:id/cancel', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.cancelSubscription(req.params.id);
  res.json({ subscription: result });
}));

router.get('/admin/subscription-impact', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { institution_id, plan_key } = req.query;
  const result = await journeyService.getSubscriptionImpact(institution_id, plan_key);
  res.json(result);
}));

router.post('/admin/subscriptions/institution/:institutionId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { plan_key } = req.body || {};
  const result = await journeyService.assignInstitutionSubscription(req.params.institutionId, plan_key);
  res.json(result);
}));

router.get('/admin/student-users/:studentId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.getStudentUsers(req.params.studentId);
  if (!result) throw new HttpError(404, 'Student not found');
  res.json(result);
}));

router.patch('/admin/student-users/:studentId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.updateStudentProfile(req.params.studentId, req.body || {}, req.user);
  res.json(result);
}));

router.post('/admin/student-users/:studentId/assign', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { admin_id } = req.body || {};
  const result = await journeyService.assignStudentAdmin(req.params.studentId, admin_id);
  res.json(result);
}));

router.patch('/admin/student-users/:studentId/assign', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { admin_id } = req.body || {};
  const result = await journeyService.assignStudentAdmin(req.params.studentId, admin_id);
  res.json(result);
}));

router.get('/admin/departments', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const result = await journeyService.getAdminDepartments();
  res.json(result);
}));

// ═══════════════════════════════════════════════════════
// MASTER ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════

router.post('/admin/journey-access', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { student_id, access_level } = req.body || {};
  if (!student_id || access_level === undefined) throw new HttpError(400, 'student_id and access_level are required');
  const result = await journeyService.assignJourneyAccess(student_id, access_level, req.user?._id);
  res.json(result);
}));

router.post('/admin/journey-access/upgrade', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { student_id, new_level } = req.body || {};
  if (!student_id || !new_level) throw new HttpError(400, 'student_id and new_level are required');
  const result = await journeyService.upgradeJourneyAccess(student_id, new_level, req.user?._id);
  res.json(result);
}));

router.post('/admin/journey-access/downgrade', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { student_id, new_level } = req.body || {};
  if (!student_id || new_level === undefined) throw new HttpError(400, 'student_id and new_level are required');
  const result = await journeyService.downgradeJourneyAccess(student_id, new_level, req.user?._id);
  res.json(result);
}));

router.post('/admin/journey-access/bulk', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { student_ids, access_level } = req.body || {};
  if (!student_ids?.length || access_level === undefined) throw new HttpError(400, 'student_ids and access_level are required');
  const result = await journeyService.bulkAssignAccess(student_ids, access_level, req.user?._id);
  res.json({ results: result });
}));

router.post('/admin/journey-access/institution/:institutionId', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { access_level, department_id, year } = req.body || {};
  if (access_level === undefined) throw new HttpError(400, 'access_level is required');
  const result = await journeyService.assignInstitutionJourneyAccess(
    req.params.institutionId, access_level, req.user?._id, { department_id, year }
  );
  res.json({ results: result });
}));

router.get('/admin/journey-access/impact', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { institution_id, department_id, year } = req.query;
  const result = await journeyService.getJourneyAccessImpact(institution_id, { department_id, year });
  res.json(result);
}));

// ═══════════════════════════════════════════════════════
// ADMIN REPORT PDF ENDPOINTS
// ═══════════════════════════════════════════════════════

router.get('/admin/reports/overview', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const studentWhere = buildStudentWhere(req.user);
  if (req.query.department_id && req.user.role === 'admin') {
    studentWhere.department_id = req.query.department_id;
  }

  const students = await User.findAll({
    where: studentWhere,
    attributes: ['_id', 'name', 'email', 'department_id', 'institutionId'],
    raw: true,
  });

  const studentIds = students.map(s => s._id);
  const journeys = studentIds.length
    ? await StudentJourney.findAll({ where: { student_id: studentIds }, raw: true })
    : [];
  const journeyMap = {};
  for (const j of journeys) journeyMap[j.student_id] = j;

  const subs = studentIds.length
    ? await Subscription.findAll({ where: { student_id: studentIds, status: 'active' }, raw: true })
    : [];
  const subMap = {};
  for (const s of subs) subMap[s.student_id] = s;

  const rows = students.map(s => {
    const j = journeyMap[s._id] || {};
    const sub = subMap[s._id] || {};
    return {
      name: s.name,
      email: s.email,
      level: j.current_level || 0,
      completed: j.completed_interviews || 0,
      readiness: j.readiness_score || 0,
      status: j.status || 'not_started',
      plan: sub.plan_name || '—',
    };
  });

  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=branch_overview_report.pdf');
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('Branch Overview Report');
  doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toISOString().slice(0, 10)}  |  Total students: ${rows.length}`);
  doc.moveDown();

  const headers = ['Name', 'Email', 'Level', 'Done', 'Readiness', 'Status', 'Plan'];
  const widths = [100, 120, 40, 40, 55, 65, 80];
  let y = doc.y;
  let x = 42;
  doc.font('Helvetica-Bold').fontSize(8);
  headers.forEach((h, i) => { doc.text(h, x, y, { width: widths[i], continued: true }); x += widths[i]; });
  y += 16;
  doc.moveTo(42, y).lineTo(570, y).stroke();
  y += 4;

  doc.font('Helvetica').fontSize(7);
  for (const row of rows) {
    if (y > 760) { doc.addPage(); y = 42; }
    x = 42;
    const vals = [row.name, row.email, String(row.level), String(row.completed), `${row.readiness}%`, row.status, row.plan];
    vals.forEach((v, i) => { doc.text(String(v || '—').slice(0, 30), x, y, { width: widths[i], continued: true }); x += widths[i]; });
    y += 14;
  }

  doc.end();
}));

router.get('/admin/reports/student/:studentId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const student = await User.findByPk(req.params.studentId, {
    attributes: ['_id', 'name', 'email', 'department_id', 'institutionId'],
    raw: true,
  });
  if (!student) throw new HttpError(404, 'Student not found');

  const journey = await StudentJourney.findOne({ where: { student_id: student._id }, raw: true });
  const interviews = await InterviewReport.findAll({
    where: { student_id: student._id },
    order: [['created_at', 'DESC']],
    raw: true,
  });

  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=student_report_${student._id}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('Student Report');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').text(`Name: ${student.name}`);
  doc.font('Helvetica').fontSize(10).text(`Email: ${student.email}`);
  if (journey) {
    doc.text(`Level: ${journey.current_level}  |  Completed: ${journey.completed_interviews} interviews  |  Readiness: ${journey.readiness_score}%`);
    doc.text(`Status: ${journey.status}`);
  }
  doc.moveDown();

  if (interviews.length) {
    doc.fontSize(13).font('Helvetica-Bold').text('Interview History');
    doc.moveDown(0.3);
    const iHeaders = ['#', 'Role', 'Domain', 'Score', 'Grade', 'Date'];
    const iWidths = [25, 100, 100, 50, 60, 100];
    let y = doc.y;
    let x = 42;
    doc.font('Helvetica-Bold').fontSize(8);
    iHeaders.forEach((h, i) => { doc.text(h, x, y, { width: iWidths[i], continued: true }); x += iWidths[i]; });
    y += 14;
    doc.moveTo(42, y).lineTo(570, y).stroke();
    y += 4;
    doc.font('Helvetica').fontSize(7);
    interviews.slice(0, 50).forEach((iv, idx) => {
      if (y > 760) { doc.addPage(); y = 42; }
      x = 42;
      const pct = iv.overall?.percentage || 0;
      const grade = iv.overall?.grade_label || iv.overall?.grade || '—';
      const date = iv.created_at ? new Date(iv.created_at).toLocaleDateString() : '—';
      const vals = [String(idx + 1), iv.interview_role || '—', iv.interview_domain || '—', `${pct}%`, grade, date];
      vals.forEach((v, i) => { doc.text(String(v).slice(0, 25), x, y, { width: iWidths[i], continued: true }); x += iWidths[i]; });
      y += 14;
    });
  } else {
    doc.fontSize(10).font('Helvetica').text('No interviews completed yet.');
  }

  doc.end();
}));

export default router;
