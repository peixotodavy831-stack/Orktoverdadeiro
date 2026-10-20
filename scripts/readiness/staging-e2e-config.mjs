export const STAGING_E2E_TARGET = Object.freeze({
  vercelProjectId: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  supabaseRef: 'ghrjongiodziasupakrk',
});

// The historical password harness must never recreate password accounts in a
// Google-only project. Inspect live Auth settings before any administrative write.
export function validatePasswordRunnerMode(settings, env = {}) {
  if (env.ORKTO_AUTH_MODE === 'google_pilot' || env.VITE_ORKTO_AUTH_MODE === 'google_pilot'
    || settings?.external?.email !== true) {
    return { ok: false, code: 'PASSWORD_RUNNER_INCOMPATIBLE_WITH_AUTH_MODE' };
  }
  return { ok: true, code: 'PASSWORD_RUNNER_AUTH_MODE_VALID' };
}

export function syntheticIdentityGroup(email, label) {
  const normalized = String(email || '').toLowerCase();
  if (normalized === `user-${label.toLowerCase()}@staging.synthetic`) return 'legacy';
  return normalized.match(new RegExp(`^orkto-readiness-${label.toLowerCase()}-([a-f0-9]{12})@example\\.invalid$`))?.[1] || null;
}

const productionHosts = new Set([
  'orkto.vercel.app', 'orkto.co', 'www.orkto.co', 'orkto.com.br',
  'orktoverdeiro-production.up.railway.app', 'qneqljlphgkptebsaonb.supabase.co',
]);

export function validateStagingE2ETargetConfig(env) {
  if (env.ORKTO_STAGING_E2E !== '1') return { ok: false, code: 'STAGING_E2E_EXPLICIT_OPT_IN_REQUIRED' };
  if (env.ORKTO_STAGING_VERCEL_PROJECT_ID !== STAGING_E2E_TARGET.vercelProjectId
    || env.ORKTO_STAGING_SUPABASE_REF !== STAGING_E2E_TARGET.supabaseRef) {
    return { ok: false, code: 'STAGING_PROJECT_BOUNDARY_MISMATCH' };
  }

  let preview;
  try { preview = new URL(env.ORKTO_STAGING_PREVIEW_URL || ''); }
  catch { return { ok: false, code: 'STAGING_PREVIEW_URL_REQUIRED_OR_UNSAFE' }; }
  if (preview.protocol !== 'https:' || !preview.hostname.endsWith('.vercel.app')
    || !/staging/i.test(preview.hostname) || preview.port || preview.username || preview.password
    || preview.pathname !== '/' || preview.search || preview.hash
    || productionHosts.has(preview.hostname.toLowerCase())) {
    return { ok: false, code: 'STAGING_PREVIEW_URL_REQUIRED_OR_UNSAFE' };
  }
  if (!/^[a-f0-9]{40}$/i.test(env.ORKTO_STAGING_EXPECTED_SHA || '')) {
    return { ok: false, code: 'STAGING_EXPECTED_SHA_REQUIRED' };
  }

  const configuredValues = Object.values(env).filter((value) => typeof value === 'string');
  if (configuredValues.some((value) => value.includes('qneqljlphgkptebsaonb')
    || value.includes('prj_XiwDjfbGC8sq8L8zb59lcZA4HUny')
    || /(?:service_role|SUPABASE_ADMIN_KEY)/i.test(value))) {
    return { ok: false, code: 'STAGING_ENVIRONMENT_MISMATCH' };
  }

  return { ok: true, code: 'STAGING_E2E_TARGET_VALID', baseURL: preview.origin };
}

export function validateStagingE2EConfig(env) {
  const target = validateStagingE2ETargetConfig(env);
  if (!target.ok) return target;
  const groups = [];
  for (const name of ['A', 'B']) {
    const group = syntheticIdentityGroup(env[`ORKTO_STAGING_E2E_USER_${name}_EMAIL`], name);
    groups.push(group);
    if (!group
      || (env[`ORKTO_STAGING_E2E_USER_${name}_PASSWORD`] || '').length < 12) {
      return { ok: false, code: `STAGING_SYNTHETIC_USER_${name}_REQUIRED` };
    }
  }
  if (groups[0] !== groups[1]) return { ok: false, code: 'STAGING_SYNTHETIC_USERS_MUST_SHARE_BATCH' };
  if (env.ORKTO_STAGING_E2E_USER_A_PASSWORD === env.ORKTO_STAGING_E2E_USER_B_PASSWORD) {
    return { ok: false, code: 'STAGING_SYNTHETIC_PASSWORDS_MUST_DIFFER' };
  }

  return { ...target, code: 'STAGING_E2E_CONFIG_VALID' };
}

