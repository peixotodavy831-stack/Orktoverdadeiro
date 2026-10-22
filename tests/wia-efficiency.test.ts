import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { registerOperationalRoutes } from '../backend/operational-routes.js';
import { createOwnerTenantContext } from '../backend/tenancy/tenant-context.js';
import {
  ESCALATION_POLICY,
  PULSO_CLASS_FOR_TASK,
  PULSO_CLASS_POLICY_VERSION,
  aggregateEfficiencyUsage,
  estimatePlanCost,
  latestTariffFor,
  planExecution,
} from '../backend/wiaos/efficiency.js';
import { REFERENCE_PULSO_MILLI } from '../supabase/functions/orkto-core-mutations/_shared/cost-governor.js';

const WORKSPACE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_A = WORKSPACE_A;
const WORKSPACE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_B = WORKSPACE_B;
const NOW = Date.parse('2026-10-21T12:00:00.000Z');
const CURRENT_MONTH_START = `${new Date().toISOString().slice(0, 7)}-01`;
const PREVIOUS_MONTH_START = `${new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7)}-01`;

const NO_PROVIDERS_ENV: Record<string, string> = { APP_ENV: 'development', NODE_ENV: 'test' };

const SEMPRE_VIGENTE_TARIFF_VERSION_3 = {
  provider: 'gemini', model: 'gemini-3.8-flash', version: 3,
  inputMicrousdPerMillion: 300, outputMicrousdPerMillion: 2500, cachedMicrousdPerMillion: 40,
  effectiveFrom: '2024-01-01T00:00:00.000Z', effectiveUntil: null,
};

