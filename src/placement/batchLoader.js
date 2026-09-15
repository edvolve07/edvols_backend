/**
 * Placement Batch Data Loader
 *
 * Optimized data loading for placement analytics.
 * Key improvements over the sequential approach:
 *
 * 1. Parallel data fetching: Load all students' raw data in parallel
 *    using Promise.allSettled instead of sequential for...of loops.
 *
 * 2. Batch SQL queries: Fetch all interview sessions, comm reports,
 *    and resumes in bulk queries instead of one-per-student.
 *
 * 3. In-memory grouping: Group raw data by student in JS rather
 *    than issuing N database queries.
 *
 * 4. Cache integration: Return cached profiles when available,
 *    only recompute for students whose data has changed.
 */

import {
  User, Department, InterviewSession, InterviewReport,
  CommunicationReport, ResumeVersion, StudentJourney,
  getSequelize, Op,
} from '../database/index.js';
import { getBlueprintByNumber } from '../mentorship/blueprints.js';
import {
  COMPETENCIES,
  DEFAULT_COMPETENCY_WEIGHTS,
  categorizeQuestion,
  computeCompetency,
  computeOverallReadiness,
  classifyReadiness,
  computeAssessmentConfidence,
  identifySkillGaps,
  identifyStrengths,
  classifyStudentSegment,
  meetsTalentCriteria,
  generateRecommendations,
  generateScoringExplanation,
} from './scoringEngine.js';
import { profileCache, profileKey, batchAnalyticsCache, batchKey } from './cache.js';

const BATCH_SIZE = 50;

/**
 * Fetch all raw data for a list of student IDs in bulk.
 * Returns Maps keyed by studentId.
 */
async function fetchBulkStudentData(studentIds) {
  if (studentIds.length === 0) {
    return { sessionsByStudent: new Map(), commByStudent: new Map(), resumeByStudent: new Map(), journeyByStudent: new Map() };
  }

  const [allSessions, allCommReports, allResumes, allJourneys] = await Promise.all([
    InterviewSession.findAll({
      where: { student_id: { [Op.in]: studentIds }, status: 'completed' },
      order: [['created_at', 'ASC']],
    }),
    CommunicationReport.findAll({
      where: { student_id: { [Op.in]: studentIds } },
      order: [['created_at', 'DESC']],
    }),
    ResumeVersion.findAll({
      where: { student_id: { [Op.in]: studentIds } },
      order: [['created_at', 'DESC']],
    }),
    StudentJourney.findAll({
      where: { student_id: { [Op.in]: studentIds } },
    }),
  ]);

  // Group by student_id, keeping only latest comm report and resume per student
  const sessionsByStudent = new Map();
  for (const s of allSessions) {
    if (!sessionsByStudent.has(s.student_id)) sessionsByStudent.set(s.student_id, []);
    sessionsByStudent.get(s.student_id).push(s);
  }

  const commByStudent = new Map();
  for (const c of allCommReports) {
    if (!commByStudent.has(c.student_id)) commByStudent.set(c.student_id, c);
  }

  const resumeByStudent = new Map();
  for (const r of allResumes) {
    if (!resumeByStudent.has(r.student_id)) resumeByStudent.set(r.student_id, r);
  }

  const journeyByStudent = new Map();
  for (const j of allJourneys) {
    journeyByStudent.set(j.student_id, j);
  }

  return { sessionsByStudent, commByStudent, resumeByStudent, journeyByStudent };
}

/**
 * Build a student's interview history from bulk-loaded sessions.
 */
function buildInterviewHistory(sessions) {
  const interviewHistory = [];
  for (const session of sessions) {
    const history = session.history || [];
    const blueprint = session.interview_number ? getBlueprintByNumber(session.interview_number) : null;
    const category = blueprint
      ? categorizeQuestion(blueprint.category, blueprint.focus_areas)
      : 'technical_knowledge';

    for (const entry of history) {
      interviewHistory.push({
        ...entry,
        category,
        session_id: session.session_id,
        interview_number: session.interview_number,
        timestamp: entry.timestamp || session.created_at,
      });
    }
  }
  return interviewHistory;
}

/**
 * Assemble student data object from bulk-loaded maps.
 */
function assembleStudentData(studentId, bulkData) {
  const sessions = bulkData.sessionsByStudent.get(studentId) || [];
  const commReport = bulkData.commByStudent.get(studentId);
  const resume = bulkData.resumeByStudent.get(studentId);
  const journey = bulkData.journeyByStudent.get(studentId);

  return {
    interviewHistory: buildInterviewHistory(sessions),
    interviewSessions: sessions,
    communicationReport: commReport?.overall || null,
    resumeAnalysis: resume?.ats_analysis || null,
    journey,
    completedInterviews: sessions.length,
  };
}

/**
 * Compute a student profile with caching.
 */