/** Pass only Preview access material to the browser child; never the admin key. */
export function stagingPreviewAccessForBrowser(env) {
  const accessUrl = env.ORKTO_STAGING_PREVIEW_ACCESS_URL?.trim();
  const bypass = env.ORKTO_STAGING_E2E_BYPASS_SECRET?.trim();
  const oidc = env.VERCEL_OIDC_TOKEN?.trim();
  if ([accessUrl, bypass, oidc].filter(Boolean).length > 1) return { ok: false, code: 'STAGING_PREVIEW_ACCESS_AMBIGUOUS' };
  if (oidc) {
    try {
      const claims = JSON.parse(Buffer.from(oidc.split('.')[1], 'base64url').toString('utf8'));
      if (!Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
        return { ok: false, code: 'STAGING_OIDC_TOKEN_INVALID_OR_EXPIRED' };
      }
    } catch { return { ok: false, code: 'STAGING_OIDC_TOKEN_INVALID_OR_EXPIRED' }; }
    // Signature and Trusted Source claims are checked by Vercel, not by this
    // local expiry guard. The browser attaches this only to the verified origin.
    return { ok: true, values: { VERCEL_OIDC_TOKEN: oidc } };
  }
  if (accessUrl) {
    let preview;
    let access;
    try {
      preview = new URL(env.ORKTO_STAGING_PREVIEW_URL || '');
      access = new URL(accessUrl);
    } catch { return { ok: false, code: 'STAGING_PREVIEW_ACCESS_URL_REQUIRED_OR_UNSAFE' }; }
    if (access.origin !== preview.origin || access.pathname !== '/'
      || [...access.searchParams.keys()].some(key => key !== '_vercel_share')
      || !access.searchParams.get('_vercel_share') || access.hash) {
      return { ok: false, code: 'STAGING_PREVIEW_ACCESS_URL_REQUIRED_OR_UNSAFE' };
    }
    return { ok: true, values: { ORKTO_STAGING_PREVIEW_ACCESS_URL: accessUrl } };
  }
  if (bypass) return { ok: true, values: { ORKTO_STAGING_E2E_BYPASS_SECRET: bypass } };
  return { ok: false, code: 'STAGING_PREVIEW_ACCESS_REQUIRED' };
}

/** Authenticated inspect plus an ID-scoped deployment list bind URL and SHA before credentials reach a browser. */
export function validateStagingPreviewDeployment(previewUrl, deployment, projectDeployments = [], expectedSha) {
  let expected;
  try { expected = new URL(previewUrl); }
  catch { return { ok: false, code: 'STAGING_PREVIEW_IDENTITY_NOT_VERIFIED' }; }
  const projectId = deployment?.projectId || deployment?.project?.id;
  const deploymentUrl = deployment?.url;
  const actualHost = typeof deploymentUrl === 'string' ? deploymentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() : '';
  // The REST API also returns the explicit legacy `staging` target. Project,
  // host, READY state and exact source SHA remain mandatory below. This target
  // additionally requires the project ID from authenticated inspection, not
  // just a list entry's name. Unknown environments/production remain rejected.
  const previewTarget = target => target === null || target === 'preview'
    || target === 'staging' && projectId === STAGING_E2E_TARGET.vercelProjectId;
  const stagingListEntry = Array.isArray(projectDeployments) && projectDeployments.find(item =>
    item?.url?.toLowerCase() === expected.hostname.toLowerCase()
      && item?.name === 'orkto-staging' && item?.state === 'READY' && previewTarget(item?.target));
  const sourceSha = deployment?.gitSource?.sha || deployment?.meta?.githubCommitSha
    || deployment?.meta?.gitlabCommitSha || deployment?.meta?.bitbucketCommitSha
    || stagingListEntry?.meta?.githubCommitSha || stagingListEntry?.meta?.gitlabCommitSha
    || stagingListEntry?.meta?.bitbucketCommitSha;
  if (!/^[a-f0-9]{40}$/i.test(expectedSha || '') || String(sourceSha || '').toLowerCase() !== expectedSha.toLowerCase()) {
    return { ok: false, code: 'STAGING_PREVIEW_SHA_MISMATCH' };
  }
  if ((projectId && projectId !== STAGING_E2E_TARGET.vercelProjectId)
    || (!projectId && !stagingListEntry)
    || actualHost !== expected.hostname.toLowerCase()
    || !previewTarget(deployment?.target) || deployment?.readyState !== 'READY') {
    return { ok: false, code: 'STAGING_PREVIEW_IDENTITY_NOT_VERIFIED' };
  }
  return { ok: true, code: 'STAGING_PREVIEW_IDENTITY_VERIFIED' };
}
