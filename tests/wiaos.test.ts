import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { enforceServerGuardrails, GeminiModelProvider, getModelProvider, MockModelProvider, DeepSeekModelProvider, OpenRouterModelProvider, ModelProviderError } from '../backend/wiaos/model-provider.js';
import { classifyWiaTask, createModelRegistry } from '../backend/wiaos/model-registry.js';
import { createModelRouter } from '../backend/wiaos/model-router.js';
import { decideWithWia } from '../backend/wiaos/wia-service.js';

const context = { openQuotes: 1, pendingValue: 1200, clients: 3 };

test('mock gera resumo sem executar acao externa', async () => {
  const result = await new MockModelProvider().decide({ message: 'Como estao as vendas?', context, sourceIds: ['quote:1'] });
  assert.equal(result.decision.action, 'answer');
  assert.equal(result.decision.requiresApproval, false);
  assert.deepEqual(result.decision.sourceIds, ['quote:1']);
});

test('opt-out sempre exige registro controlado', async () => {
  const result = await new MockModelProvider().decide({ message: 'Pare de me mandar mensagens', context, sourceIds: [] });
  assert.equal(result.decision.action, 'record_optout');
  assert.equal(result.decision.requiresApproval, true);
});

test('pedido por pessoa transfere para humano', async () => {
  const result = await new MockModelProvider().decide({ message: 'Quero falar com um atendente humano', context, sourceIds: [] });
  assert.equal(result.decision.action, 'handoff_to_human');
  assert.equal(result.decision.requiresApproval, true);
});

test('preco sem fonte verificavel nao e inventado', async () => {
  const base = await new MockModelProvider().decide({ message: 'Qual e o preco?', context, sourceIds: [] });
  const result = enforceServerGuardrails('Qual e o preco?', base, []);
  assert.equal(result.decision.action, 'ask_clarification');
  assert.equal(result.decision.reasonCode, 'missing_verified_source');
});

test('fontes inventadas pelo modelo sao removidas', async () => {
  const base = await new MockModelProvider().decide({ message: 'Resumo', context, sourceIds: ['quote:1'] });
  base.decision.sourceIds.push('tenant:outro');
  const result = enforceServerGuardrails('Resumo', base, ['quote:1']);
  assert.deepEqual(result.decision.sourceIds, ['quote:1']);
});

test('Gemini recebe historico curto da conversa sem alterar contexto verificado', async () => {
  const originalFetch = globalThis.fetch;
  let sent: Record<string, unknown> | undefined;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        action: 'answer', messageDraft: 'A proposta segue em aberto.', sourceIds: ['quote:1'],
        confidenceSignal: 'medium', requiresApproval: false, reasonCode: 'conversation_context',
      }) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await new GeminiModelProvider('test-key', 'test-model').decide({
      message: 'E essa proposta?', context, sourceIds: ['quote:1'],
      history: [
        { role: 'user', content: 'Como está a proposta?' },
        { role: 'assistant', content: 'Ela está em aberto.' },
      ],
    });
    const contents = sent?.contents as Array<{ role: string; parts: Array<{ text: string }> }>;
    assert.deepEqual(contents.slice(0, 2).map(turn => turn.role), ['user', 'model']);
    assert.equal(contents[2].role, 'user');
    assert.match(contents[2].parts[0].text, /quote:1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini permanece provider padrão em produção e desenvolvimento; providers futuros são opt-in', () => {
  const productionWithFutureCredentials = {
    NODE_ENV: 'production', GEMINI_API_KEY: 'gemini-test', DEEPSEEK_API_KEY: 'deepseek-test',
    OPENROUTER_API_KEY: 'openrouter-test', OPENROUTER_MODEL: 'xiaomi/mimo-v2.5',
  } as NodeJS.ProcessEnv;
  assert.ok(getModelProvider(productionWithFutureCredentials) instanceof GeminiModelProvider);
  assert.ok(getModelProvider({ ...productionWithFutureCredentials, WIA_MODEL_PROVIDER: 'auto' } as NodeJS.ProcessEnv) instanceof GeminiModelProvider);
  assert.equal(createModelRegistry(productionWithFutureCredentials).standard.purpose, 'production');

  const development = { NODE_ENV: 'development', GEMINI_API_KEY: 'gemini-test', DEEPSEEK_API_KEY: 'deepseek-test' } as NodeJS.ProcessEnv;
  assert.ok(getModelProvider(development) instanceof GeminiModelProvider);
  assert.ok(getModelProvider({ NODE_ENV: 'production', WIA_MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'deepseek-test' } as NodeJS.ProcessEnv) instanceof DeepSeekModelProvider);
});

