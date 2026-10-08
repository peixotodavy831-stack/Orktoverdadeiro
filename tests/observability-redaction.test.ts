import assert from 'node:assert/strict';
import test from 'node:test';
import { redactSensitiveData } from '../backend/observability/structured-logger.js';

test('structured redaction removes credential keys, bearer tokens, JWTs and inline secrets recursively', () => {
  const output = JSON.stringify(redactSensitiveData({
    password: 'test-password',
    authorization: 'Bearer access-token-value',
    nested: {
      refresh_token: 'refresh-token-value',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
      error: 'authorization=Bearer inline-value; request accepted',
      message: 'received eyJabcdefghijk.abcdefghijk.abcdefghijk from provider',
    },
    safe: { requestId: 'request-1', workspaceId: 'workspace-a', errorCode: 'timeout' },
  }));

  for (const secret of ['test-password','access-token-value','refresh-token-value','service-role-value','inline-value','eyJabcdefghijk.abcdefghijk.abcdefghijk']) {
    assert.equal(output.includes(secret), false, `redaction must remove ${secret}`);
  }
  assert.match(output, /requestId/);
  assert.match(output, /workspaceId/);
  assert.match(output, /timeout/);
});

test('redaction bounds recursive and oversized values', () => {
  const nested = { value: 'x'.repeat(5000) };
  assert.equal(String((redactSensitiveData(nested) as { value: string }).value).length, 4000);
  let deep: Record<string, unknown> = {};
  let current = deep;
  for (let index = 0; index < 12; index += 1) {
    const next: Record<string, unknown> = {};
    current.next = next;
    current = next;
  }
  assert.doesNotThrow(() => redactSensitiveData(deep));
});
