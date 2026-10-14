import { test as baseTest } from '@playwright/test';
import { redactSecrets, secretValues } from './staging-browser-security.mjs';
import { STAGES } from './staging-diagnostics.mjs';
import type { TestInfo } from '@playwright/test';

const phases = new WeakMap<TestInfo, { stage: string; start: number }>();
export function checkpoint(stage: string) {
  if (!STAGES.includes(stage)) throw new Error('UNKNOWN_CHECKPOINT');
  const info = test.info();
  const previous = phases.get(info);
  if (previous) console.log('ORKTO_SAFE_EVENT ' + JSON.stringify({ kind: 'phase', stage: previous.stage, status: 'complete', duration_ms: Math.round(performance.now() - previous.start) }));
  phases.set(info, { stage, start: performance.now() });
  console.log('ORKTO_SAFE_EVENT ' + JSON.stringify({ kind: 'phase', stage, status: 'start', duration_ms: 0 }));
}

// This fixture tears down before the built-in artifact collector, so request
// diagnostics are redacted before error-context.md is written.
export const test = baseTest.extend<{ redactErrors: void }>({
  redactErrors: [async ({}, use, testInfo) => {
    try { await use(); }
    finally {
      const phase = phases.get(testInfo);
      if (phase) console.log('ORKTO_SAFE_EVENT ' + JSON.stringify({ kind: 'phase', stage: phase.stage, status: testInfo.errors.length ? 'failed' : 'complete', duration_ms: Math.round(performance.now() - phase.start) }));
      const secrets = secretValues(process.env);
      for (const error of testInfo.errors) {
        if (error.message) error.message = redactSecrets(error.message, secrets);
        if (error.stack) error.stack = redactSecrets(error.stack, secrets);
        if (error.value) error.value = redactSecrets(error.value, secrets);
        if (error.errorContext) error.errorContext = redactSecrets(error.errorContext, secrets);
      }
    }
  }, { auto: true }],
});
