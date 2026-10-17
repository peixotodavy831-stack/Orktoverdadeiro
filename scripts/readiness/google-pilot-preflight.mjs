import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Offline decision aid only. A supplied inventory is not authentication proof,
// does not enforce admission, and can never authorize activation or deployment.
const TARGET = Object.freeze({
  supabaseRef: 'ghrjongiodziasupakrk',
  vercelProjectId: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  baselineAppSha: 'd693e2f8269759485713fba9c3c2b19f6e4fbc74',
});
const COUNTS = ['authUsers', 'passwordAccounts', 'googleIdentities', 'linkedAccounts',
  'multiWorkspaceUsers', 'privilegedActiveMemberships'];
const FLAGS = ['emailProviderEnabled', 'googleProviderEnabled', 'manualLinkingEnabled',
  'anonymousEnabled', 'signupEnabled', 'confirmEmail', 'pkceConfigured',
  'automaticWorkspaceProvisioning', 'pilotAdmissionEnforced'];
const KEYS = new Set(['schemaVersion', ...Object.keys(TARGET), ...COUNTS, ...FLAGS]);

function validInventory(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === KEYS.size
    && Object.keys(value).every(key => KEYS.has(key))
    && value.schemaVersion === 1
    && Object.keys(TARGET).every(key => typeof value[key] === 'string')
    && COUNTS.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)
    && FLAGS.every(key => typeof value[key] === 'boolean')
    && value.passwordAccounts <= value.authUsers
    && value.linkedAccounts <= value.authUsers
    && value.multiWorkspaceUsers <= value.authUsers;
}

export function evaluateGooglePilotPreflight(inventory) {
  const base = { scope: 'OFFLINE_PREFLIGHT_ONLY', technicalReady: 'NO',
    stagingRecommendation: 'NO_GO', actionsPerformed: [] };
  if (!validInventory(inventory)) {
    return { ...base, status: 'BLOCKED', blockers: ['INVALID_SANITIZED_INVENTORY'] };
  }
  if (Object.entries(TARGET).some(([key, expected]) => inventory[key] !== expected)) {
    return { ...base, status: 'BLOCKED', blockers: ['TARGET_OR_BASELINE_MISMATCH'] };
  }
  const blockers = [];
  if (inventory.passwordAccounts > 0) {
    blockers.push(inventory.emailProviderEnabled
      ? 'LEGACY_AUTH_TRANSITION_REQUIRED' : 'LEGACY_PASSWORD_ACCESS_AT_RISK');
  }
  if (inventory.emailProviderEnabled) blockers.push('PILOT_PASSWORDLESS_ENFORCEMENT_UNPROVEN');
  if (!inventory.googleProviderEnabled) blockers.push('GOOGLE_PROVIDER_DISABLED');
  if (inventory.manualLinkingEnabled) blockers.push('MANUAL_LINKING_REVIEW_REQUIRED');
  if (inventory.anonymousEnabled) blockers.push('ANONYMOUS_AUTH_ENABLED');
  if (!inventory.confirmEmail && inventory.emailProviderEnabled) blockers.push('LEGACY_EMAIL_CONFIRMATION_DISABLED');
  if (!inventory.pkceConfigured) blockers.push('PKCE_REQUIRED');
  if (!inventory.pilotAdmissionEnforced) blockers.push('SERVER_ADMISSION_REQUIRED');
  if (inventory.signupEnabled && inventory.automaticWorkspaceProvisioning && !inventory.pilotAdmissionEnforced) {
    blockers.push('UNAPPROVED_WORKSPACE_PROVISIONING_RISK');
  }
  return { ...base, status: blockers.length ? 'BLOCKED' : 'REVIEW_REQUIRED', blockers,
    // Even a declared ideal configuration is not a runtime negative test.
    remainingVerification: ['PASSWORD_ADD_LOGIN_RECOVERY_DENIAL', 'AUTOMATIC_LINKING_REVIEW',
      'ALLOWLIST_REVOCATION_RLS_EDGE', 'GOOGLE_CALLBACK_STATE_PKCE', 'EXACT_SHA_AUTH_AB_E2E'],
    counts: Object.fromEntries(COUNTS.map(key => [key, inventory[key]])) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('INVALID_ARGUMENTS');
    const raw = await readFile(process.argv[2], 'utf8');
    if (Buffer.byteLength(raw) > 16384) throw new Error('INVENTORY_TOO_LARGE');
    const result = evaluateGooglePilotPreflight(JSON.parse(raw));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 2;
  } catch {
    // Never echo raw JSON, paths, parse errors, environment or credentials.
    process.stderr.write('GOOGLE_PILOT_PREFLIGHT_BLOCKED: INVALID_SANITIZED_INVENTORY\n');
    process.exitCode = 2;
  }
}
