import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicAppUrlConfigurationError, resolvePublicAppBaseUrl } from '../backend/public-app-url.js';

test('public proposal origin comes only from a canonical configured URL', () => {
  assert.equal(resolvePublicAppBaseUrl({ APP_URL: 'https://staging.example.test/' }), 'https://staging.example.test');
  assert.equal(resolvePublicAppBaseUrl({ APP_URL: 'http://localhost:5173', NODE_ENV: 'test' }), 'http://localhost:5173');
});

test('public proposal origin rejects missing production config and unsafe URLs', () => {
  for (const env of [
    { NODE_ENV: 'production' },
    { APP_URL: 'javascript:alert(1)', NODE_ENV: 'production' },
    { APP_URL: 'http://attacker.example', NODE_ENV: 'production' },
    { APP_URL: 'https://user:pass@example.test', NODE_ENV: 'production' },
    { APP_URL: 'https://example.test/other-path', NODE_ENV: 'production' },
  ]) assert.throws(() => resolvePublicAppBaseUrl(env), PublicAppUrlConfigurationError);
});
