export type WiaTaskClass = 'fast' | 'standard' | 'deep';
export type ModelProviderId = 'deepseek' | 'gemini' | 'openrouter' | 'mock';
export type ModelGatewayId = 'deepseek-direct' | 'google-direct' | 'openrouter' | 'local';

export interface ModelDefinition {
  provider: ModelProviderId;
  modelFamily: string;
  gateway: ModelGatewayId;
  modelId: string;
  displayName: string;
  capabilities: {
    text: boolean;
    reasoning: boolean;
    toolCalling: boolean;
    structuredOutput: boolean;
    vision: boolean;
    audio: boolean;
  };
  pricingKey?: string;
  purpose: 'production' | 'development-testing' | 'future-opt-in';
  enabled: boolean;
}

export type ModelRegistry = Record<WiaTaskClass, ModelDefinition>;

const DEFAULT_MODEL_IDS: Record<Exclude<ModelProviderId, 'mock'>, string> = {
  deepseek: 'deepseek-flash',
  gemini: 'gemini-3.8-flash',
  openrouter: '',
};

function providerGateway(provider: ModelProviderId): ModelGatewayId {
  if (provider === 'deepseek') return 'deepseek-direct';
  if (provider === 'gemini') return 'google-direct';
  if (provider === 'openrouter') return 'openrouter';
  return 'local';
}

function hasCredential(provider: ModelProviderId, env: NodeJS.ProcessEnv): boolean {
  if (provider === 'deepseek') return Boolean(env.DEEPSEEK_API_KEY?.trim());
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY?.trim());
  if (provider === 'openrouter') return Boolean(env.OPENROUTER_API_KEY?.trim());
  return env.NODE_ENV !== 'production' && env.WIA_ALLOW_MOCK === 'true';
}

function configuredModel(provider: ModelProviderId, task: WiaTaskClass, env: NodeJS.ProcessEnv): string {
  const taskKey = task.toUpperCase();
  const fromTask = env[`WIA_${taskKey}_MODEL`]?.trim();
  if (fromTask) return fromTask;
  if (provider === 'deepseek') return env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL_IDS.deepseek;
  if (provider === 'gemini') return env.GEMINI_MODEL?.trim() || DEFAULT_MODEL_IDS.gemini;
  if (provider === 'openrouter') return env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL_IDS.openrouter;
  return 'deterministic';
}

function configuredProvider(task: WiaTaskClass, env: NodeJS.ProcessEnv): ModelProviderId | undefined {
  const specific = env[`WIA_${task.toUpperCase()}_PROVIDER`]?.trim().toLowerCase();
  const global = env.WIA_MODEL_PROVIDER?.trim().toLowerCase();
  const value = specific || (global && global !== 'auto' ? global : undefined);
  if (value === 'deepseek' || value === 'gemini' || value === 'openrouter' || value === 'mock') return value;
  if (value) throw new Error(`Provider WIA não reconhecido para a classe ${task}.`);
  // Gemini remains the active WIA provider in every environment until routing
  // to future providers is explicitly enabled through WIA_MODEL_PROVIDER or
  // a task-specific WIA_<TASK>_PROVIDER setting. Credentials alone never opt in.
  return 'gemini';
}

export function classifyWiaTask(message: string): WiaTaskClass {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  if (/\b(analise estrategica|diagnostico|compare|investigue|planejamento|relatorio|tendencia|por que.*(caiu|mudou|aconteceu))\b/.test(normalized)) return 'deep';
  if (/\b(classifique|classificar|extraia|extrair|intencao|urgencia|tags?|categorize|detectar)\b/.test(normalized)) return 'fast';
  if (/\b(resuma|resumo|respost\w*|follow.?up|objecao|cliente|negocio|proposta|orcamento|venda)\b/.test(normalized)) return 'standard';
  return 'fast';
}

export function createModelRegistry(env: NodeJS.ProcessEnv = process.env): ModelRegistry {
  const registry = {} as ModelRegistry;
  for (const task of ['fast', 'standard', 'deep'] as const) {
    const provider = configuredProvider(task, env);
    const modelId = provider ? configuredModel(provider, task, env) : '';
    const available = provider ? hasCredential(provider, env) && Boolean(modelId) : false;
    if (provider === 'mock' && !hasCredential(provider, env)) {
      throw new Error('Mock só pode ser habilitado explicitamente fora de produção.');
    }
    registry[task] = {
      provider: provider || 'gemini',
      modelFamily: provider === 'openrouter' ? modelId.split('/')[0] || 'unknown' : provider || 'gemini',
      gateway: provider ? providerGateway(provider) : 'google-direct',
      modelId,
      displayName: modelId || 'Provider não configurado',
      pricingKey: provider ? `${provider}:${modelId}` : undefined,
      capabilities: { text: true, reasoning: task === 'deep', toolCalling: false, structuredOutput: true, vision: false, audio: false },
      purpose: provider === 'mock'
        ? 'development-testing'
        : provider === 'gemini'
          ? 'production'
          : 'future-opt-in',
      enabled: available,
    };
  }
  return registry;
}
