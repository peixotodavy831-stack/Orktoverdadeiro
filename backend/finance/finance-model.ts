import { REFERENCE_PULSO_MILLI, type OperationClass } from '../../supabase/functions/orkto-core-mutations/_shared/cost-governor.js';
export type FinanceScenarioKey = 'pok' | 'base' | 'favorable';

/** Scenario only: technical class weights, never an allowance or ledger write. */
export function estimatePulsoWorkload(counts: Partial<Record<OperationClass,number>>) {
  if(!counts||typeof counts!=='object'||Array.isArray(counts)||Object.keys(counts).some(key=>!Object.hasOwn(REFERENCE_PULSO_MILLI,key)))throw new Error('PULSO_SCENARIO_INVALID');
  let milli=0;
  for(const [key,weight] of Object.entries(REFERENCE_PULSO_MILLI)){
    const count=counts[key as OperationClass]??0;
    if(!Number.isSafeInteger(count)||count<0||count>1_000_000)throw new Error('PULSO_SCENARIO_INVALID');
    milli+=count*weight;
  }
  return {milli,pulso:milli/1000,basis:'technical_reference_only' as const,policyApproved:false as const};
}
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
  monthlyOperationalExpenseCents: number;
  monthlyFounderCompensationCents: number;
  infrastructurePerWorkspaceCents: number;
  aiPerWorkspaceCents: number;
  paymentProcessingPercent: number;
  fixedPaymentFeeCentsPerCompany: number;
  taxRatePercent: number;
  channelPerWorkspaceCents: number;
  servedCustomersPerCompany: number;
  directCostPerServedCustomerCents: number;
  openingCashCents: number;
  plannedReservePercent: number;
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
  companies: number;
  servedCustomers: number;
  /** @deprecated Alias for companies retained for older dashboard clients. */
  customers: number;
  arpaCents: number;
  mrrCents: number;
  arrCents: number;
  technicalCogsCents: number;
  channelCostsCents: number;
  paymentFeesCents: number;
  taxesCents: number;
  operationalExpensesCents: number;
  founderCompensationCents: number;
  technicalCogsPercent: number | null;
  economicMarginCents: number;
  channelAdjustedOperatingResultCents: number;
  pokCashEndCents: number;
  plannedReserveCents: number;
  reserveShortfallCents: number;
  breakEvenCustomers: number | null;
  alerts: string[];
}

export interface PlanUnitEconomics {
  plan: Exclude<FinancePlanKey, 'enterprise' | 'founders' | 'legacy_standard'>;
  priceCents: number;
  paymentFeesCents: number;
  taxesCents: number;
  variableCostCents: number;
  contributionCents: number;
  contributionPercent: number | null;
  breakEvenCompanies: number | null;
}

