export type FinanceScenarioKey = 'pok' | 'base' | 'favorable';
export type FinancePlanKey = 'starter' | 'pro' | 'business' | 'scale' | 'enterprise' | 'founders' | 'legacy_standard';

export interface AiModelRate {
  provider: string;
  model: string;
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens?: number;
  outputUsdPerMillionTokens: number;
  effectiveFrom?: string;
  active: boolean;
}

export interface FinanceAssumptions {
  currency: 'BRL';
  cogsTargetPercent: number;
  cogsHardCapPercent: number;
  monthlyFixedPlatformCostCents: number;
  infrastructurePerWorkspaceCents: number;
  aiPerWorkspaceCents: number;
  paymentProcessingPercent: number;
  channelPerWorkspaceCents: number;
  openingCashCents: number;
  planPricesCents: Record<FinancePlanKey, number>;
  planMixPercent: Record<FinancePlanKey, number>;
  scenarios: Record<FinanceScenarioKey, { revenueFactor: number; costFactor: number }>;
  usdBrlExchangeRate: number;
  aiModelRates: AiModelRate[];
}

export interface AiUsageRecord {
  workspace_id?: string | null;
  user_id?: string | null;
  provider: string;
  model: string;
  prompt_tokens: number;
  cached_input_tokens?: number;
  completion_tokens: number;
  mode: 'live' | 'simulated';
  created_at?: string;
}

export interface AiUsageCostEstimate {
  estimatedCostCents: number;
  pricedEvents: number;
  unpricedEvents: number;
  simulatedEvents: number;
  byModel: Array<{ provider: string; model: string; events: number; costCents: number }>;
  byWorkspace: Array<{ workspaceId: string; events: number; costCents: number }>;
}

export interface ChannelUsageCostSummary {
  eventCount: number;
  revenueCents: number;
  actualCashCostCents: number | null;
  normalizedCostCents: number | null;
  infrastructureAllocationCents: number | null;
  legacyReportedCostCents: number;
  foreignCurrencyEvents: number;
  byChannel: Array<{ channel: string; events: number; revenueCents: number; actualCashCostCents: number | null; normalizedCostCents: number | null; infrastructureAllocationCents: number | null; legacyReportedCostCents: number }>;
}

export interface ObservedFinanceMetrics {
  actualTechnicalCogsPercent: number | null;
  actualEconomicMarginCents: number;
  actualChannelAdjustedResultCents: number;
  normalizedTechnicalCogsPercent: number | null;
  normalizedEconomicMarginCents: number | null;
  normalizedChannelAdjustedResultCents: number | null;
}

export interface FinanceProjection {
  scenario: FinanceScenarioKey;
  customers: number;
  arpaCents: number;
  mrrCents: number;
  arrCents: number;
  technicalCogsCents: number;
  channelCostsCents: number;
  technicalCogsPercent: number;
  economicMarginCents: number;
  channelAdjustedOperatingResultCents: number;
  pokCashEndCents: number;
  breakEvenCustomers: number | null;
  alerts: string[];
}

export const DEFAULT_FINANCE_ASSUMPTIONS: FinanceAssumptions = {
  currency: 'BRL',
  cogsTargetPercent: 15,
  cogsHardCapPercent: 20,
  monthlyFixedPlatformCostCents: 0,
  infrastructurePerWorkspaceCents: 0,
  aiPerWorkspaceCents: 0,
  paymentProcessingPercent: 0,
  channelPerWorkspaceCents: 0,
  openingCashCents: 0,
  // Proposed values from the prior implementation brief; these are hypotheses, not public prices.
  planPricesCents: { starter: 7990, pro: 14990, business: 29990, scale: 59990, enterprise: 149990, founders: 7990, legacy_standard: 0 },
  // A draft portfolio mix; edit and version before using this as a forecast.
  planMixPercent: { starter: 60, pro: 25, business: 10, scale: 4, enterprise: 1, founders: 0, legacy_standard: 0 },
  scenarios: {
    pok: { revenueFactor: 0.7, costFactor: 1.2 },
    base: { revenueFactor: 1, costFactor: 1 },
    favorable: { revenueFactor: 1.3, costFactor: 0.9 },
  },
  // Provider prices are intentionally empty until the operator enters the contracted/current rate.
  // USD/BRL is also an explicit assumption, never a silently fetched or hardcoded exchange rate.
  usdBrlExchangeRate: 0,
  aiModelRates: [],
};

