import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { requireAuth, requireModuleAccess } from '../../aptitude/middleware/auth.js';
import { HttpError, asyncHandler } from '../../utils/httpError.js';
import { CommunicationSession } from '../../database/models/CommunicationSession.js';
import { CommunicationReport } from '../../database/models/CommunicationReport.js';
import { CommunicationScenario } from '../../database/models/CommunicationScenario.js';
import { nimService } from '../../services/nimService.js';
import { aiService } from '../../services/aiService.js';
import { transcriber } from '../../services/transcriber.js';
import { config } from '../../config.js';

const uploadDir = path.join(os.tmpdir(), 'edvolve-audio');
const upload = multer({ dest: uploadDir });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Communication AI runs on Groq (aiService); the NVIDIA path (nimService) is
// unavailable — dead models + speech-host DNS failures.
const commAi = aiService;

const router = Router();

const COMMUNICATION_CATEGORIES = [
  'Everyday Conversation & Small Talk',
  'Active Listening & Empathy',
  'Assertive Communication',
  'Conflict Resolution & Difficult Conversations',
  'Persuasion & Influence',
  'Public Speaking & Presentations',
  'Networking & Professional Introductions',
  'Giving & Receiving Feedback',
  'Cross-Cultural Communication',
  'Storytelling & Narrative Skills',
  'Team Collaboration & Meetings',
  'Client & Stakeholder Communication',
  'Crisis Communication',
  'Tell Me About Yourself',
  'Behavioral Questions (STAR)',
  'Strengths & Weaknesses',
  'Why This Role / Company',
  'Technical Explanations',
  'Handling Difficult Questions',
  'Career Goals & Aspirations',
  'Salary & Negotiation Talk',
];

router.post('/start', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { category, scenario_id } = req.body || {};
  const resolvedCategory = category || 'Tell Me About Yourself';
  let title = '',
    context = '',
    opening = '';

  if (scenario_id) {
    const scenario = await CommunicationScenario.findByPk(scenario_id);
    if (!scenario || scenario.status !== 'published') {
      throw new HttpError(404, 'Scenario not found');
    }
    title = scenario.title;
    context = scenario.context;
    opening = scenario.context;
  } else {
    const scenario = await commAi.generateScenario(resolvedCategory);
    title = scenario.title;
    context = scenario.context;
    opening = scenario.opening;
  }

  const sessionId = uuidv4();
  const session = {
    session_id: sessionId,
    student_id: req.user._id,
    student_name: req.user.name || '',
    student_email: req.user.email || '',
    scenario_id: scenario_id || '',
    category: resolvedCategory,
    context,
    history: [],
    current_prompt: opening,
    exchange_count: 0,
    max_exchanges: 6,
    status: 'active',
  };

  await CommunicationSession.create(session);

  res.json({
    session_id: sessionId,
    category: resolvedCategory,
    title,
    context,
    prompt: opening,
    exchange_count: 0,
    max_exchanges: 6,
  });
}));

router.post('/respond', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { session_id: sessionId, answer } = req.body || {};

  if (!sessionId || typeof answer !== 'string' || !answer.trim()) {
    throw new HttpError(400, 'session_id and answer are required');
  }

  const session = await CommunicationSession.findOne({ where: { session_id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== req.user._id) throw new HttpError(403, 'Not your session');
  if (session.status !== 'active') throw new HttpError(400, 'Session is already completed');

  const category = session.category || 'General';
  const evaluation = await commAi.evaluateResponse(session.current_prompt, answer, category);
  const history = session.history || [];
  const exchangeCount = (session.exchange_count || 0) + 1;
  const isLastExchange = exchangeCount >= session.max_exchanges;

  history.push({
    prompt: session.current_prompt,
    answer,
    evaluation: {
      clarity: evaluation.clarity,
      structure: evaluation.structure,
      conciseness: evaluation.conciseness,
      relevance: evaluation.relevance,
      confidence_tone: evaluation.confidence_tone,
    },
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    feedback: evaluation.feedback,
    real_world_tip: evaluation.real_world_tip || '',
  });

  const nextPrompt = isLastExchange ? '' : (evaluation.next_prompt || 'Can you tell me more about a specific example from your experience?');

  await CommunicationSession.update({
    history,
    current_prompt: nextPrompt,
    exchange_count: exchangeCount,
    status: isLastExchange ? 'completed' : 'active',
  }, { where: { session_id: sessionId } });

  res.json({
    exchange_number: exchangeCount,
    max_exchanges: session.max_exchanges,
    is_last: isLastExchange,
    evaluation: {
      clarity: evaluation.clarity,
      structure: evaluation.structure,
      conciseness: evaluation.conciseness,
      relevance: evaluation.relevance,
      confidence_tone: evaluation.confidence_tone,
    },
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    feedback: evaluation.feedback,
    real_world_tip: evaluation.real_world_tip || '',
    next_prompt: nextPrompt,
  });
}));

