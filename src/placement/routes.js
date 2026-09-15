import { Router } from 'express';
import { requireAuth, requireRole } from '../aptitude/middleware/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import { HttpError } from '../utils/httpError.js';
import {
  User, Department, InterviewSession, InterviewReport,
  CommunicationReport, ResumeVersion, StudentJourney,
  JourneyInterview, getSequelize, Op,
  PlacementConfig, ScoringVersion, HumanValidation,
} from '../database/index.js';
import { getBlueprintByNumber, BLUEPRINTS } from '../mentorship/blueprints.js';
import {
  COMPETENCIES,
  DEFAULT_COMPETENCY_WEIGHTS,
  DEFAULT_READINESS_BANDS,
  DEFAULT_TALENT_CRITERIA,
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
  computeBatchAnalytics,
  computeDepartmentAnalytics,
  filterStudentsByCriteria,
  generateScoringExplanation,
} from './scoringEngine.js';
import {
  loadBatchProfiles,
  getInstitutionProfiles,
  getDepartmentMap,
  fetchBulkStudentData,
  assembleStudentData,
  computeProfileWithCache,
} from './batchLoader.js';
import { profileCache, profileKey, batchAnalyticsCache, batchKey } from './cache.js';
import { COMPETENCY_RUBRICS, getAllRubrics } from './rubricConfig.js';
import { validateSessionEvaluations, detectAnomalies } from './aiValidation.js';
import { scoringContext, activeScoringConfig } from './scoringContext.js';
import { validateScoringConfig } from './configValidation.js';

const router = Router();
router.use(requireAuth, (req, _res, next) => {
  if (req.user.role === 'admin' && !req.user.institutionId) {
    return next(new HttpError(403, 'Institution access required'));
  }
  if (req.path.startsWith('/config') && !['GET', 'HEAD'].includes(req.method) && req.user.role !== 'master_admin') {
    return next(new HttpError(403, 'Only master admins can change platform scoring configuration'));
  }
  next();
});
router.use(asyncHandler(async (_req, _res, next) => {
  const config = await PlacementConfig.findOne({ where: { active: true } });
  scoringContext.run(config?.get({ plain: true }) || {}, next);
}));

