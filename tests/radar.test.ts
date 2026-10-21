import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { after, afterEach, before, test } from 'node:test';
import { registerOperationalRoutes } from '../backend/operational-routes.js';
import { createOwnerTenantContext } from '../backend/tenancy/tenant-context.js';
import {
  buildRadarSnapshot,
  detectOverdueFollowups,
  detectUnansweredProposals,
  detectUnattendedLeads,
} from '../backend/orkto-core/radar.js';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 86_400_000;
const iso = (msOffset: number) => new Date(NOW + msOffset).toISOString();

test('radar flags proposals sent beyond the threshold and separates viewed from unseen', () => {
  const quotes = [
    { id: 'q-viewed', quote_number: '0001', client_name: 'Ana', total: 1500, status: 'viewed', sent_at: iso(-3 * DAY), viewed_at: iso(-2 * DAY), approved_at: null, rejected_at: null, deal_id: null },
    { id: 'q-unseen', quote_number: '0002', client_name: 'Bruno', total: 900, status: 'sent', sent_at: iso(-8 * DAY), viewed_at: null, approved_at: null, rejected_at: null, deal_id: 'deal-1' },
    { id: 'q-fresh', quote_number: '0003', client_name: 'Carla', total: 100, status: 'sent', sent_at: iso(-2 * HOUR), viewed_at: null, approved_at: null, rejected_at: null, deal_id: null },
    { id: 'q-approved', quote_number: '0004', client_name: 'Duda', total: 500, status: 'approved', sent_at: iso(-9 * DAY), viewed_at: iso(-8 * DAY), approved_at: iso(-7 * DAY), rejected_at: null, deal_id: null },
    { id: 'q-no-sent', quote_number: '0005', client_name: 'Elias', total: 200, status: 'pending', sent_at: null, viewed_at: null, approved_at: null, rejected_at: null, deal_id: null },
  ];
  const signals = detectUnansweredProposals(quotes as any, NOW);
  assert.deepEqual(signals.map(signal => signal.entity_ref), ['q-unseen', 'q-viewed']);
  assert.equal(signals[0].severity, 'high');
  assert.equal(signals[1].severity, 'medium');
  assert.match(signals[0].recommendation, /sem visualização registrada/);
  assert.match(signals[1].recommendation, /Visualização registrada/);
  assert.equal(signals[0].suggested_view, 'proposals');
  assert.deepEqual(signals[0].action_query, { dealId: 'deal-1' });
});

test('radar flags leads waiting on an incoming message and ignores conversations owned by the operator', () => {
  const conversations = [
    { id: 'c-waiting', contact_name: 'Fernanda', contact_phone: '11999990001', status: 'open', created_at: iso(-1 * DAY), messages: [
      { direction: 'incoming', sent_at: iso(-3 * HOUR), read_at: null },
      { direction: 'outgoing', sent_at: iso(-2 * HOUR), read_at: null },
      { direction: 'incoming', sent_at: iso(-90 * 60_000), read_at: null },
    ] },
    { id: 'c-operator-last', contact_name: 'Gustavo', contact_phone: '11999990002', status: 'active', created_at: iso(-1 * DAY), messages: [
      { direction: 'incoming', sent_at: iso(-5 * HOUR), read_at: iso(-4 * HOUR) },
      { direction: 'outgoing', sent_at: iso(-30 * 60_000), read_at: null },
    ] },
    { id: 'c-empty-old', contact_name: 'Helena', contact_phone: '11999990003', status: 'open', created_at: iso(-3 * HOUR), messages: [] },
    { id: 'c-empty-fresh', contact_name: 'Ivo', contact_phone: '11999990004', status: 'open', created_at: iso(-10 * 60_000), messages: [] },
    { id: 'c-closed', contact_name: 'Joana', contact_phone: '11999990005', status: 'closed', created_at: iso(-2 * DAY), messages: [
      { direction: 'incoming', sent_at: iso(-1 * DAY), read_at: null },
    ] },
  ];
  const signals = detectUnattendedLeads(conversations as any, NOW, { slaMinutes: 60 });
  assert.deepEqual(signals.map(signal => signal.entity_ref), ['c-waiting']);
  const waitingSignal = signals.find(signal => signal.entity_ref === 'c-waiting')!;
  assert.equal(waitingSignal.severity, 'medium');
  assert.equal(waitingSignal.evidence.unread_count, 1);
  assert.match(waitingSignal.recommendation, /aguarda resposta há/);
  assert.equal(waitingSignal.suggested_view, 'conversations');
  const highSla = detectUnattendedLeads(conversations as any, NOW, { slaMinutes: 60, leadHighMinutes: 60 });
  assert.equal(highSla[0].severity, 'high');
});

