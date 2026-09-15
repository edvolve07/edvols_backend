import assert from 'node:assert/strict';
import { scoringContext } from '../src/placement/scoringContext.js';
import { profileKey } from '../src/placement/cache.js';
import { validateScoringConfig } from '../src/placement/configValidation.js';
import { computeOverallReadiness, classifyReadiness, meetsTalentCriteria, generateScoringExplanation, computeBatchAnalytics } from '../src/placement/scoringEngine.js';

const result = computeOverallReadiness({ technical_knowledge: { score: 80, dataPoints: 1, confidence: 'LOW' } });
assert.equal(result.overall, 80);
assert.equal(result.breakdown.find(b => b.competency === 'communication').normalizedWeight, 0);
assert.equal(result.breakdown.find(b => b.competency === 'technical_knowledge').normalizedWeight, 1);
assert.throws(() => validateScoringConfig({ weights: { technical_knowledge: -1 } }), /weights/);
assert.throws(() => validateScoringConfig({ talentCriteria: { overall_readiness: 101 } }), /criteria/);
assert.throws(() => validateScoringConfig({ confidenceThresholds: { HIGH: { minQuestions: -1 } } }), /thresholds/);
const baselineKey = profileKey('student');
assert.equal(computeBatchAnalytics([
  { overallReadiness: 0, readinessBand: 'HIGH_INTERVENTION' },
  { overallReadiness: 100, readinessBand: 'PLACEMENT_READY' },
]).avgReadiness, 50);
await Promise.all(['2.0', '3.0'].map(version => scoringContext.run({
  version, updated_at: version,
  readiness_bands: { PLACEMENT_READY: { min: 95 }, INTERVIEW_READY: { min: 90 }, DEVELOPMENT_REQUIRED: { min: 70 } },
  talent_criteria: { overall_readiness: 90 },
}, async () => {
  await Promise.resolve();
  assert.equal(classifyReadiness(85), 'DEVELOPMENT_REQUIRED');
  assert.equal(meetsTalentCriteria({}, 85), false);
  assert.equal(generateScoringExplanation({}, result, 'DEVELOPMENT_REQUIRED', 'LOW').scoringEngineVersion, version);
  assert.notEqual(profileKey('student'), baselineKey);
  assert.ok(profileKey('student').includes(version));
})));
assert.equal(classifyReadiness(85), 'PLACEMENT_READY');
console.log('Logic regression tests passed');