// ═══════════════════════════════════════════════════════
// HELPER: Gather all data for a single student (unchanged)
// ═══════════════════════════════════════════════════════
async function gatherStudentData(studentId) {
  const [interviewSessions, latestCommReport, latestResume, journey] = await Promise.all([
    InterviewSession.findAll({
      where: { student_id: studentId, status: { [Op.in]: ['completed', 'ended'] } },
      order: [['created_at', 'ASC']],
    }),
    CommunicationReport.findOne({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
    }),
    ResumeVersion.findOne({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
    }),
    StudentJourney.findOne({
      where: { student_id: studentId },
    }),
  ]);

  const interviewHistory = [];
  for (const session of interviewSessions) {
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

  return {
    interviewHistory,
    interviewSessions,
    communicationReport: latestCommReport?.overall || null,
    resumeAnalysis: latestResume?.ats_analysis || null,
    journey,
    completedInterviews: interviewSessions.length,
  };
}

// ═══════════════════════════════════════════════════════
// HELPER: Compute full placement profile (single student)
// ═══════════════════════════════════════════════════════
function computeStudentProfile(studentData, weights = activeScoringConfig().competency_weights || DEFAULT_COMPETENCY_WEIGHTS) {
  const { interviewHistory, communicationReport, resumeAnalysis, completedInterviews } = studentData;

  const competencies = {};
  for (const comp of COMPETENCIES) {
    competencies[comp] = computeCompetency(comp, interviewHistory, communicationReport, resumeAnalysis);
  }

  const overallResult = computeOverallReadiness(competencies, weights);
  const readinessBand = overallResult.totalWeight > 0 ? classifyReadiness(overallResult.overall) : 'UNASSESSED';
  const assessmentConfidence = computeAssessmentConfidence(competencies);
  const gaps = identifySkillGaps(competencies);
  const strengths = identifyStrengths(competencies);
  const segments = classifyStudentSegment(competencies);
  const talentMatch = meetsTalentCriteria(competencies, overallResult.overall);
  const recommendations = generateRecommendations(competencies, gaps);
  const explanation = generateScoringExplanation(competencies, overallResult, readinessBand, assessmentConfidence);

  return {
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
}

// ═══════════════════════════════════════════════════════
// STUDENT ENDPOINTS (unchanged, use single-student path)
// ═══════════════════════════════════════════════════════

router.get('/student/profile', requireAuth, asyncHandler(async (req, res) => {
  const studentId = req.user?._id || req.user?.user_id;
  if (!studentId) throw new HttpError(401, 'Not authenticated');

  const cached = profileCache.get(profileKey(studentId));
  let profile;
  if (cached) {
    profile = cached;
  } else {
    const studentData = await gatherStudentData(studentId);
    profile = computeStudentProfile(studentData);
    profileCache.set(profileKey(studentId), profile);
  }

  res.json({
    studentId,
    ...profile,
    scoringEngineVersion: activeScoringConfig().version || '1.0',
  });
}));

router.get('/student/explain', requireAuth, asyncHandler(async (req, res) => {
  const studentId = req.user?._id || req.user?.user_id;
  if (!studentId) throw new HttpError(401, 'Not authenticated');

  const cached = profileCache.get(profileKey(studentId));
  let profile;
  if (cached) {
    profile = cached;
  } else {
    const studentData = await gatherStudentData(studentId);
    profile = computeStudentProfile(studentData);
    profileCache.set(profileKey(studentId), profile);
  }

  res.json({
    studentId,
    explanation: profile.explanation,
    competencyBreakdown: COMPETENCIES.map(comp => ({
      name: comp,
      score: profile.competencies[comp]?.score || 0,
      confidence: profile.competencies[comp]?.confidence || 'INSUFFICIENT',
      dataPoints: profile.competencies[comp]?.dataPoints || 0,
      evidence: profile.competencies[comp]?.evidence || [],
    })),
  });
}));

router.get('/student/gaps', requireAuth, asyncHandler(async (req, res) => {
  const studentId = req.user?._id || req.user?.user_id;
  if (!studentId) throw new HttpError(401, 'Not authenticated');

  const cached = profileCache.get(profileKey(studentId));
  let profile;
  if (cached) {
    profile = cached;
  } else {
    const studentData = await gatherStudentData(studentId);
    profile = computeStudentProfile(studentData);
    profileCache.set(profileKey(studentId), profile);
  }

  res.json({
    studentId,
    gaps: profile.gaps,
    strengths: profile.strengths,
    recommendations: profile.recommendations,
  });
}));

router.get('/student/trends', requireAuth, asyncHandler(async (req, res) => {
  const studentId = req.user?._id || req.user?.user_id;
  if (!studentId) throw new HttpError(401, 'Not authenticated');

  const reports = await InterviewReport.findAll({
    where: { student_id: studentId },
    order: [['created_at', 'ASC']],
    attributes: ['session_id', 'overall', 'created_at'],
  });

  const trends = reports.map((r, i) => ({
    interviewNumber: i + 1,
    sessionId: r.session_id,
    percentage: r.overall?.percentage || 0,
    grade: r.overall?.grade || 'N/A',
    date: r.created_at,
  }));

  res.json({ studentId, trends });
}));

// ═══════════════════════════════════════════════════════
// ADMIN ENDPOINTS — OPTIMIZED with batch loading + cache
// ═══════════════════════════════════════════════════════

// GET /api/placement/admin/dashboard
router.get('/admin/dashboard', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  if (!institutionId && req.user?.role !== 'master_admin') {
    throw new HttpError(403, 'Institution access required');
  }

  const { profiles, students } = await getInstitutionProfiles(
    institutionId,
    req.user?.role,
  );

  const batchAnalytics = computeBatchAnalytics(profiles);

  const departmentIds = profiles.map(p => p.departmentId).filter(Boolean);
  const departmentMap = await getDepartmentMap(departmentIds);
  const departments = [...departmentMap.values()];
  const departmentAnalytics = computeDepartmentAnalytics(profiles, departments);

  const interviewReady = profiles.filter(p => p.talentMatch);

  res.json({
    overview: {
      totalStudents: students.length,
      assessedStudents: batchAnalytics.assessedCount,
      averageReadiness: batchAnalytics.avgReadiness,
      distribution: batchAnalytics.distribution,
      competencyAverages: batchAnalytics.competencyAverages,
      skillGaps: batchAnalytics.skillGaps,
    },
    departmentAnalytics,
    interviewReadyStudents: interviewReady.map(p => ({
      studentId: p.studentId,
      name: p.name,
      overallReadiness: p.overallReadiness,
      readinessBand: p.readinessBand,
      assessmentConfidence: p.assessmentConfidence,
    })),
    totalStudents: students.length,
    assessedStudents: batchAnalytics.assessedCount,
    assessmentCoverage: students.length > 0
      ? Math.round((batchAnalytics.assessedCount / students.length) * 100)
      : 0,
  });
}));