function computeProfileWithCache(studentId, studentData, weights = DEFAULT_COMPETENCY_WEIGHTS) {
  const key = profileKey(studentId);
  const cached = profileCache.get(key);
  if (cached) return cached;

  const { interviewHistory, communicationReport, resumeAnalysis, completedInterviews } = studentData;

  const competencies = {};
  for (const comp of COMPETENCIES) {
    competencies[comp] = computeCompetency(comp, interviewHistory, communicationReport, resumeAnalysis);
  }

  const overallResult = computeOverallReadiness(competencies, weights);
  const readinessBand = classifyReadiness(overallResult.overall);
  const assessmentConfidence = computeAssessmentConfidence(competencies);
  const gaps = identifySkillGaps(competencies);
  const strengths = identifyStrengths(competencies);
  const segments = classifyStudentSegment(competencies);
  const talentMatch = meetsTalentCriteria(competencies, overallResult.overall);
  const recommendations = generateRecommendations(competencies, gaps);
  const explanation = generateScoringExplanation(competencies, overallResult, readinessBand, assessmentConfidence);

  const profile = {
    competencies,
    overallReadiness: overallResult.overall,
    readinessBand,
    assessmentConfidence,
    completedInterviews,
    gaps,
    strengths,
    segments,
    talentMatch,
    recommendations,
    explanation,
  };

  profileCache.set(key, profile);
  return profile;
}

/**
 * Load and compute profiles for multiple students in parallel.
 * Returns array of { studentId, name, email, ...profile }.
 */
async function loadBatchProfiles(students, { weights = DEFAULT_COMPETENCY_WEIGHTS, parallel = true } = {}) {
  const studentIds = students.map(s => s._id);

  // Step 1: Bulk fetch all raw data (4 queries total instead of 4N)
  const bulkData = await fetchBulkStudentData(studentIds);

  // Step 2: Build a lookup for student metadata
  const studentMeta = new Map();
  for (const s of students) {
    studentMeta.set(s._id, {
      studentId: s._id,
      name: s.name,
      email: s.email,
      departmentId: s.department_id,
      year: s.year,
      stream: s.stream,
      institutionId: s.institutionId,
    });
  }

  // Step 3: Compute profiles (with caching)
  const profiles = [];

  if (parallel) {
    // Parallel computation using Promise.allSettled
    const computations = studentIds.map(async (sid) => {
      const studentData = assembleStudentData(sid, bulkData);
      if (studentData.completedInterviews === 0 && !studentData.communicationReport && !studentData.resumeAnalysis) {
        return null;
      }
      const profile = computeProfileWithCache(sid, studentData, weights);
      return { ...studentMeta.get(sid), ...profile };
    });

    const results = await Promise.allSettled(computations);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) profiles.push(r.value);
    }
  } else {
    // Sequential fallback
    for (const sid of studentIds) {
      try {
        const studentData = assembleStudentData(sid, bulkData);
        if (studentData.completedInterviews === 0 && !studentData.communicationReport && !studentData.resumeAnalysis) continue;
        const profile = computeProfileWithCache(sid, studentData, weights);
        profiles.push({ ...studentMeta.get(sid), ...profile });
      } catch {
        // skip failed students
      }
    }
  }

  return profiles;
}

/**
 * Get student profiles for an institution, with caching.
 */
async function getInstitutionProfiles(institutionId, userRole, queryFilters = {}) {
  const cacheKey = batchKey(institutionId || 'all', queryFilters);
  const cached = batchAnalyticsCache.get(cacheKey);
  if (cached) return cached;

  const whereClause = { role: 'student', is_active: true };
  if (userRole === 'admin' && institutionId) {
    whereClause.institutionId = institutionId;
  }
  if (queryFilters.department_id) whereClause.department_id = queryFilters.department_id;
  if (queryFilters.year) whereClause.year = queryFilters.year;
  if (queryFilters.search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${queryFilters.search}%` } },
      { email: { [Op.iLike]: `%${queryFilters.search}%` } },
    ];
  }

  const students = await User.findAll({
    where: whereClause,
    attributes: ['_id', 'name', 'email', 'department_id', 'year', 'institutionId', 'stream'],
  });

  const profiles = await loadBatchProfiles(students);
  batchAnalyticsCache.set(cacheKey, { profiles, students });
  return { profiles, students };
}

/**
 * Get all department records for a set of department IDs.
 */
async function getDepartmentMap(departmentIds) {
  const unique = [...new Set(departmentIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const departments = await Department.findAll({
    where: { _id: { [Op.in]: unique } },
  });
  const map = new Map();
  for (const d of departments) map.set(d._id, d);
  return map;
}

export {
  fetchBulkStudentData,
  buildInterviewHistory,
  assembleStudentData,
  computeProfileWithCache,
  loadBatchProfiles,
  getInstitutionProfiles,
  getDepartmentMap,
};
