/**
 * Placement Scoring Engine - Automated Tests
 * 
 * Run with: node tests/scoringEngine.test.js
 * 
 * Tests cover:
 * 1. Score normalization
 * 2. Weighted score calculation
 * 3. Missing competency handling
 * 4. Score boundaries
 * 5. Classification boundaries
 * 6. Skill gap identification
 * 7. Confidence calculation
 * 8. Student segmentation
 * 9. Talent criteria matching
 * 10. Batch analytics
 * 11. Recommendations generation
 * 12. Scoring explanation
 */

import {
  COMPETENCIES,
  DEFAULT_COMPETENCY_WEIGHTS,
  DEFAULT_READINESS_BANDS,
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
  filterStudentsByCriteria,
  generateScoringExplanation,
} from '../src/placement/scoringEngine.js';

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  total++;
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  total++;
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
  }
}

// ═══════════════════════════════════════════════════════
// TEST 1: Utility Functions
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 1: Utility Functions ===');

assertEqual(avg([]), 0, 'avg of empty array is 0');
assertEqual(avg([10]), 10, 'avg of single element');
assertClose(avg([10, 20, 30]), 20, 0.01, 'avg of [10,20,30] is 20');
assertClose(avg([1, 2, 3, 4, 5]), 3, 0.01, 'avg of [1,2,3,4,5] is 3');

assertEqual(clamp(-10, 0, 100), 0, 'clamp below min');
assertEqual(clamp(150, 0, 100), 100, 'clamp above max');
assertEqual(clamp(50, 0, 100), 50, 'clamp within range');

assertEqual(round2(3.456), 3.46, 'round2 rounds to 2 decimal places');
assertEqual(round2(3.454), 3.45, 'round2 rounds down');
assertEqual(round2(3), 3, 'round2 on integer');

assertEqual(normalizeTo100(5, 10), 50, 'normalize 5/10 to 100 scale');
assertEqual(normalizeTo100(10, 10), 100, 'normalize 10/10 to 100 scale');
assertEqual(normalizeTo100(0, 10), 0, 'normalize 0/10 to 100 scale');
assertEqual(normalizeTo100(7, 10), 70, 'normalize 7/10 to 100 scale');

// ═══════════════════════════════════════════════════════
// TEST 2: Question Categorization
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 2: Question Categorization ===');

assertEqual(
  categorizeQuestion('Foundation', ['Technical Foundations']),
  'technical_knowledge',
  'Foundation + Technical → technical_knowledge'
);
assertEqual(
  categorizeQuestion('Foundation', ['Project Portfolio']),
  'project_knowledge',
  'Foundation + Project → project_knowledge'
);
assertEqual(
  categorizeQuestion('Professional', ['Behavioral Core']),
  'behavioral_skills',
  'Professional + Behavioral → behavioral_skills'
);
assertEqual(
  categorizeQuestion('Advanced', ['Communication']),
  'communication',
  'Advanced + Communication → communication'
);
assertEqual(
  categorizeQuestion('Expert', ['Problem Decomposition']),
  'problem_solving',
  'Expert + Problem → problem_solving'
);
assertEqual(
  categorizeQuestion('Technical', ['System Design']),
  'technical_knowledge',
  'Technical category → technical_knowledge'
);
assertEqual(
  categorizeQuestion('', []),
  'technical_knowledge',
  'Empty category defaults to technical_knowledge'
);

// ═══════════════════════════════════════════════════════
// TEST 3: Competency Computation
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 3: Competency Computation ===');

// Technical Knowledge
const techHistory = [
  { evaluation: { knowledge: 8, skill_relevance: 7 }, category: 'technical_knowledge', timestamp: new Date().toISOString() },
  { evaluation: { knowledge: 9, skill_relevance: 8 }, category: 'technical_knowledge', timestamp: new Date().toISOString() },
  { evaluation: { knowledge: 7, skill_relevance: 6 }, category: 'technical_knowledge', timestamp: new Date().toISOString() },
  { evaluation: { knowledge: 8, skill_relevance: 7 }, category: 'technical_knowledge', timestamp: new Date().toISOString() },
];
const techResult = computeCompetency('technical_knowledge', techHistory, null, null);
assert(techResult.score > 0 && techResult.score <= 100, `Technical score in range: ${techResult.score}`);
assertEqual(techResult.dataPoints, 4, 'Technical data points = 4');
assertEqual(techResult.confidence, 'HIGH', '4 data points → HIGH confidence');

