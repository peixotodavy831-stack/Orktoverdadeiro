import assert from 'node:assert/strict';
import test from 'node:test';
import { createT0ToolRegistry, type ApprovalRow, type CustomerRow, type QuoteRow, type SaleRow, type T0DataSource } from '../backend/wiaos/t0-tools.js';
import { decideWithWia, routeT0Request } from '../backend/wiaos/wia-service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const tenant = { userId: tenantId, tenantId, role: 'owner' as const };

class FakeDataSource implements T0DataSource {
  observedTenantIds: string[] = [];
  fail = false;
  private check(id: string) { this.observedTenantIds.push(id); if (this.fail) throw new Error('database offline'); }
  async getSalesToday(id: string): Promise<SaleRow[]> { this.check(id); return [{ id: 'sale-1', quote_number: 'ORC-1', client_name: 'Ana', total: 1250, approved_at: '2026-09-25T10:00:00Z' }]; }
  async getOpenQuotes(id: string): Promise<QuoteRow[]> { this.check(id); return [{ id: 'quote-1', quote_number: 'ORC-2', client_name: 'Bia', total: 900, status: 'sent', updated_at: null }]; }
  async getCustomer(id: string): Promise<CustomerRow | null> { this.check(id); return { id: 'customer-1', name: 'Caio', phone: '11999999999', company: null, vehicle_or_service: null, notes: null, quote_count: 2, total_revenue: 300, last_contact_date: null }; }
  async getPendingApprovals(id: string): Promise<ApprovalRow[]> { this.check(id); return [{ id: 'approval-1', task_type: 'quote', bot_name: 'WIA', proposed_content: 'Aplicar desconto', reason: 'Acima do limite', policy_applied: 'discount_limit', expires_at: null, created_at: '2026-09-25T10:00:00Z', orkto_conversations: { id: 'conversation-1', user_id: id, contact_name: 'Dani' } }]; }
}

function runtime(source = new FakeDataSource(), role: 'owner' | 'channel' = 'owner') {
  return { source, toolRuntime: { registry: createT0ToolRegistry(source), context: { tenant: { ...tenant, role }, traceId: 'trace-pr3', now: new Date('2026-09-25T12:00:00Z') } } };
}

test('registra exatamente as quatro ferramentas T0 com contratos operacionais', () => {
  const { toolRuntime } = runtime();
  assert.deepEqual(toolRuntime.registry.list().map(tool => tool.name), ['get_sales_today', 'get_open_quotes', 'get_customer', 'get_pending_approvals']);
  assert.ok(toolRuntime.registry.list().every(tool => tool.timeoutMs === 5000 && tool.requiredPermission.endsWith(':read')));
});

test('get_sales_today usa somente o tenant autenticado e preserva fontes', async () => {
  const { source, toolRuntime } = runtime();
  const result = await toolRuntime.registry.execute('get_sales_today', {}, toolRuntime.context);
  assert.equal(result.execution.status, 'succeeded');
  assert.deepEqual(result.execution.sourceIds, ['quote:sale-1']);
  assert.deepEqual(source.observedTenantIds, [tenantId]);
  assert.ok(!source.observedTenantIds.includes(otherTenantId));
});

test('entrada inválida e papel sem permissão retornam erros tipados', async () => {
  const { toolRuntime } = runtime();
  const invalid = await toolRuntime.registry.execute('get_customer', {}, toolRuntime.context);
  assert.equal(invalid.execution.error?.code, 'invalid_input');
  const channelRuntime = runtime(new FakeDataSource(), 'channel').toolRuntime;
  const denied = await channelRuntime.registry.execute('get_open_quotes', {}, channelRuntime.context);
  assert.equal(denied.execution.error?.code, 'permission_denied');
});

test('roteador reconhece somente intenções T0 explícitas', () => {
  assert.equal(routeT0Request('Quanto vendemos hoje?')?.name, 'get_sales_today');
  assert.equal(routeT0Request('Mostre os orçamentos abertos')?.name, 'get_open_quotes');
  assert.equal(routeT0Request('Quais aprovações estão pendentes?')?.name, 'get_pending_approvals');
  assert.equal(routeT0Request('Ajude a escrever uma proposta'), null);
});

test('pergunta T0 percorre caminho zero-LLM', async () => {
  const { toolRuntime } = runtime();
  const result = await decideWithWia({ message: 'Quanto vendemos hoje?', context: { openQuotes: 0, pendingValue: 0, clients: 0 }, sourceIds: [], toolRuntime });
  assert.equal(result.path, 't0');
  assert.equal(result.usage.provider, 'none');
  assert.equal(result.usage.totalTokens, 0);
  assert.equal(result.decision.reasonCode, 't0_get_sales_today');
  assert.match(result.decision.messageDraft, /R\$\s?1\.250,00/);
});

test('intenção T0 sem runtime falha fechada e nunca usa modelo', async () => {
  const result = await decideWithWia({ message: 'Quanto vendemos hoje?', context: { openQuotes: 0, pendingValue: 0, clients: 0 }, sourceIds: [] });
  assert.equal(result.path, 't0');
  assert.equal(result.usage.totalTokens, 0);
  assert.equal(result.decision.reasonCode, 't0_runtime_unavailable');
});

test('falha da ferramenta não cai silenciosamente para um modelo', async () => {
  const source = new FakeDataSource(); source.fail = true;
  const { toolRuntime } = runtime(source);
  const result = await decideWithWia({ message: 'Quanto vendemos hoje?', context: { openQuotes: 0, pendingValue: 0, clients: 0 }, sourceIds: [], toolRuntime });
  assert.equal(result.path, 't0');
  assert.equal(result.usage.totalTokens, 0);
  assert.equal(result.decision.action, 'ask_clarification');
  assert.equal(result.toolExecutions[0].error?.code, 'execution_failed');
});
