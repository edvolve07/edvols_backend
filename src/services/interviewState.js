import { InterviewSession } from '../database/index.js';
import { HttpError } from '../utils/httpError.js';
import { profileCache, batchAnalyticsCache } from '../placement/cache.js';

// Advance history and question together. A second request with the same
// snapshot cannot overwrite an answer already committed by another worker.
export async function commitInterviewAnswer(session, update) {
  const [count] = await InterviewSession.update(update, {
    where: { session_id: session.session_id, status: 'active', question_count: session.question_count },
  });
  if (!count) throw new HttpError(409, 'This question was already submitted or the interview ended. Reload the session.');
  profileCache.invalidatePrefix(`profile:${session.student_id}`);
  batchAnalyticsCache.invalidateAll();
}
