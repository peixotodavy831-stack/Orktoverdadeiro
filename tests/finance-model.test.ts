import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateObservedFinanceMetrics, DEFAULT_FINANCE_ASSUMPTIONS, estimateAiUsageCost, isTechnicalCogsCategory, projectFinance, summarizeChannelUsageCosts, validateFinanceAssumptions } from '../backend/finance/finance-model.js';

const configured = {
  ...DEFAULT_FINANCE_ASSUMPTIONS,
  monthlyFixedPlatformCostCents: 200_000,
  infrastructurePerWorkspaceCents: 500,
  aiPerWorkspaceCents: 1_000,
  paymentProcessingPercent: 2,
  channelPerWorkspaceCents: 300,
  openingCashCents: 500_000,
};

test('simulador calcula receita recorrente, ARR, ARPA e ponto de equilíbrio', () => {
  const result = projectFinance(configured, 100, 'base');
  assert.equal(result.arpaCents, 15_440);
  assert.equal(result.mrrCents, 1_544_000);
  assert.equal(result.arrCents, 18_528_000);
  assert.equal(result.breakEvenCustomers, 15);
});

test('custos de canal são separados do COGS técnico e da margem econômica', () => {
  const result = projectFinance(configured, 100, 'base');
  assert.equal(result.technicalCogsCents, 380_880);
  assert.equal(result.channelCostsCents, 30_000);
  assert.equal(result.economicMarginCents, result.mrrCents - result.technicalCogsCents);
  assert.equal(result.channelAdjustedOperatingResultCents, result.economicMarginCents - result.channelCostsCents);
  assert.equal(result.pokCashEndCents, configured.openingCashCents + result.channelAdjustedOperatingResultCents);
});

test('telemetria de canal separa caixa real, custo normalizado, infraestrutura e legado sem dupla contagem', () => {
  const summary = summarizeChannelUsageCosts([
    { channel:'whatsapp', revenue_cents:220, cost_cents:500, actual_cash_cost_cents:500, normalized_cost_cents:800, infrastructure_allocation_cents:50, cost_currency:'BRL' },
    { channel:'email', revenue_cents:0, cost_cents:125, actual_cash_cost_cents:125, normalized_cost_cents:null, infrastructure_allocation_cents:null, cost_currency:'USD' },
  ]);
  assert.equal(summary.eventCount,2);
  assert.equal(summary.revenueCents,220);
  assert.equal(summary.actualCashCostCents,500,'foreign currency is not converted');
  assert.equal(summary.normalizedCostCents,800);
  assert.equal(summary.infrastructureAllocationCents,50);
  assert.equal(summary.legacyReportedCostCents,625,'legacy cost remains separately classified');
  assert.equal(summary.foreignCurrencyEvents,1);
  assert.deepEqual(summary.byChannel.map(row=>row.channel),['email','whatsapp']);
});

test('snapshot observado separa base atual, base normalizada e custos de canal', () => {
  const metrics = calculateObservedFinanceMetrics({
    mrrCents: 100_000,
    actualTechnicalCogsCents: 10_000,
    actualChannelCostsCents: 5_000,
    normalizedTechnicalCogsCents: 20_000,
    normalizedChannelCostsCents: 8_000,
  });
  assert.equal(metrics.actualTechnicalCogsPercent, 10);
  assert.equal(metrics.actualEconomicMarginCents, 90_000);
  assert.equal(metrics.actualChannelAdjustedResultCents, 85_000);
  assert.equal(metrics.normalizedTechnicalCogsPercent, 20);
  assert.equal(metrics.normalizedEconomicMarginCents, 80_000);
  assert.equal(metrics.normalizedChannelAdjustedResultCents, 72_000);

  const withoutNormalizedBasis = calculateObservedFinanceMetrics({
    mrrCents: 100_000,
    actualTechnicalCogsCents: 10_000,
    actualChannelCostsCents: 5_000,
    normalizedTechnicalCogsCents: null,
    normalizedChannelCostsCents: 0,
  });
  assert.equal(withoutNormalizedBasis.normalizedTechnicalCogsPercent, null);
  assert.equal(withoutNormalizedBasis.normalizedEconomicMarginCents, null);
});

test('folha, imposto e canal não são classificados como COGS técnico', () => {
  assert.equal(isTechnicalCogsCategory('infrastructure'), true);
  assert.equal(isTechnicalCogsCategory('ai'), true);
  assert.equal(isTechnicalCogsCategory('payment_processor'), true);
  assert.equal(isTechnicalCogsCategory('channel'), false);
  assert.equal(isTechnicalCogsCategory('people'), false);
  assert.equal(isTechnicalCogsCategory('tax'), false);
  assert.equal(isTechnicalCogsCategory('subscription'), false);
  assert.equal(isTechnicalCogsCategory('unrecognized'), false);
});