router.post('/respond-audio', requireAuth, requireModuleAccess('communication'), upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'audio file is required');

  const { session_id: sessionId } = req.body || {};
  if (!sessionId) throw new HttpError(400, 'session_id is required');

  const session = await CommunicationSession.findOne({ where: { session_id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== req.user._id) throw new HttpError(403, 'Not your session');
  if (session.status !== 'active') throw new HttpError(400, 'Session is already completed');

  let answer;
  try {
    answer = await transcriber.transcribe(req.file.path);
  } catch (err) {
    throw new HttpError(502, `Transcription failed: ${err.message}`);
  } finally {
    fs.unlink(req.file.path).catch(() => {});
  }

  if (!answer) throw new HttpError(400, 'Could not transcribe audio — please try again');

  const category = session.category || 'General';
  const evaluation = await commAi.evaluateResponse(session.current_prompt, answer, category);
  const history = session.history || [];
  const exchangeCount = (session.exchange_count || 0) + 1;
  const isLastExchange = exchangeCount >= session.max_exchanges;

  history.push({
    prompt: session.current_prompt,
    answer,
    evaluation: {
      clarity: evaluation.clarity,
      structure: evaluation.structure,
      conciseness: evaluation.conciseness,
      relevance: evaluation.relevance,
      confidence_tone: evaluation.confidence_tone,
    },
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    feedback: evaluation.feedback,
    real_world_tip: evaluation.real_world_tip || '',
  });

  const nextPrompt = isLastExchange ? '' : (evaluation.next_prompt || 'Can you tell me more about a specific example from your experience?');

  await CommunicationSession.update({
    history,
    current_prompt: nextPrompt,
    exchange_count: exchangeCount,
    status: isLastExchange ? 'completed' : 'active',
  }, { where: { session_id: sessionId } });

  res.json({
    transcript: answer,
    exchange_number: exchangeCount,
    max_exchanges: session.max_exchanges,
    is_last: isLastExchange,
    evaluation: {
      clarity: evaluation.clarity,
      structure: evaluation.structure,
      conciseness: evaluation.conciseness,
      relevance: evaluation.relevance,
      confidence_tone: evaluation.confidence_tone,
    },
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    feedback: evaluation.feedback,
    next_prompt: nextPrompt,
  });
}));

router.get('/session/:session_id', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const session = await CommunicationSession.findOne({ where: { session_id: req.params.session_id } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== req.user._id && !['admin', 'master_admin'].includes(req.user.role)) {
    throw new HttpError(403, 'Not your session');
  }

  res.json({
    session_id: session.session_id,
    category: session.category,
    context: session.context,
    prompt: session.current_prompt,
    exchange_count: session.exchange_count,
    max_exchanges: session.max_exchanges,
    status: session.status,
    history: session.history || [],
  });
}));