test('radar flags overdue tasks and deals past expected close, always labeling the source', () => {
  const tasks = [
    { id: 't-1', title: 'Ligar para o cliente', status: 'open', due_at: iso(-2 * DAY), deal_id: 'deal-9', customer_ref: 'c-1' },
    { id: 't-2', title: 'Enviar nota', status: 'completed', due_at: iso(-2 * DAY), deal_id: null, customer_ref: null },
    { id: 't-3', title: 'Sem prazo', status: 'open', due_at: null, deal_id: null, customer_ref: null },
    { id: 't-4', title: 'Futuro', status: 'in_progress', due_at: iso(2 * DAY), deal_id: null, customer_ref: null },
  ];
  const deals = [
    { id: 'deal-old', title: 'Instalação hidráulica', stage: 'negotiation', status: 'open', expected_close_on: '2026-10-10', customer_ref: 'c-2' },
    { id: 'deal-future', title: 'Manutenção', stage: 'new', status: 'open', expected_close_on: '2026-11-01', customer_ref: null },
    { id: 'deal-won', title: 'Fechado', stage: 'won', status: 'won', expected_close_on: '2026-09-01', customer_ref: null },
  ];
  const signals = detectOverdueFollowups(tasks as any, deals as any, NOW);
  assert.deepEqual(signals.map(signal => signal.id), ['radar:overdue_followup:deal:deal-old', 'radar:overdue_followup:task:t-1']);
  const dealSignal = signals.find(signal => signal.entity_ref === 'deal-old')!;
  const taskSignal = signals.find(signal => signal.entity_ref === 't-1')!;
  assert.equal(taskSignal.source, 'task_due');
  assert.equal(dealSignal.source, 'deal_expected_close');
  assert.equal(dealSignal.entity_type, 'deal');
  assert.match(dealSignal.recommendation, /10\/10/);
  assert.equal(dealSignal.suggested_view, 'deals');
});

test('radar snapshot aggregates counts, sorts high severity first, and caps per kind', () => {
  const quotes = Array.from({ length: 30 }, (_, index) => ({
    id: `q-${index}`, quote_number: String(index), client_name: `Cliente ${index}`, total: 100, status: 'sent',
    sent_at: iso(-(index + 1) * DAY), viewed_at: null, approved_at: null, rejected_at: null, deal_id: null,
  }));
  const snapshot = buildRadarSnapshot({ quotes: quotes as any, conversations: [], tasks: [], deals: [] }, NOW);
  assert.equal(snapshot.counts.unanswered_proposals, 25);
  assert.equal(snapshot.counts.unattended_leads, 0);
  assert.equal(snapshot.counts.overdue_followups, 0);
  assert.equal(new Date(snapshot.generated_at).getTime(), NOW);
  const severities = snapshot.signals.map(signal => signal.severity);
  assert.equal(severities.indexOf('medium') > severities.lastIndexOf('high'), true);
  assert.deepEqual(snapshot.counts, { unanswered_proposals: 25, unattended_leads: 0, overdue_followups: 0 });
  const empty = buildRadarSnapshot({}, NOW);
  assert.deepEqual(empty.counts, { unanswered_proposals: 0, unattended_leads: 0, overdue_followups: 0 });
  assert.deepEqual(empty.signals, []);
});

const WORKSPACE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_A = WORKSPACE_A;
const WORKSPACE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_B = WORKSPACE_B;

class RadarMemoryQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private maxRows: number | null = null;
  private ordering: { column: string; ascending: boolean } | null = null;
  constructor(private readonly database: RadarMemoryDatabase, private readonly table: string) {}
  select(_columns = '*'): this { return this; }
  eq(column: string, value: unknown): this { this.filters.push(row => row[column] === value); return this; }
  in(column: string, values: unknown[]): this { this.filters.push(row => values.includes(row[column])); return this; }
  is(column: string, value: unknown): this { this.filters.push(row => (row[column] ?? null) === value); return this; }
  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is' && value === null) this.filters.push(row => row[column] !== null && row[column] !== undefined);
    return this;
  }
  or(expression: string): this {
    const boundary = expression.split('retention_expires_at.gt.')[1];
    if (boundary) this.filters.push(row => row.retention_expires_at == null || Date.parse(String(row.retention_expires_at)) > Date.parse(boundary));
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

class RadarMemoryDatabase {
  readonly tables: Record<string, Array<Record<string, unknown>>> = {
    orkto_workspace_members: [
      { workspace_id: WORKSPACE_A, user_id: USER_A, role: 'owner', status: 'active' },
      { workspace_id: WORKSPACE_B, user_id: USER_B, role: 'owner', status: 'active' },
    ],
    orkto_workspaces: [
      { id: WORKSPACE_A, owner_user_id: USER_A },
      { id: WORKSPACE_B, owner_user_id: USER_B },
    ],
    quotes: [
      { id: 'quote-a', workspace_id: WORKSPACE_A, quote_number: '0001', client_name: 'Ana', total: 1500, status: 'viewed', sent_at: iso(-3 * DAY), viewed_at: iso(-2 * DAY), approved_at: null, rejected_at: null, deal_id: null, archived_at: null },
      { id: 'quote-b', workspace_id: WORKSPACE_B, quote_number: '0002', client_name: 'Outro', total: 990, status: 'sent', sent_at: iso(-9 * DAY), viewed_at: null, approved_at: null, rejected_at: null, deal_id: null, archived_at: null },
    ],
    orkto_conversations: [
      { id: 'conv-a', workspace_id: WORKSPACE_A, contact_name: 'Fernanda', contact_phone: '11999990001', status: 'open', created_at: iso(-1 * DAY), last_message_at: iso(-90 * 60_000) },
      { id: 'conv-b', workspace_id: WORKSPACE_B, contact_name: 'Outro lead', contact_phone: '11888880000', status: 'open', created_at: iso(-1 * DAY), last_message_at: iso(-90 * 60_000) },
    ],
    orkto_messages: [
      { conversation_id: 'conv-a', workspace_id: WORKSPACE_A, direction: 'incoming', sent_at: iso(-90 * 60_000), read_at: null },
      { conversation_id: 'conv-b', workspace_id: WORKSPACE_B, direction: 'incoming', sent_at: iso(-90 * 60_000), read_at: null },
    ],
    orkto_tasks: [
      { id: 'task-a', workspace_id: WORKSPACE_A, title: 'Ligar para o cliente', status: 'open', due_at: iso(-2 * DAY), deal_id: 'deal-a', customer_ref: 'c-1' },
    ],
    orkto_deals: [
      { id: 'deal-a', workspace_id: WORKSPACE_A, title: 'Instalação hidráulica', stage: 'negotiation', status: 'open', expected_close_on: '2026-10-10', customer_ref: 'c-2' },
    ],
    orkto_feature_configs: [],
  };
  readonly operations: string[] = [];
  from(table: string): RadarMemoryQuery { return new RadarMemoryQuery(this, table); }
}

const servers = new Set<ReturnType<typeof createServer>>();
const realNow = Date.now;

before(() => {
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'test';
  Date.now = () => NOW;
});

afterEach(async () => {
  await Promise.all([...servers].map(server => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  })));
  servers.clear();
});

after(() => {
  Date.now = realNow;
  delete process.env.APP_ENV;
});

