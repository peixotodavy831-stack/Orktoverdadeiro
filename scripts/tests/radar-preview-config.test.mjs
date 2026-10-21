import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Radar branch cannot auto-deploy on push and keeps the readiness branch guard', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled['feat/orkto-radar-2027'], false);
  assert.equal(config.git.deploymentEnabled['production-readiness/*'], false);
  assert.equal(Object.keys(config.git.deploymentEnabled).some(key => key === 'main' || key === 'master'), false);
});