router.post('/end', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { session_id: sessionId } = req.body || {};
  if (!sessionId) throw new HttpError(400, 'session_id is required');

  const session = await CommunicationSession.findOne({ where: { session_id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== req.user._id) throw new HttpError(403, 'Not your session');

  const history = session.history || [];
  const category = session.category || 'General';
  const exchangeBreakdown = history.map((item, index) => ({
    number: index + 1,
    prompt: item.prompt,
    answer: item.answer,
    evaluation: item.evaluation,
    strengths: item.strengths || [],
    improvements: item.improvements || [],
    feedback: item.feedback || '',
    real_world_tip: item.real_world_tip || '',
  }));

  const metricKeys = ['clarity', 'structure', 'conciseness', 'relevance', 'confidence_tone'];
  const metricSums = Object.fromEntries(metricKeys.map((k) => [k, 0]));
  for (const item of history) {
    const ev = item.evaluation || {};
    for (const key of metricKeys) {
      metricSums[key] += Number(ev[key] || 0);
    }
  }
  const count = history.length || 1;
  const avg = Object.fromEntries(metricKeys.map((k) => [k, Number((metricSums[k] / count).toFixed(1))]));

  const totalScore = Object.values(metricSums).reduce((s, v) => s + v, 0);
  const maxPossible = count * 50;
  const percentage = maxPossible ? (totalScore / maxPossible) * 100 : 0;
  let grade = 'F', label = 'Needs Improvement';
  if (percentage >= 85) { grade = 'A'; label = 'Excellent'; }
  else if (percentage >= 70) { grade = 'B'; label = 'Good'; }
  else if (percentage >= 55) { grade = 'C'; label = 'Average'; }
  else if (percentage >= 40) { grade = 'D'; label = 'Fair'; }

  const conversation_log = history.map((item, index) => ({
    exchange: index + 1,
    interviewer: item.prompt,
    student: item.answer,
    scores: item.evaluation || {},
    feedback: item.feedback || '',
    real_world_tip: item.real_world_tip || '',
  }));

  const summary = await commAi.generateReport(history, category);
  const reportId = `CR-${new Date().toISOString().slice(0, 10)}-${uuidv4().slice(0, 3).toUpperCase()}`;

  const report = {
    session_id: sessionId,
    student_id: session.student_id,
    student_name: session.student_name || '',
    student_email: session.student_email || '',
    category,
    report_id: reportId,
    generated_date: new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: '2-digit', timeZone: 'UTC',
    }),
    overall: {
      total_score: totalScore,
      max_score: maxPossible,
      percentage: Number(percentage.toFixed(2)),
      grade,
      grade_label: label,
      metrics: avg,
    },
    exchange_breakdown: exchangeBreakdown,
    conversation_log,
    strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
    areas_to_improve: Array.isArray(summary.areas_to_improve) ? summary.areas_to_improve : [],
    tips: Array.isArray(summary.tips) ? summary.tips : [],
    category_insights: summary.category_insights || {},
    real_world_preparation: Array.isArray(summary.real_world_preparation) ? summary.real_world_preparation : [],
    competency_analysis: summary.competency_analysis || {},
  };

  await CommunicationReport.upsert(report);
  await CommunicationSession.update({ status: 'completed' }, { where: { session_id: sessionId } });

  res.json(report);
}));

// ── LiveKit voice session finalization ───────────────────────────────
// The voice UI streams the agent's per-turn evaluations to the browser, then
// POSTs them here to build the coaching report. session_id === room name.

function mapAgentExchanges(exchanges) {
  return (Array.isArray(exchanges) ? exchanges : []).map((ex) => {
    const ev = ex.evaluation || {};
    return {
      prompt: ex.eliciting_prompt || ex.prompt || '',
      answer: ex.transcript || ex.answer || '',
      evaluation: {
        clarity: Number(ev.clarity) || 0,
        structure: Number(ev.structure) || 0,
        conciseness: Number(ev.conciseness) || 0,
        relevance: Number(ev.relevance) || 0,
        confidence_tone: Number(ev.confidence_tone) || 0,
      },
      strengths: Array.isArray(ex.strengths) ? ex.strengths : [],
      improvements: Array.isArray(ex.improvements) ? ex.improvements : [],
      feedback: ex.feedback || '',
      real_world_tip: ex.real_world_tip || '',
    };
  });
}

