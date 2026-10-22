// WIA Efficiency Engine R1 — planejador econômico puro.
// Decide a camada de execução (determinística → modelo econômico → escalada),
// verifica autorização de modelo/tarifa/política Pulso e quantifica estimativas,
// sem executar nada, sem tocar saldos e sem inventar modelos ou preços.
// A inferência real continua nos caminhos homologados (wia-service / Edge).

import { classifyWiaTask, createModelRegistry, type WiaTaskClass } from './model-registry.js';
import { routeT0Request, type T0Route } from '../../supabase/functions/orkto-core-mutations/_shared/wia-t0.js';
import {
  REFERENCE_PULSO_MILLI,
  estimateModelCost,
  type ModelTariff,
} from '../../supabase/functions/orkto-core-mutations/_shared/cost-governor.js';

export const EFFICIENCY_PLAN_VERSION = 'R1' as const;

export type ExecutionTier = 1 | 2 | 3;
export type PulsoOperationClass = 'simple' | 'light' | 'normal' | 'complex';
export type EfficiencyCheckStatus = 'passed' | 'blocked' | 'not_required';

/** Política versionada: palavra do código, revisável por revisão. NÃO altera franquias vigentes. */
export const PULSO_CLASS_POLICY_VERSION = 1 as const;

export const PULSO_CLASS_FOR_TASK: Record<WiaTaskClass, PulsoOperationClass> = {
  fast: 'simple',
  standard: 'normal',
  deep: 'complex',
};

export const ESCALATION_POLICY = {
  version: 1,
  maxEscalationSteps: 1,
  maxRetries: 2,
  budgetCapMilli: REFERENCE_PULSO_MILLI.complex,
  requiresJustifiedComplexity: true,
  neverRepeatInference: 'escalated run reuses the same request_key; a repeated attempt re-consumes the existing reservation by id',
} as const;

export interface EfficiencyCheck {
  check: string;
  status: EfficiencyCheckStatus;
  reason?: string;
}

export interface HeuristicTokenEstimate {
  provenance: 'heuristic';
  input_tokens: number;
  output_tokens: number;
  basis: string;
}

export interface ExecutionPlan {
  plan_version: typeof EFFICIENCY_PLAN_VERSION;
  pulso_class_policy_version: number;
  tier: ExecutionTier;
  layer: 'deterministic_t0' | 'model_primary' | 'model_escalated';
  t0_route: { name: string; clarification?: string } | null;
  task_class: WiaTaskClass;
  pulso_class: PulsoOperationClass | null;
  pulso_reference_milli: number | null;
  authorized_model: {
    provider: string;
    model_id: string;
    gateway: string;
    purpose: string;
    enabled: boolean;
  } | null;
  checks: EfficiencyCheck[];
  escalation: {
    allowed: boolean;
    max_steps: number;
    max_retries: number;
    budget_cap_milli: number;
    note: string;
  };
  token_estimate: HeuristicTokenEstimate | null;
  usage_basis: 'zero_inference' | 'heuristic_estimate';
  blocked: boolean;
  block_reasons: string[];
}

const T0_ZERO_COST_BASIS = 'Resposta determinística de leitura autorizada: zero tokens, zero Pulsos, nenhuma inferência.';

function heuristicTokens(message: string, taskClass: WiaTaskClass): HeuristicTokenEstimate {
  const inputTokens = Math.min(12_000, Math.max(1, Math.ceil(message.length / 4)));
  const outputCap = taskClass === 'deep' ? 1400 : taskClass === 'standard' ? 700 : 300;
  return {
    provenance: 'heuristic',
    input_tokens: inputTokens,
    output_tokens: outputCap,
    basis: `Entrada aproximada por caracteres (ceil(len/4)); saída teto por classe de tarefa (${taskClass}). Estimativa de planejamento, não medida.`,
  };
}

function collectBlockReasons(checks: EfficiencyCheck[]): string[] {
  return checks.filter(check => check.status === 'blocked').map(check => check.reason || check.check);
}

export interface PlanInput {
  message: string;
  env?: NodeJS.ProcessEnv;
  tariff?: ModelTariff | null;
  nowMs?: number;
}

