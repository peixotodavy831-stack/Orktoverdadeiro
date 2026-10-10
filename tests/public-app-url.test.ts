import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicAppUrlConfigurationError, resolvePublicAppBaseUrl } from '../backend/public-app-url.js';

test('public proposal origin comes only from a canonical configured URL', () => {
  assert.equal(resolvePublicAppBaseUrl({ APP_URL: 'https://staging.example.test/' }), 'https://staging.example.test');
  assert.equal(resolvePublicAppBaseUrl({ APP_URL: 'http://localhost:5173', NODE_ENV: 'test' }), 'http://localhost:5173');
});

test('pinned staging Preview uses its immutable deployment origin for public links', () => {
  const env = { APP_ENV:'staging', VERCEL:'1', VERCEL_ENV:'preview',
    VERCEL_PROJECT_ID:'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
    ORKTO_STAGING_VERCEL_PROJECT_ID:'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
    VERCEL_URL:'orkto-staging-d2f5a4rga-peixoto-s-projects1.vercel.app',
    APP_URL:'https://orkto-staging.vercel.app' };
  assert.equal(resolvePublicAppBaseUrl(env), `https://${env.VERCEL_URL}`);
  assert.equal(resolvePublicAppBaseUrl({ ...env, VERCEL_PROJECT_ID:'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }), env.APP_URL);
  assert.equal(resolvePublicAppBaseUrl({ ...env, VERCEL_URL:'orkto.vercel.app' }), env.APP_URL);
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
