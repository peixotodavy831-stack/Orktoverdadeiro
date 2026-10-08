import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  assertStagingBoundary,
  stagingPreviewOrigin,
  PRODUCTION_SUPABASE_REF,
  PRODUCTION_VERCEL_PROJECT_ID,
  STAGING_VERCEL_PROJECT_ID,
  STAGING_SUPABASE_REF,
} from '../backend/staging-boundary.js';

const jwt = (payload: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const staging = () => ({
  APP_ENV: 'staging',
  VITE_APP_ENV: 'staging',
  VITE_SUPABASE_URL: `https://${STAGING_SUPABASE_REF}.supabase.co`,
  APP_URL: 'https://orkto-staging.vercel.app',
  VITE_SUPABASE_ANON_KEY: jwt({ ref: STAGING_SUPABASE_REF, role: 'anon' }),
  ASAAS_ENVIRONMENT: 'sandbox',
  COLLECTIVE_MEMORY_CROSS_WORKSPACE: 'OFF',
  PUBLIC_CASE_PUBLICATION: 'OFF',
});

test('generated Preview origin is allowed only when the staging deployment identity is pinned', () => {
  const env = { ...staging(), VERCEL:'1', VERCEL_ENV:'preview',
    VERCEL_PROJECT_ID:STAGING_VERCEL_PROJECT_ID,
    ORKTO_STAGING_VERCEL_PROJECT_ID:STAGING_VERCEL_PROJECT_ID,
    VERCEL_URL:'orkto-staging-5ee92qdyr-peixoto-s-projects1.vercel.app' };
  assert.equal(stagingPreviewOrigin(env), `https://${env.VERCEL_URL}`);
  assert.equal(stagingPreviewOrigin({ ...env, VERCEL_PROJECT_ID:PRODUCTION_VERCEL_PROJECT_ID }), null);
  assert.equal(stagingPreviewOrigin({ ...env, VERCEL_URL:'orkto.vercel.app' }), null);
  assert.equal(stagingPreviewOrigin({ ...env, VERCEL_URL:'orkto-staging-example.vercel.app.evil.test' }), null);
  assert.equal(stagingPreviewOrigin({ ...env, VERCEL_ENV:'production' }), null);
});

test('accepts only the dedicated staging project and public key', () => {
  assert.doesNotThrow(() => assertStagingBoundary(staging()));
  assert.throws(() => assertStagingBoundary({ ...staging(), VITE_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co` }));
  assert.throws(() => assertStagingBoundary({ ...staging(), VITE_SUPABASE_ANON_KEY: jwt({ ref: PRODUCTION_SUPABASE_REF, role: 'anon' }) }));
  assert.throws(() => assertStagingBoundary({ ...staging(), SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: PRODUCTION_SUPABASE_REF, role: 'service_role' }) }));
  assert.throws(() => assertStagingBoundary({ ...staging(), SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: STAGING_SUPABASE_REF, role: 'anon' }) }));
  assert.throws(() => assertStagingBoundary({ ...staging(), APP_ENV: undefined }));
  assert.throws(() => assertStagingBoundary({ ...staging(), SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: STAGING_SUPABASE_REF, role: 'service_role' }) }));
  assert.throws(() => assertStagingBoundary({ ...staging(), VITE_SUPABASE_ANON_KEY: undefined }));
  assert.throws(() => assertStagingBoundary({ ...staging(), APP_URL: undefined }));
  assert.throws(() => assertStagingBoundary({ ...staging(), APP_URL: 'https://orkto.vercel.app' }));
});

test('rejects production Vercel binding, domains, database references, and webhook URLs', () => {
  assert.throws(() => assertStagingBoundary({ ...staging(), VERCEL_PROJECT_ID: PRODUCTION_VERCEL_PROJECT_ID }));
  assert.throws(() => assertStagingBoundary({ ...staging(), VERCEL_ENV: 'production' }));
  assert.throws(() => assertStagingBoundary({ ...staging(), ASAAS_WEBHOOK_URL: `https://api.${PRODUCTION_SUPABASE_REF}.supabase.co/webhook` }));
  assert.throws(() => assertStagingBoundary({ ...staging(), RESET_REDIRECT_URL: 'https://orkto.com.br/reset' }));
});

test('staging environment mismatches have a stable machine-readable code', () => {
  assert.throws(
    () => assertStagingBoundary({ ...staging(), VITE_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co` }),
    error => error instanceof Error && error.message.startsWith('STAGING_ENVIRONMENT_MISMATCH:'),
  );
  assert.throws(
    () => assertStagingBoundary({ ...staging(), PUBLIC_CASE_PUBLICATION: 'ON' }),
    error => error instanceof Error && error.message.startsWith('STAGING_ENVIRONMENT_MISMATCH:'),
  );
});

test('pins Vercel deployment to the explicitly configured staging project', () => {
  const env = { ...staging(), VERCEL: '1', VERCEL_PROJECT_ID: STAGING_VERCEL_PROJECT_ID };
  assert.throws(() => assertStagingBoundary(env));
  assert.doesNotThrow(() => assertStagingBoundary({ ...env, ORKTO_STAGING_VERCEL_PROJECT_ID: STAGING_VERCEL_PROJECT_ID }));
  assert.throws(() => assertStagingBoundary({ ...env, ORKTO_STAGING_VERCEL_PROJECT_ID: 'prj_other_123' }));
  assert.throws(() => assertStagingBoundary({ ...env, APP_ENV: undefined, VITE_APP_ENV: undefined }));
  assert.throws(() => assertStagingBoundary({ ...staging(), ORKTO_STAGING_VERCEL_PROJECT_ID: STAGING_VERCEL_PROJECT_ID, APP_ENV: undefined, VITE_APP_ENV: undefined }));
});

test('rejects paid providers, external sends, live payment configuration, mocks, and legal activation', () => {
  for (const unsafe of [
    { GEMINI_API_KEY: 'not-a-real-key' },
    { DEEPSEEK_API_KEY: 'not-a-real-key' },
    { RESEND_API_KEY: 'not-a-real-key' },
    { VITE_SENTRY_DSN: 'https://staging-dsn.invalid/1' },
    { WHATSAPP_ACCESS_TOKEN: 'not-a-real-key' },
    { ASAAS_API_KEY: 'not-a-real-key' },
    { STRIPE_MODE: 'live' },
    { ASAAS_ENVIRONMENT: 'production' },
    { COLLECTIVE_MEMORY_LEGAL_APPROVED: 'true' },
    { CASE_STUDY_LEGAL_APPROVED: 'true' },
    { COLLECTIVE_MEMORY_CROSS_WORKSPACE: 'ON' },
    { PUBLIC_CASE_PUBLICATION: 'ON' },
    { ORKTO_ENABLE_MOCK_ROUTES: 'true' },
    { ORKTO_ENABLE_DEMO_LOGIN: 'true' },
  ]) assert.throws(() => assertStagingBoundary({ ...staging(), ...unsafe }));
});

test('opaque public keys require a staging fingerprint; elevated keys are refused', () => {
  const pub = 'sb_publishable_synthetic_staging';
  const admin = 'sb_secret_synthetic_staging';
  const env = {
    ...staging(),
    VITE_SUPABASE_ANON_KEY: pub,
    STAGING_PUBLISHABLE_KEY_SHA256: createHash('sha256').update(pub).digest('hex'),
  };
  assert.doesNotThrow(() => assertStagingBoundary(env));
  assert.throws(() => assertStagingBoundary({ ...env, STAGING_PUBLISHABLE_KEY_SHA256: undefined }));
  assert.throws(() => assertStagingBoundary({ ...env, SUPABASE_SERVICE_ROLE_KEY: admin }));
  assert.throws(() => assertStagingBoundary({ ...env, STAGING_SERVICE_ROLE_KEY_SHA256: createHash('sha256').update(admin).digest('hex') }));
});

test('does not alter non-staging environment behavior', () => {
  assert.doesNotThrow(() => assertStagingBoundary({ VITE_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co` }));
});
