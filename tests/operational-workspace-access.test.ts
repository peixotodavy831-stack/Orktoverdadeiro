import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { after, afterEach, before, test } from 'node:test';
import { registerOperationalRoutes } from '../backend/operational-routes.js';
import { createOwnerTenantContext } from '../backend/tenancy/tenant-context.js';

const WORKSPACE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_A = WORKSPACE_A;
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WORKSPACE_UNRELATED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TEST_SUPABASE_URL = 'http://orkto-test-supabase.invalid';

const originalFetch = globalThis.fetch;
const gatewayDatabases = new Map<string, MemoryWorkspaceDatabase>();
const originalGatewayEnv = Object.fromEntries(['APP_ENV','NODE_ENV','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY']
  .map(key => [key,process.env[key]]));

function gatewayJson(data: unknown, status=200) { return Response.json(data,{status}); }

before(() => {
  process.env.APP_ENV='development';process.env.NODE_ENV='test';
  process.env.VITE_SUPABASE_URL=TEST_SUPABASE_URL;process.env.VITE_SUPABASE_ANON_KEY='test-publishable-key';
  globalThis.fetch=async (input:RequestInfo|URL,init?:RequestInit) => {
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.origin!==TEST_SUPABASE_URL || url.pathname!=='/functions/v1/orkto-core-mutations') return originalFetch(input,init);
    const headers=new Headers(init?.headers);const token=(headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const db=gatewayDatabases.get(token);const workspaceId=headers.get('x-orkto-workspace')||'';
    if(!db) return gatewayJson({code:'AUTH_REQUIRED'},401);
    const membership=db.memberships.find(row=>row.user_id===token&&row.workspace_id===workspaceId&&row.status==='active');
    if(!membership) return gatewayJson({code:'WORKSPACE_ACCESS_DENIED'},403);
    const {command,payload={}}=JSON.parse(String(init?.body||'{}')) as {command:string;payload:Record<string,any>};
    const ok=(data:Record<string,unknown>,status=200)=>gatewayJson({data},status);
    const client=db.clients.find(row=>row.id===payload.clientId&&row.workspace_id===workspaceId&&!row.archived_at);
    const service=db.services.find(row=>row.id===payload.serviceId&&row.workspace_id===workspaceId&&!row.archived_at);
    const deal=db.deals.find(row=>row.id===payload.dealId&&row.workspace_id===workspaceId);
    const audit=(event_type:string,entity_type:string,entity_ref:string,payload:Record<string,unknown>={})=>db.events.push({
      id:`event-${randomUUID()}`,workspace_id:workspaceId,actor_user_id:token,event_type,entity_type,entity_ref,payload,occurred_at:new Date().toISOString(),
    });
    if(command==='CREATE_CLIENT'){
      const row={id:`client-${randomUUID()}`,workspace_id:workspaceId,user_id:token,name:payload.name,phone:payload.phone,
        company:payload.company??null,vehicle_or_service:payload.vehicleOrService??null,notes:payload.notes??null,archived_at:null,created_at:new Date().toISOString()};
      db.clients.push(row);audit('client.created','client',row.id);return ok({result:'CREATED',client:row},201);
    }
    if(command==='UPDATE_CLIENT'){
      if(!client)return gatewayJson({code:'NOT_FOUND'},404);Object.assign(client,payload.changes);audit('client.updated','client',client.id);return ok({result:'UPDATED',client});
    }
    if(command==='ARCHIVE_CLIENT'){
      if(!client)return gatewayJson({code:'NOT_FOUND'},404);if(!['owner','admin'].includes(membership.role))return gatewayJson({code:'PERMISSION_DENIED'},403);
      client.archived_at=new Date().toISOString();audit('client.archived','client',client.id);return ok({result:'ARCHIVED',client_id:client.id});
    }
    if(command==='CREATE_CATALOG_ITEM'){
      const row={id:`service-${randomUUID()}`,workspace_id:workspaceId,user_id:token,name:payload.name,description:payload.description??'',
        unit_price:payload.unitPrice,category:payload.category,archived_at:null,created_at:new Date().toISOString()};
      db.services.push(row);audit('catalog_item.created','service',row.id);return ok({result:'CREATED',service:row},201);
    }
    if(command==='UPDATE_CATALOG_ITEM'){
      if(!service)return gatewayJson({code:'NOT_FOUND'},404);const changes={...payload.changes};
      if(Object.hasOwn(changes,'unitPrice')){changes.unit_price=changes.unitPrice;delete changes.unitPrice;}Object.assign(service,changes);
      audit('catalog_item.updated','service',service.id);return ok({result:'UPDATED',service});
    }
    if(command==='ARCHIVE_CATALOG_ITEM'){
      if(!service)return gatewayJson({code:'NOT_FOUND'},404);if(!['owner','admin'].includes(membership.role))return gatewayJson({code:'PERMISSION_DENIED'},403);
      service.archived_at=new Date().toISOString();audit('catalog_item.archived','service',service.id);return ok({result:'ARCHIVED',service_id:service.id});
    }
    if(command==='CREATE_DEAL'){
      if(payload.ownerUserId&&!db.memberships.some(row=>row.workspace_id===workspaceId&&row.user_id===payload.ownerUserId&&row.status==='active'))
        return gatewayJson({code:'VALIDATION_FAILED'},400);
      const row={id:`deal-${randomUUID()}`,workspace_id:workspaceId,created_by:token,title:payload.title,description:payload.description??'',
        customer_ref:payload.customerRef??null,stage:payload.stage??'new',status:'open',value_cents:payload.valueCents??0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      db.deals.push(row);audit('deal.created','deal',row.id);return ok({result:'CREATED',deal:row},201);
    }
    if(command==='UPDATE_DEAL'){
      if(!deal)return gatewayJson({code:'NOT_FOUND'},404);if(deal.status==='archived')return gatewayJson({code:'CONFLICT'},409);
      const from=deal.stage;const changes={...payload.changes};if(Object.hasOwn(changes,'valueCents')){changes.value_cents=changes.valueCents;delete changes.valueCents;}
      Object.assign(deal,changes,{updated_at:new Date().toISOString()});audit(changes.stage&&changes.stage!==from?'deal.stage_changed':'deal.updated','deal',deal.id,{from_stage:from,to_stage:deal.stage});
      return ok({result:'UPDATED',deal});
    }
    if(command==='ARCHIVE_DEAL'){
      if(!deal)return gatewayJson({code:'NOT_FOUND'},404);if(!['owner','admin'].includes(membership.role))return gatewayJson({code:'PERMISSION_DENIED'},403);
      if(deal.status==='archived')return ok({result:'REPLAY',deal});deal.status='archived';audit('deal.archived','deal',deal.id);return ok({result:'UPDATED',deal});
    }
    return gatewayJson({code:'VALIDATION_FAILED'},400);
  };
});

after(() => {
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries(originalGatewayEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

type Membership = { workspace_id: string; user_id: string; role: string; status: string };

class MemorySupabaseQuery {
  private readonly filters: Array<[string, unknown]> = [];
  private operation: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select';
  private payload: any = {};
  private rangeBounds: [number, number] | null = null;
  private maxRows: number | null = null;
  private ordering: { column: string; ascending: boolean } | null = null;

  constructor(private readonly database: MemoryWorkspaceDatabase, private readonly table: string) {}

  select(_columns = '*'): this { return this; }
  eq(column: string, value: unknown): this { this.filters.push([column, value]); return this; }
  neq(column: string, value: unknown): this { this.filters.push([`neq:${column}`, value]); return this; }
  gt(column: string, value: unknown): this { this.filters.push([`gt:${column}`, value]); return this; }
  gte(column: string, value: unknown): this { this.filters.push([`gte:${column}`, value]); return this; }
  lt(column: string, value: unknown): this { this.filters.push([`lt:${column}`, value]); return this; }
  lte(column: string, value: unknown): this { this.filters.push([`lte:${column}`, value]); return this; }
  or(_expression: string): this { return this; }
  in(column: string, values: unknown[]): this { this.filters.push([column, values]); return this; }
  is(column: string, value: unknown): this { this.filters.push([column, value]); return this; }
  order(column: string, options?: { ascending?: boolean }): this { this.ordering = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number): this { this.maxRows = value; return this; }
  range(from: number, to: number): this { this.rangeBounds = [from, to]; return this; }
  update(payload: Record<string, unknown>): this { this.operation = 'update'; this.payload = payload; return this; }
  insert(payload: any): this { this.operation = 'insert'; this.payload = payload; return this; }
  upsert(payload: any): this { this.operation = 'upsert'; this.payload = payload; return this; }
  delete(): this { this.operation = 'delete'; return this; }
  maybeSingle(): Promise<{ data: any; error: null }> { return this.execute(true); }
  single(): Promise<{ data: any; error: null }> { return this.execute(true); }
  then(resolve: (value: { data: any; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
    return this.execute(false).then(resolve, reject);
  }

  private execute(single: boolean): Promise<{ data: any; error: null }> {
    const result = this.database.execute(this.table, this.operation, this.filters, this.payload, this.rangeBounds, this.ordering, this.maxRows);
    return Promise.resolve({ data: single ? result[0] ?? null : result, error: null });
  }
}

class MemoryWorkspaceDatabase {
  readonly memberships: Membership[] = [
    { workspace_id: WORKSPACE_A, user_id: USER_A, role: 'owner', status: 'active' },
    { workspace_id: WORKSPACE_A, user_id: USER_MEMBER, role: 'member', status: 'active' },
    { workspace_id: WORKSPACE_A, user_id: USER_B, role: 'admin', status: 'active' },
    { workspace_id: USER_B, user_id: USER_B, role: 'owner', status: 'active' },
  ];
  readonly workspaces = new Map([
    [WORKSPACE_A, { id: WORKSPACE_A, owner_user_id:USER_A, name: 'Empresa A', settings: {}, plan_key:'pro', subscription_status:'active' }],
    [USER_B, { id: USER_B, owner_user_id:USER_B, name: 'Empresa B', settings: {}, plan_key:'pro', subscription_status:'active' }],
  ]);
  readonly subscriptions = [WORKSPACE_A, USER_B].map(workspace_id => ({ workspace_id, plan_key:'pro', status:'active', trial_ends_at:null, created_at:'2026-01-01T00:00:00.000Z' }));
  readonly planVersions = ['starter','pro','business','scale','enterprise','founders','legacy_standard'].map(plan_key => ({
    plan_key, version:1, status:'approved', price_cents:null, price_is_public:false,
    effective_from:'2026-01-01T00:00:00.000Z', effective_until:null,
    entitlements:{ features:{core_crm:true,proposals:true,wia:true}, limits:{seats:null,monthly_wia_runs:null,active_proposals:plan_key==='pro'?50:5} },
  }));
  readonly deals = [
    { id: 'deal-a', workspace_id: WORKSPACE_A, title: 'Negócio A', stage: 'new', status: 'open', value_cents: 1200 },
    { id: 'deal-b', workspace_id: USER_B, title: 'Negócio B', stage: 'new', status: 'open', value_cents: 3400 },
  ];
  readonly clients: Array<Record<string, any>> = [
    { id:'client-a',user_id:WORKSPACE_A,workspace_id:WORKSPACE_A,name:'Cliente A',phone:'11999990001',company:null,vehicle_or_service:null,notes:null,archived_at:null,created_at:'2026-09-01T00:00:00.000Z' },
    { id:'client-b',user_id:USER_B,workspace_id:USER_B,name:'Cliente B',phone:'11999990002',company:null,vehicle_or_service:null,notes:null,archived_at:null,created_at:'2026-09-01T00:00:00.000Z' },
  ];
  readonly services: Array<Record<string, any>> = [
    { id:'service-a',user_id:WORKSPACE_A,workspace_id:WORKSPACE_A,name:'Serviço A',description:'',unit_price:100,category:'Serviço',archived_at:null,created_at:'2026-09-01T00:00:00.000Z' },
    { id:'service-b',user_id:USER_B,workspace_id:USER_B,name:'Serviço B',description:'',unit_price:200,category:'Serviço',archived_at:null,created_at:'2026-09-01T00:00:00.000Z' },
  ];
  readonly importJobs: Array<Record<string, any>> = [];
  readonly importRows: Array<Record<string, any>> = [];
  readonly events: Record<string, unknown>[] = [];

  from(table: string): MemorySupabaseQuery { return new MemorySupabaseQuery(this, table); }

  execute(table: string, operation: 'select' | 'update' | 'insert' | 'upsert' | 'delete', filters: Array<[string, unknown]>, payload: any, range: [number,number] | null, ordering: { column:string; ascending:boolean } | null, maxRows: number | null): any[] {
    const matches = (row: Record<string, unknown>) => filters.every(([rawColumn, value]) => {
      const [operator, ...columnParts] = String(rawColumn).split(':');
      const column = columnParts.length ? columnParts.join(':') : operator;
      const actual = row[column] as any;
      if (operator === 'neq') return actual !== value;
      if (operator === 'gt') return actual > value;
      if (operator === 'gte') return actual >= value;
      if (operator === 'lt') return actual < value;
      if (operator === 'lte') return actual <= value;
      return Array.isArray(value) ? value.includes(actual) : actual === value;
    });
    if (table === 'orkto_workspace_subscriptions') return this.subscriptions.filter(matches);
    if (table === 'orkto_plan_price_versions') return this.planVersions.filter(matches);
    if (table === 'clients' || table === 'services') {
      const rows = table === 'clients' ? this.clients : this.services;
      const selected = rows.filter(matches);
      if (operation === 'insert' || operation === 'upsert') {
        const candidates = Array.isArray(payload) ? payload : [payload];
        const insertedRows = candidates.map(candidate => {
          if (operation === 'upsert' && candidate.orkto_import_row_id) {
            const prior = rows.find(row => row.orkto_import_row_id === candidate.orkto_import_row_id);
            if (prior) { Object.assign(prior,candidate); return prior; }
          }
          return { id:`${table}-${randomUUID()}`, created_at:new Date().toISOString(), updated_at:new Date().toISOString(), archived_at:null, ...candidate };
        });
        for (const inserted of insertedRows) if (!rows.includes(inserted)) rows.push(inserted as any);
        const inserted = insertedRows[0];
        return [inserted];
      }
      if (operation === 'update') { for (const row of selected) Object.assign(row,payload); }
      if (operation === 'delete') {
        for (const row of selected) rows.splice(rows.indexOf(row),1);
      }
      return operation === 'select' && range ? selected.slice(range[0],range[1] + 1) : selected;
    }
    if (table === 'orkto_import_jobs' || table === 'orkto_import_rows') {
      const rows = table === 'orkto_import_jobs' ? this.importJobs : this.importRows;
      const selected = rows.filter(matches);
      if (operation === 'insert') {
        const candidates = Array.isArray(payload) ? payload : [payload];
        const inserted = candidates.map(candidate => ({ id:`${table}-${randomUUID()}`,created_at:new Date().toISOString(),...candidate }));
        rows.push(...inserted);
        return inserted;
      }
      if (operation === 'update') for (const row of selected) Object.assign(row,payload);
      return selected;
    }
    if (table === 'orkto_workspace_members') return this.memberships.filter(matches);
    if (table === 'orkto_plan_usage') return [];
    if (table === 'orkto_deals') {
      const selected = this.deals.filter(matches);
      if (operation === 'insert') {
        const inserted: Record<string,any> = { id:`deal-${randomUUID()}`, ...payload };
        this.deals.push(inserted as any);
        return [inserted];
      }
      if (operation === 'update' && selected[0]) Object.assign(selected[0], payload);
      return selected.map(row => ({ ...row }));
    }
    if (table === 'orkto_wia_events') {
      const selected = this.events.filter(matches);
      if (operation === 'insert') {
        const candidates = Array.isArray(payload) ? payload : [payload];
        const inserted = candidates.map(candidate => ({ id:`event-${randomUUID()}`,occurred_at:new Date().toISOString(),...candidate }));
        this.events.push(...inserted);
        return inserted;
      }
      return selected;
    }
    if (table === 'quotes') return [];
    if (table === 'orkto_workspaces') {
      const selected = [...this.workspaces.values()].filter(matches);
      if (operation === 'update' && selected[0]) Object.assign(selected[0], payload);
      return selected;
    }
    if (table === 'orkto_wia_events' && operation === 'insert') {
      this.events.push(payload);
      return [payload];
    }
    return [];
  }
}

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all([...servers].map(server => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  })));
  servers.clear();
  gatewayDatabases.clear();
});

function createTestApp(database: MemoryWorkspaceDatabase, userId: string): Express {
  gatewayDatabases.set(userId,database);
  const app = express();
  app.use(express.json());
  const authenticate = (req: any, _res: any, next: () => void) => {
    req.user = { id: userId, email: `${userId}@example.test` };
    req.headers.authorization = `Bearer ${userId}`;
    req.tenantContext = createOwnerTenantContext(userId);
    next();
  };
  registerOperationalRoutes(app, authenticate, database);
  return app;
}

async function request(app: Express, path: string, init?: RequestInit): Promise<Response> {
  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

test('workspace access derives the tenant from an active membership, not an untrusted workspace ID', async () => {
  const database = new MemoryWorkspaceDatabase();
  const unrelatedWorkspace = await request(createTestApp(database, USER_MEMBER), '/api/operational/workspace', {
    headers: { 'x-orkto-workspace': WORKSPACE_UNRELATED },
  });
  assert.equal(unrelatedWorkspace.status, 403);

  const memberWorkspace = await request(createTestApp(database, USER_MEMBER), '/api/operational/workspace', {
    headers: { 'x-orkto-workspace': WORKSPACE_A },
  });
  assert.equal(memberWorkspace.status, 200);
  const payload = await memberWorkspace.json() as { workspace: { id: string }; currentRole: string };
  assert.equal(payload.workspace.id, WORKSPACE_A);
  assert.equal(payload.currentRole, 'member');
});

test('member cannot create a manager-attributed private instruction', async () => {
  const database = new MemoryWorkspaceDatabase();
  const response = await request(createTestApp(database, USER_MEMBER), '/api/conversations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sussurros', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'x-orkto-workspace':WORKSPACE_A },
    body:JSON.stringify({ content:'Synthetic manager instruction' }),
  });
  assert.equal(response.status,403);
});

test('member cannot change workspace settings; admin and owner can', async () => {
  const database = new MemoryWorkspaceDatabase();
  const update = (app: Express) => request(app, '/api/operational/workspace', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-orkto-workspace': WORKSPACE_A },
    body: JSON.stringify({ name: 'Empresa atualizada' }),
  });

  assert.equal((await update(createTestApp(database, USER_MEMBER))).status, 403);
  assert.equal(database.workspaces.get(WORKSPACE_A)?.name, 'Empresa A');

  assert.equal((await update(createTestApp(database, USER_B))).status, 200);
  assert.equal(database.workspaces.get(WORKSPACE_A)?.name, 'Empresa atualizada');
  assert.equal((await update(createTestApp(database, USER_A))).status, 200);
  assert.equal(database.events.length, 4);
  assert.deepEqual(database.events.map(event => event.event_type), [
    'workspace.settings_change_requested','workspace.settings_changed',
    'workspace.settings_change_requested','workspace.settings_changed',
  ]);
});

