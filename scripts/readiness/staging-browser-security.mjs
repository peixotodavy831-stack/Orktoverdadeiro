import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export function browserTlsEnvironment(env) {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || env.ORKTO_E2E_ALLOW_RUNNER_CA === '1') {
    throw new Error('INSECURE_TLS_OVERRIDE_REJECTED');
  }
  const result = {};
  if (env.NODE_USE_SYSTEM_CA === '1') result.NODE_USE_SYSTEM_CA = '1';
  if (env.NODE_EXTRA_CA_CERTS) {
    if (!isAbsolute(env.NODE_EXTRA_CA_CERTS) || !existsSync(env.NODE_EXTRA_CA_CERTS)) {
      throw new Error('TRUSTED_CA_FILE_REQUIRED');
    }
    result.NODE_EXTRA_CA_CERTS = env.NODE_EXTRA_CA_CERTS;
  }
  return result;
}

export function buildStagingBrowserEnvironment(parent, previewAccess) {
  const child = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT',
    'ORKTO_STAGING_PREVIEW_URL', 'ORKTO_STAGING_EXPECTED_SHA', 'ORKTO_STAGING_E2E_USER_A_EMAIL', 'ORKTO_STAGING_E2E_USER_A_PASSWORD',
    'ORKTO_STAGING_E2E_USER_B_EMAIL', 'ORKTO_STAGING_E2E_USER_B_PASSWORD']) {
    if (parent[name]) child[name] = parent[name];
  }
  Object.assign(child, { CI: '1', ORKTO_STAGING_E2E: '1', ORKTO_STAGING_VERCEL_PROJECT_ID: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
    ORKTO_STAGING_SUPABASE_REF: 'ghrjongiodziasupakrk' }, previewAccess, browserTlsEnvironment(parent));
  return child;
}

export function secretValues(env) {
  return Object.entries(env).filter(([name, value]) => value && /PASSWORD|TOKEN|KEY|SECRET|PREVIEW_ACCESS_URL/i.test(name))
    .map(([, value]) => String(value));
}

export function redactSecrets(input, secrets = []) {
  let text = String(input ?? '');
  for (const value of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
    for (const variant of [value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)]) {
      text = text.split(variant).join('[REDACTED]');
    }
  }
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/(?:sb_secret_|sb_publishable_|github_pat_|gh[pousr]_|sk-(?:proj-)?)[A-Za-z0-9_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/^.*(?:authorization|x-vercel-trusted-oidc-idp-token|x-vercel-protection-bypass|refresh_token|access_token|password|apikey|_vercel_share)\s*["']?\s*[:=].*$/gim, '[REDACTED_CREDENTIAL_LINE]');
}

export function errorClass(error) {
  const text = String(error?.message ?? error ?? '');
  if (/certificate|CERT_|self.signed|unable to verify/i.test(text)) return 'TLS_CERTIFICATE_ERROR';
  if (/timeout|timed out/i.test(text)) return 'TIMEOUT';
  if (/expect\(|AssertionError|toBe|toEqual/i.test(text)) return 'ASSERTION_FAILED';
  return 'TEST_ERROR';
}

// Unstructured error context is withheld, not merely regex-filtered: an unknown
// opaque secret cannot be reliably recognized. Keep only allowlisted status data.
export function sanitizeArtifacts(root, secrets = []) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isSymbolicLink()) { rmSync(file); continue; }
    if (entry.isDirectory()) { sanitizeArtifacts(file, secrets); continue; }
    if (entry.name === '.last-run.json') {
      try {
        const value = JSON.parse(readFileSync(file, 'utf8'));
        writeFileSync(file, JSON.stringify({ status: ['passed', 'failed', 'interrupted'].includes(value.status) ? value.status : 'unknown',
          failedTests: Array.isArray(value.failedTests) ? value.failedTests.filter(id => /^[a-f0-9-]{8,100}$/i.test(id)) : [] }));
      } catch { rmSync(file); }
    } else if (/\.(md|txt|log)$/.test(entry.name)) {
      writeFileSync(file, 'ERROR_CONTEXT_WITHHELD: consult safe test ID, status and error class in runner output.\n');
    } else { rmSync(file); }
  }
}