// GET /api/placement/admin/students
router.get('/admin/students', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  const { department_id, year, readiness_band, search, page = 1, limit = 50 } = req.query;

  const { profiles, students } = await getInstitutionProfiles(
    institutionId,
    req.user?.role,
    { department_id, year, search },
  );

  // Filter by readiness band if specified
  let filtered = profiles;
  if (readiness_band) {
    filtered = profiles.filter(p => p.readinessBand === readiness_band);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginated = filtered.slice(offset, offset + parseInt(limit));

  res.json({
    students: paginated.map(p => ({
      studentId: p.studentId,
      name: p.name,
      email: p.email,
      departmentId: p.departmentId,
      year: p.year,
      stream: p.stream,
      overallReadiness: p.overallReadiness,
      readinessBand: p.readinessBand,
      assessmentConfidence: p.assessmentConfidence,
      competencies: p.competencies,
      segments: p.segments,
      talentMatch: p.talentMatch,
    })),
    pagination: {
      total: filtered.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filtered.length / parseInt(limit)),
    },
  });
}));

// GET /api/placement/admin/student/:studentId
router.get('/admin/student/:studentId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const institutionId = req.user?.institutionId;

  const student = await User.findByPk(studentId);
  if (!student) throw new HttpError(404, 'Student not found');
  if (req.user?.role === 'admin' && student.institutionId !== institutionId) {
    throw new HttpError(403, 'Access denied');
  }

  // Try cache first
  let profile = profileCache.get(profileKey(studentId));
  if (!profile) {
    const studentData = await gatherStudentData(studentId);
    profile = computeStudentProfile(studentData);
    profileCache.set(profileKey(studentId), profile);
  }

  const interviewHistory = await InterviewReport.findAll({
    where: { student_id: studentId },
    order: [['created_at', 'ASC']],
    attributes: ['session_id', 'overall', 'strengths', 'areas_to_improve', 'created_at'],
  });

  res.json({
    student: {
      id: student._id,
      name: student.name,
      email: student.email,
      departmentId: student.department_id,
      year: student.year,
      stream: student.stream,
      institutionId: student.institutionId,
    },
    ...profile,
    interviewHistory: interviewHistory.map(r => ({
      sessionId: r.session_id,
      percentage: r.overall?.percentage || 0,
      grade: r.overall?.grade || 'N/A',
      strengths: r.strengths || [],
      areasToImprove: r.areas_to_improve || [],
      date: r.created_at,
    })),
  });
}));

// GET /api/placement/admin/department-comparison
router.get('/admin/department-comparison', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;

  const { profiles } = await getInstitutionProfiles(institutionId, req.user?.role);

  const departmentIds = profiles.map(p => p.departmentId).filter(Boolean);
  const departmentMap = await getDepartmentMap(departmentIds);
  const departments = [...departmentMap.values()];
  const departmentAnalytics = computeDepartmentAnalytics(profiles, departments);

  res.json({ departments: departmentAnalytics });
}));

// GET /api/placement/admin/skill-heatmap
router.get('/admin/skill-heatmap', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;

  const { profiles } = await getInstitutionProfiles(institutionId, req.user?.role);

  const departmentIds = profiles.map(p => p.departmentId).filter(Boolean);
  const departmentMap = await getDepartmentMap(departmentIds);
  const departments = [...departmentMap.values()];

  const deptIdToName = new Map();
  for (const d of departments) deptIdToName.set(d._id, d.name);

  const heatmap = [];
  for (const [deptId, deptName] of deptIdToName) {
    const deptProfiles = profiles.filter(p => p.departmentId === deptId);
    if (deptProfiles.length === 0) continue;

    const row = { departmentId: deptId, departmentName: deptName, competencies: {} };
    for (const comp of COMPETENCIES) {
      const scores = deptProfiles
        .map(p => p.competencies[comp]?.score)
        .filter(s => s != null && s > 0);
      row.competencies[comp] = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    }
    heatmap.push(row);
  }

  res.json({ heatmap });
}));

