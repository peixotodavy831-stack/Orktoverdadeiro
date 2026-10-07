export const TARGET_MIGRATION_COUNT = 31;
export const STAGING_PROJECT_REF = 'ghrjongiodziasupakrk';
export const MIGRATION_18_NAME = 'v20260928130000_durable_payment_and_delivery_ledgers';
export const CORE_MUTATION_MIGRATION_NAMES = ['core_client_mutation_gateway','core_client_update_archive_gateway','core_catalog_mutation_gateway','core_deal_mutation_gateway','core_wia_decision_gateway','core_quote_create_gateway','core_inbox_priority_gateway','core_quote_customer_match_guard','core_profile_onboarding_gateway','core_inbox_state_gateway','core_quote_archive_gateway','core_quote_update_gateway','quote_legacy_link_invalidation'];

export function evaluateStagingMigrationGate({ capture, ledger, now = Date.now(), maxAgeMs = 30 * 60 * 1000 }) {
  if (!capture || !ledger || !Array.isArray(ledger.migrations)) {
    return { status: 'CONFIGURATION_REQUIRED', code: 'REMOTE_LEDGER_CAPTURE_REQUIRED', expected: TARGET_MIGRATION_COUNT };
  }
  if (capture.source?.projectRef !== STAGING_PROJECT_REF) {
    return { status: 'BLOCKED', code: 'STAGING_ENVIRONMENT_MISMATCH', expectedProjectRef: STAGING_PROJECT_REF };
  }
  if (capture.rowDataExported !== false || capture.migrationSqlExported !== false) {
    return { status: 'BLOCKED', code: 'UNSAFE_CAPTURE_CONTENT', expectedProjectRef: STAGING_PROJECT_REF };
  }
  const capturedAt = Date.parse(capture.capturedAt || '');
  if (!Number.isFinite(capturedAt) || capturedAt > now || now - capturedAt > maxAgeMs) {
    return { status: 'CONFIGURATION_REQUIRED', code: 'FRESH_REMOTE_CAPTURE_REQUIRED', expectedProjectRef: STAGING_PROJECT_REF };
  }

  const versions = ledger.migrations.map((item) => String(item.version || ''));
  const migration18Entries = ledger.migrations.filter((item) => item.name === MIGRATION_18_NAME);
  const coreMutationCounts = CORE_MUTATION_MIGRATION_NAMES.map((name) => ledger.migrations.filter((item) => item.name === name).length);
  if (versions.some((version) => !/^\d{14}$/.test(version)) || new Set(versions).size !== versions.length) {
    return { status: 'BLOCKED', code: 'REMOTE_LEDGER_INVALID', expected: TARGET_MIGRATION_COUNT, actual: versions.length };
  }
  if (migration18Entries.length > 1 || coreMutationCounts.some((count) => count > 1)) {
    return { status: 'BLOCKED', code: 'MIGRATION_LEDGER_DIVERGENT', expected: TARGET_MIGRATION_COUNT, actual: versions.length, migration18Present: true };
  }
  const actual = versions.length;
  if (actual !== TARGET_MIGRATION_COUNT) {
    return {
      status: 'STAGING_SCHEMA_OUTDATED', code: 'STAGING_SCHEMA_OUTDATED',
      expected: TARGET_MIGRATION_COUNT, actual,
      migration18Present: migration18Entries.length === 1,
    };
  }
  if (migration18Entries.length !== 1 || coreMutationCounts.some((count) => count !== 1)) {
    return { status: 'BLOCKED', code: 'MIGRATION_LEDGER_DIVERGENT', expected: TARGET_MIGRATION_COUNT, actual, migration18Present: false };
  }
  return { status: 'PASS', code: 'STAGING_SCHEMA_CURRENT', expected: TARGET_MIGRATION_COUNT, actual, migration18Present: true };
}