export function planExecution(input: PlanInput): ExecutionPlan {
  const message = String(input.message ?? '');
  const env = input.env ?? process.env;
  const nowMs = input.nowMs ?? Date.now();
  const checks: EfficiencyCheck[] = [];

  const route: T0Route | null = message.length > 0 && message.length <= 8_000 ? routeT0Request(message) : null;
  const taskClass: WiaTaskClass = classifyWiaTask(message);
  const tier: ExecutionTier = route ? 1 : taskClass === 'deep' ? 3 : 2;
  const layer: ExecutionPlan['layer'] = tier === 1 ? 'deterministic_t0' : tier === 2 ? 'model_primary' : 'model_escalated';
  const pulsoClass: PulsoOperationClass | null = tier === 1 ? null : PULSO_CLASS_FOR_TASK[taskClass];
  const pulsoReferenceMilli = pulsoClass === null ? null : REFERENCE_PULSO_MILLI[pulsoClass];

  checks.push({ check: 'deterministic_t0_route', status: route ? 'passed' : 'not_required', reason: route ? `roteado para ${route.name}` : undefined });
  checks.push({ check: 'zero_inference_cost', status: route ? 'passed' : 'not_required', reason: route ? T0_ZERO_COST_BASIS : undefined });

  let authorizedModel: ExecutionPlan['authorized_model'] = null;
  if (tier <= 1) {
    checks.push({ check: 'model_authorized', status: 'not_required', reason: 'nenhuma inferência solicitada' });
    checks.push({ check: 'tariff', status: 'not_required' });
    checks.push({ check: 'pulso_reserve', status: 'not_required', reason: 'Nível 1 consome zero Pulsos' });
  } else {
    const registry = createModelRegistry(env);
    const definition = registry[taskClass];
    authorizedModel = {
      provider: definition.provider,
      model_id: definition.modelId,
      gateway: definition.gateway,
      purpose: definition.purpose,
      enabled: definition.enabled,
    };
    checks.push({ check: 'model_authorized',
      status: definition.enabled && definition.purpose !== 'future-opt-in' && Boolean(definition.modelId) ? 'passed' : 'blocked',
      reason: !definition.enabled ? 'credencial ou variável do provedor ausente (WIA_*_MODEL / WIA_*_PROVIDER)'
        : definition.purpose === 'future-opt-in' ? 'provedor existe mas exige opt-in aprovado (future-opt-in)'
        : !definition.modelId ? 'modelo não configurado' : undefined,
    });
    checks.push({ check: 'tariff', status: 'not_required', reason: 'tarifa é verificada na execução (MODEL_TARIFF_REQUIRED sem tarifa aprovada vigente)' });
    checks.push({ check: 'pulso_reserve',
      status: 'not_required',
      reason: `reserva Pulso aplica-se na execução: classe ${pulsoClass}, referência ${pulsoReferenceMilli} milli-Pulso (política versionada; franquias vigentes intocadas)` });
  }

  const tokenEstimate = tier === 1 ? null : heuristicTokens(message, taskClass);
  const blockReasons = collectBlockReasons(checks);

  return {
    plan_version: EFFICIENCY_PLAN_VERSION,
    pulso_class_policy_version: PULSO_CLASS_POLICY_VERSION,
    tier,
    layer,
    t0_route: route ? { name: route.name, ...(route.clarification ? { clarification: route.clarification } : {}) } : null,
    task_class: taskClass,
    pulso_class: pulsoClass,
    pulso_reference_milli: pulsoReferenceMilli,
    authorized_model: authorizedModel,
    checks,
    escalation: tier === 3
      ? { allowed: true, max_steps: ESCALATION_POLICY.maxEscalationSteps, max_retries: ESCALATION_POLICY.maxRetries, budget_cap_milli: ESCALATION_POLICY.budgetCapMilli, note: 'Escalada é o próprio tier 3: uma única subida por mensagem, orçamento teto 4.000 milli-Pulso referência, sem repetição de inferência.' }
      : { allowed: false, max_steps: 0, max_retries: ESCALATION_POLICY.maxRetries, budget_cap_milli: ESCALATION_POLICY.budgetCapMilli, note: 'Escalada só existe em pedidos classificados como deep; Nível 2 executa no modelo econômico autorizado.' },
    token_estimate: tokenEstimate,
    usage_basis: tier === 1 ? 'zero_inference' : 'heuristic_estimate',
    blocked: blockReasons.length > 0,
    block_reasons: blockReasons,
  };
}

/** Estimativa de custo em microusd com tarifa real vigente; null quando a tarifa não autoriza. */
export function estimatePlanCost(plan: ExecutionPlan, tariff: ModelTariff | null | undefined, nowMs = Date.now()): { microusd: number | null; valid: boolean; tariffVersion: number | null } {
  if (!plan.token_estimate || !plan.authorized_model) return { microusd: null, valid: false, tariffVersion: null };
  const estimate = estimateModelCost(tariff ?? null, {
    provider: plan.authorized_model.provider,
    model: plan.authorized_model.model_id,
    input: plan.token_estimate.input_tokens,
    cached: 0,
    output: plan.token_estimate.output_tokens,
  }, nowMs);
  return { microusd: estimate?.microusd ?? null, valid: estimate !== null, tariffVersion: estimate?.tariffVersion ?? null };
}

export interface EfficiencyUsageRow {
  provider: string | null;
  model: string | null;
  task_class: string | null;
  gateway: string | null;
  prompt_tokens: number | null;
  cached_input_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  mode: string | null;
  created_at: string | null;
}