function createRadarTestApp(database: RadarMemoryDatabase, userId: string | null, requestDb?: RadarMemoryDatabase): Express {
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

test('GET /api/radar is read-only, workspace-scoped, and returns the deterministic envelope', async () => {
  const database = new RadarMemoryDatabase();
  const before = JSON.stringify(database.tables);
  const response = await request(createRadarTestApp(database, USER_A), '/api/radar', { 'x-orkto-workspace': WORKSPACE_A });
  assert.equal(response.status, 200);
  const payload = await response.json() as { data: { generated_at: string; counts: Record<string, number>; signals: Array<{ kind: string; entity_ref: string }> } };
  assert.equal(typeof payload.data.generated_at, 'string');
  assert.equal(payload.data.counts.unanswered_proposals, 1);
  assert.equal(payload.data.counts.unattended_leads, 1);
  assert.equal(payload.data.counts.overdue_followups, 2);
  const kinds = new Map(payload.data.signals.map(signal => [signal.entity_ref, signal.kind]));
  assert.equal(kinds.get('quote-a'), 'unanswered_proposal');
  assert.equal(kinds.get('conv-a'), 'unattended_lead');
  assert.equal(kinds.get('task-a'), 'overdue_followup');
  assert.equal(kinds.get('deal-a'), 'overdue_followup');
  assert.equal(payload.data.signals.some(signal => signal.entity_ref === 'quote-b'), false);
  assert.equal(payload.data.signals.some(signal => signal.entity_ref === 'conv-b'), false);
  assert.equal(database.operations.some(operation => !operation.startsWith('select:')), false);
  assert.equal(JSON.stringify(database.tables), before);
});

test('GET /api/radar denies a workspace without active membership', async () => {
  const database = new RadarMemoryDatabase();
  const response = await request(createRadarTestApp(database, USER_B), '/api/radar', { 'x-orkto-workspace': WORKSPACE_A });
  assert.equal(response.status, 403);
});

test('proposal thresholds, retention, terminal states and future/invalid dates are conservative', () => {
  const base = { id:'q', quote_number:'1', client_name:'Teste', total:100, status:'sent', sent_at:iso(-48*HOUR), viewed_at:null, approved_at:null, rejected_at:null, deal_id:null };
  assert.equal(detectUnansweredProposals([base], NOW).length,1);
  assert.equal(detectUnansweredProposals([{...base,sent_at:iso(-48*HOUR+1)}],NOW).length,0);
  for(const changes of [{status:'draft'},{status:'expired'},{status:'approved'},{status:'rejected'},{archived_at:iso(-HOUR)},{retention_expires_at:iso(0)},{retention_expires_at:'invalid'},{sent_at:'invalid'},{sent_at:iso(HOUR)},{approved_at:iso(-HOUR)},{rejected_at:iso(-HOUR)}]) {
    assert.equal(detectUnansweredProposals([{...base,...changes}],NOW).length,0,JSON.stringify(changes));
  }
  assert.equal(detectUnansweredProposals([base],NOW,{proposalUnansweredHours:NaN,maxPerKind:Infinity}).length,1);
});

test('first-response SLA starts at oldest pending incoming; internal notes and read markers do not reset it', () => {
  const base = {id:'c',contact_name:'Teste',contact_phone:null,status:'open',created_at:iso(-DAY),messages:[
    {direction:'incoming',sent_at:iso(-60*60_000),read_at:iso(-30*60_000)},
    {direction:'incoming',sent_at:iso(-5*60_000),read_at:null},
    {direction:'internal',sent_at:iso(-60_000),read_at:null},
  ]};
  const [signal] = detectUnattendedLeads([base],NOW);
  assert.equal(signal.evidence.waiting_minutes,60);
  assert.equal(signal.evidence.response_scope,'first_response');
  assert.equal(detectUnattendedLeads([{...base,messages:base.messages.slice(1)}],NOW).length,0);
  assert.equal(detectUnattendedLeads([{...base,messages:[...base.messages,{direction:'outgoing',sent_at:iso(-60_000),read_at:null}]}],NOW).length,0);
  assert.equal(detectUnattendedLeads([{...base,messages:[]}],NOW).length,0);
  for(const status of ['paused','closed','archived']) assert.equal(detectUnattendedLeads([{...base,status}],NOW).length,0);
  for(const sent_at of ['invalid',iso(HOUR)]) assert.equal(detectUnattendedLeads([{...base,messages:[...base.messages,{direction:'incoming',sent_at,read_at:null}]}],NOW).length,0);
});

test('overdue tasks ignore completed_at and exact/future deadlines; calendar dates validate and use UTC day end', () => {
  const task = {id:'t',title:'Tarefa',status:'open',due_at:iso(0),deal_id:null,customer_ref:null};
  assert.equal(detectOverdueFollowups([task],[],NOW).length,0);
  assert.equal(detectOverdueFollowups([{...task,due_at:iso(-1)}],[],NOW).length,1);
  assert.equal(detectOverdueFollowups([{...task,due_at:iso(-DAY),completed_at:iso(-HOUR)}],[],NOW).length,0);
  const deal = {id:'d',title:'Negócio',stage:'new',status:'open',expected_close_on:'2026-10-20',customer_ref:null};
  assert.equal(detectOverdueFollowups([],[deal],NOW).length,0);
  assert.equal(detectOverdueFollowups([],[{...deal,expected_close_on:'2026-02-30'}],NOW).length,0);
});

test('GET Radar uses request-bound database exclusively, returns no-store and denies both foreign workspaces', async () => {
  for(const [actor,own,foreign] of [[USER_A,WORKSPACE_A,WORKSPACE_B],[USER_B,WORKSPACE_B,WORKSPACE_A]]) {
    const shared = new RadarMemoryDatabase();
    shared.from = () => {throw new Error('SHARED_DB_MUST_NOT_BE_USED');};
    const scoped = new RadarMemoryDatabase();
    const app = createRadarTestApp(shared,actor,scoped);
    const response = await request(app,'/api/radar',{'x-orkto-workspace':own});
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'private, no-store');
    const payload = await response.json();
    const refs = payload.data.signals.map((s:any)=>s.entity_ref);
    assert.equal(refs.some((id:string)=>id.endsWith(actor===USER_A?'-b':'-a')),false);
    assert.equal((await request(app,'/api/radar',{'x-orkto-workspace':foreign})).status,403);
    assert.equal(scoped.operations.every(op=>op.startsWith('select:')),true);
  }
});

