import type { ModelDecisionResult, WiaOperationalContext } from './contracts.js';
import { enforceServerGuardrails, getModelProvider, MockModelProvider } from './model-provider.js';

export async function decideWithWia(input: {
  message: string;
  context: WiaOperationalContext;
  sourceIds: string[];
}): Promise<ModelDecisionResult> {
  const provider = getModelProvider();
  try {
    const result = await provider.decide(input);
    return enforceServerGuardrails(input.message, result, input.sourceIds);
  } catch (error) {
    if (provider.name === 'mock') throw error;
    console.error('[WiaOS] provider indisponível; fallback seguro ativado:', error instanceof Error ? error.message : 'erro desconhecido');
    const fallback = await new MockModelProvider().decide(input);
    return enforceServerGuardrails(input.message, fallback, input.sourceIds);
  }
}