const roundCents = (value: number) => Math.round(value);

/** Channels, payroll and taxes are tracked separately from technical subscription COGS. */
export function isTechnicalCogsCategory(category: string): boolean {
  return ['infrastructure', 'ai', 'payment_processor', 'other'].includes(category);
}

/** Keep booked/actual costs separate from normalized future-cost assumptions. */
export function calculateObservedFinanceMetrics(input: {
  mrrCents: number;
  actualTechnicalCogsCents: number;
  actualChannelCostsCents: number;
  normalizedTechnicalCogsCents: number | null;
  normalizedChannelCostsCents: number;
}): ObservedFinanceMetrics {
  const percentOfMrr = (costCents: number) => input.mrrCents > 0 ? costCents / input.mrrCents * 100 : null;
  const actualEconomicMarginCents = input.mrrCents - input.actualTechnicalCogsCents;
  const normalizedTechnicalCogsCents = input.normalizedTechnicalCogsCents;
  return {
    actualTechnicalCogsPercent: percentOfMrr(input.actualTechnicalCogsCents),
    actualEconomicMarginCents,
    actualChannelAdjustedResultCents: actualEconomicMarginCents - input.actualChannelCostsCents,
    normalizedTechnicalCogsPercent: normalizedTechnicalCogsCents === null ? null : percentOfMrr(normalizedTechnicalCogsCents),
    normalizedEconomicMarginCents: normalizedTechnicalCogsCents === null ? null : input.mrrCents - normalizedTechnicalCogsCents,
    normalizedChannelAdjustedResultCents: normalizedTechnicalCogsCents === null
      ? null
      : input.mrrCents - normalizedTechnicalCogsCents - input.normalizedChannelCostsCents,
  };
}

/** Channel usage is reported separately from the reconciled finance ledger to prevent double-counting. */
export function summarizeChannelUsageCosts(records: Array<{
  channel: string;
  revenue_cents?: number | null;
  cost_cents?: number | null;
  actual_cash_cost_cents?: number | null;
  normalized_cost_cents?: number | null;
  infrastructure_allocation_cents?: number | null;
  cost_currency?: string | null;
}>): ChannelUsageCostSummary {
  const groups = new Map<string, { events: number; revenueCents: number; actual: number; actualCount: number; normalized: number; normalizedCount: number; infrastructure: number; infrastructureCount: number; legacy: number }>();
  let foreignCurrencyEvents = 0;
  for (const record of records) {
    const channel = record.channel || 'unknown';
    const group = groups.get(channel) ?? { events: 0, revenueCents: 0, actual: 0, actualCount: 0, normalized: 0, normalizedCount: 0, infrastructure: 0, infrastructureCount: 0, legacy: 0 };
    group.events += 1;
    group.revenueCents += Number(record.revenue_cents || 0);
    group.legacy += Number(record.cost_cents || 0);
    const hasTrackedCost = [record.actual_cash_cost_cents, record.normalized_cost_cents, record.infrastructure_allocation_cents]
      .some(value => value !== null && value !== undefined);
    const isBrl = String(record.cost_currency || '').toUpperCase() === 'BRL';
    if (hasTrackedCost && !isBrl) foreignCurrencyEvents += 1;
    if (isBrl) {
      if (record.actual_cash_cost_cents !== null && record.actual_cash_cost_cents !== undefined) { group.actual += Number(record.actual_cash_cost_cents); group.actualCount += 1; }
      if (record.normalized_cost_cents !== null && record.normalized_cost_cents !== undefined) { group.normalized += Number(record.normalized_cost_cents); group.normalizedCount += 1; }
      if (record.infrastructure_allocation_cents !== null && record.infrastructure_allocation_cents !== undefined) { group.infrastructure += Number(record.infrastructure_allocation_cents); group.infrastructureCount += 1; }
    }
    groups.set(channel, group);
  }
  const summarized = [...groups.entries()].map(([channel, group]) => ({
    channel,
    events: group.events,
    revenueCents: group.revenueCents,
    actualCashCostCents: group.actualCount ? group.actual : null,
    normalizedCostCents: group.normalizedCount ? group.normalized : null,
    infrastructureAllocationCents: group.infrastructureCount ? group.infrastructure : null,
    legacyReportedCostCents: group.legacy,
  }));
  const sumKnown = (values: Array<number | null>) => values.some(value => value !== null) ? values.reduce<number>((sum, value) => sum + (value || 0), 0) : null;
  return {
    eventCount: records.length,
    revenueCents: summarized.reduce((sum, row) => sum + row.revenueCents, 0),
    actualCashCostCents: sumKnown(summarized.map(row => row.actualCashCostCents)),
    normalizedCostCents: sumKnown(summarized.map(row => row.normalizedCostCents)),
    infrastructureAllocationCents: sumKnown(summarized.map(row => row.infrastructureAllocationCents)),
    legacyReportedCostCents: summarized.reduce((sum, row) => sum + row.legacyReportedCostCents, 0),
    foreignCurrencyEvents,
    byChannel: summarized.sort((left, right) => left.channel.localeCompare(right.channel)),
  };
}

