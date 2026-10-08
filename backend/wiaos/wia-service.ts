import type { WiaAgentId, WiaChatTurn, WiaOperationalContext, WiaServiceResult } from './contracts.js';
import { wiaDecisionSchema } from './contracts.js';
import type { ToolExecutionContext } from './core-contracts.js';
import type { ToolRegistry } from './tool-registry.js';
import { enforceServerGuardrails, getModelProvider } from './model-provider.js';
import { classifyWiaTask } from './model-registry.js';
import { routeSwarmAgent } from '../orkto-core/full-operational.js';
import { randomUUID } from 'node:crypto';

type T0Route = { name: string; input: Record<string, unknown>; clarification?: string };

export function routeT0Request(message: string): T0Route | null {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(vendas?|vendemos|vendeu|faturamento)\b/.test(text) && /\bhoje\b/.test(text)) return { name: 'get_sales_today', input: {} };
  if (/\b(or[cç]amentos?|propostas?)\b/.test(text) && /\b(abertos?|pendentes?|sem resposta)\b/.test(text)) return { name: 'get_open_quotes', input: {} };
  if (/\b(aprovacoes?|decisoes?)\b/.test(text) && /\b(pendentes?|aguardando|esperando)\b/.test(text)) return { name: 'get_pending_approvals', input: {} };
  const phone = message.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s-]?\d{4}/)?.[0];
  if (/\b(risco|calote|inadimplencia|memoria|preferencia|combinado|historico)\b/.test(text)) {
    if (phone) return { name: 'get_customer_operational_context', input: { phone: phone.replace(/\D/g, '') } };
    const customerId = message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
    if (customerId) return { name: 'get_customer_operational_context', input: { customerId } };
    return { name: 'get_customer_operational_context', input: {}, clarification: 'Para consultar risco e memórias sem confundir clientes, envie o telefone ou o ID do cliente.' };
  }
  if (/\b(cliente|contato)\b/.test(text) && phone) return { name: 'get_customer', input: { phone: phone.replace(/\D/g, '') } };
  return null;
}

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function messageForTool(name: string, output: unknown): string {
  const data = output as Record<string, unknown>;
  if (name === 'get_sales_today') return `Hoje há ${data.salesCount} venda(s) aprovada(s), totalizando ${brl(Number(data.total))}.`;
  if (name === 'get_open_quotes') return `Há ${data.count} orçamento(s) aberto(s), totalizando ${brl(Number(data.total))}.`;
  if (name === 'get_pending_approvals') return `Há ${data.count} aprovação(ões) aguardando sua decisão.`;
  if (name === 'get_customer') {
    const customer = data.customer as { name?: string; company?: string | null; quote_count?: number } | null;
    return customer ? `${customer.name}${customer.company ? `, da ${customer.company}` : ''}, possui ${customer.quote_count ?? 0} orçamento(s) registrado(s).` : 'Não encontrei esse cliente neste workspace.';
  }
  if (name === 'get_customer_operational_context') {
    const context = data.context as {
      customer?: { name?: string; company?: string | null };
      risk?: { score?: number; confidence?: number; reasons?: unknown[]; recommended_action?: string } | null;
      memories?: Array<{ memory_type?: string; content?: Record<string, unknown>; confidence?: number | null }>;
    } | null;
    if (!context?.customer) return 'Não encontrei esse cliente neste workspace. Nenhum dado foi alterado.';
    const risk = context.risk;
    const riskLevel = risk ? (Number(risk.score) >= 85 ? 'crítico' : Number(risk.score) >= 60 ? 'alto' : Number(risk.score) >= 30 ? 'médio' : 'baixo') : null;
    const reasons = risk?.reasons?.filter((reason): reason is string => typeof reason === 'string').slice(0, 3) || [];
    const riskText = risk
      ? `Risco ${riskLevel} (${Math.round(Number(risk.score))}/100; confiança ${Math.round(Number(risk.confidence) * 100)}%).${reasons.length ? ` Sinais: ${reasons.join('; ')}.` : ''} Próxima ação recomendada: ${risk.recommended_action || 'revisar o contexto'}.`
      : 'Ainda não há uma avaliação de risco registrada.';
    const memories = context.memories || [];
    const memoryText = memories.length
      ? `Memórias comerciais ativas: ${memories.slice(0, 3).map(memory => `${memory.memory_type}: ${JSON.stringify(memory.content || {}).slice(0, 180)}`).join(' | ')}.`
      : 'Não há memórias comerciais ativas para este cliente.';
    return `${context.customer.name}${context.customer.company ? `, da ${context.customer.company}` : ''}. ${riskText} ${memoryText}`;
  }
  return 'Consulta concluída.';
}

