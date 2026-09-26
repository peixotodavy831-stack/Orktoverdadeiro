import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceServerGuardrails, MockModelProvider } from '../backend/wiaos/model-provider.js';

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