// Problem Solving
const psHistory = [
  { evaluation: { knowledge: 7, skill_relevance: 8 }, category: 'problem_solving', timestamp: new Date().toISOString() },
  { evaluation: { knowledge: 6, skill_relevance: 7 }, category: 'problem_solving', timestamp: new Date().toISOString() },
];
const psResult = computeCompetency('problem_solving', psHistory, null, null);
assert(psResult.score > 0, `Problem solving score > 0: ${psResult.score}`);
assertEqual(psResult.dataPoints, 2, 'Problem solving data points = 2');

// Communication from CommunicationReport
const commData = { clarity: 8, structure: 7, conciseness: 9, relevance: 8, confidence_tone: 7 };
const commResult = computeCompetency('communication', [], commData, null);
assertClose(commResult.score, 78, 1, `Communication score ≈ 78: ${commResult.score}`);
assertEqual(commResult.dataPoints, 1, 'Communication data points = 1 (from report)');

// Project Knowledge
const projHistory = [
  { evaluation: { knowledge: 8, skill_relevance: 9 }, category: 'project_knowledge', timestamp: new Date().toISOString() },
  { evaluation: { knowledge: 7, skill_relevance: 8 }, category: 'project_knowledge', timestamp: new Date().toISOString() },
];
const projResult = computeCompetency('project_knowledge', projHistory, null, null);
assert(projResult.score > 0, `Project knowledge score > 0: ${projResult.score}`);

// Behavioral Skills
const bhHistory = [
  { evaluation: { confidence: 7, body_language: 8 }, category: 'behavioral_skills', timestamp: new Date().toISOString() },
  { evaluation: { confidence: 8, body_language: 7 }, category: 'behavioral_skills', timestamp: new Date().toISOString() },
];
const bhResult = computeCompetency('behavioral_skills', bhHistory, null, null);
assert(bhResult.score > 0, `Behavioral score > 0: ${bhResult.score}`);

// Resume Profile
const resumeData = { ats_score: 85 };
const resumeResult = computeCompetency('resume_profile', [], null, resumeData);
assertEqual(resumeResult.score, 85, 'Resume score = ATS score = 85');
assertEqual(resumeResult.dataPoints, 1, 'Resume data points = 1');

// Interview Performance
const intHistory = [
  { evaluation: { fluency: 8, body_language: 7, blueprint_score: 8 }, category: 'technical_knowledge', timestamp: new Date().toISOString() },
  { evaluation: { fluency: 7, body_language: 8 }, category: 'technical_knowledge', timestamp: new Date().toISOString() },
];
const intResult = computeCompetency('interview_performance', intHistory, null, null);
assert(intResult.score > 0, `Interview performance score > 0: ${intResult.score}`);

// No data → INSUFFICIENT
const noDataResult = computeCompetency('technical_knowledge', [], null, null);
assertEqual(noDataResult.score, 0, 'No data → score = 0');
assertEqual(noDataResult.confidence, 'INSUFFICIENT', 'No data → INSUFFICIENT confidence');
assertEqual(noDataResult.dataPoints, 0, 'No data → 0 data points');

// ═══════════════════════════════════════════════════════
// TEST 4: Confidence Calculation
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 4: Confidence Calculation ===');

assertEqual(computeConfidence(0, []), 'INSUFFICIENT', '0 data points → INSUFFICIENT');
assertEqual(computeConfidence(1, [{ timestamp: new Date().toISOString() }]), 'MEDIUM', '1 recent data point → MEDIUM');
assertEqual(computeConfidence(3, [{ timestamp: new Date().toISOString() }]), 'HIGH', '3 recent data points → HIGH');
assertEqual(computeConfidence(5, [{ timestamp: new Date().toISOString() }]), 'HIGH', '5 recent data points → HIGH');

const oldTimestamp = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
assertEqual(computeConfidence(3, [{ timestamp: oldTimestamp }]), 'MEDIUM', '3 old data points → MEDIUM');

// ═══════════════════════════════════════════════════════
// TEST 5: Overall Readiness Calculation
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 5: Overall Readiness Calculation ===');