// GET /api/placement/admin/talent
router.get('/admin/talent', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;

  const { profiles } = await getInstitutionProfiles(institutionId, req.user?.role);

  const talentList = profiles
    .filter(p => p.talentMatch)
    .map(p => ({
      studentId: p.studentId,
      name: p.name,
      email: p.email,
      departmentId: p.departmentId,
      year: p.year,
      stream: p.stream,
      overallReadiness: p.overallReadiness,
      readinessBand: p.readinessBand,
      assessmentConfidence: p.assessmentConfidence,
      competencies: Object.fromEntries(
        COMPETENCIES.map(c => [c, p.competencies[c]?.score || 0])
      ),
    }))
    .sort((a, b) => b.overallReadiness - a.overallReadiness);

  res.json({
    criteria: DEFAULT_TALENT_CRITERIA,
    count: talentList.length,
    students: talentList,
  });
}));

// POST /api/placement/admin/filter
router.post('/admin/filter', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  const { minReadiness, competencies: compCriteria } = req.body;

  const { profiles } = await getInstitutionProfiles(institutionId, req.user?.role);

  const criteria = {
    minReadiness: minReadiness || 0,
    competencies: compCriteria || {},
  };
  const matched = filterStudentsByCriteria(profiles, criteria);

  res.json({
    criteria,
    matchCount: matched.length,
    students: matched.map(p => ({
      studentId: p.studentId,
      name: p.name,
      email: p.email,
      departmentId: p.departmentId,
      year: p.year,
      overallReadiness: p.overallReadiness,
      readinessBand: p.readinessBand,
      assessmentConfidence: p.assessmentConfidence,
    })),
  });
}));

// GET /api/placement/admin/batch-analytics
router.get('/admin/batch-analytics', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  const { year, department_id } = req.query;

  const { profiles } = await getInstitutionProfiles(
    institutionId,
    req.user?.role,
    { year, department_id },
  );

  const analytics = computeBatchAnalytics(profiles);

  // Group by year if no specific year filter
  const yearGroups = {};
  for (const p of profiles) {
    const y = p.year || 'Unknown';
    if (!yearGroups[y]) yearGroups[y] = [];
    yearGroups[y].push(p);
  }

  const yearAnalytics = {};
  for (const [y, groupProfiles] of Object.entries(yearGroups)) {
    yearAnalytics[y] = computeBatchAnalytics(groupProfiles);
  }

  res.json({
    overall: analytics,
    byYear: yearAnalytics,
    filters: { year: year || 'all', department_id: department_id || 'all' },
  });
}));

// POST /api/placement/admin/recalculate/:studentId
router.post('/admin/recalculate/:studentId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const institutionId = req.user?.institutionId;

  const student = await User.findByPk(studentId);
  if (!student) throw new HttpError(404, 'Student not found');
  if (req.user?.role === 'admin' && student.institutionId !== institutionId) {
    throw new HttpError(403, 'Access denied');
  }

  // Invalidate cache for this student and institution
  profileCache.invalidate(profileKey(studentId));
  batchAnalyticsCache.invalidatePrefix(`batch:${institutionId || 'all'}`);

  const studentData = await gatherStudentData(studentId);
  const profile = computeStudentProfile(studentData);
  profileCache.set(profileKey(studentId), profile);

  res.json({
    studentId,
    ...profile,
    scoringEngineVersion: activeScoringConfig().version || '1.0',
    recalculatedAt: new Date().toISOString(),
  });
}));

// POST /api/placement/admin/batch-recalculate
router.post('/admin/batch-recalculate', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  const whereClause = { role: 'student', is_active: true };
  if (req.user?.role === 'admin' && institutionId) {
    whereClause.institutionId = institutionId;
  }

  // Invalidate all caches for this institution
  profileCache.invalidateAll();
  batchAnalyticsCache.invalidateAll();

  const students = await User.findAll({
    where: whereClause,
    attributes: ['_id', 'name', 'email', 'department_id', 'year', 'institutionId', 'stream'],
  });

  const profiles = await loadBatchProfiles(students);

  // Pre-populate the cache with fresh results
  for (const p of profiles) {
    profileCache.set(profileKey(p.studentId), {
      competencies: p.competencies,
      overallReadiness: p.overallReadiness,
      readinessBand: p.readinessBand,
      assessmentConfidence: p.assessmentConfidence,
      completedInterviews: p.completedInterviews,
      gaps: p.gaps,
      strengths: p.strengths,
      segments: p.segments,
      talentMatch: p.talentMatch,
      recommendations: p.recommendations,
      explanation: p.explanation,
    });
  }

  res.json({
    total: students.length,
    success: profiles.length,
    failed: students.length - profiles.length,
    errors: [],
    completedAt: new Date().toISOString(),
  });
}));