export async function decideWithWia(input: {
  message: string;
  context: WiaOperationalContext;
  sourceIds: string[];
  history?: WiaChatTurn[];
  agent?: WiaAgentId;
  toolRuntime?: { registry: ToolRegistry; context: ToolExecutionContext };
}): Promise<WiaServiceResult> {
  const runId = input.toolRuntime?.context.traceId || randomUUID();
  const agent = input.agent || routeSwarmAgent(input.message);
  const route = routeT0Request(input.message);
  if (route && !input.toolRuntime) {
    return {
      decision: wiaDecisionSchema.parse({
        action: 'ask_clarification', messageDraft: route.clarification || 'A consulta operacional está indisponível agora. Nenhuma ação foi executada.',
        sourceIds: [], confidenceSignal: route.clarification ? 'high' : 'low', requiresApproval: false, reasonCode: route.clarification ? 't0_customer_identifier_required' : 't0_runtime_unavailable',
      }),
      usage: { provider: 'none', modelFamily: 'deterministic', gateway: 'local', model: 't0-deterministic', requestedModel: 't0-deterministic', selectedModel: 't0-deterministic', actualModel: 't0-deterministic', taskType: 'fast', fallbackUsed: false, promptTokens: 0, cachedInputTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0, status: 'succeeded' },
      mode: 'simulated', path: 't0', toolExecutions: [], runId, agent,
    };
  }
  if (route && input.toolRuntime) {
    if (route.clarification) {
      return {
        decision: wiaDecisionSchema.parse({ action: 'ask_clarification', messageDraft: route.clarification, sourceIds: [], confidenceSignal: 'high', requiresApproval: false, reasonCode: 't0_customer_identifier_required' }),
        usage: { provider: 'none', modelFamily: 'deterministic', gateway: 'local', model: 't0-deterministic', requestedModel: 't0-deterministic', selectedModel: 't0-deterministic', actualModel: 't0-deterministic', taskType: 'fast', fallbackUsed: false, promptTokens: 0, cachedInputTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0, status: 'succeeded' },
        mode: 'live', path: 't0', toolExecutions: [], runId, agent,
      };
    }
    const run = await input.toolRuntime.registry.execute(route.name, route.input, input.toolRuntime.context);
    const failed = run.execution.status === 'failed';
    return {
      decision: wiaDecisionSchema.parse({
        action: failed ? 'ask_clarification' : 'answer',
        messageDraft: failed ? 'Não consegui consultar esses dados agora. Nenhuma ação foi executada.' : messageForTool(route.name, run.output),
        sourceIds: run.execution.sourceIds,
        confidenceSignal: failed ? 'low' : 'high',
        requiresApproval: false,
        reasonCode: failed ? 't0_tool_unavailable' : `t0_${route.name}`,
      }),
      usage: { provider: 'none', modelFamily: 'deterministic', gateway: 'local', model: 't0-deterministic', requestedModel: 't0-deterministic', selectedModel: 't0-deterministic', actualModel: 't0-deterministic', taskType: 'fast', fallbackUsed: false, promptTokens: 0, cachedInputTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: run.execution.durationMs, status: 'succeeded' },
      mode: 'live', path: 't0', toolExecutions: [run.execution], runId, agent,
    };
  }

  const taskType = classifyWiaTask(input.message);
  const provider = getModelProvider(process.env, taskType);
  const result = await provider.decide({ ...input, agent });
  return { ...enforceServerGuardrails(input.message, result, input.sourceIds), path: 'model', toolExecutions: [], runId, agent };
}
