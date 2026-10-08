import { createModelRegistry, type ModelRegistry, type WiaTaskClass } from './model-registry.js';

export class ProviderConfigurationError extends Error {
  readonly code = 'configuration_error';
  constructor(message = 'Nenhum provider de IA ativo está configurado para esta tarefa.') {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

export interface ModelRouteSelection {
  taskType: WiaTaskClass;
  provider: 'deepseek' | 'gemini' | 'openrouter' | 'mock';
  modelFamily: string;
  gateway: 'deepseek-direct' | 'google-direct' | 'openrouter' | 'local';
  modelId: string;
  requestedModel: string;
  selectedModel: string;
  fallbackUsed: false;
}

export class ModelRouter {
  constructor(private readonly registry: ModelRegistry) {}

  select(taskType: WiaTaskClass): ModelRouteSelection {
    const definition = this.registry[taskType];
    if (!definition.enabled || !definition.modelId) throw new ProviderConfigurationError();
    return {
      taskType,
      provider: definition.provider,
      modelFamily: definition.modelFamily,
      gateway: definition.gateway,
      modelId: definition.modelId,
      requestedModel: definition.modelId,
      selectedModel: definition.modelId,
      fallbackUsed: false,
    };
  }
}

export function createModelRouter(env: NodeJS.ProcessEnv = process.env): ModelRouter {
  try {
    return new ModelRouter(createModelRegistry(env));
  } catch (error) {
    if (error instanceof ProviderConfigurationError) throw error;
    throw new ProviderConfigurationError(error instanceof Error ? error.message : undefined);
  }
}