export interface EfficiencyUsageSummary {
  model_path_operations: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_input_tokens: number;
  average_latency_ms: number | null;
  max_latency_ms: number | null;
  by_task_class: Record<string, number>;
  by_model: Array<{ provider: string; model: string; operations: number; total_tokens: number }>;
  skipped_or_invalid_rows: number;
  coverage: {
    deterministic_operations_recorded: false;
    note: string;
  };
}

function toCount(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return 0;
}

function isValidCount(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return (typeof value === 'number' && Number.isInteger(value) && value >= 0)
    || (typeof value === 'string' && /^\d+$/.test(value));
}

/** Agregação pura sobre as linhas de orkto_model_usage. Linhas malformadas são contadas e nunca excluídas silenciosamente. */
export function aggregateEfficiencyUsage(rows:(Array<Record<string, unknown>> | null | undefined), nowMs: number = Date.now()): EfficiencyUsageSummary {
  void nowMs;
  const safe = Array.isArray(rows) ? rows : [];
  let promptTokens = 0; let completionTokens = 0; let cachedTokens = 0; let totalTokens = 0;
  let latencySum = 0; let latencyCount = 0; let maxLatency = 0;
  let operations = 0; let skippedRows = 0;
  const byTaskClass = new Map<string, number>();
  const byModel = new Map<string, { provider: string; model: string; operations: number; total_tokens: number }>();
  for (const row of safe) {
    if (!row || typeof row !== 'object') { skippedRows += 1; continue; }
    if (!isValidCount(row.latency_ms) || !isValidCount(row.total_tokens) || !isValidCount(row.prompt_tokens)
      || !isValidCount(row.completion_tokens) || !isValidCount(row.cached_input_tokens)) { skippedRows += 1; continue; }
    const rowLatency = toCount(row.latency_ms);
    const provider = String(row.provider ?? 'unknown');
    const model = String(row.model ?? 'unknown');
    const taskClass = String(row.task_class || 'unclassified');
    promptTokens += toCount(row.prompt_tokens);
    completionTokens += toCount(row.completion_tokens);
    cachedTokens += toCount(row.cached_input_tokens);
    const rowTotal = toCount(row.total_tokens);
    totalTokens += rowTotal;
    latencySum += rowLatency; latencyCount += 1;
    if (rowLatency > maxLatency) maxLatency = rowLatency;
    operations += 1;
    byTaskClass.set(taskClass, (byTaskClass.get(taskClass) || 0) + 1);
    const key = `${provider}|${model}`;
    const bucket = byModel.get(key) || { provider, model, operations: 0, total_tokens: 0 };
    bucket.operations += 1; bucket.total_tokens += rowTotal; byModel.set(key, bucket);
  }
  return {
    model_path_operations: operations,
    total_tokens: totalTokens,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cached_input_tokens: cachedTokens,
    average_latency_ms: latencyCount ? Math.round(latencySum / latencyCount) : null,
    max_latency_ms: maxLatency > 0 ? maxLatency : null,
    by_task_class: Object.fromEntries([...byTaskClass.entries()].sort(([a], [b]) => a < b ? -1 : 1)),
    by_model: [...byModel.values()].sort((a, b) => b.operations - a.operations || (a.model < b.model ? -1 : 1)),
    skipped_or_invalid_rows: skippedRows,
    coverage: {
      deterministic_operations_recorded: false,
      note: 'O ledger registra somente o caminho de modelo. Consultas determinísticas (T0) de custo zero não aparecem aqui e não são inferidas.',
    },
  };
}

/** Tarifa vigente mais recente para o par provider/model (chamador resolve a leitura). */
export function latestTariffFor(rows: (Record<string, unknown>[] | null | undefined), provider: string, model: string, nowMs = Date.now()): ModelTariff | null {
  const candidates = (Array.isArray(rows) ? rows : [])
    .filter(row => String(row?.provider) === provider && String(row?.model) === model)
    .map(row => ({
      version: Number(row.version),
      provider: String(row.provider),
      model: String(row.model),
      effectiveFrom: String(row.effective_from),
      effectiveUntil: row.effective_until === null || row.effective_until === undefined ? null : String(row.effective_until),
      inputMicrousdPerMillion: Number(row.input_microusd_per_million),
      outputMicrousdPerMillion: Number(row.output_microusd_per_million),
      cachedMicrousdPerMillion: Number(row.cached_microusd_per_million),
    }))
    .filter(tariff => {
      const from = Date.parse(tariff.effectiveFrom);
      if (!Number.isFinite(from) || tariff.version <= 0) return false;
      const until = tariff.effectiveUntil === null ? null : Date.parse(tariff.effectiveUntil);
      return from <= nowMs && (until === null || until > nowMs);
    })
    .sort((a, b) => b.version - a.version);
  return candidates[0] ?? null;
}
