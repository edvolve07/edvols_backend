/**
 * Placement Scoring Engine
 * 
 * Deterministic, reproducible scoring system for student placement readiness.
 * All calculations are formula-based — no LLM involvement in final scores.
 * 
 * Architecture:
 *   Interview data → Competency scores → Weighted overall → Classification
 * 
 * Scoring Engine Version: 1.0
 */

import { activeScoringConfig } from './scoringContext.js';
const COMPETENCIES = [
  'technical_knowledge',
  'aptitude',
  'communication',
  'problem_solving',
  'interview_performance',
  'resume_profile',
  'behavioral_skills',
];

const DEFAULT_COMPETENCY_WEIGHTS = {
  technical_knowledge: 0.20,
  aptitude: 0.15,
  communication: 0.15,
  problem_solving: 0.15,
  interview_performance: 0.15,
  resume_profile: 0.10,
  behavioral_skills: 0.10,
};

const DEFAULT_READINESS_BANDS = {
  PLACEMENT_READY: { min: 85, max: 100 },
  INTERVIEW_READY: { min: 75, max: 84.99 },
  DEVELOPMENT_REQUIRED: { min: 60, max: 74.99 },
  HIGH_INTERVENTION: { min: 0, max: 59.99 },
};

const DEFAULT_CONFIDENCE_THRESHOLDS = {
  HIGH: { minInterviews: 4, minQuestions: 8 },
  MEDIUM: { minInterviews: 2, minQuestions: 4 },
  LOW: { minInterviews: 1, minQuestions: 1 },
};

const DEFAULT_SEGMENTATION_THRESHOLDS = {
  STRONG: 75,
  MODERATE: 60,
  NEEDS_IMPROVEMENT: 0,
};

const DEFAULT_TALENT_CRITERIA = {
  overall_readiness: 80,
  technical_knowledge: 75,
  aptitude: 70,
  communication: 70,
  problem_solving: 70,
  interview_performance: 75,
  behavioral_skills: 70,
};

function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function round2(val) {
  return Math.round(val * 100) / 100;
}

export function getEffectiveWeights(customWeights) {
  const cfg = activeScoringConfig();
  const w = customWeights || cfg?.competency_weights;
  return (w && typeof w === 'object' && Object.keys(w).length > 0) ? w : DEFAULT_COMPETENCY_WEIGHTS;
}

export function getEffectiveBands(customBands) {
  const cfg = activeScoringConfig();
  const b = customBands || cfg?.readiness_bands;
  return (b && b.PLACEMENT_READY && b.PLACEMENT_READY.min != null) ? b : DEFAULT_READINESS_BANDS;
}

export function getEffectiveTalentCriteria(customCriteria) {
  const cfg = activeScoringConfig();
  const c = customCriteria || cfg?.talent_criteria;
  return (c && typeof c === 'object' && Object.keys(c).length > 0 && c.overall_readiness != null) ? c : DEFAULT_TALENT_CRITERIA;
}

export function getEffectiveSegmentation(customThresholds) {
  const cfg = activeScoringConfig();
  const t = customThresholds || cfg?.segmentation_thresholds;
  return (t && typeof t === 'object' && t.STRONG != null) ? t : DEFAULT_SEGMENTATION_THRESHOLDS;
}

/**
 * Map existing interview metrics to a competency category based on question context.
 * 
 * The existing system evaluates each question with:
 *   confidence (0-10), body_language (0-10), knowledge (0-10), 
 *   fluency (0-10), skill_relevance (0-10), blueprint_score (0-10)
 * 
 * We map these to the 7 standardized competencies using the question's
 * interview context (blueprint category, focus areas, etc.)
 */
