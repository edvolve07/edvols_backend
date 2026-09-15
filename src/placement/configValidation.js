import { COMPETENCIES } from './scoringEngine.js';
import { HttpError } from '../utils/httpError.js';

export function validateScoringConfig(input) {
  const fail = message => { throw new HttpError(400, message); };
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (input.weights !== undefined) {
    const w = input.weights;
    if (!w || Object.keys(w).length !== COMPETENCIES.length || !COMPETENCIES.every(c => number(w[c])) || Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) > 0.000001) fail('Provide all competency weights as nonnegative numbers summing to 1');
  }
  if (input.readinessBands !== undefined) {
    const bands = ['HIGH_INTERVENTION', 'DEVELOPMENT_REQUIRED', 'INTERVIEW_READY', 'PLACEMENT_READY'].map(k => input.readinessBands?.[k]);
    if (!bands.every(b => b && number(b.min) && number(b.max) && b.min <= b.max && b.max <= 100) || bands[0].min !== 0 || bands[3].max !== 100 || bands.some((b, i) => i && (b.min <= bands[i - 1].min || Math.abs(b.min - bands[i - 1].max - 0.01) > 0.000001))) fail('Readiness bands must cover 0–100 in ordered, non-overlapping ranges with 0.01 increments');
  }
  if (input.talentCriteria !== undefined) {
    const criteria = input.talentCriteria;
    if (!criteria || !number(criteria.overall_readiness) || !Object.entries(criteria).every(([k, v]) => (k === 'overall_readiness' || COMPETENCIES.includes(k)) && number(v) && v <= 100)) fail('Invalid talent criteria');
  }
  if (input.segmentationThresholds !== undefined) {
    const t = input.segmentationThresholds;
    if (!t || !number(t.STRONG) || !number(t.MODERATE) || t.STRONG > 100 || t.MODERATE >= t.STRONG) fail('Invalid segmentation thresholds');
  }
  if (input.confidenceThresholds !== undefined) {
    const thresholds = ['LOW', 'MEDIUM', 'HIGH'].map(k => input.confidenceThresholds?.[k]);
    if (!thresholds.every(t => t && ['minInterviews', 'minQuestions'].every(k => number(t[k]) && Number.isInteger(t[k]))) || thresholds.some((t, i) => i && (t.minInterviews < thresholds[i - 1].minInterviews || t.minQuestions < thresholds[i - 1].minQuestions))) fail('Confidence thresholds must contain ordered integer interview and question counts');
  }
}