test('sinaliza a meta de 15% e o hard cap de 20% sem ocultar custos ausentes', () => {
  const targetWarning = projectFinance({ ...configured, aiPerWorkspaceCents: 0 }, 100, 'base');
  assert.ok(targetWarning.alerts.some(alert => alert.includes('meta de 15%')));
  const highCost = projectFinance({ ...configured, aiPerWorkspaceCents: 5_000 }, 100, 'base');
  assert.ok(highCost.alerts.some(alert => alert.includes('hard cap')));
  assert.ok(highCost.alerts.some(alert => alert.includes('meta de 15%')));
  const missing = projectFinance(DEFAULT_FINANCE_ASSUMPTIONS, 10, 'base');
  assert.ok(missing.alerts.some(alert => alert.includes('não informados')));
});

test('POK Caixa alerta quando a projeção cai abaixo de zero', () => {
  const result = projectFinance({
    ...configured,
    openingCashCents: 0,
    monthlyFixedPlatformCostCents: 10_000_000,
    infrastructurePerWorkspaceCents: 0,
    aiPerWorkspaceCents: 0,
    paymentProcessingPercent: 0,
    channelPerWorkspaceCents: 0,
  }, 10, 'pok');
  assert.ok(result.pokCashEndCents < 0);
  assert.ok(result.alerts.some(alert => alert.includes('POK Caixa')));
});

test('POK, Base e Favorável usam fatores versionáveis sem alterar os volumes simulados', () => {
  const pok = projectFinance(configured, 1000, 'pok');
  const base = projectFinance(configured, 1000, 'base');
  const favorable = projectFinance(configured, 1000, 'favorable');
  assert.equal(pok.customers, 1000);
  assert.equal(pok.mrrCents, Math.round(base.mrrCents * 0.7));
  assert.ok(pok.technicalCogsCents > base.technicalCogsCents);
  assert.ok(favorable.mrrCents > base.mrrCents);
  assert.ok(favorable.technicalCogsCents < Math.round(favorable.mrrCents * 0.9));
});

test('aceita somente volumes do simulador e mix de planos de 100%', () => {
  assert.throws(() => projectFinance(DEFAULT_FINANCE_ASSUMPTIONS, 11, 'base'), /10, 100/);
  assert.throws(() => validateFinanceAssumptions({
    ...DEFAULT_FINANCE_ASSUMPTIONS,
    planMixPercent: { ...DEFAULT_FINANCE_ASSUMPTIONS.planMixPercent, starter: 61 },
  }), /somar 100/);
  assert.throws(() => validateFinanceAssumptions({
    ...DEFAULT_FINANCE_ASSUMPTIONS,
    cogsTargetPercent: 21,
    cogsHardCapPercent: 20,
  }), /hard cap/);
  assert.throws(() => validateFinanceAssumptions({
    ...DEFAULT_FINANCE_ASSUMPTIONS,
    aiPerWorkspaceCents: 12.5,
  }), /fora dos limites/);
});

test('tarifas configuradas estimam custo Gemini por tokens sem misturar simulações', () => {
  const assumptions = validateFinanceAssumptions({
    ...configured,
    usdBrlExchangeRate: 5,
    aiModelRates: [{ provider: 'Gemini', model: 'gemini-flash', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2, active: true }],
  });
  const estimate = estimateAiUsageCost([
    { user_id: 'workspace-a', provider: 'gemini', model: 'gemini-flash', prompt_tokens: 100_000, completion_tokens: 50_000, mode: 'live' },
    { provider: 'gemini', model: 'unknown-model', prompt_tokens: 10, completion_tokens: 10, mode: 'live' },
    { provider: 'mock', model: 'deterministic', prompt_tokens: 0, completion_tokens: 0, mode: 'simulated' },
  ], assumptions);
  assert.equal(estimate.estimatedCostCents, 100);
  assert.equal(estimate.pricedEvents, 1);
  assert.equal(estimate.unpricedEvents, 1);
  assert.equal(estimate.simulatedEvents, 1);
  assert.equal(estimate.byModel[0].costCents, 100);
  assert.deepEqual(estimate.byWorkspace, [{ workspaceId: 'workspace-a', events: 1, costCents: 100 }]);
});

