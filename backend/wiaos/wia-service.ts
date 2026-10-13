import type { WiaAgentId, WiaChatTurn, WiaOperationalContext, WiaServiceResult } from './contracts.js';
import { wiaDecisionSchema } from './contracts.js';
import type { ToolExecutionContext } from './core-contracts.js';
import type { ToolRegistry } from './tool-registry.js';
import { enforceServerGuardrails, getModelProvider } from './model-provider.js';
import { classifyWiaTask } from './model-registry.js';
import { routeSwarmAgent } from '../orkto-core/full-operational.js';
import { randomUUID } from 'node:crypto';
import { messageForTool, routeT0Request } from '../../supabase/functions/orkto-core-mutations/_shared/wia-t0.js';

export { routeT0Request } from '../../supabase/functions/orkto-core-mutations/_shared/wia-t0.js';

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
