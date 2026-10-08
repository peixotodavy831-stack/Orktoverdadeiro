import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectRouteInventory, renderMatrix } from '../readiness/generate-api-authorization-matrix.mjs';

test('API authorization inventory is generated from server routes and flags review conditions', () => {
  const routes = collectRouteInventory();
  assert.ok(routes.length >= 80, `expected broad route coverage, got ${routes.length}`);
  assert.ok(routes.some(route => route.route === '/api/wia/history' && route.auth === 'YES'));
  assert.ok(routes.some(route => route.route === '/api/proposal/:slug' && route.publicRoute === 'YES'));
  assert.ok(routes.some(route => route.rateLimit.includes('per-process only')));
  const markdown = renderMatrix(routes);
  assert.match(markdown, /REVIEW REQUIRED/);
  assert.match(markdown, /not a distributed limit/i);
});
