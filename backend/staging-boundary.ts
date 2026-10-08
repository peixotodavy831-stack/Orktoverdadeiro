import { createHash } from 'node:crypto';

type Environment = Record<string, string | undefined>;

export const STAGING_SUPABASE_REF = 'ghrjongiodziasupakrk';
export const PRODUCTION_SUPABASE_REF = 'qneqljlphgkptebsaonb';
export const PRODUCTION_VERCEL_PROJECT_ID = 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny';
export const STAGING_VERCEL_PROJECT_ID = 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc';
export const STAGING_BOUNDARY_ERROR_CODE = 'STAGING_ENVIRONMENT_MISMATCH';
const STAGING_SUPABASE_URL = `https://${STAGING_SUPABASE_REF}.supabase.co`;
const PRODUCTION_DOMAINS = [
  'orkto.vercel.app',
  'orkto.co',
  'orkto.com.br',
  'orktoverdadeiro-production.up.railway.app',
] as const;

/** Permit the Vercel-generated Preview origin only for the pinned staging project. */
export function stagingPreviewOrigin(env: Environment): string | null {
  if (env.APP_ENV !== 'staging' || env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview'
    || env.VERCEL_PROJECT_ID !== STAGING_VERCEL_PROJECT_ID
    || env.ORKTO_STAGING_VERCEL_PROJECT_ID !== STAGING_VERCEL_PROJECT_ID) return null;
  const host = env.VERCEL_URL || '';
  return /^orkto-staging-[a-z0-9-]+\.vercel\.app$/.test(host) ? `https://${host}` : null;
}

/** Provider, payment, email, and messaging secrets are deliberately unavailable in this staging lane. */
const FORBIDDEN_STAGING_KEYS = [
  'ASAAS_API_KEY', 'ASAAS_WALLET_ID', 'ASAAS_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'MERCADOPAGO_ACCESS_TOKEN',
  'MERCADOPAGO_WEBHOOK_SECRET', 'PAYMENT_PROVIDER_API_KEY',
  'RESEND_API_KEY', 'SMTP_PASSWORD',
  'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY', 'MIMO_API_KEY',
  'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_API_KEY', 'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_SECRET', 'WHATSAPP_TENANT_ID', 'TWILIO_AUTH_TOKEN',
  'SENTRY_DSN',
  'VITE_SENTRY_DSN',
] as const;

function sha256(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

function jwtClaims(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const parts = value.split('.');
  if (parts.length !== 3) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function includesProductionReference(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.includes(PRODUCTION_SUPABASE_REF) || normalized.includes(PRODUCTION_VERCEL_PROJECT_ID.toLowerCase())) return true;
  return PRODUCTION_DOMAINS.some((domain) => normalized.includes(domain));
}

/** Fail closed before a staging build or server can contact another environment. */
export function assertStagingBoundary(env: Environment): void {
  const markedStaging = env.APP_ENV === 'staging' || env.VITE_APP_ENV === 'staging'
    || env.VERCEL_PROJECT_ID === STAGING_VERCEL_PROJECT_ID
    || env.ORKTO_STAGING_VERCEL_PROJECT_ID === STAGING_VERCEL_PROJECT_ID;
  if (!markedStaging) return;

  try {
    validateStagingBoundary(env);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${STAGING_BOUNDARY_ERROR_CODE}:`)) throw error;
    const reason = error instanceof Error ? error.message : 'Unknown staging environment mismatch.';
    throw new Error(`${STAGING_BOUNDARY_ERROR_CODE}: ${reason}`, { cause: error });
  }
}

function validateStagingBoundary(env: Environment): void {

  if (env.APP_ENV !== 'staging' || env.VITE_APP_ENV !== 'staging') {
    throw new Error('Staging requires APP_ENV=staging and VITE_APP_ENV=staging.');
  }

  // Scan every configured endpoint/origin/webhook value, not just the primary app URL.
  for (const [name, raw] of Object.entries(env)) {
    if (raw?.trim() && includesProductionReference(raw)) {
      throw new Error(`Staging environment variable ${name} references production.`);
    }
  }
  if (env.VERCEL_PROJECT_ID === PRODUCTION_VERCEL_PROJECT_ID) {
    throw new Error('Staging cannot run in the production Vercel project.');
  }
  if (env.VERCEL_ENV === 'production') {
    throw new Error('Staging cannot run with VERCEL_ENV=production.');
  }
  if (env.VERCEL === '1') {
    const expectedProjectId = env.ORKTO_STAGING_VERCEL_PROJECT_ID?.trim();
    if (expectedProjectId !== STAGING_VERCEL_PROJECT_ID || env.VERCEL_PROJECT_ID !== STAGING_VERCEL_PROJECT_ID) {
      throw new Error('Staging Vercel deployment requires a pinned ORKTO_STAGING_VERCEL_PROJECT_ID.');
    }
  }

  if (env.VITE_SUPABASE_URL?.replace(/\/$/, '') !== STAGING_SUPABASE_URL) {
    throw new Error(`Staging requires VITE_SUPABASE_URL=${STAGING_SUPABASE_URL}.`);
  }
  if (!/^https:\/\//.test(env.APP_URL || '')) {
    throw new Error('Staging requires an explicit HTTPS APP_URL.');
  }
  if (!/staging/i.test(new URL(env.APP_URL!).hostname)) {
    throw new Error('Staging APP_URL must use an explicitly staging-labeled hostname.');
  }

  const publishable = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!publishable) throw new Error('Staging requires its own Supabase publishable/anon key.');
  const publicClaims = jwtClaims(publishable);
  if (publicClaims) {
    if (publicClaims.ref !== STAGING_SUPABASE_REF || publicClaims.role !== 'anon') {
      throw new Error('Staging requires an anon key issued for the staging Supabase project.');
    }
  } else {
    const expectedHash = env.STAGING_PUBLISHABLE_KEY_SHA256?.trim().toLowerCase();
    if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash) || sha256(publishable) !== expectedHash) {
      throw new Error('Opaque staging publishable keys require a reviewed STAGING_PUBLISHABLE_KEY_SHA256 fingerprint.');
    }
  }

  // Preview must never hold an elevated Supabase credential. Administrative
  // staging work belongs in a separate, authenticated runner or Edge Function.
  if (env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.STAGING_SERVICE_ROLE_KEY_SHA256?.trim()) {
    throw new Error('Staging runtime cannot contain a Supabase service-role credential or fingerprint.');
  }

  for (const key of FORBIDDEN_STAGING_KEYS) {
    if (env[key]?.trim()) throw new Error(`Staging cannot start with ${key} configured.`);
  }
  if (env.ASAAS_ENVIRONMENT === 'production' || env.STRIPE_MODE === 'live' || env.PAYMENT_ENVIRONMENT === 'production') {
    throw new Error('Staging cannot use production payment mode.');
  }
  if (env.COLLECTIVE_MEMORY_LEGAL_APPROVED === 'true' || env.CASE_STUDY_LEGAL_APPROVED === 'true') {
    throw new Error('Staging cannot activate legal-gated features.');
  }
  if (env.COLLECTIVE_MEMORY_CROSS_WORKSPACE !== 'OFF' || env.PUBLIC_CASE_PUBLICATION !== 'OFF') {
    throw new Error('Staging requires COLLECTIVE_MEMORY_CROSS_WORKSPACE=OFF and PUBLIC_CASE_PUBLICATION=OFF.');
  }
  if (env.ORKTO_ENABLE_MOCK_ROUTES === 'true' || env.ORKTO_ENABLE_DEMO_LOGIN === 'true') {
    throw new Error('Staging cannot enable mock routes or demo login.');
  }
}