function categorizeQuestion(blueprintCategory, focusAreas = []) {
  const areas = (focusAreas || []).map(a => String(a).toLowerCase());
  const cat = (blueprintCategory || '').toLowerCase();

  if (areas.some(a => a.includes('aptitude') || a.includes('quantitative') || a.includes('logical') || a.includes('reasoning') || a.includes('analytical'))) {
    return 'aptitude';
  }
  if (areas.some(a => a.includes('project') || a.includes('portfolio'))) {
    return 'project_knowledge';
  }
  if (areas.some(a => a.includes('technical') || a.includes('system') || a.includes('coding') || a.includes('algorithm') || a.includes('data structure') || a.includes('programming') || a.includes('architecture'))) {
    return 'technical_knowledge';
  }
  if (areas.some(a => a.includes('problem') || a.includes('design') || a.includes('decomposition') || a.includes('tradeoff'))) {
    return 'problem_solving';
  }
  if (areas.some(a => a.includes('behavioral') || a.includes('stress') || a.includes('cultural') || a.includes('leadership') || a.includes('hr') || a.includes('culture') || a.includes('star'))) {
    return 'behavioral_skills';
  }
  if (areas.some(a => a.includes('communication') || a.includes('negotiation') || a.includes('articulation') || a.includes('presentation'))) {
    return 'communication';
  }
  if (areas.some(a => a.includes('resume') || a.includes('claim'))) {
    return 'resume_profile';
  }
  if (areas.some(a => a.includes('mock') || a.includes('simulation') || a.includes('interview'))) {
    return 'interview_performance';
  }

  const title = (blueprintCategory || '').toLowerCase();
  if (title.includes('aptitude') || title.includes('logical') || title.includes('reasoning')) return 'aptitude';
  if (title.includes('project') || title.includes('portfolio')) return 'project_knowledge';
  if (title.includes('technical') || title.includes('domain') || title.includes('coding')) return 'technical_knowledge';
  if (title.includes('problem') || title.includes('design') || title.includes('system')) return 'problem_solving';
  if (title.includes('behavioral') || title.includes('cultural') || title.includes('stress') || title.includes('hr')) return 'behavioral_skills';
  if (title.includes('communication') || title.includes('negotiation')) return 'communication';
  if (title.includes('resume') || title.includes('claim')) return 'resume_profile';
  if (title.includes('mock') || title.includes('simulation') || title.includes('placement')) return 'interview_performance';

  return 'technical_knowledge';
}

/**
 * Normalize a 0-10 metric to 0-100.
 */
function normalizeTo100(value, maxScale = 10) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return clamp((num / maxScale) * 100, 0, 100);
}

/**
 * Compute a single competency score from all relevant interview data.
 * 
 * @param {string} competency - The competency to score
 * @param {Array} interviewHistory - Flattened array of {evaluation, session_category, ...}
 * @param {Object|null} communicationReport - Latest CommunicationReport.overall
 * @param {Object|null} resumeAnalysis - Latest ResumeVersion.ats_analysis
 * @returns {{ score: number, confidence: string, dataPoints: number, evidence: string[] }}
 */