// GET /api/placement/cache-stats — diagnostic endpoint
router.get('/cache-stats', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  res.json({
    profileCache: profileCache.stats(),
    batchCache: batchAnalyticsCache.stats(),
  });
}));

// ═══════════════════════════════════════════════════════
// CONFIG ENDPOINTS (DB-backed, Section 7/20)
// ═══════════════════════════════════════════════════════

// GET /api/placement/config — get active config
router.get('/config', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const activeConfig = await PlacementConfig.findOne({ where: { active: true } });

  if (activeConfig) {
    return res.json({
      configId: activeConfig._id,
      version: activeConfig.version,
      competencies: COMPETENCIES,
      weights: activeConfig.competency_weights,
      readinessBands: activeConfig.readiness_bands,
      talentCriteria: activeConfig.talent_criteria,
      segmentationThresholds: activeConfig.segmentation_thresholds,
      confidenceThresholds: activeConfig.confidence_thresholds,
      scoringEngineVersion: activeConfig.version,
    });
  }

  res.json({
    configId: null,
    version: '1.0',
    competencies: COMPETENCIES,
    weights: DEFAULT_COMPETENCY_WEIGHTS,
    readinessBands: DEFAULT_READINESS_BANDS,
    talentCriteria: DEFAULT_TALENT_CRITERIA,
    scoringEngineVersion: '1.0',
  });
}));

// POST /api/placement/config — create new config version
router.post('/config', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  validateScoringConfig(req.body);
  const { version, weights, readinessBands, talentCriteria, segmentationThresholds, confidenceThresholds, notes } = req.body;

  if (!version) throw new HttpError(400, 'Version is required');

  const existing = await PlacementConfig.findOne({ where: { version } });
  if (existing) throw new HttpError(409, `Config version "${version}" already exists`);

  const config = await PlacementConfig.create({
    config_name: 'default',
    version,
    competency_weights: weights || DEFAULT_COMPETENCY_WEIGHTS,
    readiness_bands: readinessBands || DEFAULT_READINESS_BANDS,
    talent_criteria: talentCriteria || DEFAULT_TALENT_CRITERIA,
    segmentation_thresholds: segmentationThresholds || { STRONG: 75, MODERATE: 60, NEEDS_IMPROVEMENT: 0 },
    confidence_thresholds: confidenceThresholds || { HIGH: { minInterviews: 4, minQuestions: 8 }, MEDIUM: { minInterviews: 2, minQuestions: 4 }, LOW: { minInterviews: 1, minQuestions: 1 } },
    active: false,
    created_by: req.user?._id || req.user?.user_id,
    notes,
  });

  res.status(201).json({ config });
}));

// PUT /api/placement/config/:configId — update config
router.put('/config/:configId', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  validateScoringConfig(req.body);
  const { configId } = req.params;
  const config = await PlacementConfig.findByPk(configId);
  if (!config) throw new HttpError(404, 'Config not found');

  const { weights, readinessBands, talentCriteria, segmentationThresholds, confidenceThresholds, notes } = req.body;
  await getSequelize().transaction(async transaction => {
  await getSequelize().query('LOCK TABLE placement_configs IN EXCLUSIVE MODE', { transaction });
  await config.reload({ transaction });
  if (config.active || await ScoringVersion.findOne({ where: { version: config.version }, transaction })) {
    throw new HttpError(409, 'Activated versions are immutable. Create a new version instead.');
  }

  await config.update({
    competency_weights: weights || config.competency_weights,
    readiness_bands: readinessBands || config.readiness_bands,
    talent_criteria: talentCriteria || config.talent_criteria,
    segmentation_thresholds: segmentationThresholds || config.segmentation_thresholds,
    confidence_thresholds: confidenceThresholds || config.confidence_thresholds,
    notes: notes ?? config.notes,
  }, { transaction });
  });

  res.json({ config });
}));

