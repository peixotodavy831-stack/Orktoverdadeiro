import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStagingMigrationGate, MIGRATION_18_NAME, CORE_MUTATION_MIGRATION_NAMES, STAGING_PROJECT_REF, TARGET_MIGRATION_COUNT } from '../readiness/staging-migration-gate.mjs';

const now = Date.parse('2026-09-28T12:00:00.000Z');
const capture = { capturedAt: new Date(now - 1000).toISOString(), source:{projectRef:STAGING_PROJECT_REF}, rowDataExported:false, migrationSqlExported:false };
const ledger = (count, includeRequired = false) => ({ migrations:Array.from({length:count},(_,index)=>({version:String(20260905000000 + index).padStart(14,'0'),name:`migration_${index}`})).map((item,index)=>includeRequired && index === 17 ? {...item,version:'20261003154759',name:MIGRATION_18_NAME} : includeRequired && index >= 18 && index <= 27 ? {...item,version:String(20261004000000 + index),name:CORE_MUTATION_MIGRATION_NAMES[index-18]} : item) });

test('17-migration staging capture is not treated as a validated app schema', () => {
  const result = evaluateStagingMigrationGate({ capture, ledger:ledger(17), now });
  assert.equal(result.status,'STAGING_SCHEMA_OUTDATED');
  assert.equal(result.expected,TARGET_MIGRATION_COUNT);
  assert.equal(result.actual,17);
  assert.equal(result.migration18Present,false);
});

test('only a fresh capture for the exact staging ref with migrations 18 through 28 passes', () => {
  const result = evaluateStagingMigrationGate({ capture, ledger:ledger(28,true), now });
  assert.equal(result.status,'PASS');
});

test('generated migration versions are accepted only with the exact logical name once', () => {
  const rows = ledger(28,true);
  assert.equal(evaluateStagingMigrationGate({ capture, ledger:rows, now }).code,'STAGING_SCHEMA_CURRENT');
  const wrongName = { migrations: rows.migrations.map((item) => item.name === MIGRATION_18_NAME ? {...item,name:'other_migration'} : item) };
  assert.equal(evaluateStagingMigrationGate({ capture, ledger:wrongName, now }).code,'MIGRATION_LEDGER_DIVERGENT');
  const duplicateName = { migrations: rows.migrations.map((item,index) => index === 0 ? {...item,name:MIGRATION_18_NAME} : item) };
  assert.equal(evaluateStagingMigrationGate({ capture, ledger:duplicateName, now }).code,'MIGRATION_LEDGER_DIVERGENT');
});

test('missing, stale, production, duplicate and malformed ledger evidence fails closed', () => {
  assert.equal(evaluateStagingMigrationGate({ now }).code,'REMOTE_LEDGER_CAPTURE_REQUIRED');
  assert.equal(evaluateStagingMigrationGate({ capture:{...capture,capturedAt:'2026-09-27T00:00:00.000Z'},ledger:ledger(28,true),now }).code,'FRESH_REMOTE_CAPTURE_REQUIRED');
  assert.equal(evaluateStagingMigrationGate({ capture:{...capture,source:{projectRef:'qneqljlphgkptebsaonb'}},ledger:ledger(28,true),now }).code,'STAGING_ENVIRONMENT_MISMATCH');
  assert.equal(evaluateStagingMigrationGate({ capture,ledger:{migrations:[{version:'20260928130000'},{version:'20260928130000'}]},now }).code,'REMOTE_LEDGER_INVALID');
  assert.equal(evaluateStagingMigrationGate({ capture,ledger:ledger(28,false),now }).code,'MIGRATION_LEDGER_DIVERGENT');
});