function computeCompetency(competency, interviewHistory, communicationReport, resumeAnalysis) {
  const evidence = [];
  let score = 0;
  let dataPoints = 0;

  switch (competency) {
    case 'technical_knowledge': {
      const techQuestions = interviewHistory.filter(h =>
        h.category === 'technical_knowledge' || h.category === 'project_knowledge'
      );
      if (techQuestions.length === 0) break;
      dataPoints = techQuestions.length;
      const knowledgeScores = techQuestions.map(h => normalizeTo100(h.evaluation?.knowledge || 0));
      const skillScores = techQuestions.map(h => normalizeTo100(h.evaluation?.skill_relevance || 0));
      score = round2(avg(knowledgeScores) * 0.7 + avg(skillScores) * 0.3);
      evidence.push(`Technical knowledge: avg knowledge=${avg(knowledgeScores).toFixed(1)}/100, skill_relevance=${avg(skillScores).toFixed(1)}/100 across ${dataPoints} questions`);
      break;
    }

    case 'aptitude': {
      const aptQuestions = interviewHistory.filter(h =>
        h.category === 'aptitude' || (h.focus_areas && h.focus_areas.some(f => {
          const fl = String(f).toLowerCase();
          return fl.includes('aptitude') || fl.includes('logical') || fl.includes('reasoning') || fl.includes('analytical');
        }))
      );
      if (aptQuestions.length > 0) {
        dataPoints = aptQuestions.length;
        const knScores = aptQuestions.map(h => normalizeTo100(h.evaluation?.knowledge || 0));
        const srScores = aptQuestions.map(h => normalizeTo100(h.evaluation?.skill_relevance || 0));
        score = round2(avg(knScores) * 0.5 + avg(srScores) * 0.5);
        evidence.push(`Aptitude: avg knowledge=${avg(knScores).toFixed(1)}/100, skill_relevance=${avg(srScores).toFixed(1)}/100 across ${dataPoints} questions`);
      } else if (interviewHistory.length > 0) {
        const baseQuestions = interviewHistory.slice(0, 10);
        dataPoints = baseQuestions.length;
        const knScores = baseQuestions.map(h => normalizeTo100(h.evaluation?.knowledge || 0));
        score = round2(avg(knScores));
        evidence.push(`Aptitude (baseline from foundational performance): ${score}/100 across ${dataPoints} questions`);
      }
      break;
    }

    case 'problem_solving': {
      const psQuestions = interviewHistory.filter(h =>
        h.category === 'problem_solving'
      );
      if (psQuestions.length === 0) break;
      dataPoints = psQuestions.length;
      const srScores = psQuestions.map(h => normalizeTo100(h.evaluation?.skill_relevance || 0));
      const knScores = psQuestions.map(h => normalizeTo100(h.evaluation?.knowledge || 0));
      score = round2(avg(srScores) * 0.6 + avg(knScores) * 0.4);
      evidence.push(`Problem solving: avg skill_relevance=${avg(srScores).toFixed(1)}/100, knowledge=${avg(knScores).toFixed(1)}/100 across ${dataPoints} questions`);
      break;
    }

    case 'communication': {
      if (communicationReport) {
        dataPoints = 1;
        const clarity = normalizeTo100(communicationReport.clarity || 0);
        const structure = normalizeTo100(communicationReport.structure || 0);
        const conciseness = normalizeTo100(communicationReport.conciseness || 0);
        const relevance = normalizeTo100(communicationReport.relevance || 0);
        const tone = normalizeTo100(communicationReport.confidence_tone || 0);
        score = round2(avg([clarity, structure, conciseness, relevance, tone]));
        evidence.push(`Communication: clarity=${clarity.toFixed(1)}, structure=${structure.toFixed(1)}, conciseness=${conciseness.toFixed(1)}, relevance=${relevance.toFixed(1)}, tone=${tone.toFixed(1)}`);
      } else {
        const commQuestions = interviewHistory.filter(h => h.category === 'communication');
        if (commQuestions.length === 0) break;
        dataPoints = commQuestions.length;
        const fluScores = commQuestions.map(h => normalizeTo100(h.evaluation?.fluency || 0));
        score = round2(avg(fluScores));
        evidence.push(`Communication (from interviews): avg fluency=${avg(fluScores).toFixed(1)}/100 across ${dataPoints} questions`);
      }
      break;
    }

    case 'project_knowledge': {
      const projQuestions = interviewHistory.filter(h => h.category === 'project_knowledge');
      if (projQuestions.length === 0) break;
      dataPoints = projQuestions.length;
      const knScores = projQuestions.map(h => normalizeTo100(h.evaluation?.knowledge || 0));
      const srScores = projQuestions.map(h => normalizeTo100(h.evaluation?.skill_relevance || 0));
      score = round2(avg(knScores) * 0.6 + avg(srScores) * 0.4);
      evidence.push(`Project knowledge: avg knowledge=${avg(knScores).toFixed(1)}/100, skill_relevance=${avg(srScores).toFixed(1)}/100 across ${dataPoints} questions`);
      break;
    }

    case 'behavioral_skills': {
      const bhQuestions = interviewHistory.filter(h => h.category === 'behavioral_skills');
      if (bhQuestions.length > 0) {
        dataPoints = bhQuestions.length;
        const confScores = bhQuestions.map(h => normalizeTo100(h.evaluation?.confidence || 0));
        const blScores = bhQuestions.map(h => normalizeTo100(h.evaluation?.body_language || 0));
        score = round2(avg(confScores) * 0.6 + avg(blScores) * 0.4);
        evidence.push(`Behavioral: avg confidence=${avg(confScores).toFixed(1)}/100, body_language=${avg(blScores).toFixed(1)}/100 across ${dataPoints} questions`);
      } else if (interviewHistory.length > 0) {
        dataPoints = interviewHistory.length;
        const confScores = interviewHistory.map(h => normalizeTo100(h.evaluation?.confidence || 0));
        score = round2(avg(confScores));
        evidence.push(`Behavioral (fallback from all interviews): avg confidence=${avg(confScores).toFixed(1)}/100 across ${dataPoints} questions`);
      }
      break;
    }

    case 'resume_profile': {
      if (resumeAnalysis && resumeAnalysis.ats_score != null) {
        dataPoints = 1;
        score = round2(clamp(resumeAnalysis.ats_score, 0, 100));
        evidence.push(`Resume ATS score: ${score}/100`);
      }
      break;
    }

    case 'interview_performance': {
      if (interviewHistory.length === 0) break;
      dataPoints = interviewHistory.length;
      const fluScores = interviewHistory.map(h => normalizeTo100(h.evaluation?.fluency || 0));
      const blScores = interviewHistory.map(h => normalizeTo100(h.evaluation?.body_language || 0));
      const bpScores = interviewHistory.filter(h => h.evaluation?.blueprint_score != null)
        .map(h => normalizeTo100(h.evaluation.blueprint_score));
      if (bpScores.length > 0) {
        score = round2(avg(fluScores) * 0.4 + avg(blScores) * 0.3 + avg(bpScores) * 0.3);
        evidence.push(`Interview performance: fluency=${avg(fluScores).toFixed(1)}, body_language=${avg(blScores).toFixed(1)}, blueprint=${avg(bpScores).toFixed(1)}`);
      } else {
        score = round2(avg(fluScores) * 0.6 + avg(blScores) * 0.4);
        evidence.push(`Interview performance: fluency=${avg(fluScores).toFixed(1)}, body_language=${avg(blScores).toFixed(1)}`);
      }
      break;
    }
  }

  const confidence = computeConfidence(dataPoints, interviewHistory);

  return { score, confidence, dataPoints, evidence };
}