// POST /api/placement/config/:configId/activate — activate a config version
router.post('/config/:configId/activate', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { configId } = req.params;
  const config = await PlacementConfig.findByPk(configId);
  if (!config) throw new HttpError(404, 'Config not found');

  validateScoringConfig({ weights: config.competency_weights, readinessBands: config.readiness_bands, talentCriteria: config.talent_criteria, segmentationThresholds: config.segmentation_thresholds, confidenceThresholds: config.confidence_thresholds });
  await getSequelize().transaction(async transaction => {
  // Serialize activations across all backend instances.
  await getSequelize().query('LOCK TABLE placement_configs IN EXCLUSIVE MODE', { transaction });
  await config.reload({ transaction });
  validateScoringConfig({ weights: config.competency_weights, readinessBands: config.readiness_bands, talentCriteria: config.talent_criteria, segmentationThresholds: config.segmentation_thresholds, confidenceThresholds: config.confidence_thresholds });
  await PlacementConfig.update({ active: false }, { where: { active: true }, transaction });

  // Activate this one
  await config.update({ active: true }, { transaction });

  // Also create a scoring version entry
  const existingVersion = await ScoringVersion.findOne({ where: { version: config.version }, transaction });
  if (!existingVersion) {
    await ScoringVersion.create({
      version: config.version,
      name: `Scoring Engine v${config.version}`,
      competency_weights: config.competency_weights,
      readiness_bands: config.readiness_bands,
      talent_criteria: config.talent_criteria,
      segmentation_thresholds: config.segmentation_thresholds,
      confidence_thresholds: config.confidence_thresholds,
      rubric_config: COMPETENCY_RUBRICS,
      activated_by: req.user?._id || req.user?.user_id,
      notes: config.notes,
    }, { transaction });
  }
  });

  profileCache.invalidateAll();
  batchAnalyticsCache.invalidateAll();

  res.json({ message: `Config v${config.version} activated`, config });
}));

// GET /api/placement/config/versions — list all config versions
router.get('/config/versions', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const versions = await PlacementConfig.findAll({ order: [['created_at', 'DESC']] });
  res.json({ versions });
}));

// ═══════════════════════════════════════════════════════
// SCORING VERSION ENDPOINTS (Section 20)
// ═══════════════════════════════════════════════════════

// GET /api/placement/scoring-versions — list scoring versions
router.get('/scoring-versions', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const versions = await ScoringVersion.findAll({ order: [['activated_at', 'DESC']] });
  res.json({ versions });
}));

// GET /api/placement/scoring-versions/:version — get specific version
router.get('/scoring-versions/:version', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { version } = req.params;
  const scoringVersion = await ScoringVersion.findOne({ where: { version } });
  if (!scoringVersion) throw new HttpError(404, `Scoring version "${version}" not found`);
  res.json({ version: scoringVersion });
}));

// ═══════════════════════════════════════════════════════
// RUBRIC ENDPOINTS (Section 3)
// ═══════════════════════════════════════════════════════

// GET /api/placement/admin/rubric — get rubric configuration
router.get('/admin/rubric', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  res.json({
    rubrics: getAllRubrics(),
    competencies: COMPETENCIES,
  });
}));

// ═══════════════════════════════════════════════════════
// AI VALIDATION ENDPOINTS (Section 4)
// ═══════════════════════════════════════════════════════

// POST /api/placement/admin/validate-evaluations — validate AI evaluation data
router.post('/admin/validate-evaluations', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { sessionHistory, isBlueprint } = req.body;

  if (!sessionHistory || !Array.isArray(sessionHistory)) {
    throw new HttpError(400, 'sessionHistory array is required');
  }

  const validation = validateSessionEvaluations(sessionHistory, { isBlueprint });

  res.json({
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    anomalies: validation.anomalies,
    hasAnomalies: validation.hasAnomalies,
    consistency: validation.consistency,
    questionCount: validation.questionCount,
  });
}));

// ═══════════════════════════════════════════════════════
// HUMAN VALIDATION ENDPOINTS (Section 23)
// ═══════════════════════════════════════════════════════

