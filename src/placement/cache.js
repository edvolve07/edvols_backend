/**
 * Placement Profile Cache
 *
 * In-memory LRU cache for computed student placement profiles.
 * Avoids recomputing profiles on every admin dashboard load.
 *
 * Cache invalidation:
 *   - TTL-based (default 5 minutes)
 *   - Manual invalidation on recalculate
 *   - Auto-stale-while-revalidate for dashboard reads
 */

import { scoringCacheSuffix } from './scoringContext.js';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 2000;

class PlacementCache {
  constructor({ ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this._store = new Map(); // key -> { value, expiresAt, createdAt }
    this._accessOrder = []; // LRU tracking
  }

  _touch(key) {
    const idx = this._accessOrder.indexOf(key);
    if (idx !== -1) this._accessOrder.splice(idx, 1);
    this._accessOrder.push(key);
  }

  _evict() {
    while (this._accessOrder.length > this.maxEntries) {
      const oldest = this._accessOrder.shift();
      this._store.delete(oldest);
    }
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      const idx = this._accessOrder.indexOf(key);
      if (idx !== -1) this._accessOrder.splice(idx, 1);
      return undefined;
    }
    this._touch(key);
    return entry.value;
  }

  set(key, value, ttlMs) {
    const expiresAt = Date.now() + (ttlMs || this.ttlMs);
    this._store.set(key, { value, expiresAt, createdAt: Date.now() });
    this._touch(key);
    this._evict();
  }

  invalidate(key) {
    this._store.delete(key);
    const idx = this._accessOrder.indexOf(key);
    if (idx !== -1) this._accessOrder.splice(idx, 1);
  }

  invalidatePrefix(prefix) {
    const keysToDelete = [];
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) keysToDelete.push(key);
    }
    for (const key of keysToDelete) this.invalidate(key);
  }

  invalidateAll() {
    this._store.clear();
    this._accessOrder = [];
  }

  get size() {
    return this._store.size;
  }

  stats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();
    for (const [, entry] of this._store) {
      if (now > entry.expiresAt) expired++;
      else valid++;
    }
    return { total: this._store.size, valid, expired, maxEntries: this.maxEntries, ttlMs: this.ttlMs };
  }
}

const profileCache = new PlacementCache();
const batchAnalyticsCache = new PlacementCache({ ttlMs: 2 * 60 * 1000, maxEntries: 500 });

function profileKey(studentId) {
  return `profile:${studentId}${scoringCacheSuffix()}`;
}

function batchKey(institutionId, filters = {}) {
  const filterStr = JSON.stringify(filters);
  return `batch:${institutionId}:${filterStr}${scoringCacheSuffix()}`;
}

export {
  PlacementCache,
  profileCache,
  batchAnalyticsCache,
  profileKey,
  batchKey,
};