/**
 * Compute confidence level based on data volume and recency.
 */
function computeConfidence(dataPoints, interviewHistory) {
  if (dataPoints === 0) return 'INSUFFICIENT';
  const configured = activeScoringConfig()?.confidence_thresholds;
  if (configured && typeof configured === 'object' && Object.keys(configured).length) {
    const interviews = new Set(interviewHistory.map(h => h.session_id).filter(Boolean)).size;
    for (const level of ['HIGH', 'MEDIUM', 'LOW']) {
      const threshold = configured[level];
      if (threshold && threshold.minQuestions != null && threshold.minInterviews != null && dataPoints >= threshold.minQuestions && interviews >= threshold.minInterviews) return level;
    }
    return 'LOW';
  }

  const now = Date.now();
  const dates = interviewHistory
    .map(h => h.timestamp ? new Date(h.timestamp).getTime() : null)
    .filter(Boolean);
  const latestDate = dates.length > 0 ? Math.max(...dates) : 0;
  const daysSinceLatest = latestDate > 0 ? (now - latestDate) / (1000 * 60 * 60 * 24) : 999;

  if (dataPoints >= 4 && daysSinceLatest < 90) return 'HIGH';
  if (dataPoints >= 2 && daysSinceLatest < 60) return 'HIGH';
  if (dataPoints >= 2) return 'MEDIUM';
  if (dataPoints >= 1 && daysSinceLatest < 60) return 'MEDIUM';
  return 'LOW';
}

/**
 * Compute weighted overall placement readiness score.
 * 
 * Only competencies with data contribute. Weights are renormalized
 * so missing competencies don't drag down the score artificially.
 */
function computeOverallReadiness(competencies, weights = null) {
  const effectiveWeights = getEffectiveWeights(weights);
  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown = [];

  for (const comp of COMPETENCIES) {
    const data = competencies[comp];
    const w = effectiveWeights[comp] || 0;
    if (!data || data.confidence === 'INSUFFICIENT' || data.dataPoints === 0) {
      breakdown.push({ competency: comp, weight: w, normalizedWeight: 0, score: 0, contribution: 0 });
      continue;
    }
    weightedSum += data.score * w;
    totalWeight += w;
    breakdown.push({ competency: comp, weight: w, normalizedWeight: 0, score: data.score, contribution: data.score * w });
  }

  const overall = totalWeight > 0 ? round2(weightedSum / totalWeight) : 0;

  // Update normalized weights in breakdown
  for (const b of breakdown) {
    const assessed = competencies[b.competency]?.dataPoints > 0 && competencies[b.competency]?.confidence !== 'INSUFFICIENT';
    b.normalizedWeight = totalWeight > 0 && assessed ? round2(b.weight / totalWeight) : 0;
  }

  return { overall, totalWeight, breakdown };
}

/**
 * Classify readiness into a band based on configurable thresholds.
 */