router.post('/sessions/:id/finalize', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const session = await CommunicationSession.findOne({ where: { session_id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.student_id !== req.user._id) throw new HttpError(403, 'Not your session');

  const existing = await CommunicationReport.findOne({ where: { session_id: sessionId } });
  if (existing) return res.json({ status: 'COMPLETED', report_session_id: sessionId });

  const bodyExchanges = Array.isArray(req.body?.exchanges) ? req.body.exchanges : [];
  const history = mapAgentExchanges(bodyExchanges.length ? bodyExchanges : (session.history || []));
  const category = session.category || 'General';

  const metricKeys = ['clarity', 'structure', 'conciseness', 'relevance', 'confidence_tone'];
  const metricSums = Object.fromEntries(metricKeys.map((k) => [k, 0]));
  for (const item of history) {
    const ev = item.evaluation || {};
    for (const key of metricKeys) metricSums[key] += Number(ev[key] || 0);
  }
  const count = history.length || 1;
  const avg = Object.fromEntries(metricKeys.map((k) => [k, Number((metricSums[k] / count).toFixed(1))]));
  const totalScore = Object.values(metricSums).reduce((s, v) => s + v, 0);
  const maxPossible = (history.length || 1) * 50;
  const percentage = maxPossible ? (totalScore / maxPossible) * 100 : 0;
  let grade = 'F', label = 'Needs Improvement';
  if (percentage >= 85) { grade = 'A'; label = 'Excellent'; }
  else if (percentage >= 70) { grade = 'B'; label = 'Good'; }
  else if (percentage >= 55) { grade = 'C'; label = 'Average'; }
  else if (percentage >= 40) { grade = 'D'; label = 'Fair'; }

  const exchangeBreakdown = history.map((item, index) => ({
    number: index + 1,
    prompt: item.prompt,
    answer: item.answer,
    evaluation: item.evaluation,
    strengths: item.strengths,
    improvements: item.improvements,
    feedback: item.feedback,
    real_world_tip: item.real_world_tip,
  }));
  const conversation_log = history.map((item, index) => ({
    exchange: index + 1,
    interviewer: item.prompt,
    student: item.answer,
    scores: item.evaluation || {},
    feedback: item.feedback || '',
    real_world_tip: item.real_world_tip || '',
  }));

  let summary = {};
  if (history.length > 0) {
    try {
      summary = await commAi.generateReport(history, category);
    } catch (err) {
      console.error('Communication report generation failed:', err.message);
    }
  }

  const report = {
    session_id: sessionId,
    student_id: session.student_id,
    student_name: session.student_name || req.user.name || '',
    student_email: session.student_email || req.user.email || '',
    category,
    report_id: `CR-${new Date().toISOString().slice(0, 10)}-${uuidv4().slice(0, 3).toUpperCase()}`,
    generated_date: new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: '2-digit', timeZone: 'UTC',
    }),
    overall: {
      total_score: totalScore,
      max_score: maxPossible,
      percentage: Number(percentage.toFixed(2)),
      grade,
      grade_label: label,
      metrics: avg,
    },
    exchange_breakdown: exchangeBreakdown,
    conversation_log,
    strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
    areas_to_improve: Array.isArray(summary.areas_to_improve) ? summary.areas_to_improve : [],
    tips: Array.isArray(summary.tips) ? summary.tips : [],
    category_insights: summary.category_insights || {},
    real_world_preparation: Array.isArray(summary.real_world_preparation) ? summary.real_world_preparation : [],
    competency_analysis: summary.competency_analysis || {},
  };

  await CommunicationReport.upsert(report);
  await CommunicationSession.update(
    { status: 'completed', history, exchange_count: history.length },
    { where: { session_id: sessionId } },
  );

  res.json({ status: 'COMPLETED', report_session_id: sessionId });
}));

router.get('/sessions/:id/report-status', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const report = await CommunicationReport.findOne({
    where: { session_id: sessionId },
    attributes: ['session_id', 'student_id'],
  });
  if (report) {
    if (report.student_id !== req.user._id && !['admin', 'master_admin'].includes(req.user.role)) {
      throw new HttpError(403, 'Not your report');
    }
    return res.json({ status: 'COMPLETED', report_session_id: sessionId });
  }
  const session = await CommunicationSession.findOne({
    where: { session_id: sessionId },
    attributes: ['status'],
  });
  if (!session) return res.json({ status: 'FAILED', error: 'Session not found' });
  res.json({ status: 'PROCESSING' });
}));

