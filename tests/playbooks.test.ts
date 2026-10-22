import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { after, afterEach, before, test } from 'node:test';
import { registerOperationalRoutes } from '../backend/operational-routes.js';
import { createOwnerTenantContext } from '../backend/tenancy/tenant-context.js';
import {
  buildPlaybookPreview,
  getPlaybookDefinition,
  playbookDigest,
  validatePlaybookDefinition,
} from '../backend/orkto-core/playbooks.js';

const WORKSPACE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_A = WORKSPACE_A;
const WORKSPACE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_B = WORKSPACE_B;

const definition = getPlaybookDefinition('proposal_recovery')!;

test('the shipped proposal-recovery definition validates and is self-consistent', () => {
  const result = validatePlaybookDefinition(definition);
  assert.equal(result.ok, true);
  assert.equal(definition.key, 'proposal_recovery');
  assert.equal(definition.version, 'R1');
  assert.deepEqual(definition.external_effects, []);
  assert.ok(definition.blocked_effects.length >= 3);
  assert.equal(definition.entry_signal, definition.entry_signal);
  assert.equal(definition.entry_signal.kind, 'unanswered_proposal');
  assert.equal(definition.trigger.family, 'manual');
  const kinds = definition.steps.map(step => step.kind);
  assert.equal(kinds.filter(kind => kind === 'finalize').length, 1);
  assert.equal(kinds[kinds.length - 1], 'finalize');
  const approvalIndex = kinds.indexOf('approval');
  const internalIndex = kinds.indexOf('internal_task');
  assert.ok(approvalIndex >= 0 && approvalIndex < internalIndex, 'approval deve preceder a tarefa interna');
  const approvalStep = definition.steps[approvalIndex];
  assert.deepEqual(approvalStep.approval_design!.response_fields.map(field => field.id), ['approved', 'justification']);
  const resolutions = definition.resolution_states;
  assert.deepEqual(resolutions.sort(), ['assumed_by_human', 'escalated', 'succeeded'].sort());
});

test('digest is deterministic, 64 hex chars and changes when content changes', () => {
  const first = playbookDigest(definition);
  const second = playbookDigest(definition);
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  const mutated = { ...definition, title: 'Outro título de playbook' };
  assert.notEqual(playbookDigest(mutated), first);
  const reordered = { ...definition, not_when: definition.not_when.slice().reverse() };
  assert.notEqual(playbookDigest(reordered), first);
});

test('validator rejects tampered definitions with explicit errors', () => {
  for (const [label, mutation] of [
    ['unknown kind', { steps: undefined }],
    ['missing fields', { key: undefined }],
    ['external effect present', { external_effects: ['Enviar e-mail ao cliente'] }],
    ['empty blocked effects', { blocked_effects: [] }],
  ] as Array<[string, Record<string, unknown>]>) {
    const result = validatePlaybookDefinition({ ...definition, ...mutation });
    assert.equal(result.ok, false, label);
  }
  const noSteps = validatePlaybookDefinition({ ...definition, steps: [] });
  assert.equal(noSteps.ok, false);
  const badKind = validatePlaybookDefinition({ ...definition, steps: [...definition.steps, { ...definition.steps[0], id: 'extra', kind: 'send_message' }] });
  assert.equal(badKind.ok, false);
  const duplicateId = validatePlaybookDefinition({ ...definition, steps: [...definition.steps, { ...definition.steps[0] }] });
  assert.equal(duplicateId.ok, false);
  const finalizeNotLast = validatePlaybookDefinition({ ...definition, steps: [definition.steps[definition.steps.length - 1], ...definition.steps.slice(0, -1)] });
  assert.equal(finalizeNotLast.ok, false);
  const approvalWithoutDesign = validatePlaybookDefinition({
    ...definition,
    steps: definition.steps.map(step => step.kind === 'approval' ? { ...step, approval_design: undefined } : step),
  });
  assert.equal(approvalWithoutDesign.ok, false);
  const internalTaskWithoutBasis = validatePlaybookDefinition({
    ...definition,
    steps: definition.steps.map(step => step.kind === 'internal_task' ? { ...step, authorized_task: undefined } : step),
  });
  assert.equal(internalTaskWithoutBasis.ok, false);
  assert.deepEqual(validatePlaybookDefinition(null), { ok: false, errors: ['definição precisa ser um objeto'] });
});

test('preview is honest: no execution, no external effects, approval point fully described', () => {
  const preview = buildPlaybookPreview(definition);
  assert.equal(preview.playbook_key, 'proposal_recovery');
  assert.equal(preview.version, 'R1');
  assert.equal(preview.digest, playbookDigest(definition));
  assert.equal(preview.execution_status, 'not_available_in_r1');
  assert.deepEqual(preview.effects.external, []);
  assert.deepEqual(preview.effects.internal, ['tarefa interna: Acompanhar proposta sem resposta (idempotência approved-action:<actionId>)']);
  assert.equal(preview.steps.every(step => step.preview_note.length > 0), true);
  assert.equal(preview.steps.find(step => step.id === 'create_followup_task')!.preview_note, 'Somente tarefa interna criada após aprovação registrada; sem contato ao cliente.');
  assert.equal(preview.approval_points.length, 1);
  const approval = preview.approval_points[0];
  assert.equal(approval.step_id, 'request_approval');
  assert.match(approval.question, /tarefa interna de follow-up/);
  assert.match(approval.timeout_policy, /sem ação externa/);
  const gated = buildPlaybookPreview(definition, { featureKey: 'proposal_recovery', featureState: 'off_by_default' });
  assert.equal(gated.digest, preview.digest);
});

class PlaybookMemoryQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private maxRows: number | null = null;
  private ordering: { column: string; ascending: boolean } | null = null;
  constructor(private readonly database: PlaybookMemoryDatabase, private readonly table: string) {}
  select(_columns = '*'): this { return this; }
  eq(column: string, value: unknown): this { this.filters.push(row => row[column] === value); return this; }
  in(column: string, values: unknown[]): this { this.filters.push(row => values.includes(row[column])); return this; }
  is(column: string, value: unknown): this { this.filters.push(row => (row[column] ?? null) === value); return this; }
  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is' && value === null) this.filters.push(row => row[column] !== null && row[column] !== undefined);
    return this;
  }
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

class PlaybookMemoryDatabase {
  readonly tables: Record<string, Array<Record<string, unknown>>> = {
    orkto_workspace_members: [
      { workspace_id: WORKSPACE_A, user_id: USER_A, role: 'owner', status: 'active' },
      { workspace_id: WORKSPACE_B, user_id: USER_B, role: 'owner', status: 'active' },
    ],
    orkto_workspaces: [
      { id: WORKSPACE_A, owner_user_id: USER_A },
      { id: WORKSPACE_B, owner_user_id: USER_B },
    ],
    orkto_feature_configs: [],
  };
  readonly operations: string[] = [];
  from(table: string): PlaybookMemoryQuery { return new PlaybookMemoryQuery(this, table); }
}

const servers = new Set<ReturnType<typeof createServer>>();

before(() => {
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'test';
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

function createPlaybookTestApp(database: PlaybookMemoryDatabase, userId: string | null, requestDb?: PlaybookMemoryDatabase): Express {
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

async function request(app: Express, path: string, headers: Record<string, string>): Promise<Response> {
  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`, { headers });
}

test('GET /api/playbooks/proposal_recovery/preview is read-only, workspace-scoped and honest by default', async () => {
  const database = new PlaybookMemoryDatabase();
  const before = JSON.stringify(database.tables);
  const response = await request(createPlaybookTestApp(database, USER_A), '/api/playbooks/proposal_recovery/preview', { 'x-orkto-workspace': WORKSPACE_A });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const payload = await response.json() as { data: Record<string, any> };
  const data = payload.data;
  assert.equal(data.execution_available, false);
  assert.equal(data.read_only, true);
  assert.equal(data.execution_status, 'not_available_in_r1');
  assert.equal(data.playbook_key, 'proposal_recovery');
  assert.match(data.digest, /^[a-f0-9]{64}$/);
  assert.equal(data.gate.feature_key, 'proposal_recovery');
  assert.equal(data.gate.state, 'off_by_default');
  assert.equal(data.steps.length, definition.steps.length);
  assert.deepEqual(data.effects.external, []);
  assert.equal(database.operations.every(operation => operation.startsWith('select:')), true);
  assert.equal(JSON.stringify(database.tables), before);
});

test('preview reflects the feature gate truthfully in every state, praising nothing', async () => {
  for (const [rows, expected] of [
    [[], 'off_by_default'],
    [[{ workspace_id: WORKSPACE_A, feature_key: 'proposal_recovery', status: 'inactive' }], 'inactive'],
    [[{ workspace_id: WORKSPACE_A, feature_key: 'proposal_recovery', status: 'ACTIVE' }], 'active'],
    [[{ workspace_id: WORKSPACE_A, feature_key: 'priority_triage', status: 'ACTIVE' }], 'off_by_default'],
  ] as Array<[Array<Record<string, unknown>>, string]>) {
    const database = new PlaybookMemoryDatabase();
    database.tables.orkto_feature_configs = rows;
    const payload = await (await request(createPlaybookTestApp(database, USER_A), '/api/playbooks/proposal_recovery/preview', {})).json();
    assert.equal(payload.data.gate.state, expected, expected);
    assert.equal(payload.data.gate.feature_key, 'proposal_recovery');
    assert.equal(payload.data.execution_available, false);
    assert.equal(payload.data.read_only, true);
  }
});

test('GET preview denies both foreign workspaces, absent membership and missing auth', async () => {
  const database = new PlaybookMemoryDatabase();
  const app = createPlaybookTestApp(database, USER_B);
  assert.equal((await request(app, '/api/playbooks/proposal_recovery/preview', { 'x-orkto-workspace': WORKSPACE_A })).status, 403);
  const empty = new PlaybookMemoryDatabase();
  empty.tables.orkto_workspace_members = [];
  assert.equal((await request(createPlaybookTestApp(empty, USER_A), '/api/playbooks/proposal_recovery/preview', {})).status, 403);
  assert.equal((await request(createPlaybookTestApp(database, null), '/api/playbooks/proposal_recovery/preview', {})).status, 401);
});

test('unknown playbook key returns 404 and the shared database is only used for reads', async () => {
  const database = new PlaybookMemoryDatabase();
  database.from = () => { throw new Error('SHARED_DB_MUST_NOT_BE_USED'); };
  const scoped = new PlaybookMemoryDatabase();
  const app = createPlaybookTestApp(database, USER_A, scoped);
  const missing = await request(app, '/api/playbooks/not_a_playbook/preview', {});
  assert.equal(missing.status, 404);
  const body = await missing.json() as { error: string; category: string };
  assert.equal(body.category, 'not_found');
  const member = new PlaybookMemoryDatabase();
  member.tables.orkto_workspace_members[0].role = 'member';
  const memberApp = createPlaybookTestApp(database, USER_A, member);
  const response = await request(memberApp, '/api/playbooks/proposal_recovery/preview', {});
  assert.equal(response.status, 200);
  assert.equal(member.operations.every(operation => operation.startsWith('select:')), true);
  assert.equal(member.tables.orkto_workspace_members[0].role, 'member');
});
