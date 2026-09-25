import type { WiaOperationalContext, WiaServiceResult } from './contracts.js';
import { wiaDecisionSchema } from './contracts.js';
import type { ToolExecutionContext } from './core-contracts.js';
import type { ToolRegistry } from './tool-registry.js';
import { enforceServerGuardrails, getModelProvider, MockModelProvider } from './model-provider.js';

type T0Route = { name: string; input: Record<string, unknown> };

export function routeT0Request(message: string): T0Route | null {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(vendas?|vendemos|vendeu|faturamento)\b/.test(text) && /\bhoje\b/.test(text)) return { name: 'get_sales_today', input: {} };
  if (/\b(or[cç]amentos?|propostas?)\b/.test(text) && /\b(abertos?|pendentes?|sem resposta)\b/.test(text)) return { name: 'get_open_quotes', input: {} };
  if (/\b(aprovacoes?|decisoes?)\b/.test(text) && /\b(pendentes?|aguardando|esperando)\b/.test(text)) return { name: 'get_pending_approvals', input: {} };
  const phone = message.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s-]?\d{4}/)?.[0];
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
  return 'Consulta concluída.';
}

export async function decideWithWia(input: {
  message: string;
  context: WiaOperationalContext;
  sourceIds: string[];
  toolRuntime?: { registry: ToolRegistry; context: ToolExecutionContext };
}): Promise<WiaServiceResult> {
  const route = routeT0Request(input.message);
  if (route && !input.toolRuntime) {
    return {
      decision: wiaDecisionSchema.parse({
        action: 'ask_clarification', messageDraft: 'A consulta operacional está indisponível agora. Nenhuma ação foi executada.',
        sourceIds: [], confidenceSignal: 'low', requiresApproval: false, reasonCode: 't0_runtime_unavailable',
      }),
      usage: { provider: 'none', model: 't0-deterministic', promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0 },
      mode: 'simulated', path: 't0', toolExecutions: [],
    };
  }
  if (route && input.toolRuntime) {
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
      usage: { provider: 'none', model: 't0-deterministic', promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: run.execution.durationMs },
      mode: 'live', path: 't0', toolExecutions: [run.execution],
    };
  }

  const provider = getModelProvider();
  try {
    const result = await provider.decide(input);
    return { ...enforceServerGuardrails(input.message, result, input.sourceIds), path: 'model', toolExecutions: [] };
  } catch (error) {
    if (provider.name === 'mock') throw error;
    console.error('[WiaOS] provider indisponível; fallback seguro ativado:', error instanceof Error ? error.message : 'erro desconhecido');
    const fallback = await new MockModelProvider().decide(input);
    return { ...enforceServerGuardrails(input.message, fallback, input.sourceIds), path: 'model', toolExecutions: [] };
  }
}