function classifyReadiness(score, bands = null) {
  const effectiveBands = getEffectiveBands(bands);
  if (score >= effectiveBands.PLACEMENT_READY.min) return 'PLACEMENT_READY';
  if (score >= effectiveBands.INTERVIEW_READY.min) return 'INTERVIEW_READY';
  if (score >= effectiveBands.DEVELOPMENT_REQUIRED.min) return 'DEVELOPMENT_REQUIRED';
  return 'HIGH_INTERVENTION';
}

/**
 * Compute overall assessment confidence from individual competency confidences.
 */
function computeAssessmentConfidence(competencies) {
  const confidences = COMPETENCIES.map(c => competencies[c]?.confidence || 'INSUFFICIENT');
  const highCount = confidences.filter(c => c === 'HIGH').length;
  const mediumCount = confidences.filter(c => c === 'MEDIUM').length;
  const lowCount = confidences.filter(c => c === 'LOW').length;
  const insuffCount = confidences.filter(c => c === 'INSUFFICIENT').length;

  if (insuffCount >= 5) return 'INSUFFICIENT';
  if (highCount >= 4) return 'HIGH';
  if (highCount >= 2 && mediumCount >= 2) return 'HIGH';
  if (highCount >= 2 || mediumCount >= 3) return 'MEDIUM';
  if (lowCount >= 3) return 'LOW';
  return 'MEDIUM';
}

/**
 * Identify skill gaps for a student.
 */
function identifySkillGaps(competencies) {
  const gaps = [];
  for (const comp of COMPETENCIES) {
    const data = competencies[comp];
    if (!data || data.confidence === 'INSUFFICIENT' || data.dataPoints === 0) continue;
    if (data.score < 70) {
      gaps.push({
        competency: comp,
        score: data.score,
        targetScore: 70,
        gap: round2(70 - data.score),
        priority: data.score < 50 ? 'HIGH' : 'MODERATE',
      });
    }
  }
  return gaps.sort((a, b) => b.gap - a.gap);
}

/**
 * Identify strengths for a student.
 */
function identifyStrengths(competencies) {
  const strengths = [];
  for (const comp of COMPETENCIES) {
    const data = competencies[comp];
    if (!data || data.confidence === 'INSUFFICIENT' || data.dataPoints === 0) continue;
    if (data.score >= 75) {
      strengths.push({
        competency: comp,
        score: data.score,
        confidence: data.confidence,
      });
    }
  }
  return strengths.sort((a, b) => b.score - a.score);
}

/**
 * Classify a student into segments based on competency scores.
 */
function classifyStudentSegment(competencies, thresholds = null) {
  const effectiveThresholds = getEffectiveSegmentation(thresholds);
  const segments = [];
  const scores = {};
  for (const comp of COMPETENCIES) {
    const data = competencies[comp];
    if (data && data.confidence !== 'INSUFFICIENT' && data.dataPoints > 0) {
      scores[comp] = data.score;
    }
  }

  if (Object.keys(scores).length === 0) return ['UNASSESSED'];

  const strong = Object.entries(scores).filter(([_, s]) => s >= effectiveThresholds.STRONG);
  const moderate = Object.entries(scores).filter(([_, s]) =>
    s >= effectiveThresholds.MODERATE && s < effectiveThresholds.STRONG
  );
  const weak = Object.entries(scores).filter(([_, s]) => s < effectiveThresholds.MODERATE);

  if (strong.length >= 5 && weak.length === 0) segments.push('STRONG_OVERALL');
  if (weak.length >= 3) segments.push('MULTIPLE_SKILL_GAPS');

  const techScore = scores.technical_knowledge;
  const commScore = scores.communication;
  const psScore = scores.problem_solving;
  const projScore = scores.project_knowledge;
  const bhScore = scores.behavioral_skills;

  if (techScore != null && techScore >= effectiveThresholds.STRONG && commScore != null && commScore < effectiveThresholds.MODERATE) {
    segments.push('TECHNICAL_STRONG_COMMUNICATION_WEAK');
  }
  if (commScore != null && commScore >= effectiveThresholds.STRONG && techScore != null && techScore < effectiveThresholds.MODERATE) {
    segments.push('COMMUNICATION_STRONG_TECHNICAL_WEAK');
  }
  if (techScore != null && techScore >= effectiveThresholds.STRONG && psScore != null && psScore < effectiveThresholds.MODERATE) {
    segments.push('TECHNICAL_STRONG_PROBLEM_SOLVING_WEAK');
  }
  if (projScore != null && projScore >= effectiveThresholds.STRONG && techScore != null && techScore < effectiveThresholds.MODERATE) {
    segments.push('PROJECT_STRONG_TECHNICAL_WEAK');
  }
  if (strong.length >= 4 && bhScore != null && bhScore < effectiveThresholds.MODERATE) {
    segments.push('STRONG_OVERALL_BEHAVIORAL_WEAK');
  }

  return segments.length > 0 ? segments : ['BALANCED'];
}

