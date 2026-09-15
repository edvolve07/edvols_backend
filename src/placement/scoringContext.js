import { AsyncLocalStorage } from 'node:async_hooks';

// Keep one immutable configuration snapshot for the whole request.
export const scoringContext = new AsyncLocalStorage();
export function activeScoringConfig() {
  return scoringContext.getStore() || {};
}
export function scoringCacheSuffix() {
  const config = activeScoringConfig();
  return config.version ? `:${config.version}:${config.updated_at}` : '';
}
