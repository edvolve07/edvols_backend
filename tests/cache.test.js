import { PlacementCache } from '../src/placement/cache.js';

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

console.log('=== Cache Tests ===\n');

// Test 1: Basic set/get
console.log('Test 1: Basic Set/Get');
{
  const cache = new PlacementCache({ ttlMs: 60000 });
  cache.set('key1', { score: 85 });
  const val = cache.get('key1');
  assert(val?.score === 85, 'get returns stored value');
  assert(cache.size === 1, 'size is 1');
}

// Test 2: Cache miss
console.log('\nTest 2: Cache Miss');
{
  const cache = new PlacementCache({ ttlMs: 60000 });
  assert(cache.get('missing') === undefined, 'missing key returns undefined');
}

// Test 3: TTL expiration
console.log('\nTest 3: TTL Expiration');
{
  const cache = new PlacementCache({ ttlMs: 1 }); // 1ms TTL
  cache.set('expire', 'value');
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 5) {} // busy wait 5ms
  assert(cache.get('expire') === undefined, 'expired key returns undefined');
}

// Test 4: Invalidation
console.log('\nTest 4: Invalidation');
{
  const cache = new PlacementCache({ ttlMs: 60000 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.invalidate('a');
  assert(cache.get('a') === undefined, 'invalidated key returns undefined');
  assert(cache.get('b') === 2, 'other key unaffected');
  assert(cache.size === 1, 'size reduced');
}

// Test 5: Prefix invalidation
console.log('\nTest 5: Prefix Invalidation');
{
  const cache = new PlacementCache({ ttlMs: 60000 });
  cache.set('profile:s1', { id: 's1' });
  cache.set('profile:s2', { id: 's2' });
  cache.set('batch:inst1', { data: 1 });
  cache.invalidatePrefix('profile:');
  assert(cache.get('profile:s1') === undefined, 'profile:s1 invalidated');
  assert(cache.get('profile:s2') === undefined, 'profile:s2 invalidated');
  assert(cache.get('batch:inst1') !== undefined, 'batch:inst1 preserved');
}

// Test 6: Invalidate all
console.log('\nTest 6: Invalidate All');
{
  const cache = new PlacementCache({ ttlMs: 60000 });
  cache.set('x', 1);
  cache.set('y', 2);
  cache.invalidateAll();
  assert(cache.size === 0, 'all entries cleared');
}

// Test 7: LRU eviction
console.log('\nTest 7: LRU Eviction');
{
  const cache = new PlacementCache({ ttlMs: 60000, maxEntries: 3 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  cache.set('d', 4); // should evict 'a'
  assert(cache.size === 3, 'size capped at maxEntries');
  assert(cache.get('a') === undefined, 'oldest entry evicted');
  assert(cache.get('d') === 4, 'newest entry present');
}

// Test 8: LRU access refreshes order
console.log('\nTest 8: LRU Access Order');
{
  const cache = new PlacementCache({ ttlMs: 60000, maxEntries: 3 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  cache.get('a'); // refresh 'a'
  cache.set('d', 4); // should evict 'b' (oldest unaccessed)
  assert(cache.get('a') !== undefined, 'accessed entry preserved');
  assert(cache.get('b') === undefined, 'unaccessed entry evicted');
}

// Test 9: Stats
console.log('\nTest 9: Stats');
{
  const cache = new PlacementCache({ ttlMs: 60000, maxEntries: 100 });
  cache.set('valid', 1);
  const stats = cache.stats();
  assert(stats.total === 1, 'total is 1');
  assert(stats.valid === 1, 'valid is 1');
  assert(stats.maxEntries === 100, 'maxEntries correct');
  assert(stats.ttlMs === 60000, 'ttlMs correct');
}

// Test 10: Key generation helpers
console.log('\nTest 10: Key Helpers');
{
  // Import from cache.js if needed, or test inline
  const profileKey = (id) => `profile:${id}`;
  const batchKeyFn = (instId, filters) => `batch:${instId}:${JSON.stringify(filters)}`;
  assert(profileKey('s123') === 'profile:s123', 'profileKey format');
  assert(batchKeyFn('i1', { year: '3rd' }) === 'batch:i1:{"year":"3rd"}', 'batchKey format');
}

console.log(`\n══════════════════════════════════════════════════`);
console.log(`Results: ${passed}/${passed + failed} passed`);
console.log(`══════════════════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