test('workspace settings refuse a write when the audit store is unavailable', async () => {
  class AuditUnavailableDatabase extends MemoryWorkspaceDatabase {
    override execute(...args: Parameters<MemoryWorkspaceDatabase['execute']>): any[] {
      if (args[0] === 'orkto_wia_events' && args[1] === 'insert') throw new Error('audit unavailable');
      return super.execute(...args);
    }
  }
  const database = new AuditUnavailableDatabase();
  const response = await request(createTestApp(database, USER_A), '/api/operational/workspace', {
    method:'PATCH',
    headers:{ 'content-type':'application/json', 'x-orkto-workspace':WORKSPACE_A },
    body:JSON.stringify({ name:'Should not persist' }),
  });
  assert.equal(response.status,503);
  assert.equal(database.workspaces.get(WORKSPACE_A)?.name,'Empresa A');
});

test('a workspace member cannot read or edit another workspace deal', async () => {
  const database = new MemoryWorkspaceDatabase();
  const app = createTestApp(database, USER_MEMBER);

  const invalidOwner = await request(createTestApp(database,USER_A),'/api/deals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Responsável externo',ownerUserId:WORKSPACE_UNRELATED})});
  assert.equal(invalidOwner.status,400,'an assigned owner must be an active workspace member');
  const spoofedTenantCreate = await request(createTestApp(database,USER_A),'/api/deals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Negócio criado no tenant autenticado',workspace_id:USER_B})});
  assert.equal(spoofedTenantCreate.status,201);
  const created = (await spoofedTenantCreate.json() as {data:{id:string;workspace_id:string}}).data;
  assert.equal(created.workspace_id,WORKSPACE_A,'workspace_id from the request body must be ignored');

  const list = await request(app, '/api/deals', {
    headers: { 'x-orkto-workspace': WORKSPACE_A },
  });
  assert.equal(list.status, 200);
  const payload = await list.json() as { data: Array<{ id: string }> };
  assert.deepEqual(payload.data.map(deal => deal.id), ['deal-a',created.id]);

  const listB = await request(createTestApp(database,USER_B),'/api/deals');
  const dealsB = (await listB.json() as {data:Array<{id:string;title:string}>}).data;
  assert.deepEqual(dealsB.map(deal=>deal.id),['deal-b']);
  assert.equal(dealsB.some(deal=>deal.title==='Negócio criado no tenant autenticado'),false);

  const crossTenantEdit = await request(app, '/api/deals/deal-b', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-orkto-workspace': WORKSPACE_A },
    body: JSON.stringify({ title: 'Tentativa indevida' }),
  });
  assert.equal(crossTenantEdit.status, 404);
  assert.equal(database.deals.find(deal => deal.id === 'deal-b')?.title, 'Negócio B');
});