test('telemetria usa workspace_id, tokens em cache e versão de tarifa vigente no evento', () => {
  const assumptions = validateFinanceAssumptions({
    ...configured,
    usdBrlExchangeRate: 5,
    aiModelRates: [
      { provider: 'gemini', model: 'flash', inputUsdPerMillionTokens: 1, cachedInputUsdPerMillionTokens: 0.25, outputUsdPerMillionTokens: 2, effectiveFrom: '2026-01-01T00:00:00.000Z', active: true },
      { provider: 'gemini', model: 'flash', inputUsdPerMillionTokens: 3, cachedInputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 4, effectiveFrom: '2026-09-01T00:00:00.000Z', active: true },
    ],
  });
  const estimate = estimateAiUsageCost([
    { workspace_id: 'tenant-new', user_id: 'owner', provider: 'gemini', model: 'flash', prompt_tokens: 1_000_000, cached_input_tokens: 400_000, completion_tokens: 100_000, mode: 'live', created_at: '2026-02-01T00:00:00.000Z' },
    { workspace_id: 'tenant-new', user_id: 'owner', provider: 'gemini', model: 'flash', prompt_tokens: 1_000_000, cached_input_tokens: 400_000, completion_tokens: 100_000, mode: 'live', created_at: '2026-09-10T00:00:00.000Z' },
  ], assumptions);
  assert.deepEqual(estimate.byWorkspace.map(row => row.workspaceId), ['tenant-new']);
  assert.equal(estimate.byWorkspace[0].events, 2);
  // 2026-02: .6M * $1 + .4M * $.25 + .1M * $2 = $0.9; 2026-09: .6M * $3 + .4M * $1 + .1M * $4 = $2.6.
  assert.equal(estimate.estimatedCostCents, 1750);
});

test('mantém planos Founders e Legacy Standard em premissas antigas sem alterar seu mix', () => {
  const { founders: _founders, legacy_standard: _legacy, ...legacyPrices } = DEFAULT_FINANCE_ASSUMPTIONS.planPricesCents;
  const { founders: _foundersMix, legacy_standard: _legacyMix, ...legacyMix } = DEFAULT_FINANCE_ASSUMPTIONS.planMixPercent;
  const migrated = validateFinanceAssumptions({
    ...DEFAULT_FINANCE_ASSUMPTIONS,
    planPricesCents: legacyPrices,
    planMixPercent: legacyMix,
  });
  assert.equal(migrated.planPricesCents.founders, DEFAULT_FINANCE_ASSUMPTIONS.planPricesCents.founders);
  assert.equal(migrated.planPricesCents.legacy_standard, 0);
  assert.equal(migrated.planMixPercent.legacy_standard, 0);
  assert.equal(projectFinance(migrated, 10, 'base').arpaCents, 15_440);
});

test('tarifas incompletas não inventam custo, modelo inativo não é tarifado e legado segue compatível', () => {
  const { aiModelRates: _rates, usdBrlExchangeRate: _fx, ...legacyAssumptions } = DEFAULT_FINANCE_ASSUMPTIONS;
  const legacy = validateFinanceAssumptions(legacyAssumptions);
  assert.equal(legacy.usdBrlExchangeRate, 0);
  assert.deepEqual(legacy.aiModelRates, []);
  const estimate = estimateAiUsageCost([
    { provider: 'gemini', model: 'flash', prompt_tokens: 1_000_000, completion_tokens: 1_000_000, mode: 'live' },
  ], {
    ...legacy,
    usdBrlExchangeRate: 5,
    aiModelRates: [{ provider: 'gemini', model: 'flash', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 1, active: false }],
  });
  assert.equal(estimate.estimatedCostCents, 0);
  assert.equal(estimate.unpricedEvents, 1);
});

test('premissas rejeitam tarifas duplicadas, negativas e câmbio ausente é marcado como sem preço', () => {
  assert.throws(() => validateFinanceAssumptions({
    ...configured, aiModelRates: [
      { provider: 'Gemini', model: 'flash', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 1, active: true },
      { provider: 'gemini', model: 'FLASH', inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 2, active: true },
    ],
  }), /duplicadas/);
  assert.throws(() => validateFinanceAssumptions({
    ...configured, aiModelRates: [{ provider: 'Gemini', model: 'flash', inputUsdPerMillionTokens: -1, outputUsdPerMillionTokens: 1, active: true }],
  }), /Tarifa de IA inválida/);
  const estimate = estimateAiUsageCost([
    { provider: 'gemini', model: 'flash', prompt_tokens: 1_000_000, completion_tokens: 1_000_000, mode: 'live' },
  ], {
    ...configured,
    usdBrlExchangeRate: 0,
    aiModelRates: [{ provider: 'gemini', model: 'flash', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 1, active: true }],
  });
  assert.equal(estimate.unpricedEvents, 1);
});