const allCompetencies = {
  technical_knowledge: { score: 80, confidence: 'HIGH', dataPoints: 5 },
  aptitude: { score: 85, confidence: 'HIGH', dataPoints: 4 },
  communication: { score: 70, confidence: 'MEDIUM', dataPoints: 3 },
  problem_solving: { score: 75, confidence: 'HIGH', dataPoints: 4 },
  interview_performance: { score: 72, confidence: 'HIGH', dataPoints: 6 },
  resume_profile: { score: 90, confidence: 'LOW', dataPoints: 1 },
  behavioral_skills: { score: 65, confidence: 'MEDIUM', dataPoints: 2 },
};

const overallResult = computeOverallReadiness(allCompetencies);
assert(overallResult.overall > 0 && overallResult.overall <= 100, `Overall score in range: ${overallResult.overall}`);
assert(overallResult.breakdown.length === 7, 'Breakdown has 7 entries');

// Manual verification:
// 80*0.20 + 85*0.15 + 70*0.15 + 75*0.15 + 72*0.15 + 90*0.10 + 65*0.10
// = 16 + 12.75 + 10.5 + 11.25 + 10.8 + 9 + 6.5 = 76.8
assertClose(overallResult.overall, 76.8, 0.1, `Overall ≈ 76.8: ${overallResult.overall}`);

// ═══════════════════════════════════════════════════════
// TEST 6: Classification Boundaries
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 6: Classification Boundaries ===');

assertEqual(classifyReadiness(100), 'PLACEMENT_READY', '100 → PLACEMENT_READY');
assertEqual(classifyReadiness(85), 'PLACEMENT_READY', '85 → PLACEMENT_READY');
assertEqual(classifyReadiness(84.99), 'INTERVIEW_READY', '84.99 → INTERVIEW_READY');
assertEqual(classifyReadiness(75), 'INTERVIEW_READY', '75 → INTERVIEW_READY');
assertEqual(classifyReadiness(74.99), 'DEVELOPMENT_REQUIRED', '74.99 → DEVELOPMENT_REQUIRED');
assertEqual(classifyReadiness(60), 'DEVELOPMENT_REQUIRED', '60 → DEVELOPMENT_REQUIRED');
assertEqual(classifyReadiness(59.99), 'HIGH_INTERVENTION', '59.99 → HIGH_INTERVENTION');
assertEqual(classifyReadiness(0), 'HIGH_INTERVENTION', '0 → HIGH_INTERVENTION');

// ═══════════════════════════════════════════════════════
// TEST 7: Assessment Confidence
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 7: Assessment Confidence ===');

const highConf = {};
COMPETENCIES.forEach(c => { highConf[c] = { confidence: 'HIGH', dataPoints: 5 }; });
assertEqual(computeAssessmentConfidence(highConf), 'HIGH', 'All HIGH → HIGH');

const medConf = {};
COMPETENCIES.forEach(c => { medConf[c] = { confidence: 'MEDIUM', dataPoints: 3 }; });
assertEqual(computeAssessmentConfidence(medConf), 'MEDIUM', 'All MEDIUM → MEDIUM');

const insuffConf = {};
COMPETENCIES.forEach(c => { insuffConf[c] = { confidence: 'INSUFFICIENT', dataPoints: 0 }; });
assertEqual(computeAssessmentConfidence(insuffConf), 'INSUFFICIENT', 'All INSUFFICIENT → INSUFFICIENT');

const mixedConf = {};
COMPETENCIES.forEach((c, i) => {
  mixedConf[c] = { confidence: i < 4 ? 'HIGH' : 'MEDIUM', dataPoints: i < 4 ? 5 : 3 };
});
assertEqual(computeAssessmentConfidence(mixedConf), 'HIGH', '4 HIGH + 3 MEDIUM → HIGH');

// ═══════════════════════════════════════════════════════
// TEST 8: Skill Gap Identification
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 8: Skill Gap Identification ===');

const gapCompetencies = {
  technical_knowledge: { score: 80, confidence: 'HIGH', dataPoints: 5 },
  problem_solving: { score: 45, confidence: 'MEDIUM', dataPoints: 3 },
  communication: { score: 30, confidence: 'HIGH', dataPoints: 4 },
  project_knowledge: { score: 75, confidence: 'HIGH', dataPoints: 4 },
  behavioral_skills: { score: 55, confidence: 'MEDIUM', dataPoints: 2 },
  resume_profile: { score: 90, confidence: 'LOW', dataPoints: 1 },
  interview_performance: { score: 80, confidence: 'HIGH', dataPoints: 6 },
};