test('deals persist detail, stage history and archive while denying every cross-workspace operation', async () => {
  const database = new MemoryWorkspaceDatabase();
  const appA = createTestApp(database, USER_A);
  const appB = createTestApp(database, USER_B);
  const createdResponse = await request(appA, '/api/deals', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Proposta A', customerRef: '11999990001', stage: 'qualification', valueCents: 42000, workspace_id: USER_B }),
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json() as { data: { id: string; workspace_id: string; customer_ref: string } }).data;
  assert.equal(created.workspace_id, WORKSPACE_A);
  assert.equal(created.customer_ref, '11999990001');
  assert.equal((await request(appA, `/api/deals/${created.id}`)).status, 200);

  const transition = await request(appA, `/api/deals/${created.id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'proposal' }),
  });
  assert.equal(transition.status, 200);
  const history = await request(appA, `/api/deals/${created.id}/history`);
  const events = (await history.json() as { data: Array<{ event_type: string; payload: { from_stage?: string; to_stage?: string } }> }).data;
  assert.equal(events.at(-1)?.event_type, 'deal.stage_changed');
  assert.equal(events.at(-1)?.payload.from_stage, 'qualification');
  assert.equal(events.at(-1)?.payload.to_stage, 'proposal');

  const foreignRead = await request(appB, `/api/deals/${created.id}`);
  const foreignHistory = await request(appB, `/api/deals/${created.id}/history`);
  const foreignEdit = await request(appB, `/api/deals/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Vazamento' }) });
  const foreignArchive = await request(appB, `/api/deals/${created.id}`, { method: 'DELETE' });
  assert.equal(foreignRead.status, 404);
  assert.equal(foreignHistory.status, 404);
  assert.equal(foreignEdit.status, 404);
  assert.equal(foreignArchive.status, 404);
  assert.equal(database.deals.find(row => row.id === created.id)?.title, 'Proposta A');

  const memberArchive = await request(createTestApp(database, USER_MEMBER), `/api/deals/${created.id}`, { method: 'DELETE', headers: { 'x-orkto-workspace': WORKSPACE_A } });
  assert.equal(memberArchive.status, 403);
  const archive = await request(appA, `/api/deals/${created.id}`, { method: 'DELETE' });
  assert.equal(archive.status, 200);
  assert.equal(database.deals.find(row => row.id === created.id)?.status, 'archived');
  const attemptedReopen = await request(appA, `/api/deals/${created.id}`, {
    method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Tentativa de reabrir',status:'open'}),
  });
  assert.equal(attemptedReopen.status,409,'generic edits cannot reopen an archived deal');
  assert.equal(database.deals.find(row => row.id === created.id)?.status,'archived');
  assert.equal(database.deals.find(row => row.id === created.id)?.title,'Proposta A');
  const list = await request(appA, '/api/deals');
  assert.equal(((await list.json() as { data: Array<{ id: string }> }).data).some(row => row.id === created.id), false);
});

test('clients API keeps CRUD, archive and client-supplied tenant IDs inside the authenticated workspace', async () => {
  const database = new MemoryWorkspaceDatabase();
  const appA = createTestApp(database, USER_A);
  const appB = createTestApp(database, USER_B);
  const createdResponse = await request(appA, '/api/clients', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ name:'Novo A',phone:'+5511988880001',workspace_id:USER_B }),
  });
  assert.equal(createdResponse.status,400,'strict request schema must reject browser-supplied workspace IDs');
  const create = await request(appA, '/api/clients', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ name:'Novo A',phone:'+5511988880001' }),
  });
  assert.equal(create.status,201);
  const created = (await create.json() as { data:{id:string;workspace_id:string;user_id:string} }).data;
  assert.equal(created.workspace_id,WORKSPACE_A);
  assert.equal(created.user_id,USER_A);
  const readA = await request(appA,`/api/clients/${created.id}`);
  assert.equal(readA.status,200);
  assert.equal(((await readA.json() as {data:{id:string}}).data).id,created.id);

  const listA = await request(appA,'/api/clients');
  const listB = await request(appB,'/api/clients');
  assert.deepEqual((await listA.json() as {data:Array<{id:string}>}).data.map(row=>row.id),['client-a',created.id]);
  assert.deepEqual((await listB.json() as {data:Array<{id:string}>}).data.map(row=>row.id),['client-b']);
  const searched = await request(appA,'/api/clients?q=novo%20a');
  assert.deepEqual((await searched.json() as {data:Array<{id:string}>}).data.map(row=>row.id),[created.id]);

  const crossRead = await request(appB,`/api/clients/${encodeURIComponent(created.id)}`);
  assert.equal(crossRead.status,404);
  const crossUpdate = await request(appB,`/api/clients/${encodeURIComponent(created.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Vazamento'})});
  assert.equal(crossUpdate.status,404);
  const crossDelete = await request(appB,`/api/clients/${encodeURIComponent(created.id)}`,{method:'DELETE'});
  assert.equal(crossDelete.status,404);
  assert.equal(database.clients.find(row=>row.id===created.id)?.name,'Novo A');

  const memberArchive = await request(createTestApp(database,USER_MEMBER),`/api/clients/${encodeURIComponent(created.id)}`,{method:'DELETE',headers:{'x-orkto-workspace':WORKSPACE_A}});
  assert.equal(memberArchive.status,403);
  assert.equal(database.clients.find(row=>row.id===created.id)?.archived_at,null);

  const spoof = await request(appA,'/api/clients',{headers:{'x-orkto-workspace':USER_B}});
  assert.equal(spoof.status,403);
  const archive = await request(appA,`/api/clients/${encodeURIComponent(created.id)}`,{method:'DELETE'});
  assert.equal(archive.status,200);
  assert.ok(database.clients.find(row=>row.id===created.id)?.archived_at);
});

test('catalog API keeps create, update, archive and list tenant-scoped', async () => {
  const database = new MemoryWorkspaceDatabase();
  const appA = createTestApp(database, USER_A);
  const appB = createTestApp(database, USER_B);
  const create = await request(appA,'/api/catalog',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Plano A',unitPrice:250,category:'Serviço'})});
  assert.equal(create.status,201);
  const item = (await create.json() as {data:{id:string;workspace_id:string;user_id:string}}).data;
  assert.equal(item.workspace_id,WORKSPACE_A);
  assert.equal(item.user_id,USER_A);
  const readA = await request(appA,`/api/catalog/${item.id}`);
  assert.equal(readA.status,200);
  assert.equal(((await readA.json() as {data:{id:string}}).data).id,item.id);
  const listB = await request(appB,'/api/catalog');
  assert.deepEqual((await listB.json() as {data:Array<{id:string}>}).data.map(row=>row.id),['service-b']);
  assert.equal((await request(appB,`/api/catalog/${item.id}`)).status,404);
  const searched = await request(appA,'/api/catalog?q=plano%20a');
  assert.deepEqual((await searched.json() as {data:Array<{id:string}>}).data.map(row=>row.id),[item.id]);
  const crossUpdate = await request(appB,`/api/catalog/${item.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({unitPrice:0})});
  assert.equal(crossUpdate.status,404);
  const crossDelete = await request(appB,`/api/catalog/${item.id}`,{method:'DELETE'});
  assert.equal(crossDelete.status,404);
  const update = await request(appA,`/api/catalog/${item.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({unitPrice:375})});
  assert.equal(update.status,200);
  assert.equal(database.services.find(row=>row.id===item.id)?.unit_price,375);
  const archive = await request(appA,`/api/catalog/${item.id}`,{method:'DELETE'});
  assert.equal(archive.status,200);
  assert.ok(database.services.find(row=>row.id===item.id)?.archived_at);
});

test('CSV import preview and commit remain scoped to the workspace that created the job', async () => {
  const database = new MemoryWorkspaceDatabase();
  const appA = createTestApp(database,USER_A);
  const appB = createTestApp(database,USER_B);
  const preview = await request(appA,'/api/imports/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    source:'csv',rows:[{client:'Importado A',telephone:'+5511888123456',organization:'Empresa A'}],mapping:{name:'client',phone:'telephone',company:'organization'},
  })});
  assert.equal(preview.status,201);
  const job = (await preview.json() as {data:{job:{id:string;workspace_id:string}}}).data.job;
  assert.equal(job.workspace_id,WORKSPACE_A);
  assert.equal(database.importRows[0]?.workspace_id,WORKSPACE_A);

  const crossTenantCommit = await request(appB,`/api/imports/${encodeURIComponent(job.id)}/commit`,{method:'POST'});
  assert.equal(crossTenantCommit.status,404);
  assert.equal(database.clients.some(row=>row.phone==='+5511888123456'),false);

  const commit = await request(appA,`/api/imports/${encodeURIComponent(job.id)}/commit`,{method:'POST'});
  assert.equal(commit.status,200);
  assert.equal(database.clients.find(row=>row.phone==='+5511888123456')?.workspace_id,WORKSPACE_A);
  assert.equal(database.importJobs.find(row=>row.id===job.id)?.status,'completed');
});