export function validateFinanceAssumptions(value: unknown): FinanceAssumptions {
  if (!value || typeof value !== 'object') throw new Error('Premissas financeiras inválidas.');
  const input = value as Partial<FinanceAssumptions>;
  const finiteNonNegative = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const cents = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const percentage = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
  const plans = input.planPricesCents as Partial<Record<FinancePlanKey, number>> | undefined;
  const mix = input.planMixPercent as Partial<Record<FinancePlanKey, number>> | undefined;
  const scenarios = input.scenarios;
  if (input.currency !== 'BRL'
    || !percentage(input.cogsTargetPercent)
    || !percentage(input.cogsHardCapPercent)
    || !cents(input.monthlyFixedPlatformCostCents)
    || !cents(input.infrastructurePerWorkspaceCents)
    || !cents(input.aiPerWorkspaceCents)
    || !percentage(input.paymentProcessingPercent)
    || !cents(input.channelPerWorkspaceCents)
    || !cents(input.openingCashCents)
    || !plans || !mix || !scenarios) throw new Error('Revise valores ausentes ou fora dos limites permitidos.');

  const planKeys: FinancePlanKey[] = ['starter', 'pro', 'business', 'scale', 'enterprise', 'founders', 'legacy_standard'];
  const normalizedPrices = { ...DEFAULT_FINANCE_ASSUMPTIONS.planPricesCents, ...plans };
  const normalizedMix = { ...DEFAULT_FINANCE_ASSUMPTIONS.planMixPercent, ...mix };
  for (const key of planKeys) {
    if (!cents(normalizedPrices[key]) || !percentage(normalizedMix[key])) throw new Error(`Premissa inválida para o plano ${key}.`);
  }
  if (Math.abs(planKeys.reduce((sum, key) => sum + normalizedMix[key], 0) - 100) > 0.01) {
    throw new Error('A distribuição de planos precisa somar 100%.');
  }
  for (const key of ['pok', 'base', 'favorable'] as const) {
    const scenario = scenarios[key];
    if (!scenario || !finiteNonNegative(scenario.revenueFactor) || !finiteNonNegative(scenario.costFactor)) {
      throw new Error(`Cenário ${key} inválido.`);
    }
  }
  if (input.cogsHardCapPercent < input.cogsTargetPercent) throw new Error('O hard cap deve ser maior ou igual à meta de COGS.');
  const usdBrlExchangeRate = input.usdBrlExchangeRate ?? 0;
  if (!finiteNonNegative(usdBrlExchangeRate) || usdBrlExchangeRate > 1000) {
    throw new Error('A cotação USD/BRL deve ser um número entre 0 e 1.000.');
  }
  const aiModelRates = input.aiModelRates ?? [];
  if (!Array.isArray(aiModelRates) || aiModelRates.length > 40) throw new Error('Cadastre no máximo 40 tarifas de modelos.');
  const seenModelRates = new Set<string>();
  for (const rate of aiModelRates) {
    if (!rate || typeof rate.provider !== 'string' || rate.provider.trim().length < 1 || rate.provider.length > 80
      || typeof rate.model !== 'string' || rate.model.trim().length < 1 || rate.model.length > 120
      || !finiteNonNegative(rate.inputUsdPerMillionTokens) || rate.inputUsdPerMillionTokens > 1_000_000
      || !finiteNonNegative(rate.outputUsdPerMillionTokens) || rate.outputUsdPerMillionTokens > 1_000_000
      || (rate.cachedInputUsdPerMillionTokens !== undefined && (!finiteNonNegative(rate.cachedInputUsdPerMillionTokens) || rate.cachedInputUsdPerMillionTokens > 1_000_000))
      || (rate.effectiveFrom !== undefined && !Number.isFinite(Date.parse(rate.effectiveFrom)))
      || typeof rate.active !== 'boolean') throw new Error('Tarifa de IA inválida.');
    const key = `${rate.provider.trim().toLowerCase()}:${rate.model.trim().toLowerCase()}:${rate.effectiveFrom || 'legacy'}`;
    if (seenModelRates.has(key)) throw new Error('Provider, modelo e vigência não podem ter tarifas duplicadas.');
    seenModelRates.add(key);
  }
  return { ...input, planPricesCents: normalizedPrices, planMixPercent: normalizedMix, usdBrlExchangeRate, aiModelRates } as FinanceAssumptions;
}

