export const STAGING_E2E_TARGET = Object.freeze({
  vercelProjectId: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  supabaseRef: 'ghrjongiodziasupakrk',
});

export function syntheticIdentityGroup(email, label) {
  const normalized = String(email || '').toLowerCase();
  if (normalized === `user-${label.toLowerCase()}@staging.synthetic`) return 'legacy';
  return normalized.match(new RegExp(`^orkto-readiness-${label.toLowerCase()}-([a-f0-9]{12})@example\\.invalid$`))?.[1] || null;
}

const productionHosts = new Set([
  'orkto.vercel.app', 'orkto.co', 'www.orkto.co', 'orkto.com.br',
  'orktoverdeiro-production.up.railway.app', 'qneqljlphgkptebsaonb.supabase.co',
]);

export function validateStagingE2EConfig(env) {
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

  const configuredValues = Object.values(env).filter((value) => typeof value === 'string');
  if (configuredValues.some((value) => value.includes('qneqljlphgkptebsaonb')
    || value.includes('prj_XiwDjfbGC8sq8L8zb59lcZA4HUny')
    || /(?:service_role|SUPABASE_ADMIN_KEY)/i.test(value))) {
    return { ok: false, code: 'STAGING_ENVIRONMENT_MISMATCH' };
  }

  return { ok: true, code: 'STAGING_E2E_CONFIG_VALID', baseURL: preview.origin };
}

/** Authenticated inspect plus an ID-scoped deployment list bind the URL before credentials reach a browser. */
export function validateStagingPreviewDeployment(previewUrl, deployment, projectDeployments = []) {
  let expected;
  try { expected = new URL(previewUrl); }
  catch { return { ok: false, code: 'STAGING_PREVIEW_IDENTITY_NOT_VERIFIED' }; }
  const projectId = deployment?.projectId || deployment?.project?.id;
  const deploymentUrl = deployment?.url;
  const actualHost = typeof deploymentUrl === 'string' ? deploymentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() : '';
  const inStagingList = Array.isArray(projectDeployments) && projectDeployments.some(item =>
    item?.url?.toLowerCase() === expected.hostname.toLowerCase()
      && item?.name === 'orkto-staging' && item?.state === 'READY' && item?.target !== 'production');
  if ((projectId && projectId !== STAGING_E2E_TARGET.vercelProjectId)
    || (!projectId && !inStagingList)
    || actualHost !== expected.hostname.toLowerCase()
    || deployment?.target !== 'preview' || deployment?.readyState !== 'READY') {
    return { ok: false, code: 'STAGING_PREVIEW_IDENTITY_NOT_VERIFIED' };
  }
  return { ok: true, code: 'STAGING_PREVIEW_IDENTITY_VERIFIED' };
}
