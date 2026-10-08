import { defineConfig } from '@playwright/test';
import { validateStagingE2EConfig } from './scripts/readiness/staging-e2e-config.mjs';

const validated = validateStagingE2EConfig(process.env);
if (!validated.ok) throw new Error(validated.code);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results/staging-e2e',
  // Traces can contain Authorization headers and browser storage. Keep them
  // disabled until a reviewed redaction pipeline exists.
  use: {
    baseURL: validated.baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
