import { test as baseTest } from '@playwright/test';
import { redactSecrets, secretValues } from './staging-browser-security.mjs';

// This fixture tears down before the built-in artifact collector, so request
// diagnostics are redacted before error-context.md is written.
export const test = baseTest.extend<{ redactErrors: void }>({
  redactErrors: [async ({}, use, testInfo) => {
    try { await use(); }
    finally {
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
