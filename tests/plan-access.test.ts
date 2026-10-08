import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPlanLimit, hasPlanFeature, normalizePlanKey, resolvePlanAccess } from '../backend/billing/plan-access.js';

const now = Date.parse('2026-09-27T12:00:00.000Z');
const active = (overrides: Record<string, unknown> = {}) => resolvePlanAccess({
  planKey: 'pro', status: 'active', trialEndsAt: null, effectivePriceVersion: 1,
  entitlements: { features: { wia: true }, limits: { seats: 3, monthly_wia_runs: 100, active_proposals: 50 } }, now,
  ...overrides,
});

test('catálogo reconhece seis planos novos, Founders e Legacy Standard; preserva alias legado free', () => {
  assert.equal(normalizePlanKey('free'), 'legacy_standard');
  for (const key of ['starter','pro','business','scale','enterprise','founders','legacy_standard']) assert.equal(normalizePlanKey(key), key);
  assert.equal(normalizePlanKey('unknown'), null);
});

test('trial válido permite operação e trial expirado fica somente leitura', () => {
  const current = resolvePlanAccess({ planKey: 'starter', status: 'trial', trialEndsAt: '2026-09-28T00:00:00.000Z', effectivePriceVersion: 1, now });
  const expired = resolvePlanAccess({ planKey: 'starter', status: 'trial', trialEndsAt: '2026-09-26T00:00:00.000Z', effectivePriceVersion: 1, now });
  assert.equal(current.readOnly, false);
  assert.equal(expired.readOnly, true);
});

test('status ausente ou sem versão de entitlement é configuration-required e somente leitura', () => {
  const missing = resolvePlanAccess({ planKey: 'starter', status: 'active', effectivePriceVersion: null, now });
  assert.equal(missing.configurationRequired, true);
  assert.equal(missing.readOnly, true);
  assert.equal(hasPlanFeature(missing, 'wia'), false);
});

test('entitlement é aplicado por feature e ausência de direito não libera uso', () => {
  const state = active({ entitlements: { features: { wia: false }, limits: {} } });
  assert.equal(hasPlanFeature(state, 'wia'), false);
  assert.equal(hasPlanFeature(active(), 'wia'), true);
});

test('limites de seats, WIA e propostas bloqueiam bypass server-side', () => {
  const entitlements = { limits: { seats: 3, monthly_wia_runs: 100, active_proposals: 50 } };
  assert.deepEqual(checkPlanLimit(entitlements, 'seats', 2), { allowed: true, remaining: 0 });
  assert.deepEqual(checkPlanLimit(entitlements, 'seats', 3), { allowed: false, remaining: 0, reason: 'limit_reached' });
  assert.deepEqual(checkPlanLimit(entitlements, 'monthly_wia_runs', 99), { allowed: true, remaining: 0 });
  assert.deepEqual(checkPlanLimit(entitlements, 'monthly_wia_runs', 100), { allowed: false, remaining: 0, reason: 'limit_reached' });
  assert.deepEqual(checkPlanLimit(entitlements, 'active_proposals', 50), { allowed: false, remaining: 0, reason: 'limit_reached' });
  assert.deepEqual(checkPlanLimit({ limits: {} }, 'seats', 0), { allowed: false, remaining: 0, reason: 'configuration_required' });
  assert.deepEqual(checkPlanLimit({ limits: { seats: null } }, 'seats', 100), { allowed: true, remaining: null });
});

test('preço só é exposto quando uma versão declara explicitamente price_is_public', () => {
  const hidden = active({ priceCents: 7990, priceIsPublic: false });
  const visible = active({ priceCents: 7990, priceIsPublic: true });
  assert.equal(hidden.publicPriceCents, null);
  assert.equal(hidden.publicPriceApproved, false);
  assert.equal(visible.publicPriceCents, 7990);
});