const gaps = identifySkillGaps(gapCompetencies);
assert(gaps.length > 0, `Identified ${gaps.length} gaps`);
assertEqual(gaps[0].competency, 'communication', 'Largest gap is communication (gap=40)');
assertEqual(gaps[0].priority, 'HIGH', 'Communication gap is HIGH priority (score=30 < 50)');
// Problem solving score is 45 (< 50), so priority is HIGH
assertEqual(gaps.find(g => g.competency === 'problem_solving')?.priority, 'HIGH', 'Problem solving gap is HIGH priority (score=45 < 50)');

// ═══════════════════════════════════════════════════════
// TEST 9: Strengths Identification
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 9: Strengths Identification ===');

const strengths = identifyStrengths(gapCompetencies);
assert(strengths.length > 0, `Identified ${strengths.length} strengths`);
assertEqual(strengths[0].competency, 'resume_profile', 'Top strength is resume_profile');
assertEqual(strengths.find(s => s.competency === 'technical_knowledge')?.competency, 'technical_knowledge', 'Technical is a strength');

// ═══════════════════════════════════════════════════════
// TEST 10: Student Segmentation
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 10: Student Segmentation ===');

const strongComps = {};
COMPETENCIES.forEach(c => { strongComps[c] = { score: 85, confidence: 'HIGH', dataPoints: 5 }; });
const strongSegments = classifyStudentSegment(strongComps);
assert(strongSegments.includes('STRONG_OVERALL'), 'All strong → STRONG_OVERALL');

const mixedSegComps = {
  technical_knowledge: { score: 85, confidence: 'HIGH', dataPoints: 5 },
  communication: { score: 45, confidence: 'MEDIUM', dataPoints: 3 },
  problem_solving: { score: 70, confidence: 'HIGH', dataPoints: 4 },
  project_knowledge: { score: 80, confidence: 'HIGH', dataPoints: 4 },
  behavioral_skills: { score: 60, confidence: 'MEDIUM', dataPoints: 2 },
  resume_profile: { score: 75, confidence: 'LOW', dataPoints: 1 },
  interview_performance: { score: 70, confidence: 'HIGH', dataPoints: 6 },
};
const mixedSeg = classifyStudentSegment(mixedSegComps);
assert(mixedSeg.includes('TECHNICAL_STRONG_COMMUNICATION_WEAK'), 'Tech strong + comm weak detected');

const emptySeg = classifyStudentSegment({});
assertEqual(emptySeg[0], 'UNASSESSED', 'Empty competencies → UNASSESSED');

// ═══════════════════════════════════════════════════════
// TEST 11: Talent Criteria Matching
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 11: Talent Criteria Matching ===');

const talentComps = {
  technical_knowledge: { score: 85, confidence: 'HIGH', dataPoints: 5 },
  aptitude: { score: 80, confidence: 'HIGH', dataPoints: 4 },
  problem_solving: { score: 80, confidence: 'HIGH', dataPoints: 4 },
  communication: { score: 75, confidence: 'MEDIUM', dataPoints: 3 },
  behavioral_skills: { score: 70, confidence: 'MEDIUM', dataPoints: 2 },
  resume_profile: { score: 90, confidence: 'LOW', dataPoints: 1 },
  interview_performance: { score: 78, confidence: 'HIGH', dataPoints: 6 },
};
assert(meetsTalentCriteria(talentComps, 82), 'High-scoring student meets talent criteria');

const weakComps = {
  technical_knowledge: { score: 50, confidence: 'HIGH', dataPoints: 5 },
  communication: { score: 40, confidence: 'MEDIUM', dataPoints: 3 },
};
assert(!meetsTalentCriteria(weakComps, 55), 'Weak student does not meet talent criteria');

// ═══════════════════════════════════════════════════════
// TEST 12: Recommendations
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 12: Recommendations ===');

const recCompetencies = {
  technical_knowledge: { score: 80, confidence: 'HIGH', dataPoints: 5 },
  communication: { score: 40, confidence: 'HIGH', dataPoints: 4 },
  problem_solving: { score: 55, confidence: 'MEDIUM', dataPoints: 3 },
};
const recGaps = identifySkillGaps(recCompetencies);
const recs = generateRecommendations(recCompetencies, recGaps);
assertEqual(recs.length, 2, 'Generated 2 recommendations');
assertEqual(recs[0].area, 'Communication', 'First recommendation is Communication');
assertEqual(recs[0].priority, 'HIGH', 'First recommendation is HIGH priority');

