import assert from 'node:assert/strict';

// Model construction only; every database operation below is replaced by an
// in-memory adapter. This test never connects to the configured database.
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:1/test';
const { InterviewSession } = await import('../src/database/index.js');
const { commitInterviewAnswer } = await import('../src/services/interviewState.js');
const original = InterviewSession.update;
let state = { session_id: 's', student_id: 'u', status: 'active', question_count: 1, history: [] };
InterviewSession.update = async (update, { where }) => {
  if (!Object.entries(where).every(([k, v]) => state[k] === v)) return [0];
  state = { ...state, ...update };
  return [1];
};
try {
  const snapshot = { ...state };
  const outcomes = await Promise.allSettled([
    commitInterviewAnswer(snapshot, { history: [{ answer: 'first' }], question_count: 2, current_question: 'Next' }),
    commitInterviewAnswer(snapshot, { history: [{ answer: 'duplicate' }], question_count: 2, current_question: 'Different' }),
  ]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(state.history[0].answer, 'first');
  assert.equal(state.current_question, 'Next');
  state.status = 'ended';
  await assert.rejects(commitInterviewAnswer({ ...state }, { history: [] }), error => error.status === 409);
  assert.equal(state.history.length, 1);
  console.log('Interview conditional-write regression tests passed (in-memory database adapter)');
} finally {
  InterviewSession.update = original;
}
