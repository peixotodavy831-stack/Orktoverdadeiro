import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quotaSnapshot } from '../src/product/adapters/quota-model.js';

test('quota preserves unknown policy instead of inventing a zero or allowance', () => {
  assert.deepEqual(quotaSnapshot(null, null), { state: 'unknown' });
  assert.deepEqual(quotaSnapshot(0, null), { state: 'unknown' });
});
test('quota uses real consumption, clamps visual percentage and handles exhaustion', () => {
  assert.deepEqual(quotaSnapshot(742, 1000, 258), { state:'known',used:742,limit:1000,remaining:258,percentage:74.2,tone:'normal' });
  assert.equal((quotaSnapshot(80,100) as any).tone,'warning');
  assert.equal((quotaSnapshot(95,100) as any).tone,'warning');
  assert.equal((quotaSnapshot(96,100) as any).tone,'critical');
  assert.equal((quotaSnapshot(150,100,0) as any).percentage,100);
  assert.equal((quotaSnapshot(0,0,0) as any).remaining,0);
});
test('quota rejects inconsistent, negative and non-finite server data', () => {
  for (const [used,limit,remaining] of [[-1,10,11],[1,-10,0],[NaN,10,0],[1,Infinity,0],[5,10,9],[5,10,-1],[5,10,NaN]]) assert.deepEqual(quotaSnapshot(used,limit,remaining),{state:'invalid'});
  assert.equal(quotaSnapshot(0.1,0.3,0.2).state,'known');
});