export function estimateAiUsageCost(records: AiUsageRecord[], assumptionsInput: FinanceAssumptions): AiUsageCostEstimate {
  const assumptions = validateFinanceAssumptions(assumptionsInput);
  let unpricedEvents = 0;
  let simulatedEvents = 0;
  let totalUsd = 0;
  const byModel = new Map<string, { provider: string; model: string; events: number; usd: number }>();
  const byWorkspace = new Map<string, { events: number; usd: number }>();
  for (const record of records) {
    if (record.mode !== 'live') {
      simulatedEvents += 1;
      continue;
    }
    const usageAt = record.created_at ? Date.parse(record.created_at) : Number.POSITIVE_INFINITY;
    const rate = assumptions.aiModelRates.filter(item => item.active
      && item.provider.trim().toLowerCase() === record.provider.trim().toLowerCase()
      && item.model.trim().toLowerCase() === record.model.trim().toLowerCase()
      && (!item.effectiveFrom || Date.parse(item.effectiveFrom) <= usageAt))
      .sort((a, b) => Date.parse(b.effectiveFrom || '1970-01-01T00:00:00.000Z') - Date.parse(a.effectiveFrom || '1970-01-01T00:00:00.000Z'))[0];
    if (!rate || assumptions.usdBrlExchangeRate <= 0) {
      unpricedEvents += 1;
      continue;
    }
    const cachedTokens = Math.min(record.prompt_tokens, Math.max(0, record.cached_input_tokens || 0));
    const uncachedTokens = Math.max(0, record.prompt_tokens - cachedTokens);
    const usd = (uncachedTokens * rate.inputUsdPerMillionTokens
      + cachedTokens * (rate.cachedInputUsdPerMillionTokens ?? rate.inputUsdPerMillionTokens)
      + record.completion_tokens * rate.outputUsdPerMillionTokens) / 1_000_000;
    totalUsd += usd;
    const key = `${record.provider}:${record.model}`;
    const aggregate = byModel.get(key) ?? { provider: record.provider, model: record.model, events: 0, usd: 0 };
    aggregate.events += 1;
    aggregate.usd += usd;
    byModel.set(key, aggregate);
    const workspaceId = record.workspace_id || record.user_id;
    if (workspaceId) {
      const workspace = byWorkspace.get(workspaceId) ?? { events: 0, usd: 0 };
      workspace.events += 1;
      workspace.usd += usd;
      byWorkspace.set(workspaceId, workspace);
    }
  }
  const toCents = (usd: number) => Math.round(usd * assumptions.usdBrlExchangeRate * 100);
  return {
    estimatedCostCents: toCents(totalUsd),
    pricedEvents: [...byModel.values()].reduce((sum, item) => sum + item.events, 0),
    unpricedEvents,
    simulatedEvents,
    byModel: [...byModel.values()].map(item => ({
      provider: item.provider, model: item.model, events: item.events, costCents: toCents(item.usd),
    })),
    byWorkspace: [...byWorkspace.entries()].map(([workspaceId, item]) => ({
      workspaceId, events: item.events, costCents: toCents(item.usd),
    })),
  };
}

