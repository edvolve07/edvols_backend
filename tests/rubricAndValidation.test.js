import { COMPETENCY_RUBRICS, getRubricForCompetency, getAllRubrics, getRubricForBlueprint, VALID_SCORE_RANGES } from '../src/placement/rubricConfig.js';
import { validateEvaluation, detectAnomalies, computeConsistency, validateSessionEvaluations } from '../src/placement/aiValidation.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

console.log('=== Rubric Config Tests ===\n');

// Test 1: All 7 competencies have rubrics
console.log('Test 1: Rubric Coverage');
{
  const expected = ['technical_knowledge', 'problem_solving', 'communication', 'project_knowledge', 'behavioral_skills', 'resume_profile', 'interview_performance'];
  const allRubrics = getAllRubrics();
  for (const comp of expected) {
    assert(allRubrics[comp] !== undefined, `${comp} has a rubric`);
  }
}

// Test 2: Rubric metric weights sum to 1.0
console.log('\nTest 2: Metric Weight Sums');
{
  for (const [comp, rubric] of Object.entries(COMPETENCY_RUBRICS)) {
    const sum = Object.values(rubric.metricWeights).reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 1.0) < 0.001, `${comp} weights sum to ~1.0: ${sum}`);
  }
}

// Test 3: getRubricForCompetency
console.log('\nTest 3: Rubric Lookup');
{
  assert(getRubricForCompetency('technical_knowledge') !== null, 'technical_knowledge found');
  assert(getRubricForCompetency('nonexistent') === null, 'nonexistent returns null');
}

// Test 4: getRubricForBlueprint
console.log('\nTest 4: Blueprint Rubric Mapping');
{
  const tech = getRubricForBlueprint(3, 'Foundation', ['technical concepts', 'coding']);
  assert(tech.competency === 'technical_knowledge', 'Foundation + technical → technical_knowledge');

  const proj = getRubricForBlueprint(4, 'Foundation', ['project portfolio']);
  assert(proj.competency === 'project_knowledge', 'Foundation + project → project_knowledge');

  const bh = getRubricForBlueprint(8, 'Professional', ['behavioral questions', 'cultural fit']);
  assert(bh.competency === 'behavioral_skills', 'Professional + behavioral → behavioral_skills');

  const comm = getRubricForBlueprint(14, 'Expert', ['communication skills']);
  assert(comm.competency === 'communication', 'Expert + communication → communication');
}

// Test 5: Score ranges are valid
console.log('\nTest 5: Score Ranges');
{
  for (const [field, range] of Object.entries(VALID_SCORE_RANGES)) {
    assert(range.min === 0, `${field} min is 0`);
    assert(range.max === 10, `${field} max is 10`);
  }
}

console.log('\n\n=== AI Validation Tests ===\n');

// Test 6: Valid evaluation passes
console.log('Test 6: Valid Evaluation');
{
  const result = validateEvaluation({
    confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8,
  });
  assert(result.valid === true, 'Valid evaluation passes');
  assert(result.errors.length === 0, 'No errors');
}

// Test 7: Missing field fails
console.log('\nTest 7: Missing Field');
{
  const result = validateEvaluation({
    confidence: 7, knowledge: 8, fluency: 7, skill_relevance: 8,
  });
  assert(result.valid === false, 'Missing body_language fails');
  assert(result.errors.some(e => e.includes('body_language')), 'Error mentions body_language');
}

// Test 8: Out of range fails
console.log('\nTest 8: Out of Range');
{
  const result = validateEvaluation({
    confidence: 15, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8,
  });
  assert(result.valid === false, 'Score > 10 fails');
  assert(result.errors.some(e => e.includes('out of range')), 'Error mentions out of range');
}

// Test 9: Non-numeric fails
console.log('\nTest 9: Non-numeric');
{
  const result = validateEvaluation({
    confidence: 'high', body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8,
  });
  assert(result.valid === false, 'String score fails');
  assert(result.errors.some(e => e.includes('must be a number')), 'Error mentions type');
}