test('tier 1: open-quotes question resolves deterministically with zero inference and zero Pulso', () => {
  const plan = planExecution({ message: 'Quantos orçamentos estão abertos?', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(plan.tier, 1);
  assert.equal(plan.layer, 'deterministic_t0');
  assert.equal(plan.t0_route?.name, 'get_open_quotes');
  assert.equal(plan.pulso_class, null);
  assert.equal(plan.pulso_reference_milli, null);
  assert.equal(plan.usage_basis, 'zero_inference');
  assert.equal(plan.token_estimate, null);
  assert.equal(plan.blocked, false);
  assert.equal(plan.escalation.allowed, false);
  const salesRoute = planExecution({ message: 'Vendas de hoje', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(salesRoute.tier, 1);
  assert.equal(salesRoute.t0_route?.name, 'get_sales_today');
  const clarification = planExecution({ message: 'risco calote memória', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(clarification.tier, 1);
  assert.equal(clarification.t0_route?.name, 'get_customer_operational_context');
  assert.match(String(clarification.t0_route?.clarification || ''), /telefone/);
});

test('tier 2: economic task classes map to the versioned Pulso policy without touching allowances', () => {
  const fast = planExecution({ message: 'Classifique a intenção desta mensagem e extraia os dados', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(fast.tier, 2);
  assert.equal(fast.task_class, 'fast');
  assert.equal(fast.pulso_class, 'simple');
  assert.equal(fast.pulso_reference_milli, REFERENCE_PULSO_MILLI.simple);
  const standard = planExecution({ message: 'Prepare uma resposta para o follow-up do cliente', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(standard.tier, 2);
  assert.equal(standard.task_class, 'standard');
  assert.equal(standard.pulso_class, 'normal');
  assert.equal(standard.pulso_reference_milli, REFERENCE_PULSO_MILLI.normal);
  assert.deepEqual([PULSO_CLASS_FOR_TASK.fast, PULSO_CLASS_FOR_TASK.standard, PULSO_CLASS_FOR_TASK.deep], ['simple', 'normal', 'complex']);
  assert.equal(PULSO_CLASS_POLICY_VERSION, 1);
});

test('tier 3: deep requests carry escalation caps and never allow unbounded retries', () => {
  const deep = planExecution({ message: 'Faça uma análise estratégica de por que a receita caiu este trimestre', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(deep.tier, 3);
  assert.equal(deep.layer, 'model_escalated');
  assert.equal(deep.task_class, 'deep');
  assert.equal(deep.pulso_class, 'complex');
  assert.equal(deep.escalation.allowed, true);
  assert.equal(deep.escalation.max_steps, ESCALATION_POLICY.maxEscalationSteps);
  assert.equal(deep.escalation.max_steps, 1);
  assert.equal(deep.escalation.max_retries, 2);
  assert.equal(deep.escalation.budget_cap_milli, REFERENCE_PULSO_MILLI.complex);
});

test('tier 2 without any provider credential blocks instead of inventing a model', () => {
  const plan = planExecution({ message: 'Prepare uma resposta para o cliente', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.equal(plan.tier, 2);
  assert.equal(plan.blocked, true);
  const authCheck = plan.checks.find(item => item.check === 'model_authorized')!;
  assert.equal(authCheck.status, 'blocked');
  assert.match(String(authCheck.reason), /credencial|modelo não configurado/);
});

test('tier 2 with explicit deepseek opt-in env still requires provider approval (future-opt-in)', () => {
  const env = { ...NO_PROVIDERS_ENV, DEEPSEEK_API_KEY: 'stub', WIA_MODEL_PROVIDER: 'deepseek' };
  const plan = planExecution({ message: 'Prepare uma resposta para o cliente', env, nowMs: NOW });
  assert.equal(plan.tier, 2);
  assert.equal(plan.blocked, true);
  assert.equal(plan.authorized_model?.provider, 'deepseek');
  assert.equal(plan.authorized_model?.purpose, 'future-opt-in');
  assert.ok(plan.block_reasons.some(reason => /opt-in/.test(reason)));
});

test('cost estimate uses the effective approved tariff with upstream rounding semantics', () => {
  const withGemini = planExecution({ message: 'Prepare uma resposta para o follow-up do cliente', env: { ...NO_PROVIDERS_ENV, GEMINI_API_KEY: 'stub' }, nowMs: NOW });
  assert.equal(withGemini.tier, 2);
  assert.equal(withGemini.blocked, false);
  assert.equal(withGemini.authorized_model?.provider, 'gemini');
  assert.equal(withGemini.authorized_model?.enabled, true);

  const fresh = estimatePlanCost(withGemini, SEMPRE_VIGENTE_TARIFF_VERSION_3, NOW);
  const expected = ((withGemini.token_estimate!.input_tokens) * 300 + (withGemini.token_estimate!.output_tokens) * 2500) / 1_000_000;
  assert.equal(fresh.valid, true);
  assert.equal(fresh.microusd, Math.ceil(expected));
  assert.equal(fresh.tariffVersion, 3);

  const expired = estimatePlanCost(withGemini, { ...SEMPRE_VIGENTE_TARIFF_VERSION_3, effectiveUntil: '2024-06-01T00:00:00.000Z' }, NOW);
  assert.equal(expired.valid, false);
  assert.equal(expired.microusd, null);
  const none = estimatePlanCost(withGemini, null, NOW);
  assert.equal(none.valid, false);
  const tier1 = planExecution({ message: 'Quantos orçamentos estão abertos?', env: NO_PROVIDERS_ENV, nowMs: NOW });
  assert.deepEqual(estimatePlanCost(tier1, SEMPRE_VIGENTE_TARIFF_VERSION_3, NOW), { microusd: null, valid: false, tariffVersion: null });
});

test('latestTariffFor picks the newest effective version and ignores stale/expired/foreign rows', () => {
  const baseDbTariff = {
    provider: 'gemini', model: 'gemini-3.8-flash',
    input_microusd_per_million: 300, output_microusd_per_million: 2500, cached_microusd_per_million: 40,
    effective_from: '2024-01-01T00:00:00.000Z', effective_until: null,
  };
  const rows = [
    { ...baseDbTariff, version: 2 },
    { ...baseDbTariff, version: 5, effective_until: '2024-02-01T00:00:00.000Z' },
    { ...baseDbTariff, version: 4, effective_from: '2099-01-01T00:00:00.000Z' },
    { ...baseDbTariff, version: 9, provider: 'other' },
  ];
  const tariff = latestTariffFor(rows, 'gemini', 'gemini-3.8-flash', NOW);
  assert.equal(tariff?.version, 2);
  assert.equal(latestTariffFor([], 'gemini', 'gemini-3.8-flash', NOW), null);
  assert.equal(latestTariffFor(null, 'gemini', 'x', NOW), null);
});

test('usage aggregation sums the model ledger honestly, counts malformed rows and marks zero-cost coverage', () => {
  const summary = aggregateEfficiencyUsage([
    { provider: 'gemini', model: 'gemini-3.8-flash', task_class: 'standard', gateway: 'google-direct', prompt_tokens: '120', cached_input_tokens: 0, completion_tokens: '80', total_tokens: '200', latency_ms: '900', mode: 'simulated', created_at: '2026-10-20T00:00:00Z' },
    { provider: 'gemini', model: 'gemini-3.8-flash', task_class: 'fast', gateway: 'google-direct', prompt_tokens: 60, cached_input_tokens: 20, completion_tokens: 30, total_tokens: 90, latency_ms: 300, mode: 'live', created_at: '2026-10-20T01:00:00Z' },
    { provider: 'gemini', model: 'gemini-3.8-flash', task_class: 'standard', latency_ms: 12, total_tokens: 7, created_at: '2026-10-20T01:30:00Z' },
    { junk: true },
    { provider: 'gemini', model: 'm', latency_ms: 'oops' },
    { provider: 'gemini', model: 'm', total_tokens: -5 },
  ]);
  assert.equal(summary.model_path_operations, 4);
  assert.equal(summary.total_tokens, 297);
  assert.equal(summary.prompt_tokens, 180);
  assert.equal(summary.completion_tokens, 110);
  assert.equal(summary.cached_input_tokens, 20);
  assert.equal(summary.average_latency_ms, Math.round((900 + 300 + 12 + 0) / 4));
  assert.equal(summary.max_latency_ms, 900);
  assert.deepEqual(summary.by_task_class, { fast: 1, standard: 2, unclassified: 1 });
  assert.equal(summary.by_model[0].model, 'gemini-3.8-flash');
  assert.equal(summary.skipped_or_invalid_rows, 2);
  assert.equal(summary.coverage.deterministic_operations_recorded, false);
  const empty = aggregateEfficiencyUsage([]);
  assert.equal(empty.model_path_operations, 0);
  assert.equal(empty.average_latency_ms, null);
  assert.equal(empty.skipped_or_invalid_rows, 0);
});

class EfficiencyMemoryQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private maxRows: number | null = null;
  private ordering: { column: string; ascending: boolean } | null = null;
  constructor(private readonly database: EfficiencyMemoryDatabase, private readonly table: string) {}
  select(_columns = '*'): this { return this; }
  eq(column: string, value: unknown): this { this.filters.push(row => row[column] === value); return this; }
  in(column: string, values: unknown[]): this { this.filters.push(row => values.includes(row[column])); return this; }
  order(column: string, options?: { ascending?: boolean }): this { this.ordering = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number): this { this.maxRows = value; return this; }
  maybeSingle(): Promise<{ data: any; error: null }> { return this.execute().then(rows => ({ data: rows[0] ?? null, error: null })); }
  then(resolve: (value: { data: any; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
    return this.execute().then(rows => resolve({ data: rows, error: null }), reject);
  }
  private execute(): Promise<any[]> {
    this.database.operations.push(`select:${this.table}`);
    let rows = (this.database.tables[this.table] || []).filter(row => this.filters.every(match => match(row)));
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      rows = rows.slice().sort((left, right) => {
        const a = left[column]; const b = right[column];
        const result = a === b ? 0 : String(a) > String(b) ? 1 : -1;
        return ascending ? result : -result;
      });
    }
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
    return Promise.resolve(rows);
  }
}

class EfficiencyMemoryDatabase {
  readonly tables: Record<string, Array<Record<string, unknown>>> = {
    orkto_workspace_members: [
      { workspace_id: WORKSPACE_A, user_id: USER_A, role: 'owner', status: 'active' },
      { workspace_id: WORKSPACE_B, user_id: USER_B, role: 'owner', status: 'active' },
    ],
    orkto_workspaces: [
      { id: WORKSPACE_A, owner_user_id: USER_A },
      { id: WORKSPACE_B, owner_user_id: USER_B },
    ],
    orkto_model_usage: [
      { workspace_id: WORKSPACE_A, provider: 'gemini', model: 'gemini-3.8-flash', task_class: 'standard', gateway: 'google-direct', prompt_tokens: 100, cached_input_tokens: 0, completion_tokens: 50, total_tokens: 150, latency_ms: 640, mode: 'live', created_at: '2026-10-20T02:00:00Z', billing_period_start: CURRENT_MONTH_START },
      { workspace_id: WORKSPACE_B, provider: 'gemini', model: 'gemini-3.8-flash', task_class: 'deep', gateway: 'google-direct', prompt_tokens: 9000, completion_tokens: 4000, total_tokens: 13000, latency_ms: 5000, mode: 'live', created_at: '2026-10-20T03:00:00Z', billing_period_start: CURRENT_MONTH_START },
    ],
    orkto_model_tariffs: [
      { provider: 'gemini', model: 'gemini-3.8-flash', version: 3, input_microusd_per_million: 300, output_microusd_per_million: 2500, cached_microusd_per_million: 40, effective_from: '2024-01-01T00:00:00.000Z', effective_until: null },
    ],
  };
  readonly operations: string[] = [];
  from(table: string): EfficiencyMemoryQuery { return new EfficiencyMemoryQuery(this, table); }
}

before(() => {
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'test';
  delete process.env.GEMINI_API_KEY;
  delete process.env.WIA_MODEL_PROVIDER;
});

afterEach(async () => {
  await Promise.all([...servers].map(server => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  })));
  servers.clear();
});

after(() => {
  delete process.env.APP_ENV;
});

const servers = new Set<ReturnType<typeof createServer>>();

function createEfficiencyTestApp(database: EfficiencyMemoryDatabase, userId: string | null, requestDb?: EfficiencyMemoryDatabase): Express {
  const app = express();
  app.use(express.json());
  const authenticate = (req: any, res: any, next: () => void) => {
    if (!userId) return res.status(401).json({ error: 'Sessão necessária.' });
    req.user = { id: userId, email: `${userId}@example.test` };
    req.tenantContext = createOwnerTenantContext(userId);
    if (requestDb) req.authenticatedSupabase = requestDb;
    next();
  };
  registerOperationalRoutes(app, authenticate, database as any);
  return app;
}

async function request(app: Express, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`, { headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
}

let sharedDb: EfficiencyMemoryDatabase;

beforeEach(() => { sharedDb = new EfficiencyMemoryDatabase(); });

test('POST /api/wia-efficiency/plan is read-only, tiered and reports zero-cost for T0', async () => {
  const database = sharedDb;
  const before = JSON.stringify(database.tables);
  const response = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/plan', { 'x-orkto-workspace': WORKSPACE_A }, { message: 'Quantos orçamentos estão abertos?' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const payload = await response.json() as { data: Record<string, any> };
  const data = payload.data;
  assert.equal(data.tier, 1);
  assert.equal(data.layer, 'deterministic_t0');
  assert.equal(data.t0_route.name, 'get_open_quotes');
  assert.equal(data.pulso_class, null);
  assert.equal(data.usage_basis, 'zero_inference');
  assert.equal(data.blocked, false);
  assert.equal(data.cost_estimate.provenance, 'zero_inference');
  assert.equal(data.cost_estimate.microusd, null);
  assert.equal(data.escalation.allowed, false);
  assert.equal(data.read_only, true);
  assert.equal(data.execution_available, false);
  assert.equal(database.operations.every(operation => operation.startsWith('select:')), true);
  assert.equal(JSON.stringify(database.tables), before);
});

test('POST plan with a model question estimates against the effective approved tariff without writing', async () => {
  process.env.GEMINI_API_KEY = 'stub';
  const database = sharedDb;
  try {
    const response = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/plan', { 'x-orkto-workspace': WORKSPACE_A }, { message: 'Prepare uma resposta para o cliente' });
    assert.equal(response.status, 200);
    const payload = await response.json() as { data: Record<string, any> };
    const data = payload.data;
    assert.equal(data.tier, 2);
    assert.equal(data.authorized_model.provider, 'gemini');
    assert.equal(data.authorized_model.model_id, 'gemini-3.8-flash');
    assert.equal(data.pulso_class, 'normal');
    assert.equal(data.blocked, false);
    assert.equal(data.cost_estimate.valid, true);
    assert.equal(data.cost_estimate.tariffVersion, 3);
    assert.match(String(data.cost_estimate.provenance), /heuristic_tokens_with_approved_tariff/);
    assert.equal(data.escalation.allowed, false);
    assert.equal(database.operations.every(operation => operation.startsWith('select:')), true);
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

test('GET /api/wia-efficiency/metrics aggregates per workspace with no cross-tenant leakage', async () => {
  const database = sharedDb;
  const own = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/metrics', {});
  assert.equal(own.status, 200);
  const payload = await own.json() as { data: Record<string, any> };
  const data = payload.data;
  assert.equal(data.model_path_operations, 1);
  assert.equal(data.total_tokens, 150);
  assert.equal(data.billing_period_start, CURRENT_MONTH_START);
  assert.equal(JSON.stringify(data.by_task_class), JSON.stringify({ standard: 1 }));
  assert.equal(data.coverage.deterministic_operations_recorded, false);
  assert.equal(data.read_only, true);
  const previous = await (await request(createEfficiencyTestApp(database, USER_A), `/api/wia-efficiency/metrics?month=${PREVIOUS_MONTH_START.slice(0, 7)}`)).json() as { data: Record<string, any> };
  assert.equal(previous.data.model_path_operations, 0);
  const bad = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/metrics?month=xx');
  assert.equal(bad.status, 400);
});

test('user in another workspace gets their own data without cross-tenant leakage', async () => {
  const database = sharedDb;
  const payload = await (await request(createEfficiencyTestApp(database, USER_B), '/api/wia-efficiency/metrics', {})).json() as { data: Record<string, any> };
  assert.equal(payload.data.model_path_operations, 1);
  assert.equal(payload.data.total_tokens, 13000);
  assert.equal(JSON.stringify(payload.data.by_task_class), JSON.stringify({ deep: 1 }));
});

test('efficiency routes enforce foreign-workspace rejection, absent membership and missing auth', async () => {
  const database = sharedDb;
  const app = createEfficiencyTestApp(database, USER_B);
  assert.equal((await request(app, '/api/wia-efficiency/plan', { 'x-orkto-workspace': WORKSPACE_A }, { message: 'Vendas de hoje' })).status, 403);
  assert.equal((await request(app, '/api/wia-efficiency/metrics', { 'x-orkto-workspace': WORKSPACE_A })).status, 403);
  const empty = new EfficiencyMemoryDatabase();
  empty.tables.orkto_workspace_members = [];
  assert.equal((await request(createEfficiencyTestApp(empty, USER_A), '/api/wia-efficiency/plan', {}, { message: 'oi' })).status, 403);
  assert.equal((await request(createEfficiencyTestApp(database, null), '/api/wia-efficiency/metrics')).status, 401);
});

test('plan route validates message length and never writes', async () => {
  const database = sharedDb;
  const before = JSON.stringify(database.tables);
  const missing = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/plan', {}, {});
  assert.equal(missing.status, 400);
  const tooLong = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/plan', {}, { message: 'a'.repeat(2001) });
  assert.equal(tooLong.status, 400);
  assert.equal(JSON.stringify(database.tables), before);
  assert.equal(database.operations.every(operation => operation.startsWith('select:')), true);
});

test('planning rejects legacy URLs, query-only input, unknown properties and wrong content type', async () => {
  const database = sharedDb;
  const before = JSON.stringify(database.tables);
  const app = createEfficiencyTestApp(database, USER_A);
  const legacy = await request(app, '/api/wia-efficiency/plan?message=private-fixture');
  assert.equal(legacy.status, 405);
  assert.equal(legacy.headers.get('allow'), 'POST');
  assert.equal(legacy.headers.get('cache-control'), 'private, no-store');
  assert.equal((await legacy.text()).includes('private-fixture'), false);
  for (const body of [{}, {message:'  '}, {message:'oi',workspaceId:WORKSPACE_B}, {message:['oi']}]) {
    assert.equal((await request(app, '/api/wia-efficiency/plan?message=ignored', {}, body)).status, 400);
  }
  assert.equal((await request(app, '/api/wia-efficiency/plan', {'content-type':'text/plain'}, {message:'oi'})).status, 415);
  assert.equal((await request(createEfficiencyTestApp(database, null), '/api/wia-efficiency/plan', {}, {message:'oi'})).status, 401);
  assert.equal(JSON.stringify(database.tables), before);
  assert.equal(database.operations.some(operation => operation.includes('subscription')), false);
});

test('planning resolves membership with the JWT-bound client without changing rows', async () => {
  const shared = new EfficiencyMemoryDatabase();
  shared.tables.orkto_workspace_members = [];
  const bound = new EfficiencyMemoryDatabase();
  const before = JSON.stringify(bound.tables);
  const response = await request(createEfficiencyTestApp(shared, USER_A, bound), '/api/wia-efficiency/plan', {}, {message:'Quantos orçamentos estão abertos?'});
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(bound.tables), before);
  assert.equal(shared.operations.some(operation => operation === 'select:orkto_workspace_members'), false);
});

test('metrics rejects impossible calendar months', async () => {
  for (const month of ['2026-00','2026-13','2026-1','2026-10-01']) {
    assert.equal((await request(createEfficiencyTestApp(sharedDb, USER_A), '/api/wia-efficiency/metrics?month='+month)).status, 400);
  }
});

test('large usage history is bounded and explicitly reports the scope of its totals', async () => {
  const database = sharedDb;
  database.tables.orkto_model_usage = Array.from({length:5005},(_,index)=>({workspace_id:WORKSPACE_A,billing_period_start:CURRENT_MONTH_START,created_at:String(index),total_tokens:1}));
  const response = await request(createEfficiencyTestApp(database, USER_A), '/api/wia-efficiency/metrics');
  assert.equal(response.status, 200);
  const payload = await response.json() as {data:Record<string,any>};
  assert.equal(payload.data.model_path_operations,5000);
  assert.equal(payload.data.total_tokens,5000);
  assert.equal(payload.data.coverage.records_returned,5000);
  assert.equal(payload.data.coverage.possibly_truncated,true);
  assert.equal(payload.data.coverage.totals_scope,'returned_rows_only');
  assert.equal(database.operations.every(operation=>operation.startsWith('select:')),true);
});