export const DEFAULT_FINANCE_ASSUMPTIONS: FinanceAssumptions = {
  currency: 'BRL',
  cogsTargetPercent: 15,
  cogsHardCapPercent: 20,
  monthlyFixedPlatformCostCents: 0,
  monthlyOperationalExpenseCents: 0,
  monthlyFounderCompensationCents: 0,
  infrastructurePerWorkspaceCents: 0,
  aiPerWorkspaceCents: 0,
  paymentProcessingPercent: 0,
  fixedPaymentFeeCentsPerCompany: 0,
  taxRatePercent: 0,
  channelPerWorkspaceCents: 0,
  servedCustomersPerCompany: 0,
  directCostPerServedCustomerCents: 0,
  openingCashCents: 0,
  plannedReservePercent: 40,
  // Four owner-approved prices; Enterprise zero is an excluded simulation placeholder, never an offer.
  planPricesCents: { starter: 7990, pro: 14990, business: 29990, scale: 59990, enterprise: 0, founders: 7990, legacy_standard: 0 },
  // A draft portfolio mix; edit and version before using this as a forecast.
  planMixPercent: { starter: 60, pro: 25, business: 10, scale: 5, enterprise: 0, founders: 0, legacy_standard: 0 },
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
  return ['infrastructure', 'ai'].includes(category);
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

  // New planning fields default only when loading an older versioned assumption record.
  // A displayed zero remains an editable scenario input, never a registered actual.
  const monthlyOperationalExpenseCents = input.monthlyOperationalExpenseCents ?? 0;
  const monthlyFounderCompensationCents = input.monthlyFounderCompensationCents ?? 0;
  const fixedPaymentFeeCentsPerCompany = input.fixedPaymentFeeCentsPerCompany ?? 0;
  const taxRatePercent = input.taxRatePercent ?? 0;
  const servedCustomersPerCompany = input.servedCustomersPerCompany ?? 0;
  const directCostPerServedCustomerCents = input.directCostPerServedCustomerCents ?? 0;
  const plannedReservePercent = input.plannedReservePercent ?? 40;
  if (!cents(monthlyOperationalExpenseCents) || !cents(monthlyFounderCompensationCents)
    || !cents(fixedPaymentFeeCentsPerCompany) || !percentage(taxRatePercent)
    || !finiteNonNegative(servedCustomersPerCompany) || servedCustomersPerCompany > 1_000_000
    || !cents(directCostPerServedCustomerCents) || !percentage(plannedReservePercent)) {
    throw new Error('Revise custos operacionais, tributos, clientes atendidos e meta de reserva.');
  }

  const planKeys: FinancePlanKey[] = ['starter', 'pro', 'business', 'scale', 'enterprise', 'founders', 'legacy_standard'];
  const normalizedPrices = { ...DEFAULT_FINANCE_ASSUMPTIONS.planPricesCents, ...plans };
  const normalizedMix = { ...DEFAULT_FINANCE_ASSUMPTIONS.planMixPercent, ...mix };
  for(const [key,approved] of Object.entries({starter:7990,pro:14990,business:29990,scale:59990})) {
    if(normalizedPrices[key]!==approved)throw new Error('Preço comercial aprovado é imutável; use uma nova decisão e versão.');
  }
  // Historical Enterprise seed was never a commercial price. Exclude it from forecasts until a negotiated contract exists.
  normalizedPrices.enterprise=0;
  if(normalizedMix.enterprise>0)throw new Error('Enterprise exige proposta negociada; retire sua participação do cenário sem contrato.');
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
  return {
    ...input,
    monthlyOperationalExpenseCents,
    monthlyFounderCompensationCents,
    fixedPaymentFeeCentsPerCompany,
    taxRatePercent,
    servedCustomersPerCompany,
    directCostPerServedCustomerCents,
    plannedReservePercent,
    planPricesCents: normalizedPrices,
    planMixPercent: normalizedMix,
    usdBrlExchangeRate,
    aiModelRates,
  } as FinanceAssumptions;
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
  if (!Number.isSafeInteger(customers) || customers < 0 || customers > 1_000_000) {
    throw new Error('Informe uma quantidade inteira de empresas entre 0 e 1.000.000.');
  }
  const factors = assumptions.scenarios[scenario];
  const planKeys: FinancePlanKey[] = ['starter', 'pro', 'business', 'scale', 'enterprise', 'founders', 'legacy_standard'];
  const weightedArpa = planKeys.reduce((sum, key) => sum + assumptions.planPricesCents[key] * assumptions.planMixPercent[key] / 100, 0);
  const arpaCents = roundCents(weightedArpa * factors.revenueFactor);
  const mrrCents = arpaCents * customers;
  const arrCents = mrrCents * 12;
  const servedCustomers = roundCents(customers * assumptions.servedCustomersPerCompany);
  const fixedCogs = assumptions.monthlyFixedPlatformCostCents;
  const workspaceInfra = assumptions.infrastructurePerWorkspaceCents * customers;
  const workspaceAi = assumptions.aiPerWorkspaceCents * customers;
  const processing = mrrCents * assumptions.paymentProcessingPercent / 100
    + customers * assumptions.fixedPaymentFeeCentsPerCompany;
  const technicalCogsCents = roundCents((fixedCogs + workspaceInfra + workspaceAi) * factors.costFactor);
  const channelCostsCents = roundCents((assumptions.channelPerWorkspaceCents * customers
    + assumptions.directCostPerServedCustomerCents * servedCustomers) * factors.costFactor);
  const paymentFeesCents = roundCents(processing * factors.costFactor);
  const taxesCents = roundCents(mrrCents * assumptions.taxRatePercent / 100);
  const operationalExpensesCents = assumptions.monthlyOperationalExpenseCents;
  const founderCompensationCents = assumptions.monthlyFounderCompensationCents;
  const technicalCogsPercent = mrrCents > 0 ? technicalCogsCents / mrrCents * 100 : null;
  const economicMarginCents = mrrCents - technicalCogsCents;
  const channelAdjustedOperatingResultCents = economicMarginCents - channelCostsCents - paymentFeesCents
    - taxesCents - operationalExpensesCents - founderCompensationCents;
  const contributionPerCompany = arpaCents * (1 - assumptions.taxRatePercent / 100)
    - (arpaCents * assumptions.paymentProcessingPercent / 100 + assumptions.fixedPaymentFeeCentsPerCompany) * factors.costFactor
    - (assumptions.infrastructurePerWorkspaceCents + assumptions.aiPerWorkspaceCents + assumptions.channelPerWorkspaceCents
      + assumptions.directCostPerServedCustomerCents * assumptions.servedCustomersPerCompany) * factors.costFactor;
  const fixedMonthlyCosts = fixedCogs * factors.costFactor + operationalExpensesCents + founderCompensationCents;
  const breakEvenCustomers = fixedMonthlyCosts > 0 && contributionPerCompany > 0
    ? Math.ceil(fixedMonthlyCosts / contributionPerCompany)
    : null;
  const plannedReserveCents = roundCents(mrrCents * assumptions.plannedReservePercent / 100);
  const pokCashEndCents = assumptions.openingCashCents + channelAdjustedOperatingResultCents;
  // Negative closing cash adds to the capital needed before the reserve target is met.
  const reserveShortfallCents = Math.max(0, plannedReserveCents - pokCashEndCents);
  const alerts: string[] = [];
  if (fixedMonthlyCosts === 0) alerts.push('Custos fixos mensais não informados; ponto de equilíbrio indisponível.');
  if (technicalCogsCents === 0 && assumptions.infrastructurePerWorkspaceCents === 0 && assumptions.aiPerWorkspaceCents === 0) alerts.push('Custos técnicos não informados; margem econômica ainda é estimativa incompleta.');
  if (technicalCogsCents > 0 && technicalCogsPercent !== null && technicalCogsPercent > assumptions.cogsTargetPercent) alerts.push(`COGS acima da meta de ${assumptions.cogsTargetPercent}%.`);
  if (technicalCogsCents > 0 && technicalCogsPercent !== null && technicalCogsPercent > assumptions.cogsHardCapPercent) alerts.push(`COGS acima do hard cap de ${assumptions.cogsHardCapPercent}%.`);
  if (channelCostsCents > 0) alerts.push('Custos de canal aparecem à parte e não entram no COGS técnico da assinatura.');
  if (assumptions.taxRatePercent === 0) alerts.push('Tributos não parametrizados; o resultado não representa receita líquida fiscal.');
  if (assumptions.paymentProcessingPercent === 0 && assumptions.fixedPaymentFeeCentsPerCompany === 0) alerts.push('Taxas de pagamento não parametrizadas; o resultado não representa recebimento líquido.');
  if (assumptions.servedCustomersPerCompany === 0) alerts.push('Quantidade de clientes atendidos por empresa não informada; custos por atendimento podem estar incompletos.');
  if (reserveShortfallCents > 0) alerts.push('A meta de reserva não cabe no caixa final projetado após as obrigações parametrizadas.');
  if (pokCashEndCents < 0) alerts.push('Alerta POK Caixa: caixa final projetado abaixo de zero.');
  return {
    scenario, companies: customers, customers, servedCustomers, arpaCents, mrrCents, arrCents, technicalCogsCents, channelCostsCents,
    paymentFeesCents, taxesCents, operationalExpensesCents, founderCompensationCents,
    technicalCogsPercent: technicalCogsPercent === null ? null : Number(technicalCogsPercent.toFixed(2)), economicMarginCents,
    channelAdjustedOperatingResultCents, pokCashEndCents, plannedReserveCents, reserveShortfallCents,
    breakEvenCustomers, alerts,
  };
}