test('GET Radar does not auto-provision absent or inactive memberships and denies missing auth', async () => {
  const db = new RadarMemoryDatabase(); db.tables.orkto_workspace_members=[];
  assert.equal((await request(createRadarTestApp(db,USER_A),'/api/radar',{})).status,403);
  assert.equal((await request(createRadarTestApp(db,null),'/api/radar',{})).status,401);
  db.tables.orkto_workspace_members=[{workspace_id:WORKSPACE_A,user_id:USER_A,role:'member',status:'inactive'}];
  assert.equal((await request(createRadarTestApp(db,USER_A),'/api/radar',{})).status,403);
  assert.equal(db.operations.every(op=>op.startsWith('select:')),true);
});

test('GET Radar excludes archived/retained quotes and skips lead inference for truncated messages', async () => {
  const db = new RadarMemoryDatabase();
  db.tables.quotes.push({...db.tables.quotes[0],id:'archived',archived_at:iso(-HOUR)}, {...db.tables.quotes[0],id:'expired',retention_expires_at:iso(-HOUR)});
  db.tables.orkto_messages=Array.from({length:1001},(_,i)=>({conversation_id:'conv-a',workspace_id:WORKSPACE_A,direction:'incoming',sent_at:iso(-HOUR-i),read_at:null}));
  const payload = await (await request(createRadarTestApp(db,USER_A),'/api/radar',{})).json();
  assert.equal(payload.data.coverage.partial,true); assert.equal(payload.data.coverage.leads_evaluated,false);
  assert.equal(payload.data.counts.unanswered_proposals,1); assert.equal(payload.data.counts.unattended_leads,0);
  assert.deepEqual(payload.data.coverage.limited_sources,['messages']);
});

test('GET Radar filters foreign messages even when they reference a selected conversation and allows member reads without elevation', async () => {
  const db = new RadarMemoryDatabase();
  db.tables.orkto_workspace_members[0].role='member';
  db.tables.orkto_messages.push({conversation_id:'conv-a',workspace_id:WORKSPACE_B,direction:'outgoing',sent_at:iso(-60_000),read_at:null});
  const before = JSON.stringify(db.tables);
  const response = await request(createRadarTestApp(db,USER_A),'/api/radar',{});
  const payload = await response.json();
  assert.equal(response.status,200); assert.equal(payload.data.counts.unattended_leads,1);
  assert.equal(JSON.stringify(db.tables),before);
  assert.equal(db.tables.orkto_workspace_members[0].role,'member');
});

test('GET Radar marks capped sources partial and propagates read failure without a successful empty snapshot', async () => {
  const capped = new RadarMemoryDatabase(); capped.tables.quotes=Array.from({length:200},(_,i)=>({...capped.tables.quotes[0],id:`q-${i}`}));
  const payload = await (await request(createRadarTestApp(capped,USER_A),'/api/radar',{})).json();
  assert.equal(payload.data.coverage.partial,true); assert.ok(payload.data.coverage.limited_sources.includes('quotes'));
  const broken = new RadarMemoryDatabase(),from=broken.from.bind(broken);
  broken.from=(table:string)=>{if(table==='quotes')throw new Error('read unavailable');return from(table);};
  const response = await request(createRadarTestApp(broken,USER_A),'/api/radar',{});
  assert.equal(response.status,503); assert.equal((await response.json()).data,undefined);
});
