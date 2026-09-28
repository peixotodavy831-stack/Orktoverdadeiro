import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReadinessDiff,
  compareLedgers,
  comparePostgresVersions,
} from '../compare-readiness-inventories.mjs';

const sections = [
  'tables', 'columns', 'types', 'constraints', 'indexes', 'policies', 'grants',
  'columnGrants', 'schemaGrants', 'defaultPrivileges', 'sequences', 'sequenceGrants',
  'functions', 'functionGrants', 'triggers', 'extensions',
];

function inventory(overrides = {}) {
  return {
    inventory_version: 2,
    captured_at: 'volatile',
    server_version: '17.6',
    server_version_num: 170006,
    server_version_full: 'PostgreSQL 17.6 test build',
    schemas: ['public'],
    ...Object.fromEntries(sections.map((section) => [section, []])),
    ...overrides,
  };
}

test('ledger marks only a verified chronological suffix as expected pending', () => {
  const local = [
    { version: '20260905220031', name: 'initial_schema', sha256: 'local-a' },
    { version: '20260906145611', name: 'billing', sha256: 'local-b' },
    { version: '20260927180000', name: 'advanced', sha256: 'local-c' },
  ];
  const remote = { migrations: [{ version: '20260905220031', name: 'initial_schema' }] };
  const diff = compareLedgers(local, remote);
  assert.deepEqual(diff.map((item) => item.status), ['MATCH', 'EXPECTED_PENDING', 'EXPECTED_PENDING']);
  assert.equal(diff[0].sqlChecksum, 'UNVERIFIED_FROM_REMOTE_LEDGER');
});

test('non-prefix local migration gaps and mismatched names are not assumed pending', () => {
  const local = [
    { version: '20260905220031', name: 'initial_schema', sha256: 'a' },
    { version: '20260927180000', name: 'advanced', sha256: 'b' },
  ];
  const remote = { migrations: [{ version: '20260905220031', name: 'different_sql_name' }] };
  const diff = compareLedgers(local, remote);
  assert.equal(diff.find((item) => item.key.endsWith('20260905220031')).status, 'DIVERGENT');
  assert.equal(diff.find((item) => item.key.endsWith('20260927180000')).status, 'EXPECTED_PENDING');
});

test('schema diff identifies match, expected pending, local-only, remote-only, and divergent objects', () => {
  const targetInventory = inventory({
    tables: [
      { schema: 'public', name: 'same', rls: true },
      { schema: 'public', name: 'waiting', rls: true },
      { schema: 'public', name: 'unexplained', rls: true },
      { schema: 'public', name: 'changed', rls: true },
    ],
  });
  const remoteInventory = inventory({
    tables: [
      { schema: 'public', name: 'same', rls: true },
      { schema: 'public', name: 'remote_extra', rls: true },
      { schema: 'public', name: 'changed', rls: false },
    ],
  });
  const diff = buildReadinessDiff({
    targetInventory,
    remoteInventory,
    localMigrations: [],
    remoteLedger: { migrations: [] },
    expectedPendingKeys: ['tables:public:waiting'],
  });
  const actual = new Map(diff.schemaObjectDiff.map((item) => [item.key, item.status]));
  assert.equal(actual.get('tables:public:same'), 'MATCH');
  assert.equal(actual.get('tables:public:waiting'), 'EXPECTED_PENDING');
  assert.equal(actual.get('tables:public:unexplained'), 'LOCAL_ONLY');
  assert.equal(actual.get('tables:public:remote_extra'), 'REMOTE_ONLY');
  assert.equal(actual.get('tables:public:changed'), 'DIVERGENT');
  assert.equal(diff.status, 'BLOCKED_UNEXPLAINED_DIFFS');
});

test('missing schema sections become UNKNOWN and block staging', () => {
  const target = inventory();
  const remote = inventory();
  delete remote.policies;
  const diff = buildReadinessDiff({
    targetInventory: target,
    remoteInventory: remote,
    localMigrations: [],
    remoteLedger: { migrations: [] },
  });
  assert.ok(diff.schemaObjectDiff.some((item) => item.status === 'UNKNOWN' && item.key === 'policies:*'));
  assert.equal(diff.status, 'BLOCKED_UNEXPLAINED_DIFFS');
});

test('mismatched inventory versions become UNKNOWN and block staging', () => {
  const target = inventory();
  const remote = inventory({ inventory_version: 1 });
  const diff = buildReadinessDiff({
    targetInventory: target,
    remoteInventory: remote,
    localMigrations: [],
    remoteLedger: { migrations: [] },
  });
  assert.ok(diff.schemaObjectDiff.some((item) => item.status === 'UNKNOWN' && item.key === 'inventory:version'));
  assert.equal(diff.status, 'BLOCKED_UNEXPLAINED_DIFFS');
});

test('PostgreSQL minor difference triggers a review and is not treated as migration failure', () => {
  const target = inventory({ server_version: '17.6.0', server_version_num: 170006 });
  const remote = inventory({ server_version: '17.7.0', server_version_num: 170007 });
  const comparison = comparePostgresVersions(target, remote);
  assert.equal(comparison.status, 'MINOR_VERSION_REVIEW');
  assert.equal(comparison.requiresManualReview, true);
});

test('PostgreSQL patch/build version difference is recorded for compatibility review', () => {
  const target = inventory({ server_version: '17.6.0', server_version_num: 170006 });
  const remote = inventory({ server_version: '17.6.1.127', server_version_num: 170006 });
  const comparison = comparePostgresVersions(target, remote);
  assert.equal(comparison.status, 'PATCH_VERSION_REVIEW');
  assert.equal(comparison.requiresManualReview, true);
});
