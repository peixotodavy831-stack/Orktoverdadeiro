import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consumeWindowRateLimit, type RateLimitBucket } from '../supabase/functions/_shared/rate-limit.js';

test('window rate limit rejects after the configured request count and resets on expiry', () => {
  const buckets = new Map<string, RateLimitBucket>();
  for (let request = 0; request < 3; request += 1) {
    assert.equal(consumeWindowRateLimit(buckets, 'token-a', 1_000, { maxRequests: 3, windowMs: 60_000 }), false);
  }
  assert.equal(consumeWindowRateLimit(buckets, 'token-a', 1_001, { maxRequests: 3, windowMs: 60_000 }), true);
  assert.equal(consumeWindowRateLimit(buckets, 'token-a', 61_000, { maxRequests: 3, windowMs: 60_000 }), false);
});

test('expired buckets are removed and high-cardinality keys remain bounded', () => {
  const buckets = new Map<string, RateLimitBucket>();
  for (let index = 0; index < 8; index += 1) {
    consumeWindowRateLimit(buckets, `old-${index}`, 0, { maxEntries: 4, windowMs: 100 });
  }
  assert.equal(buckets.size, 4);

  consumeWindowRateLimit(buckets, 'new', 100, { maxEntries: 4, windowMs: 100 });
  assert.equal(buckets.size, 1);
  assert.equal(buckets.has('new'), true);
});

test('high-cardinality active keys evict oldest entries without exceeding the cap', () => {
  const buckets = new Map<string, RateLimitBucket>();
  for (let index = 0; index < 20; index += 1) {
    consumeWindowRateLimit(buckets, `token-${index}`, index, { maxEntries: 4, windowMs: 60_000 });
    assert.ok(buckets.size <= 4);
  }
  assert.equal(buckets.size, 4);
  assert.equal(buckets.has('token-0'), false);
  assert.equal(buckets.has('token-19'), true);
});
