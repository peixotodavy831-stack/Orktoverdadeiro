import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { CoreMutationClient, resolveCoreMutationEndpoint } from '../backend/core-mutation-client.js';

const staging = 'https://ghrjongiodziasupakrk.supabase.co';
const production = 'https://qneqljlphgkptebsaonb.supabase.co';

test('the same command endpoint contract resolves independently for staging and production', () => {
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'staging', VITE_SUPABASE_URL: staging }),
    `${staging}/functions/v1/orkto-core-mutations`);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'production', VITE_SUPABASE_URL: production }),
    `${production}/functions/v1/orkto-core-mutations`);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'development', VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }),
    'http://127.0.0.1:54321/functions/v1/orkto-core-mutations');
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'development', NODE_ENV: 'test',
    VITE_SUPABASE_URL: 'http://orkto-test-supabase.invalid' }),
    'http://orkto-test-supabase.invalid/functions/v1/orkto-core-mutations');
});

test('environment mismatch and implicit production routing fail closed', () => {
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'staging', VITE_SUPABASE_URL: production }), null);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'production', VITE_SUPABASE_URL: staging }), null);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'development', VITE_SUPABASE_URL: production }), null);
  assert.equal(resolveCoreMutationEndpoint({ VITE_SUPABASE_URL: staging }), null);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'development', VITE_SUPABASE_URL: 'http://orkto-test-supabase.invalid' }), null);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'production', VITE_SUPABASE_URL: production,
    VERCEL: '1', VERCEL_PROJECT_ID: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc' }), null);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'staging', VITE_SUPABASE_URL: staging,
    VERCEL: '1', VERCEL_PROJECT_ID: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }), null);
  assert.equal(resolveCoreMutationEndpoint({ APP_ENV: 'development', VITE_SUPABASE_URL: staging,
    ORKTO_DEVELOPMENT_SUPABASE_REF: 'ghrjongiodziasupakrk' }), null);
});

test('unconfigured gateway returns CONFIGURATION_REQUIRED without attempting a direct write', async () => {
  let fetchCalls = 0;
  let sentStatus = 0;
  let sentBody: unknown;
  const res = {
    status(code: number) { sentStatus = code; return this; },
    json(body: unknown) { sentBody = body; return this; },
  } as unknown as Response;
  const req = { get() { return undefined; }, requestId: 'test-request' } as unknown as Request;
  const client = new CoreMutationClient({ APP_ENV: 'production', VITE_SUPABASE_URL: staging,
    VITE_SUPABASE_ANON_KEY: 'public-test-key' }, async () => {
    fetchCalls += 1;
    throw new Error('must not fetch');
  });
  const result = await client.invoke(req, res, '11111111-1111-4111-8111-111111111111', 'CREATE_CLIENT', { name: 'Test' });
  assert.equal(result, null);
  assert.equal(fetchCalls, 0);
  assert.equal(sentStatus, 503);
  assert.deepEqual(sentBody, { error: 'Mutation Gateway indisponível.', category: 'CONFIGURATION_REQUIRED' });
});