export function calculatePlanUnitEconomics(
  assumptionsInput: FinanceAssumptions,
  scenario: FinanceScenarioKey = 'base',
): PlanUnitEconomics[] {
  const assumptions = validateFinanceAssumptions(assumptionsInput);
  const factors = assumptions.scenarios[scenario];
  const keys = ['starter', 'pro', 'business', 'scale'] as const;
  const fixedMonthlyCosts = assumptions.monthlyFixedPlatformCostCents * factors.costFactor
    + assumptions.monthlyOperationalExpenseCents + assumptions.monthlyFounderCompensationCents;
  return keys.map(plan => {
    const priceCents = roundCents(assumptions.planPricesCents[plan] * factors.revenueFactor);
    const taxesCents = roundCents(priceCents * assumptions.taxRatePercent / 100);
    const paymentFeesCents = roundCents((priceCents * assumptions.paymentProcessingPercent / 100
      + assumptions.fixedPaymentFeeCentsPerCompany) * factors.costFactor);
    const variableCostCents = roundCents((assumptions.infrastructurePerWorkspaceCents
      + assumptions.aiPerWorkspaceCents + assumptions.channelPerWorkspaceCents
      + assumptions.directCostPerServedCustomerCents * assumptions.servedCustomersPerCompany) * factors.costFactor);
    const contributionCents = priceCents - taxesCents - paymentFeesCents - variableCostCents;
    return {
      plan,
      priceCents,
      paymentFeesCents,
      taxesCents,
      variableCostCents,
      contributionCents,
      contributionPercent: priceCents > 0 ? Number((contributionCents / priceCents * 100).toFixed(2)) : null,
      breakEvenCompanies: fixedMonthlyCosts > 0 && contributionCents > 0
        ? Math.ceil(fixedMonthlyCosts / contributionCents)
        : null,
    };
  });
}
