/**
 * AI Response Validation (Section 4)
 *
 * Validates AI-generated evaluation responses for anomalies, outliers,
 * and format errors before they enter the scoring engine.
 *
 * Validation layers:
 *   1. Schema validation: required fields, correct types
 *   2. Range validation: scores within 0-10
 *   3. Anomaly detection: suspicious patterns
 *   4. Consistency checks: score variance
 */

import { VALID_SCORE_RANGES } from './rubricConfig.js';

const EVALUATION_FIELDS = ['confidence', 'body_language', 'knowledge', 'fluency', 'skill_relevance'];
const BLUEPRINT_FIELDS = [...EVALUATION_FIELDS, 'blueprint_score'];

/**
 * Validate a single evaluation response.
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */
function validateEvaluation(evaluation, options = {}) {
  const { isBlueprint = false, requireAllFields = true } = options;
  const errors = [];
  const warnings = [];

  if (!evaluation || typeof evaluation !== 'object') {
    return { valid: false, errors: ['Evaluation is null or not an object'], warnings: [] };
  }

  const requiredFields = isBlueprint ? BLUEPRINT_FIELDS : EVALUATION_FIELDS;

  for (const field of requiredFields) {
    if (evaluation[field] === undefined || evaluation[field] === null) {
      if (requireAllFields) {
        errors.push(`Missing required field: ${field}`);
      } else {
        warnings.push(`Missing optional field: ${field}`);
      }
      continue;
    }

    const val = evaluation[field];
    if (typeof val !== 'number' || isNaN(val)) {
      errors.push(`Field "${field}" must be a number, got ${typeof val}: ${val}`);
      continue;
    }

    const range = VALID_SCORE_RANGES[field];
    if (range) {
      if (val < range.min || val > range.max) {
        errors.push(`Field "${field}" out of range [${range.min}-${range.max}]: ${val}`);
      }
    }

    if (typeof val === 'number' && !Number.isInteger(val) && field !== 'blueprint_score') {
      warnings.push(`Field "${field}" has non-integer value: ${val}. Expected integer 0-10.`);
    }
  }

  for (const field of ['strengths', 'improvements']) {
    if (evaluation[field] !== undefined) {
      if (!Array.isArray(evaluation[field])) {
        warnings.push(`Field "${field}" should be an array, got ${typeof evaluation[field]}`);
      }
    }
  }

  if (evaluation.feedback !== undefined && typeof evaluation.feedback !== 'string') {
    warnings.push(`Field "feedback" should be a string, got ${typeof evaluation.feedback}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Detect anomalous evaluation patterns.
 * Returns { anomalous: boolean, anomalies: string[] }
 */
function detectAnomalies(evaluations) {
  const anomalies = [];

  if (!evaluations || evaluations.length === 0) {
    return { anomalous: false, anomalies: [] };
  }

  // Check 1: All scores identical across all questions
  const allFields = {};
  for (const eval_ of evaluations) {
    for (const field of EVALUATION_FIELDS) {
      if (eval_.evaluation?.[field] != null) {
        if (!allFields[field]) allFields[field] = [];
        allFields[field].push(eval_.evaluation[field]);
      }
    }
  }

  for (const [field, scores] of Object.entries(allFields)) {
    if (scores.length >= 3) {
      const unique = new Set(scores);
      if (unique.size === 1) {
        anomalies.push(`All ${field} scores are identical (${scores[0]}) across ${scores.length} questions — likely AI fatigue or prompt issue.`);
      }
    }
  }

  // Check 2: Score variance too low (all within 0.5 of each other)
  for (const [field, scores] of Object.entries(allFields)) {
    if (scores.length >= 3) {
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      if (max - min <= 0.5 && new Set(scores).size > 1) {
        anomalies.push(`Very low variance in ${field} (range ${min}-${max}) across ${scores.length} questions.`);
      }
    }
  }

  // Check 3: Suspiciously perfect scores
  for (const [field, scores] of Object.entries(allFields)) {
    const perfectCount = scores.filter(s => s === 10).length;
    if (perfectCount > scores.length * 0.7 && scores.length >= 3) {
      anomalies.push(`${perfectCount}/${scores.length} questions have perfect ${field}=10 — possible AI leniency.`);
    }
  }

  // Check 4: All zeros
  for (const [field, scores] of Object.entries(allFields)) {
    const zeroCount = scores.filter(s => s === 0).length;
    if (zeroCount === scores.length && scores.length >= 2) {
      anomalies.push(`All ${field} scores are 0 across ${scores.length} questions — possible student absence or AI failure.`);
    }
  }

  return { anomalous: anomalies.length > 0, anomalies };
}

/**
 * Compute score consistency metrics.
 * Returns { variance, standardDeviation, range, consistency }
 */
function computeConsistency(evaluations, field = 'knowledge') {
  const scores = evaluations
    .map(e => e.evaluation?.[field])
    .filter(s => s != null && typeof s === 'number');

  if (scores.length < 2) {
    return { variance: 0, standardDeviation: 0, range: 0, consistency: 'INSUFFICIENT' };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const range = Math.max(...scores) - Math.min(...scores);

  let consistency = 'HIGH';
  if (stdDev > 3) consistency = 'LOW';
  else if (stdDev > 1.5) consistency = 'MEDIUM';

  return {
    variance: Math.round(variance * 100) / 100,
    standardDeviation: Math.round(stdDev * 100) / 100,
    range: Math.round(range * 100) / 100,
    consistency,
  };
}

/**
 * Validate an entire session's evaluations batch.
 * Returns { valid, errors, warnings, anomalies, consistency }
 */
function validateSessionEvaluations(sessionHistory, options = {}) {
  const { isBlueprint = false } = options;
  const allErrors = [];
  const allWarnings = [];
  let allValid = true;

  for (let i = 0; i < sessionHistory.length; i++) {
    const entry = sessionHistory[i];
    const evaluation = entry.evaluation;
    if (!evaluation) {
      allErrors.push(`Question ${i + 1}: No evaluation present`);
      allValid = false;
      continue;
    }
    const result = validateEvaluation(evaluation, { isBlueprint, requireAllFields: true });
    if (!result.valid) {
      allValid = false;
      for (const err of result.errors) {
        allErrors.push(`Question ${i + 1}: ${err}`);
      }
    }
    allWarnings.push(...result.warnings.map(w => `Question ${i + 1}: ${w}`));
  }

  const anomalies = detectAnomalies(sessionHistory);
  const consistency = computeConsistency(sessionHistory);

  return {
    valid: allValid,
    errors: allErrors,
    warnings: allWarnings,
    anomalies: anomalies.anomalies,
    hasAnomalies: anomalies.anomalous,
    consistency,
    questionCount: sessionHistory.length,
  };
}

export {
  validateEvaluation,
  detectAnomalies,
  computeConsistency,
  validateSessionEvaluations,
  EVALUATION_FIELDS,
  BLUEPRINT_FIELDS,
};
