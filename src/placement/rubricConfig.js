/**
 * Rubric Configuration Layer (Section 3)
 *
 * Maps interview blueprints to competencies and defines metric weights
 * for computing competency scores from raw AI evaluation data.
 *
 * Each rubric entry defines:
 *   - competency: which of the 7 standard competencies this maps to
 *   - metricWeights: how to weight the raw AI evaluation metrics
 *   - scoreSource: which field(s) to use from the evaluation
 *   - normalizeFrom: the max scale of the input (default 10)
 *
 * This is the "configurable rubric" layer that allows different
 * interviews to use different evaluation approaches.
 */

const COMPETENCY_RUBRICS = {
  technical_knowledge: {
    competency: 'technical_knowledge',
    metricWeights: { knowledge: 0.7, skill_relevance: 0.3 },
    description: 'Weighted average of knowledge (70%) and skill relevance (30%) from technical questions.',
    appliesToBlueprintCategories: ['Foundation', 'Skill Development', 'Placement Ready'],
    focusAreaKeywords: ['technical', 'system', 'coding', 'domain', 'industry'],
  },

  aptitude: {
    competency: 'aptitude',
    metricWeights: { knowledge: 0.5, skill_relevance: 0.5 },
    description: 'Weighted average of quantitative aptitude and logical reasoning questions.',
    appliesToBlueprintCategories: ['Foundation', 'Skill Development', 'Placement Ready'],
    focusAreaKeywords: ['aptitude', 'logical', 'reasoning', 'analytical', 'quantitative'],
  },

  problem_solving: {
    competency: 'problem_solving',
    metricWeights: { skill_relevance: 0.6, knowledge: 0.4 },
    description: 'Weighted average of skill relevance (60%) and knowledge (40%) from problem-solving questions.',
    appliesToBlueprintCategories: ['Foundation', 'Professional', 'Advanced', 'Expert'],
    focusAreaKeywords: ['problem', 'design', 'decomposition', 'real world'],
  },

  communication: {
    competency: 'communication',
    metricWeights: { clarity: 0.25, structure: 0.20, conciseness: 0.20, relevance: 0.20, confidence_tone: 0.15 },
    description: 'From CommunicationReport: clarity (25%), structure (20%), conciseness (20%), relevance (20%), confidence_tone (15%). Falls back to interview fluency if no report exists.',
    fallbackMetricWeights: { fluency: 1.0 },
    fallbackDescription: 'Fallback from interviews: fluency score.',
    appliesToBlueprintCategories: ['Expert', 'Mentor'],
    focusAreaKeywords: ['communication', 'negotiation', 'presentation'],
  },

  project_knowledge: {
    competency: 'project_knowledge',
    metricWeights: { knowledge: 0.6, skill_relevance: 0.4 },
    description: 'Weighted average of knowledge (60%) and skill relevance (40%) from project-related questions.',
    appliesToBlueprintCategories: ['Foundation'],
    focusAreaKeywords: ['project', 'portfolio'],
  },

  behavioral_skills: {
    competency: 'behavioral_skills',
    metricWeights: { confidence: 0.6, body_language: 0.4 },
    description: 'Weighted average of confidence (60%) and body language (40%) from behavioral questions. Falls back to all-question confidence average.',
    fallbackMetricWeights: { confidence: 1.0 },
    fallbackDescription: 'Fallback: average confidence across all interview questions.',
    appliesToBlueprintCategories: ['Professional', 'Advanced', 'Expert'],
    focusAreaKeywords: ['behavioral', 'stress', 'cultural', 'leadership', 'ethics', 'integrity'],
  },

  resume_profile: {
    competency: 'resume_profile',
    metricWeights: { ats_score: 1.0 },
    description: 'Direct ATS score from resume analysis (0-100 scale).',
    appliesToBlueprintCategories: ['Foundation'],
    focusAreaKeywords: ['resume'],
  },

  interview_performance: {
    competency: 'interview_performance',
    metricWeights: { fluency: 0.4, body_language: 0.3, blueprint_score: 0.3 },
    description: 'Weighted average of fluency (40%), body language (30%), and blueprint score (30%). Falls back to fluency + body language if no blueprint score.',
    fallbackMetricWeights: { fluency: 0.6, body_language: 0.4 },
    fallbackDescription: 'Fallback without blueprint: fluency (60%) + body language (40%).',
    appliesToBlueprintCategories: ['Foundation', 'Professional', 'Advanced', 'Expert', 'Mentor', 'Placement'],
    focusAreaKeywords: [],
  },
};

const VALID_SCORE_RANGES = {
  confidence: { min: 0, max: 10 },
  body_language: { min: 0, max: 10 },
  knowledge: { min: 0, max: 10 },
  fluency: { min: 0, max: 10 },
  skill_relevance: { min: 0, max: 10 },
  blueprint_score: { min: 0, max: 10 },
};

function getRubricForCompetency(competency) {
  return COMPETENCY_RUBRICS[competency] || null;
}

function getAllRubrics() {
  return { ...COMPETENCY_RUBRICS };
}

function getRubricForBlueprint(interviewNumber, blueprintCategory, focusAreas = []) {
  const areas = focusAreas.map(a => a.toLowerCase());
  const cat = (blueprintCategory || '').toLowerCase();

  for (const [, rubric] of Object.entries(COMPETENCY_RUBRICS)) {
    const categoryMatch = rubric.appliesToBlueprintCategories.some(
      c => c.toLowerCase() === cat
    );
    if (!categoryMatch) continue;

    if (rubric.focusAreaKeywords.length === 0) return rubric;
    if (areas.some(a => rubric.focusAreaKeywords.some(kw => a.includes(kw)))) {
      return rubric;
    }
  }

  return COMPETENCY_RUBRICS.technical_knowledge;
}

export {
  COMPETENCY_RUBRICS,
  VALID_SCORE_RANGES,
  getRubricForCompetency,
  getAllRubrics,
  getRubricForBlueprint,
};