export function projectFinance(
  assumptionsInput: FinanceAssumptions,
  customers: number,
  scenario: FinanceScenarioKey,
): FinanceProjection {
  const assumptions = validateFinanceAssumptions(assumptionsInput);
  if (!Number.isInteger(customers) || ![10, 100, 1000, 10000].includes(customers)) {
    throw new Error('O simulador aceita 10, 100, 1.000 ou 10.000 clientes.');
  }
  const factors = assumptions.scenarios[scenario];
  const planKeys: FinancePlanKey[] = ['starter', 'pro', 'business', 'scale', 'enterprise', 'founders', 'legacy_standard'];
  const weightedArpa = planKeys.reduce((sum, key) => sum + assumptions.planPricesCents[key] * assumptions.planMixPercent[key] / 100, 0);
  const arpaCents = roundCents(weightedArpa * factors.revenueFactor);
  const mrrCents = arpaCents * customers;
  const arrCents = mrrCents * 12;
  const fixedCogs = assumptions.monthlyFixedPlatformCostCents;
  const workspaceInfra = assumptions.infrastructurePerWorkspaceCents * customers;
  const workspaceAi = assumptions.aiPerWorkspaceCents * customers;
  const processing = mrrCents * assumptions.paymentProcessingPercent / 100;
  const technicalCogsCents = roundCents((fixedCogs + workspaceInfra + workspaceAi + processing) * factors.costFactor);
  const channelCostsCents = roundCents(assumptions.channelPerWorkspaceCents * customers * factors.costFactor);
  const technicalCogsPercent = mrrCents > 0 ? technicalCogsCents / mrrCents * 100 : 0;
  const economicMarginCents = mrrCents - technicalCogsCents;
  const channelAdjustedOperatingResultCents = economicMarginCents - channelCostsCents;
  const contributionPerWorkspace = arpaCents * (1 - assumptions.paymentProcessingPercent / 100)
    - (assumptions.infrastructurePerWorkspaceCents + assumptions.aiPerWorkspaceCents) * factors.costFactor;
  const breakEvenCustomers = contributionPerWorkspace > 0
    ? Math.ceil(fixedCogs * factors.costFactor / contributionPerWorkspace)
    : null;
  const alerts: string[] = [];
  if (technicalCogsCents === 0) alerts.push('Custos técnicos não informados; margem e ponto de equilíbrio ainda não são confiáveis.');
  if (technicalCogsCents > 0 && technicalCogsPercent > assumptions.cogsTargetPercent) alerts.push(`COGS acima da meta de ${assumptions.cogsTargetPercent}%.`);
  if (technicalCogsCents > 0 && technicalCogsPercent > assumptions.cogsHardCapPercent) alerts.push(`COGS acima do hard cap de ${assumptions.cogsHardCapPercent}%.`);
  if (channelCostsCents > 0) alerts.push('Custos de canal aparecem à parte e não entram no COGS técnico da assinatura.');
  const pokCashEndCents = assumptions.openingCashCents + channelAdjustedOperatingResultCents;
  if (pokCashEndCents < 0) alerts.push('Alerta POK Caixa: caixa final projetado abaixo de zero.');
  return {
    scenario, customers, arpaCents, mrrCents, arrCents, technicalCogsCents, channelCostsCents,
    technicalCogsPercent: Number(technicalCogsPercent.toFixed(2)), economicMarginCents,
    channelAdjustedOperatingResultCents, pokCashEndCents,
    breakEvenCustomers, alerts,
  };
}