// ═══════════════════════════════════════════════════════
// TEST 13: Company-Specific Filtering
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 13: Company-Specific Filtering ===');

const students = [
  { studentId: 's1', overallReadiness: 85, competencies: { technical_knowledge: { score: 80 }, communication: { score: 75 }, problem_solving: { score: 80 } } },
  { studentId: 's2', overallReadiness: 72, competencies: { technical_knowledge: { score: 75 }, communication: { score: 65 }, problem_solving: { score: 70 } } },
  { studentId: 's3', overallReadiness: 55, competencies: { technical_knowledge: { score: 50 }, communication: { score: 40 }, problem_solving: { score: 50 } } },
];

const standardFilter = filterStudentsByCriteria(students, {
  overall_readiness: 70,
  technical_knowledge: 70,
});
assertEqual(standardFilter.length, 2, '2 students match criteria');

const strictFilter = filterStudentsByCriteria(students, {
  overall_readiness: 80,
  technical_knowledge: 80,
  communication: 70,
});
assertEqual(strictFilter.length, 1, '1 student matches strict criteria');

// ═══════════════════════════════════════════════════════
// TEST 14: Batch Analytics
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 14: Batch Analytics ===');

const batchProfiles = [
  { studentId: 's1', overallReadiness: 88, readinessBand: 'PLACEMENT_READY', competencies: { technical_knowledge: { score: 85 } } },
  { studentId: 's2', overallReadiness: 78, readinessBand: 'INTERVIEW_READY', competencies: { technical_knowledge: { score: 75 } } },
  { studentId: 's3', overallReadiness: 65, readinessBand: 'DEVELOPMENT_REQUIRED', competencies: { technical_knowledge: { score: 60 } } },
];

const analytics = computeBatchAnalytics(batchProfiles);
assertEqual(analytics.studentCount, 3, 'Batch student count = 3');
assertEqual(analytics.assessedCount, 3, 'Batch assessed count = 3');
assert(analytics.averageReadiness > 0, `Batch avg readiness > 0: ${analytics.averageReadiness}`);
assertEqual(analytics.distribution.PLACEMENT_READY, 1, '1 placement ready');
assertEqual(analytics.distribution.INTERVIEW_READY, 1, '1 interview ready');
assertEqual(analytics.distribution.DEVELOPMENT_REQUIRED, 1, '1 development required');

const emptyBatch = computeBatchAnalytics([]);
assertEqual(emptyBatch.studentCount, 0, 'Empty batch → 0 students');

// ═══════════════════════════════════════════════════════
// TEST 15: Scoring Explanation
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 15: Scoring Explanation ===');

const explanation = generateScoringExplanation(
  allCompetencies,
  overallResult,
  'INTERVIEW_READY',
  'HIGH'
);
assertEqual(explanation.scoringEngineVersion, '1.0', 'Version is 1.0');
assertEqual(explanation.readinessBand, 'INTERVIEW_READY', 'Band is INTERVIEW_READY');
assertEqual(explanation.assessmentConfidence, 'HIGH', 'Confidence is HIGH');
assert(explanation.calculatedAt != null, 'CalculatedAt is set');
assert(explanation.competencies.length === 7, 'Explanation has 7 competencies');
assert(explanation.weightBreakdown.length === 7, 'Weight breakdown has 7 entries');

// ═══════════════════════════════════════════════════════
// TEST 16: Score Boundary Reproducibility
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 16: Score Boundary Reproducibility ===');

// Verify that the same inputs always produce the same outputs
for (let run = 0; run < 3; run++) {
  const result = computeOverallReadiness(allCompetencies);
  assertClose(result.overall, 76.8, 0.01, `Run ${run + 1}: Overall is deterministic ≈ 76.8`);
}

// ═══════════════════════════════════════════════════════
// TEST 17: Weight Sum Validation
// ═══════════════════════════════════════════════════════
console.log('\n=== Test 17: Weight Sum Validation ===');

const weightSum = Object.values(DEFAULT_COMPETENCY_WEIGHTS).reduce((a, b) => a + b, 0);
assertClose(weightSum, 1.0, 0.001, `Default weights sum to 1.0: ${weightSum}`);

const allCompetenciesPresent = COMPETENCIES.every(c => DEFAULT_COMPETENCY_WEIGHTS[c] != null);
assert(allCompetenciesPresent, 'All 7 competencies have weights');

// ═══════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
console.log('═'.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