// Test 10: Null evaluation fails
console.log('\nTest 10: Null Evaluation');
{
  const result = validateEvaluation(null);
  assert(result.valid === false, 'Null fails');
}

// Test 11: Blueprint validation
console.log('\nTest 11: Blueprint Validation');
{
  const result = validateEvaluation({
    confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8, blueprint_score: 7,
  }, { isBlueprint: true });
  assert(result.valid === true, 'Valid blueprint evaluation passes');

  const missing = validateEvaluation({
    confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8,
  }, { isBlueprint: true });
  assert(missing.valid === false, 'Missing blueprint_score fails for blueprint');
}

// Test 12: Anomaly detection - identical scores
console.log('\nTest 12: Anomaly Detection');
{
  const evals = [
    { evaluation: { confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8 } },
    { evaluation: { confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8 } },
    { evaluation: { confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8 } },
  ];
  const result = detectAnomalies(evals);
  assert(result.anomalous === true, 'Identical scores detected as anomalous');
  assert(result.anomalies.length > 0, 'Has anomaly messages');
}

// Test 13: Anomaly detection - perfect scores
console.log('\nTest 13: Perfect Score Anomaly');
{
  const evals = [
    { evaluation: { confidence: 10, body_language: 10, knowledge: 10, fluency: 10, skill_relevance: 10 } },
    { evaluation: { confidence: 10, body_language: 10, knowledge: 10, fluency: 10, skill_relevance: 10 } },
    { evaluation: { confidence: 10, body_language: 10, knowledge: 10, fluency: 10, skill_relevance: 10 } },
    { evaluation: { confidence: 10, body_language: 10, knowledge: 10, fluency: 10, skill_relevance: 10 } },
  ];
  const result = detectAnomalies(evals);
  assert(result.anomalous === true, 'Perfect scores detected as anomalous');
}

// Test 14: Normal variance not anomalous
console.log('\nTest 14: Normal Variance');
{
  const evals = [
    { evaluation: { confidence: 6, body_language: 5, knowledge: 7, fluency: 6, skill_relevance: 7 } },
    { evaluation: { confidence: 8, body_language: 7, knowledge: 9, fluency: 8, skill_relevance: 9 } },
    { evaluation: { confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8 } },
  ];
  const result = detectAnomalies(evals);
  assert(result.anomalous === false, 'Normal variance not flagged');
}

// Test 15: Consistency calculation
console.log('\nTest 15: Consistency');
{
  const evals = [
    { evaluation: { knowledge: 7 } },
    { evaluation: { knowledge: 7.5 } },
    { evaluation: { knowledge: 8 } },
  ];
  const result = computeConsistency(evals, 'knowledge');
  assert(result.consistency === 'HIGH', 'Low variance → HIGH consistency');
  assert(result.variance > 0, 'Variance > 0');
}

// Test 16: Session validation
console.log('\nTest 16: Session Validation');
{
  const history = [
    { evaluation: { confidence: 7, body_language: 6, knowledge: 8, fluency: 7, skill_relevance: 8 } },
    { evaluation: { confidence: 8, body_language: 7, knowledge: 9, fluency: 8, skill_relevance: 9 } },
  ];
  const result = validateSessionEvaluations(history);
  assert(result.valid === true, 'Valid session passes');
  assert(result.questionCount === 2, 'Question count correct');
}

// Test 17: Session validation with errors
console.log('\nTest 17: Session Validation with Errors');
{
  const history = [
    { evaluation: { confidence: 7, knowledge: 8, fluency: 7, skill_relevance: 8 } }, // missing body_language
    { evaluation: null },
  ];
  const result = validateSessionEvaluations(history);
  assert(result.valid === false, 'Invalid session fails');
  assert(result.errors.length >= 2, 'Multiple errors detected');
}

console.log(`\n══════════════════════════════════════════════════`);
console.log(`Results: ${passed}/${passed + failed} passed`);
console.log(`══════════════════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