test('ausência da chave Gemini falha de forma controlada sem ativar provider futuro por credencial', () => {
  const env = { NODE_ENV: 'production', DEEPSEEK_API_KEY: 'deepseek-test', OPENROUTER_API_KEY: 'openrouter-test', OPENROUTER_MODEL: 'xiaomi/mimo-v2.5' } as NodeJS.ProcessEnv;
  const definition = createModelRegistry(env).standard;
  assert.equal(definition.provider, 'gemini');
  assert.equal(definition.gateway, 'google-direct');
  assert.equal(definition.enabled, false);
  assert.throws(() => getModelProvider(env), /Nenhum provider/);
});

test('produção sem provider configurado falha em vez de responder com mock', () => {
  assert.throws(() => getModelProvider({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), /Nenhum provider/);
  assert.throws(() => getModelProvider({ NODE_ENV: 'production', WIA_MODEL_PROVIDER: 'mock', WIA_ALLOW_MOCK: 'true' } as NodeJS.ProcessEnv), /Mock só pode/);
  assert.ok(getModelProvider({ NODE_ENV: 'test', WIA_MODEL_PROVIDER: 'mock', WIA_ALLOW_MOCK: 'true' } as NodeJS.ProcessEnv) instanceof MockModelProvider);
});

test('serviço WIA também recusa mock explicitamente solicitado em produção', async () => {
  const keys = ['NODE_ENV', 'WIA_MODEL_PROVIDER', 'WIA_ALLOW_MOCK'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.NODE_ENV = 'production';
  process.env.WIA_MODEL_PROVIDER = 'mock';
  process.env.WIA_ALLOW_MOCK = 'true';
  try {
    await assert.rejects(decideWithWia({ message: 'Pode me ajudar com o atendimento?', context, sourceIds: [] }), /Mock só pode/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key]!;
    }
  }
});

test('Model Registry distingue gateway, família e modelo configurado para MiMo via OpenRouter', () => {
  const env = { NODE_ENV: 'production', OPENROUTER_API_KEY: 'test-key', WIA_MODEL_PROVIDER: 'openrouter', OPENROUTER_MODEL: 'xiaomi/mimo-v2.5' } as NodeJS.ProcessEnv;
  const registry = createModelRegistry(env);
  assert.equal(registry.standard.provider, 'openrouter');
  assert.equal(registry.standard.modelFamily, 'xiaomi');
  assert.equal(registry.standard.gateway, 'openrouter');
  assert.equal(registry.standard.purpose, 'future-opt-in');
  assert.equal(createModelRouter(env).select('standard').modelId, 'xiaomi/mimo-v2.5');
});

test('Model Router permite configuração por classe e classificação mantém rotas determinísticas', () => {
  const env = { NODE_ENV: 'production', WIA_MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-key',
    WIA_FAST_MODEL: 'deepseek-flash', WIA_STANDARD_MODEL: 'deepseek-chat', WIA_DEEP_MODEL: 'deepseek-reasoner' } as NodeJS.ProcessEnv;
  const router = createModelRouter(env);
  assert.equal(router.select('fast').modelId, 'deepseek-flash');
  assert.equal(router.select('deep').modelId, 'deepseek-reasoner');
  assert.equal(classifyWiaTask('Resuma esta conversa e prepare um follow-up'), 'standard');
  assert.equal(classifyWiaTask('Faça um diagnóstico estratégico e compare as tendências'), 'deep');
  assert.equal(classifyWiaTask('Olá'), 'fast');
});

test('casos do benchmark cobrem as classes configuradas sem chamadas externas', async () => {
  const cases = JSON.parse(await readFile(new URL('./fixtures/wia-model-benchmark.json', import.meta.url), 'utf8')) as Array<{ id: string; taskType: string; message: string }>;
  assert.equal(cases.length, 7);
  for (const sample of cases) assert.equal(classifyWiaTask(sample.message), sample.taskType, sample.id);
});

test('OpenRouter não permite fallback automático e classifica erro HTTP', async () => {
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> | undefined;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('rate limited', { status: 429 });
  };
  try {
    const provider = getModelProvider({ NODE_ENV: 'production', WIA_MODEL_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'xiaomi/mimo-v2.5' } as NodeJS.ProcessEnv);
    assert.ok(provider instanceof OpenRouterModelProvider);
    await assert.rejects(provider.decide({ message: 'Resumo', context, sourceIds: [] }), (error: unknown) => error instanceof ModelProviderError && error.code === 'rate_limit');
    assert.deepEqual(body?.provider, { allow_fallbacks: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
