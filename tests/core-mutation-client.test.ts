import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

test('web runtime has one publishable JWT path and cannot regain service-role or staging-only writes', async () => {
  const source = await readFile(resolve(process.cwd(), 'backend/core-app.ts'), 'utf8');
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|supabaseServiceKey/);
  assert.doesNotMatch(source, /stagingRequestDb|APP_ENV\s*===\s*['"]staging['"]\s*\?\s*req\.authenticatedSupabase/);
  assert.match(source, /const requestDb = supabaseClient \? createRequestScopedClient\(supabaseClient\) : null/);
  assert.match(source, /const membershipDb = req\.authenticatedSupabase/);
  assert.match(source, /ORKTO_EXTERNAL_MESSAGING_ENABLED !== ['"]true['"]/);
  assert.match(source, /AUDIT_MESSAGE_CONFIGURATION_REQUIRED/);
});

test('WIA preparation uses the explicit mutation lifecycle without a direct persistence fallback', async () => {
  const source = await readFile(resolve(process.cwd(), 'backend/operational-routes.ts'), 'utf8');
  const start = source.indexOf("app.post('/api/wia/route-agent'");
  const end = source.indexOf("app.get('/api/reports'", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(route, /'START_WIA_RUN'/);
  assert.match(route, /'COMPLETE_WIA_RUN'/);
  assert.match(route, /workspaceContext\(req, res, db, false, true\)/,
    'WIA plan enforcement must remain in the Core Mutation Gateway');
  assert.match(route, /const requestDb = req\.authenticatedSupabase \|\| db/,
    'WIA reads must preserve the authenticated caller JWT and RLS context');
  assert.match(route, /requestDb\.from\(['"]quotes['"]\)/);
  assert.match(route, /requestDb\.from\(['"]clients['"]\)/);
  assert.match(route, /requestDb\.from\(['"]profiles['"]\)/);
  assert.match(route, /code === ['"]configuration_error['"][\s\S]*?category:['"]configuration_required['"][\s\S]*?status:['"]CONFIGURATION_REQUIRED['"]/,
    'a disabled AI provider must fail closed as CONFIGURATION_REQUIRED');
  assert.doesNotMatch(route, /\.from\(['"]orkto_wia_(runs|events|actions|tool_calls)['"]\)/);
  assert.doesNotMatch(route, /orkto_consume_plan_usage/);
});

test('proposal publication and public decisions use explicit gateways without a direct persistence fallback', async () => {
  const core = await readFile(resolve(process.cwd(), 'backend/core-app.ts'), 'utf8');
  const operational = await readFile(resolve(process.cwd(), 'backend/operational-routes.ts'), 'utf8');
  const publicClient = await readFile(resolve(process.cwd(), 'backend/public-proposal-client.ts'), 'utf8');
  const publicationStart = core.indexOf('app.post("/api/proposal/generate"');
  const publicationEnd = core.indexOf('app.post("/api/quotes/:quoteId/email"', publicationStart);
  assert.ok(publicationStart >= 0 && publicationEnd > publicationStart);
  const publication = core.slice(publicationStart, publicationEnd);
  const live = operational.slice(operational.indexOf("app.post('/api/live-quotes/from-quote"));
  assert.match(publication, /'PUBLISH_LIVE_QUOTE'/);
  assert.doesNotMatch(publication, /\.from\(['"](?:proposals|quotes|orkto_live_quotes)['"]\)/);
  assert.match(live, /'PUBLISH_LIVE_QUOTE'/);
  assert.match(live, /invokePublicProposal/);
  assert.doesNotMatch(live, /\.from\(['"](?:proposals|quotes|orkto_live_quotes|orkto_live_quote_events)['"]\)\.(?:insert|update|upsert|delete)/);
  assert.match(publicClient, /resolveCoreMutationEndpoint/);
  assert.doesNotMatch(publicClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(core, /LEGACY_LINK_DISABLED/);
  assert.match(core, /Envio externo de proposta está desativado/);
});

test('Quote retention uses the scoped gateway and never returns a raw RPC error', async () => {
  const core = await readFile(resolve(process.cwd(), 'backend/core-app.ts'), 'utf8');
  const start = core.indexOf("app.post('/api/quotes/:quoteId/extend'");
  const end = core.indexOf('app.post("/api/proposal/generate"', start);
  assert.ok(start >= 0 && end > start);
  const route = core.slice(start, end);
  assert.match(route, /'EXTEND_QUOTE_RETENTION'/);
  assert.doesNotMatch(route, /\.rpc\(|error\.message/);
  const edge = await readFile(resolve(process.cwd(), 'supabase/functions/orkto-core-mutations/index.ts'), 'utf8');
  assert.match(edge, /orkto_extend_quote_retention_command/);
});