router.get('/reports', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const reports = await CommunicationReport.findAll({
    where: ['admin', 'master_admin'].includes(req.user.role) ? {} : { student_id: req.user._id },
    attributes: [
      'session_id', 'report_id', 'generated_date', 'student_name',
      'student_email', 'category', 'overall', 'created_at',
    ],
    order: [['created_at', 'DESC']],
    limit: 100,
  });

  res.json({
    reports: reports.map((r) => ({
      session_id: r.session_id,
      report_id: r.report_id,
      generated_date: r.generated_date,
      student_name: r.student_name || '',
      student_email: r.student_email || '',
      category: r.category || '',
      grade: r.overall?.grade || '',
      percentage: r.overall?.percentage || 0,
      total_score: r.overall?.total_score || 0,
      max_score: r.overall?.max_score || 0,
      created_at: r.created_at,
    })),
  });
}));

const PERFORMANCE_LEVEL_MAP = {
  Excellent: 'Excellent',
  Good: 'Advanced',
  Average: 'Intermediate',
  Fair: 'Beginner',
  'Needs Improvement': 'Beginner',
};

const MODE_LABELS = {
  general: 'General',
  interview_prep: 'Interview Prep',
};

function avgEvaluation(evaluation = {}) {
  const values = Object.values(evaluation).map(Number).filter((n) => Number.isFinite(n));
  if (!values.length) return 0;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
}

// The report page (CommunicationReport.jsx) renders a richer schema than
// generateCommunicationReport produces. This maps the stored report onto it so
// existing and new reports both display without regenerating anything.
function toReportView(reportInstance, session) {
  const report = typeof reportInstance.toJSON === 'function' ? reportInstance.toJSON() : { ...reportInstance };
  const overall = report.overall || {};
  const metrics = overall.metrics || {};
  const breakdown = Array.isArray(report.exchange_breakdown) ? report.exchange_breakdown : [];
  const convo = Array.isArray(report.conversation_log) ? report.conversation_log : [];
  const insights = report.category_insights || {};

  let durationSeconds = 0;
  if (session?.created_at && session?.updated_at) {
    durationSeconds = Math.max(0, Math.round((new Date(session.updated_at) - new Date(session.created_at)) / 1000));
  }

  const overallScores = {};
  const communicationMetrics = {};
  for (const [key, value] of Object.entries(metrics)) {
    const score = Number(value) || 0;
    overallScores[key] = { score, label: '' };
    communicationMetrics[key] = { score };
  }

  const responseAnalysis = breakdown.map((item, idx) => ({
    exchange_number: item.number ?? idx + 1,
    analysis: item.feedback || '',
    strengths: Array.isArray(item.strengths) ? item.strengths : [],
    weaknesses: [],
    suggested_improvements: Array.isArray(item.improvements) ? item.improvements : [],
    communication_score: avgEvaluation(item.evaluation),
  }));

  const transcript = convo.map((item, idx) => ({
    exchange: item.exchange ?? idx + 1,
    coach: item.interviewer || '',
    student: item.student || '',
  }));

  const totalTurns = breakdown.length || convo.length;

  return {
    ...report,
    session_summary: {
      communication_mode: MODE_LABELS[session?.context] || session?.context || 'N/A',
      scenario: report.category || 'N/A',
      duration: durationSeconds,
      total_turns: totalTurns,
      overall_communication_score: Number(overall.percentage) || 0,
      performance_level: PERFORMANCE_LEVEL_MAP[overall.grade_label] || 'Beginner',
    },
    overall_scores: overallScores,
    communication_metrics: communicationMetrics,
    response_analysis: responseAnalysis,
    transcript,
    overall_feedback: [insights.category_mastery, insights.key_takeaway].filter(Boolean).join('\n\n'),
    final_remarks: insights.recommended_focus || '',
  };
}

router.get('/reports/:session_id', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const report = await CommunicationReport.findOne({
    where: { session_id: req.params.session_id },
    attributes: { exclude: ['_id'] },
  });
  if (!report) throw new HttpError(404, 'Report not found');
  if (!['admin', 'master_admin'].includes(req.user.role) && report.student_id !== req.user._id) {
    throw new HttpError(403, 'Not your report');
  }
  const session = await CommunicationSession.findOne({ where: { session_id: req.params.session_id } });
  res.json(toReportView(report, session));
}));

router.get('/categories', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  res.json({ categories: COMMUNICATION_CATEGORIES });
}));

export default router;