/**
 * Check if student meets interview-ready/talent criteria.
 */
function meetsTalentCriteria(competencies, overallReadiness, criteria = null) {
  const effectiveCriteria = getEffectiveTalentCriteria(criteria);
  if (overallReadiness < (effectiveCriteria.overall_readiness ?? 80)) return false;
  for (const [comp, threshold] of Object.entries(effectiveCriteria)) {
    if (comp === 'overall_readiness') continue;
    const data = competencies[comp];
    if (!data || data.confidence === 'INSUFFICIENT' || data.dataPoints === 0) return false;
    if (data.score < threshold) return false;
  }
  return true;
}

/**
 * Generate training/intervention recommendations based on competency scores and gaps.
 */
function generateRecommendations(competencies, gaps) {
  const recommendations = [];

  for (const gap of gaps) {
    const comp = gap.competency;
    switch (comp) {
      case 'technical_knowledge':
        recommendations.push({
          area: 'Technical Knowledge',
          priority: gap.priority,
          suggestion: 'Focus on strengthening core technical concepts through targeted practice interviews and coding exercises.',
          targetImprovement: gap.gap,
        });
        break;
      case 'aptitude':
        recommendations.push({
          area: 'Aptitude & Reasoning',
          priority: gap.priority,
          suggestion: 'Practice quantitative aptitude and logical reasoning questions to improve analytical speed and problem formulation.',
          targetImprovement: gap.gap,
        });
        break;
      case 'problem_solving':
        recommendations.push({
          area: 'Problem Solving',
          priority: gap.priority,
          suggestion: 'Practice structured problem-solving approaches. Work through case studies and system design questions.',
          targetImprovement: gap.gap,
        });
        break;
      case 'communication':
        recommendations.push({
          area: 'Communication',
          priority: gap.priority,
          suggestion: 'Practice clear and structured communication. Focus on articulating thoughts concisely and confidently.',
          targetImprovement: gap.gap,
        });
        break;
      case 'project_knowledge':
        recommendations.push({
          area: 'Project Knowledge',
          priority: gap.priority,
          suggestion: 'Deepen understanding of project architecture, technical decisions, and implementation details.',
          targetImprovement: gap.gap,
        });
        break;
      case 'behavioral_skills':
        recommendations.push({
          area: 'Behavioral Skills',
          priority: gap.priority,
          suggestion: 'Practice behavioral interview questions using STAR method. Build self-awareness and professional judgment.',
          targetImprovement: gap.gap,
        });
        break;
      case 'resume_profile':
        recommendations.push({
          area: 'Resume/Profile',
          priority: gap.priority,
          suggestion: 'Improve resume content and formatting. Ensure skills, experience, and projects are well-highlighted.',
          targetImprovement: gap.gap,
        });
        break;
      case 'interview_performance':
        recommendations.push({
          area: 'Interview Performance',
          priority: gap.priority,
          suggestion: 'Practice mock interviews to improve fluency, body language, and overall presentation.',
          targetImprovement: gap.gap,
        });
        break;
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MODERATE: 1 };
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  });
}

/**
 * Compute batch-level analytics from an array of student competency profiles.
 */