// POST /api/placement/admin/human-validation — submit human evaluation
router.post('/admin/human-validation', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const { studentId, sessionId, competency, aiScore, humanScore, evaluatorName, notes } = req.body;

  if (!studentId || !competency || aiScore == null || humanScore == null) {
    throw new HttpError(400, 'studentId, competency, aiScore, and humanScore are required');
  }

  if (!COMPETENCIES.includes(competency)) {
    throw new HttpError(400, `Invalid competency: ${competency}. Must be one of: ${COMPETENCIES.join(', ')}`);
  }

  const student = await User.findByPk(studentId);
  if (!student || !['student', 'individual_student'].includes(student.role)) throw new HttpError(404, 'Student not found');
  if (req.user.role === 'admin' && student.institutionId !== req.user.institutionId) throw new HttpError(403, 'Access denied');
  if (![aiScore, humanScore].every(score => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)) {
    throw new HttpError(400, 'Scores must be numbers between 0 and 100');
  }
  if (sessionId && !await InterviewSession.findOne({ where: { session_id: sessionId, student_id: studentId } })) {
    throw new HttpError(400, 'Session does not belong to this student');
  }

  const difference = Math.round((humanScore - aiScore) * 100) / 100;

  const validation = await HumanValidation.create({
    student_id: studentId,
    session_id: sessionId,
    competency,
    ai_score: aiScore,
    human_score: humanScore,
    difference,
    evaluator_id: req.user?._id || req.user?.user_id,
    evaluator_name: evaluatorName,
    rubric_version: '1.0',
    scoring_engine_version: '1.0',
    institution_id: student.institutionId,
    notes,
  });

  res.status(201).json({ validation });
}));

// GET /api/placement/admin/human-validation/stats — accuracy statistics
router.get('/admin/human-validation/stats', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  const whereClause = {};
  if (req.user?.role === 'admin' && institutionId) {
    whereClause.institution_id = institutionId;
  }

  const validations = await HumanValidation.findAll({ where: whereClause });

  if (validations.length === 0) {
    return res.json({
      totalValidations: 0,
      overall: null,
      byCompetency: {},
      message: 'No human validations recorded yet.',
    });
  }

  // Overall stats
  const differences = validations.map(v => v.difference);
  const absDifferences = differences.map(d => Math.abs(d));
  const mae = absDifferences.reduce((a, b) => a + b, 0) / absDifferences.length;
  const within5 = absDifferences.filter(d => d <= 5).length;
  const within10 = absDifferences.filter(d => d <= 10).length;

  const overall = {
    totalValidations: validations.length,
    meanAbsoluteError: Math.round(mae * 100) / 100,
    agreementWithin5: Math.round((within5 / validations.length) * 100),
    agreementWithin10: Math.round((within10 / validations.length) * 100),
    meanDifference: Math.round((differences.reduce((a, b) => a + b, 0) / differences.length) * 100) / 100,
  };

  // By competency
  const byCompetency = {};
  for (const comp of COMPETENCIES) {
    const compValidations = validations.filter(v => v.competency === comp);
    if (compValidations.length === 0) continue;

    const compDiffs = compValidations.map(v => Math.abs(v.difference));
    const compMae = compDiffs.reduce((a, b) => a + b, 0) / compDiffs.length;
    const compWithin5 = compDiffs.filter(d => d <= 5).length;

    byCompetency[comp] = {
      count: compValidations.length,
      meanAbsoluteError: Math.round(compMae * 100) / 100,
      agreementWithin5: Math.round((compWithin5 / compValidations.length) * 100),
      avgAiScore: Math.round(compValidations.reduce((a, v) => a + v.ai_score, 0) / compValidations.length * 100) / 100,
      avgHumanScore: Math.round(compValidations.reduce((a, v) => a + v.human_score, 0) / compValidations.length * 100) / 100,
    };
  }

  res.json({ totalValidations: validations.length, overall, byCompetency });
}));

// GET /api/placement/admin/human-validation — list human validations
router.get('/admin/human-validation', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const institutionId = req.user?.institutionId;
  const { competency, student_id, page = 1, limit = 50 } = req.query;

  const whereClause = {};
  if (req.user?.role === 'admin' && institutionId) {
    whereClause.institution_id = institutionId;
  }
  if (competency) whereClause.competency = competency;
  if (student_id) whereClause.student_id = student_id;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows } = await HumanValidation.findAndCountAll({
    where: whereClause,
    order: [['evaluation_date', 'DESC']],
    offset,
    limit: parseInt(limit),
  });

  res.json({
    validations: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    },
  });
}));

export default router;