function computeBatchAnalytics(profiles) {
  if (profiles.length === 0) {
    return {
      studentCount: 0,
      assessedCount: 0,
      avgReadiness: 0,
      distribution: { PLACEMENT_READY: 0, INTERVIEW_READY: 0, DEVELOPMENT_REQUIRED: 0, HIGH_INTERVENTION: 0 },
      competencyAverages: {},
      skillGaps: [],
    };
  }

  const assessed = profiles.filter(p => (p.readinessBand || p.readiness_band) !== 'UNASSESSED');
  const readinessScores = assessed.map(p => p.overallReadiness ?? p.overall_placement_score).filter(Number.isFinite);
  const avgReadiness = round2(avg(readinessScores));

  const distribution = { PLACEMENT_READY: 0, INTERVIEW_READY: 0, DEVELOPMENT_REQUIRED: 0, HIGH_INTERVENTION: 0 };
  for (const p of assessed) {
    const band = p.readinessBand || p.readiness_band;
    if (distribution[band] !== undefined) {
      distribution[band]++;
    }
  }

  const competencyTotals = {};
  const competencyCounts = {};
  for (const comp of COMPETENCIES) {
    competencyTotals[comp] = 0;
    competencyCounts[comp] = 0;
  }

  for (const p of assessed) {
    for (const comp of COMPETENCIES) {
      const data = p.competencies?.[comp];
      if (data && data.confidence !== 'INSUFFICIENT' && data.dataPoints > 0) {
        competencyTotals[comp] += data.score;
        competencyCounts[comp]++;
      }
    }
  }

  const competencyAverages = {};
  const gapList = [];
  for (const comp of COMPETENCIES) {
    const count = competencyCounts[comp];
    const avgScore = count > 0 ? round2(competencyTotals[comp] / count) : 0;
    competencyAverages[comp] = { average: avgScore, studentCount: count };
    if (avgScore < 70 && count > 0) {
      gapList.push({ competency: comp, averageScore: avgScore, gap: round2(70 - avgScore) });
    }
  }

  gapList.sort((a, b) => b.gap - a.gap);

  return {
    studentCount: profiles.length,
    assessedCount: assessed.length,
    avgReadiness,
    averageReadiness: avgReadiness,
    distribution,
    competencyAverages,
    skillGaps: gapList,
  };
}

/**
 * Compute department-level analytics.
 */
function computeDepartmentAnalytics(profiles, departments) {
  const deptMap = {};
  for (const dept of departments) {
    deptMap[dept._id] = { name: dept.name, profiles: [] };
  }

  for (const p of profiles) {
    const deptId = p.departmentId || p.department_id;
    if (deptId && deptMap[deptId]) {
      deptMap[deptId].profiles.push(p);
    }
  }

  const result = [];
  for (const [deptId, dept] of Object.entries(deptMap)) {
    const analytics = computeBatchAnalytics(dept.profiles);
    result.push({
      departmentId: deptId,
      departmentName: dept.name,
      ...analytics,
    });
  }

  return result;
}

/**
 * Filter students by competency criteria (for company-specific filtering).
 */
function filterStudentsByCriteria(profiles, criteria) {
  return profiles.filter(profile => {
    const readiness = profile.overallReadiness || profile.overall_placement_score || 0;
    const minReadiness = criteria.minReadiness ?? criteria.overall_readiness ?? 0;
    if (readiness < minReadiness) return false;

    const comps = criteria.competencies || criteria;
    for (const [comp, threshold] of Object.entries(comps)) {
      if (['minReadiness', 'overall_readiness', 'competencies'].includes(comp)) continue;
      const data = profile.competencies?.[comp];
      const score = typeof data === 'number' ? data : (data?.score ?? 0);
      if (score < threshold) return false;
    }
    return true;
  });
}

/**
 * Generate full scoring explanation (audit trail).
 */
function generateScoringExplanation(competencies, overallResult, readinessBand, assessmentConfidence) {
  return {
    competencies: COMPETENCIES.map(comp => {
      const data = competencies[comp] || {};
      return {
        name: comp,
        score: data.score || 0,
        confidence: data.confidence || 'INSUFFICIENT',
        dataPoints: data.dataPoints || 0,
        evidence: data.evidence || [],
      };
    }),
    overallScore: overallResult.overall,
    weightBreakdown: overallResult.breakdown,
    readinessBand,
    assessmentConfidence,
    scoringEngineVersion: activeScoringConfig().version || '1.0',
    calculatedAt: new Date().toISOString(),
  };
}

export {
  COMPETENCIES,
  DEFAULT_COMPETENCY_WEIGHTS,
  DEFAULT_READINESS_BANDS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  DEFAULT_SEGMENTATION_THRESHOLDS,
  DEFAULT_TALENT_CRITERIA,
  avg,
  clamp,
  round2,
  normalizeTo100,
  categorizeQuestion,
  computeCompetency,
  computeConfidence,
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
};
