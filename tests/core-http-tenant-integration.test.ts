import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { Express } from 'express';

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_A_RECIPIENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_A_OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const USER_WITHOUT_WORKSPACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CLIENT_TOKEN_A = 'test-session-a';
const CLIENT_TOKEN_B = 'test-session-b';
const CLIENT_TOKEN_A_RECIPIENT = 'test-session-a-recipient';
const CLIENT_TOKEN_A_OTHER = 'test-session-a-other';
const CLIENT_TOKEN_NO_WORKSPACE = 'test-session-no-workspace';
const SUPABASE_URL = 'http://orkto-test-supabase.invalid';
const WHATSAPP_SECRET = 'local-test-webhook-secret';

type Row = Record<string, any>;
type Filter = { column: string; operator: string; value: string };

function parseFilter(column: string, raw: string): Filter | null {
  const separator = raw.indexOf('.');
  if (separator < 0) return null;
  return { column, operator: raw.slice(0, separator), value: raw.slice(separator + 1) };
}

function decodeIn(value: string): string[] {
  const inner = value.startsWith('(') && value.endsWith(')') ? value.slice(1, -1) : value;
  return inner.split(',').map(item => item.replace(/^"|"$/g, ''));
}

class FakePostgrest {
  readonly tables = new Map<string, Row[]>();
  readonly requestAuthorization: Array<{ path: string; authorization: string | null }> = [];
  beforePatch?: (table: string, body: Row, filters: Filter[]) => void;
  forcedError?: { table: string; method: string; message: string };
  readonly users = new Map([
    [CLIENT_TOKEN_A, { id: USER_A, email: 'a@example.test' }],
    [CLIENT_TOKEN_B, { id: USER_B, email: 'b@example.test' }],
    [CLIENT_TOKEN_A_RECIPIENT, { id: USER_A_RECIPIENT, email: 'recipient@example.test' }],
    [CLIENT_TOKEN_A_OTHER, { id: USER_A_OTHER, email: 'other@example.test' }],
    [CLIENT_TOKEN_NO_WORKSPACE, { id: USER_WITHOUT_WORKSPACE, email: 'new@example.test' }],
  ]);

  constructor() {
    this.set('orkto_workspaces', [
      { id: WORKSPACE_A, owner_user_id: USER_A, name: 'Workspace A', plan_key:'pro', subscription_status:'active' },
      { id: WORKSPACE_B, owner_user_id: USER_B, name: 'Workspace B', plan_key:'pro', subscription_status:'active' },
    ]);
    this.set('orkto_workspace_subscriptions', [
      { workspace_id:WORKSPACE_A,plan_key:'pro',status:'active',trial_ends_at:null,created_at:'2026-01-01T00:00:00.000Z' },
      { workspace_id:WORKSPACE_B,plan_key:'pro',status:'active',trial_ends_at:null,created_at:'2026-01-01T00:00:00.000Z' },
    ]);
    this.set('orkto_plan_price_versions', ['starter','pro','business','scale','enterprise','founders','legacy_standard'].map(plan_key => ({
      plan_key,version:1,status:'approved',price_cents:null,price_is_public:false,effective_from:'2026-01-01T00:00:00.000Z',effective_until:null,
      entitlements:{ features:{ core_crm:true,proposals:true,wia:true },limits:{seats:null,monthly_wia_runs:null,active_proposals:plan_key==='pro'?50:5} },
    })));
    this.set('orkto_plan_usage', []);
    this.set('orkto_workspace_members', [
      { workspace_id: WORKSPACE_A, user_id: USER_A, role: 'owner', status: 'active' },
      { workspace_id: WORKSPACE_A, user_id: USER_A_RECIPIENT, role: 'member', status: 'active' },
      { workspace_id: WORKSPACE_A, user_id: USER_A_OTHER, role: 'member', status: 'active' },
      { workspace_id: WORKSPACE_B, user_id: USER_B, role: 'owner', status: 'active' },
    ]);
    this.set('profiles', [
      { id: USER_A, active_plan: 'pro', company_name: 'Empresa A' },
      { id: USER_B, active_plan: 'pro', company_name: 'Empresa B' },
    ]);
    this.set('clients', []);
    this.set('services', [
      { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', user_id: USER_A, workspace_id: WORKSPACE_A, name: 'Revisão técnica', description: 'Serviço A', unit_price: 125, category: 'Serviço', archived_at: null },
      { id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', user_id: USER_B, workspace_id: WORKSPACE_B, name: 'Serviço B', description: 'Serviço B', unit_price: 999, category: 'Serviço', archived_at: null },
    ]);
    for (const name of [
      'quotes', 'proposals', 'orkto_deals', 'orkto_conversations', 'orkto_messages', 'orkto_approval_tasks',
      'orkto_audit_log', 'orkto_wia_events', 'orkto_wia_runs', 'orkto_wia_actions', 'orkto_wia_tool_calls', 'orkto_sussurros',
      'orkto_model_usage', 'orkto_tasks', 'orkto_customer_signals', 'orkto_automation_jobs', 'orkto_import_jobs',
      'orkto_import_rows', 'orkto_wia_chat_messages', 'orkto_workspace_invites',
      'orkto_purchases', 'orkto_risk_assessments', 'orkto_replay_records', 'orkto_feature_configs', 'orkto_collection_cases',
      'orkto_collection_events', 'orkto_automations', 'orkto_automation_runs', 'orkto_reports', 'orkto_wrapped',
      'orkto_case_studies', 'orkto_accounting_exports', 'orkto_notifications', 'orkto_live_quotes', 'orkto_live_quote_events',
      'orkto_wia_memories', 'orkto_duplicate_reviews', 'orkto_collective_memory_contributions', 'orkto_collective_memory_items',
      'orkto_contacts', 'payment_records', 'asaas_webhook_events', 'orkto_payment_webhook_events', 'orkto_payment_intents',
    ]) this.set(name, []);
  }

  set(table: string, rows: Row[]) { this.tables.set(table, rows); }
  rows(table: string) { return this.tables.get(table) || []; }

  private value(row: Row, column: string): any {
    if (column.startsWith('orkto_conversations.')) {
      const conversation = this.rows('orkto_conversations').find(item => item.id === row.conversation_id);
      return conversation?.[column.slice('orkto_conversations.'.length)];
    }
    return row[column];
  }

  private matches(row: Row, filters: Filter[], orExpression: string | null): boolean {
    const check = ({ column, operator, value }: Filter) => {
      const actual = this.value(row, column);
      if (operator === 'eq') return String(actual) === value;
      if (operator === 'neq') return String(actual) !== value;
      if (operator === 'is') return value === 'null' ? actual == null : String(actual) === value;
      if (operator === 'in') return decodeIn(value).includes(String(actual));
      if (operator === 'not' && value.startsWith('in.')) return !decodeIn(value.slice(3)).includes(String(actual));
      if (operator === 'gt') return String(actual) > value;
      if (operator === 'gte') return String(actual) >= value;
      if (operator === 'lt') return String(actual) < value;
      if (operator === 'lte') return String(actual) <= value;
      if (operator === 'cs') {
        try { return Object.entries(JSON.parse(value)).every(([key, entry]) => actual?.[key] === entry); } catch { return false; }
      }
      return true;
    };
    if (!filters.every(check)) return false;
    if (!orExpression) return true;
    const expression = orExpression.replace(/^\(|\)$/g, '');
    const alternatives = expression.split(',').map(part => {
      const first = part.indexOf('.');
      const second = part.indexOf('.', first + 1);
      if (first < 0 || second < 0) return null;
      return { column: part.slice(0, first), operator: part.slice(first + 1, second), value: part.slice(second + 1) };
    }).filter(Boolean) as Filter[];
    return alternatives.length === 0 || alternatives.some(check);
  }

  async fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin === SUPABASE_URL && url.pathname === '/auth/v1/user') {
      const token = new Headers(init.headers).get('authorization')?.replace(/^Bearer\s+/i, '')
        || (input instanceof Request ? input.headers.get('authorization')?.replace(/^Bearer\s+/i, '') : '') || '';
      const user = this.users.get(token);
      return user ? Response.json(user) : Response.json({ message: 'invalid token' }, { status: 401 });
    }
    if (url.origin !== SUPABASE_URL || !url.pathname.startsWith('/rest/v1/')) return originalFetch(input, init);
    this.requestAuthorization.push({
      path: url.pathname,
      authorization: new Headers(init.headers).get('authorization')
        || (input instanceof Request ? input.headers.get('authorization') : null),
    });
    if (url.pathname === '/rest/v1/rpc/orkto_consume_plan_usage' && (init.method || 'GET').toUpperCase() === 'POST') {
      const args = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const rows = this.rows('orkto_plan_usage');
      const row = rows.find(item => item.workspace_id===args.p_workspace_id && item.period_start===args.p_period_start && item.feature_key===args.p_feature_key);
      const current = Number(row?.quantity || 0);
      const limit = args.p_limit === null || args.p_limit === undefined ? null : Number(args.p_limit);
      if (limit !== null && current + Number(args.p_delta) > limit) return Response.json([{allowed:false,quantity:current}]);
      if (row) row.quantity = current + Number(args.p_delta);
      else rows.push({workspace_id:args.p_workspace_id,period_start:args.p_period_start,feature_key:args.p_feature_key,quantity:Number(args.p_delta)});
      return Response.json([{allowed:true,quantity:current + Number(args.p_delta)}]);
    }
    if (url.pathname === '/rest/v1/rpc/orkto_claim_payment_webhook_event' && (init.method || 'GET').toUpperCase() === 'POST') {
      const args = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const rows = this.rows('orkto_payment_webhook_events');
      let row = rows.find(item => item.provider === args.p_provider && item.provider_event_id === args.p_provider_event_id);
      const now = new Date().toISOString();
      if (!row) {
        row = { id: randomUUID(), provider: args.p_provider, provider_event_id: args.p_provider_event_id, event_type: args.p_event_type,
          request_fingerprint: args.p_request_fingerprint, status: 'processing', attempt_count: 1, processing_claim_token: randomUUID(),
          processing_started_at: now, created_at: now, updated_at: now };
        rows.push(row);
        return Response.json([{ decision: 'CLAIMED', event_record_id: row.id, attempt_count: row.attempt_count, claim_token: row.processing_claim_token }]);
      }
      if (row.event_type !== args.p_event_type || row.request_fingerprint !== args.p_request_fingerprint) {
        return Response.json([{ decision: 'PAYLOAD_CONFLICT', event_record_id: row.id, attempt_count: row.attempt_count, claim_token: null }]);
      }
      if (['processed', 'ignored_stale'].includes(row.status)) {
        return Response.json([{ decision: 'DUPLICATE', event_record_id: row.id, attempt_count: row.attempt_count, claim_token: null }]);
      }
      if (row.status === 'processing' && Date.now() - Date.parse(row.processing_started_at) < 5 * 60_000) {
        return Response.json([{ decision: 'IN_PROGRESS', event_record_id: row.id, attempt_count: row.attempt_count, claim_token: null }]);
      }
      if (row.attempt_count >= 8) return Response.json([{ decision: 'RETRY_LIMIT', event_record_id: row.id, attempt_count: row.attempt_count, claim_token: null }]);
      row.status = 'processing'; row.attempt_count += 1; row.processing_claim_token = randomUUID(); row.processing_started_at = now; row.updated_at = now;
      return Response.json([{ decision: 'RETRY', event_record_id: row.id, attempt_count: row.attempt_count, claim_token: row.processing_claim_token }]);
    }
    if (url.pathname === '/rest/v1/rpc/orkto_apply_payment_intent_provider_event' && (init.method || 'GET').toUpperCase() === 'POST') {
      const args = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const webhook = this.rows('orkto_payment_webhook_events').find(item => item.provider === args.p_provider
        && item.provider_event_id === args.p_provider_event_id && item.request_fingerprint === args.p_request_fingerprint);
      const intent = this.rows('orkto_payment_intents').find(item => item.provider === args.p_provider
        && item.provider_reference === args.p_provider_reference);
      let decision = 'NOT_FOUND';
      if (!webhook || webhook.status !== 'processing' || webhook.processing_claim_token !== args.p_claim_token) decision = 'EVENT_NOT_CLAIMED';
      else if (intent) {
        if (Number(intent.amount_cents) !== Number(args.p_amount_cents) || intent.currency !== args.p_currency) decision = 'AMOUNT_OR_CURRENCY_MISMATCH';
        else if (intent.last_provider_event_at && Date.parse(args.p_occurred_at) < Date.parse(intent.last_provider_event_at)) decision = 'STALE';
        else if (['succeeded', 'failed', 'cancelled'].includes(intent.status)) {
          decision = intent.status === args.p_target_status ? 'ALREADY_TERMINAL' : 'TERMINAL_CONFLICT';
        } else if (!['request_accepted', 'reconciliation_required'].includes(intent.status)) decision = 'NOT_READY';
        else {
          intent.provider_status = args.p_provider_status;
          intent.last_provider_event_at = args.p_occurred_at;
          intent.last_provider_event_id = args.p_provider_event_id;
          if (args.p_target_status !== 'observed') {
            intent.status = args.p_target_status;
            intent.terminal_at = new Date().toISOString();
          }
          decision = args.p_target_status === 'observed' ? 'OBSERVED' : 'APPLIED';
        }
      }
      return Response.json([{
        decision, intent_id: intent?.id || null, workspace_id: intent?.workspace_id || null,
        quote_id: intent?.quote_id || null, intent_status: intent?.status || null,
      }]);
    }
    if (url.pathname === '/rest/v1/rpc/orkto_finish_payment_webhook_event' && (init.method || 'GET').toUpperCase() === 'POST') {
      const args = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const row = this.rows('orkto_payment_webhook_events').find(item => item.provider === args.p_provider
        && item.provider_event_id === args.p_provider_event_id && item.request_fingerprint === args.p_request_fingerprint);
      const changed = Boolean(row && row.status === 'processing' && row.processing_claim_token === args.p_claim_token);
      if (changed) {
        row.status = args.p_target_status;
        row.processed_at = ['processed', 'ignored_stale'].includes(args.p_target_status) ? new Date().toISOString() : null;
        row.last_error_category = args.p_target_status === 'failed' ? args.p_error_category : null;
      }
      return Response.json(changed);
    }

    const table = url.pathname.slice('/rest/v1/'.length);
    const rows = this.rows(table);
    const method = (init.method || 'GET').toUpperCase();
    if (this.forcedError?.table === table && this.forcedError.method === method) {
      return Response.json({ code: 'PGRST999', message: this.forcedError.message }, { status: 500 });
    }
    const headers = new Headers(init.headers);
    const filters: Filter[] = [];
    let orExpression: string | null = null;
    for (const [key, value] of url.searchParams) {
      if (key === 'or') { orExpression = value; continue; }
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
      const filter = parseFilter(key, value);
      if (filter) filters.push(filter);
    }
    const selected = () => rows.filter(row => this.matches(row, filters, orExpression));
    const now = new Date().toISOString();
    const withDefaults = (candidate: Row): Row => ({ id: randomUUID(), created_at: now, updated_at: now, ...candidate });
    let result: Row[] = [];
    let status = 200;

    if (method === 'GET' || method === 'HEAD') {
      result = selected();
      const order = url.searchParams.get('order');
      if (order) {
        const fields = order.split(',').map(field => {
          const [column, direction] = field.trim().split('.');
          return { column, direction };
        });
        result = [...result].sort((a, b) => {
          for (const { column, direction } of fields) {
            const compared = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0;
            if (compared) return compared * (direction === 'desc' ? -1 : 1);
          }
          return 0;
        });
      }
      const rangeHeader = headers.get('range');
      if (rangeHeader) {
        const [start, end] = rangeHeader.split('-').map(Number);
        if (Number.isFinite(start) && Number.isFinite(end)) result = result.slice(start, end + 1);
      }
    } else if (method === 'POST') {
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const candidates = Array.isArray(body) ? body : [body];
      const conflictColumns = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      const ignore = (headers.get('prefer') || '').includes('ignore-duplicates');
      for (const candidate of candidates) {
        const prior = conflictColumns.length ? rows.find(row => conflictColumns.every(column => row[column] === candidate[column])) : undefined;
        if (prior && ignore) { result.push(prior); continue; }
      const row = prior && (headers.get('prefer') || '').includes('resolution=merge-duplicates')
        ? Object.assign(prior, candidate)
        : withDefaults({
              ...(table === 'orkto_workspace_invites' ? { status:'invited' } : {}),
              ...(table === 'orkto_wia_actions' ? { status: 'prepared' } : {}),
              ...(table === 'orkto_approval_tasks' ? { status: 'pending' } : {}),
              ...(table === 'orkto_conversations' ? { created_at: now, updated_at: now } : {}),
              ...(table === 'orkto_messages' ? { sent_at: now, read_at: null } : {}),
              ...(table === 'quotes' ? { archived_at: null, status: 'draft', created_at: now, updated_at: now } : {}),
              ...(table === 'proposals' ? { version: 1 } : {}),
              ...candidate,
            });
        if (!prior || row !== prior) rows.push(row);
        result.push(row);
      }
      status = 201;
    } else if (method === 'PATCH') {
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      this.beforePatch?.(table, body, filters);
      result = selected().map(row => Object.assign(row, body));
    } else if (method === 'DELETE') {
      result = selected();
      for (const row of result) rows.splice(rows.indexOf(row), 1);
    } else {
      return Response.json({ message: `unsupported method ${method}` }, { status: 405 });
    }

    if (table === 'orkto_approval_tasks' && url.searchParams.get('select')?.includes('orkto_conversations')) {
      if (!url.searchParams.get('select')?.includes('orkto_conversations!orkto_approval_conversation_workspace_fkey!inner')) {
        return Response.json({ code:'PGRST201', message:'Ambiguous conversation relationship' }, { status:300 });
      }
      result = result.map(row => ({ ...row, orkto_conversations: this.rows('orkto_conversations').find(item => item.id === row.conversation_id) || null }));
    }
    const countPreference = (headers.get('prefer') || '').includes('count=exact');
    const responseHeaders = new Headers({ 'content-type': 'application/json' });
    if (countPreference) responseHeaders.set('content-range', result.length ? `0-${result.length - 1}/${result.length}` : '*/0');
    const wantsRepresentation = (headers.get('prefer') || '').includes('return=representation') || Boolean(url.searchParams.get('select'));
    const accept = headers.get('accept') || '';
    if (accept.includes('vnd.pgrst.object+json')) {
      if (result.length !== 1) return Response.json({ code: 'PGRST116', message: 'JSON object requested, no or multiple rows returned', details: `The result contains ${result.length} rows` }, { status: 406 });
      return Response.json(result[0], { status, headers: responseHeaders });
    }
    if (method === 'HEAD' || ((method === 'POST' || method === 'PATCH' || method === 'DELETE') && !wantsRepresentation)) {
      return new Response(null, { status: method === 'HEAD' ? 200 : 204, headers: responseHeaders });
    }
    return Response.json(result, { status, headers: responseHeaders });
  }
}

let originalFetch: typeof fetch;
const originalTestEnv: Record<string, string | undefined> = {};
let database: FakePostgrest;
let app: Express;
let failGeminiRequests = false;
let lastGeminiRequestContents: unknown = null;
let profileGatewayCalls = 0;
const servers = new Set<ReturnType<typeof createServer>>();

before(async () => {
  originalFetch = globalThis.fetch;
  for (const key of ['APP_ENV','NODE_ENV','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','ASAAS_WEBHOOK_SECRET','WHATSAPP_WEBHOOK_SECRET','WHATSAPP_TENANT_ID','COLLECTIVE_MEMORY_LEGAL_APPROVED','CRON_SECRET','APP_URL']) originalTestEnv[key] = process.env[key];
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'test';
  process.env.VITE_SUPABASE_URL = SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.GEMINI_API_KEY = 'test-only-gemini-key';
  process.env.ASAAS_WEBHOOK_SECRET = 'test-only-asaas-webhook-secret';
  process.env.WHATSAPP_WEBHOOK_SECRET = WHATSAPP_SECRET;
  process.env.WHATSAPP_TENANT_ID = WORKSPACE_A;
  process.env.COLLECTIVE_MEMORY_LEGAL_APPROVED = 'false';
  process.env.CRON_SECRET = 'test-only-cron-secret';
  process.env.APP_URL = 'https://orkto-staging.test';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (['https://ghrjongiodziasupakrk.supabase.co', SUPABASE_URL].includes(url.origin)
      && url.pathname === '/functions/v1/orkto-core-mutations') {
      const request = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const headers = new Headers(init?.headers);
      const workspaceId = headers.get('x-orkto-workspace');
      const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      const user = token ? database.users.get(token) : null;
      const membership = user && database.rows('orkto_workspace_members').find(row =>
        row.workspace_id === workspaceId && row.user_id === user.id && row.status === 'active');
      if (!user) return Response.json({ code:'AUTH_REQUIRED' }, { status:401 });
      if (!membership) return Response.json({ code:'WORKSPACE_ACCESS_DENIED' }, { status:403 });
      const payload = request.payload || {};
      const ok = (data: Row) => Response.json({ data });
      const denyForeign = (table: string, id: string) => database.rows(table).find(row => row.id === id && row.workspace_id === workspaceId);
      const audit = (eventType: string, entityType: string, entityRef: string) => database.rows('orkto_wia_events').push({
        id: randomUUID(), workspace_id: workspaceId, actor_user_id: user.id, event_type: eventType,
        entity_type: entityType, entity_ref: entityRef, request_id: headers.get('x-request-id'),
      });
      if (request.command === 'APPROVE_DRAFT_TASK' || request.command === 'REJECT_DRAFT_TASK') {
        if (!['owner','admin','manager'].includes(membership.role))
          return Response.json({code:'PERMISSION_DENIED'},{status:403});
        const task=denyForeign('orkto_approval_tasks',payload.taskId);
        const conversation=task && database.rows('orkto_conversations').find(row=>
          row.id===task.conversation_id && row.workspace_id===workspaceId);
        if(!task||!conversation) return Response.json({code:'NOT_FOUND'},{status:404});
        const status=request.command==='APPROVE_DRAFT_TASK'?'approved':'rejected';
        const key=headers.get('x-idempotency-key');
        const eventType=status==='approved'?'approval.approved':'approval.rejected';
        const previous=database.rows('orkto_wia_events').find(row=>
          row.workspace_id===workspaceId&&row.idempotency_key===`core:approval_task:${key}`);
        if(previous){
          if(previous.actor_user_id!==user.id||previous.event_type!==eventType||previous.entity_ref!==task.id
            ||previous.payload?.reason!==(payload.reason||''))
            return Response.json({code:'IDEMPOTENCY_CONFLICT'},{status:409});
          return ok({result:'REPLAY',task,deliveryStatus:'CONFIGURATION_REQUIRED'});
        }
        if(task.status!=='pending') return Response.json({code:'CONFLICT'},{status:409});
        task.status=status;task.decided_by=user.id;task.decided_at=new Date().toISOString();
        task.decision_reason=payload.reason|| (status==='rejected'?'Rejeitado pelo operador':'');
        database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,
          actor_user_id:user.id,event_type:eventType,entity_type:'approval_task',entity_ref:task.id,
          idempotency_key:`core:approval_task:${key}`,payload:{reason:payload.reason||''}});
        database.rows('orkto_audit_log').push({id:randomUUID(),workspace_id:workspaceId,
          user_id:user.id,conversation_id:conversation.id,approval_task_id:task.id,
          event_type:status==='approved'?'wia.draft.approved':'wia.draft.rejected',
          actor_type:'human',actor_id:user.id,trace_id:task.trace_id,
          event_data:{delivery_status:'channel_not_configured'}});
        return ok({result:'DECIDED',task,deliveryStatus:'CONFIGURATION_REQUIRED'});
      }
      if (request.command === 'START_WIA_RUN') {
        const prior=database.rows('orkto_wia_runs').find(row=>row.workspace_id===workspaceId&&row.trace_id===payload.traceId);
        if(prior){
          if(prior.user_id!==user.id||prior.agent!==payload.agent) return Response.json({code:'IDEMPOTENCY_CONFLICT'},{status:409});
          return ok({result:'REPLAY',wia_run_id:prior.id,status:prior.status});
        }
        const workspace=database.rows('orkto_workspaces').find(row=>row.id===workspaceId);
        const plan=database.rows('orkto_plan_price_versions').find(row=>row.plan_key===workspace?.plan_key&&row.status==='approved');
        const limit=plan?.entitlements?.limits?.monthly_wia_runs;
        if(limit===undefined) return Response.json({code:'CONFIGURATION_REQUIRED'},{status:423});
        const periodStart=`${new Date().toISOString().slice(0,7)}-01`;
        let usage=database.rows('orkto_plan_usage').find(row=>row.workspace_id===workspaceId&&row.period_start===periodStart&&row.feature_key==='monthly_wia_runs');
        if(limit!==null&&Number(usage?.quantity||0)+1>limit) return Response.json({code:'RATE_LIMITED'},{status:429});
        if(usage) usage.quantity=Number(usage.quantity||0)+1;
        else { usage={workspace_id:workspaceId,period_start:periodStart,feature_key:'monthly_wia_runs',quantity:1};database.rows('orkto_plan_usage').push(usage); }
        const row={id:randomUUID(),workspace_id:workspaceId,user_id:user.id,feature:'wia_contact',agent:payload.agent,
          task_type:'standard',status:'running',provider:null,model:null,trace_id:payload.traceId,context_refs:[],summary:null,
          error_category:null,started_at:new Date().toISOString(),completed_at:null,created_at:new Date().toISOString()};
        database.rows('orkto_wia_runs').push(row);
        database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,run_id:row.id,actor_user_id:user.id,
          event_type:'wia.run.started',source:'user',entity_type:'wia_run',entity_ref:row.id,idempotency_key:`wia-start:${payload.traceId}`});
        return ok({result:'STARTED',wia_run_id:row.id,status:'running'});
      }
      if (request.command === 'COMPLETE_WIA_RUN') {
        const run=database.rows('orkto_wia_runs').find(row=>row.workspace_id===workspaceId&&row.trace_id===payload.traceId);
        if(!run) return Response.json({code:'NOT_FOUND'},{status:404});
        if(run.user_id!==user.id||run.agent!==payload.agent) return Response.json({code:'PERMISSION_DENIED'},{status:403});
        if(run.status!=='running') {
          if(run.status!==payload.status) return Response.json({code:'CONFLICT'},{status:409});
          const action=database.rows('orkto_wia_actions').find(row=>row.workspace_id===workspaceId&&row.run_id===run.id);
          return ok({result:'REPLAY',wia_run_id:run.id,action_id:action?.id||null,status:run.status});
        }
        run.completed_at=new Date().toISOString();run.status=payload.status;
        if(payload.status==='failed') {
          run.error_category=payload.errorCategory;
          database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,run_id:run.id,actor_user_id:user.id,
            event_type:'wia.run.failed',source:'wia',entity_type:'wia_run',entity_ref:run.id,idempotency_key:`wia-complete:${payload.traceId}`});
          database.rows('orkto_audit_log').push({id:randomUUID(),workspace_id:workspaceId,user_id:user.id,event_type:'wia.run.failed',
            actor_type:'bot',actor_id:'wia',trace_id:payload.traceId,event_data:{error_category:payload.errorCategory}});
          return ok({result:'FAILED',wia_run_id:run.id,status:'failed'});
        }
        Object.assign(run,{task_type:payload.usage.taskType,provider:payload.usage.provider,model:payload.usage.model,
          context_refs:payload.contextRefs,summary:payload.decision.messageDraft,error_category:null});
        database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,run_id:run.id,actor_user_id:user.id,
          event_type:'wia.decision.prepared',source:'wia',entity_type:'wia_run',entity_ref:run.id,
          idempotency_key:`wia-complete:${payload.traceId}`,payload:{action:payload.decision.action,requires_approval:payload.decision.requiresApproval}});
        if(payload.path==='model') database.rows('orkto_model_usage').push({id:randomUUID(),workspace_id:workspaceId,user_id:user.id,
          trace_id:payload.traceId,provider:payload.usage.provider,model:payload.usage.model,prompt_tokens:payload.usage.promptTokens,
          cached_input_tokens:payload.usage.cachedInputTokens,completion_tokens:payload.usage.completionTokens,
          total_tokens:payload.usage.totalTokens,latency_ms:payload.usage.latencyMs,mode:payload.mode});
        for(const tool of payload.toolExecutions||[]) database.rows('orkto_wia_tool_calls').push({id:randomUUID(),workspace_id:workspaceId,
          run_id:run.id,tool_name:tool.toolName,status:tool.status,output_summary:{sourceIds:tool.sourceIds},
          error_category:tool.error?.code||null,duration_ms:tool.durationMs});
        let action:Row|undefined;
        if(!['answer','ask_clarification'].includes(payload.decision.action)){
          action={id:randomUUID(),workspace_id:workspaceId,run_id:run.id,action_type:payload.decision.action,
            payload:{messageDraft:payload.decision.messageDraft,sourceIds:payload.decision.sourceIds},rationale:payload.decision.reasonCode,
            risk_level:payload.decision.requiresApproval?'medium':'low',status:payload.decision.requiresApproval?'awaiting_approval':'prepared',
            requires_approval:payload.decision.requiresApproval,idempotency_key:`wia-action:${payload.traceId}`,created_by:user.id};
          database.rows('orkto_wia_actions').push(action);
        }
        database.rows('orkto_audit_log').push({id:randomUUID(),workspace_id:workspaceId,user_id:user.id,event_type:'wia.decision.proposed',
          actor_type:'bot',actor_id:'wia',trace_id:payload.traceId,event_data:{run_id:run.id,action_id:action?.id||null}});
        return ok({result:'COMPLETED',wia_run_id:run.id,action_id:action?.id||null,status:'succeeded'});
      }
      if (request.command === 'AUDIT_MESSAGE_CONFIGURATION_REQUIRED') {
        const conversation = denyForeign('orkto_conversations',payload.conversationId);
        if (!conversation) return Response.json({code:'NOT_FOUND'},{status:404});
        database.rows('orkto_audit_log').push({
          id:randomUUID(),workspace_id:workspaceId,user_id:user.id,conversation_id:conversation.id,
          event_type:'channel.send.configuration_required',actor_type:'human',actor_id:user.id,
          event_data:{status:'CONFIGURATION_REQUIRED'},
        });
        return ok({result:'AUDITED'});
      }
      if (request.command === 'CREATE_CLIENT') {
        const row = { id:randomUUID(),workspace_id:workspaceId,user_id:user.id,name:payload.name,phone:payload.phone,
          company:payload.company ?? null,vehicle_or_service:payload.vehicleOrService ?? null,notes:payload.notes ?? null,
          archived_at:null,created_at:new Date().toISOString() };
        database.rows('clients').push(row); audit('client.created','client',row.id);
        return ok({result:'CREATED',client:row});
      }
      if (request.command === 'UPDATE_CLIENT' || request.command === 'ARCHIVE_CLIENT') {
        const row = denyForeign('clients',payload.clientId);
        if (!row || row.archived_at) return Response.json({code:'NOT_FOUND'},{status:404});
        if (request.command === 'ARCHIVE_CLIENT') {
          if (!['owner','admin'].includes(membership.role)) return Response.json({code:'PERMISSION_DENIED'},{status:403});
          row.archived_at = new Date().toISOString(); audit('client.archived','client',row.id);
          return ok({result:'ARCHIVED',client_id:row.id});
        }
        Object.assign(row,Object.fromEntries(Object.entries(payload.changes || {}).map(([key,value])=>[
          ({vehicleOrService:'vehicle_or_service'} as Row)[key] || key,value])));
        audit('client.updated','client',row.id); return ok({result:'UPDATED',client:row});
      }
      if (request.command === 'CREATE_DEAL') {
        if (payload.customerRef && database.rows('clients').some(row=>row.id===payload.customerRef && row.workspace_id!==workspaceId))
          return Response.json({code:'VALIDATION_FAILED'},{status:400});
        const row = {id:randomUUID(),workspace_id:workspaceId,created_by:user.id,title:payload.title,description:payload.description,
          customer_ref:payload.customerRef || null,stage:payload.stage || 'new',status:'open',value_cents:payload.valueCents || 0,
          conversation_ref:payload.conversationRef || null,source:payload.source || 'manual',
          created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        database.rows('orkto_deals').push(row); audit('deal.created','deal',row.id);
        return ok({result:'CREATED',deal:row});
      }
      if (request.command === 'UPDATE_DEAL') {
        const row = denyForeign('orkto_deals',payload.dealId);
        if (!row) return Response.json({code:'NOT_FOUND'},{status:404});
        if (['won','lost'].includes(payload.changes?.stage)) return Response.json({code:'CONFIGURATION_REQUIRED'},{status:423});
        for (const [key,column] of Object.entries({title:'title',description:'description',stage:'stage',valueCents:'value_cents'}))
          if (Object.hasOwn(payload.changes || {},key)) row[column]=payload.changes[key];
        row.updated_at=new Date().toISOString(); audit('deal.updated','deal',row.id);
        return ok({result:'UPDATED',deal:row});
      }
      if (request.command === 'CLOSE_DEAL' || request.command === 'ARCHIVE_DEAL') {
        const row = denyForeign('orkto_deals',payload.dealId);
        if (!row) return Response.json({code:'NOT_FOUND'},{status:404});
        const stage = request.command === 'ARCHIVE_DEAL' ? 'archived' : payload.stage;
        if (!['won','lost','archived'].includes(stage)) return Response.json({code:'VALIDATION_FAILED'},{status:400});
        if (stage==='archived' && !['owner','admin'].includes(membership.role)) return Response.json({code:'PERMISSION_DENIED'},{status:403});
        const key = `core:deal_transition:${headers.get('x-idempotency-key')}`;
        const prior = database.rows('orkto_wia_events').find(event=>event.workspace_id===workspaceId && event.idempotency_key===key);
        if (prior && (prior.actor_user_id!==user.id || prior.entity_ref!==row.id || prior.payload?.stage!==stage))
          return Response.json({code:'IDEMPOTENCY_CONFLICT'},{status:409});
        if (prior || (row.status===stage && (stage==='archived' || row.stage===stage))) return ok({result:'REPLAY',deal:row,memory_status:'persisted'});
        if (row.status==='archived' || (stage!=='archived' && (row.status!=='open' || ['won','lost'].includes(row.stage)))) return Response.json({code:'CONFLICT'},{status:409});
        if (stage!=='archived') row.stage=stage;
        row.status=stage;row.lost_reason=stage==='lost' ? payload.lostReason || null : row.lost_reason || null;
        row.updated_at=new Date().toISOString();
        const quoteIds=database.rows('quotes').filter(quote=>quote.workspace_id===workspaceId && quote.deal_id===row.id).map(quote=>quote.id);
        for (const job of database.rows('orkto_automation_jobs').filter(job=>job.workspace_id===workspaceId && job.entity_type==='quote' && quoteIds.includes(job.entity_ref) && job.status==='scheduled')) job.status='cancelled';
        for (const action of database.rows('orkto_wia_actions').filter(action=>action.workspace_id===workspaceId && action.action_type==='send_proposal_followup' && quoteIds.includes(action.payload?.quoteId) && ['prepared','awaiting_approval'].includes(action.status))) action.status='cancelled';
        if (stage!=='archived' && row.conversation_ref) database.rows('orkto_automation_jobs').push({id:randomUUID(),workspace_id:workspaceId,entity_type:'replay_capture',entity_ref:row.id,
          step_key:row.status,status:'scheduled',due_at:new Date().toISOString(),idempotency_key:`replay-capture:${row.id}:${row.status}`});
        database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,actor_user_id:user.id,
          event_type:stage==='archived'?'deal.archived':'deal.stage_changed',entity_type:'deal',entity_ref:row.id,idempotency_key:key,payload:{stage}});
        return ok({result:'UPDATED',deal:row,memory_status:'persisted'});
      }
      if (request.command === 'CREATE_QUOTE') {
        if (database.forcedError?.table === 'quotes' && database.forcedError.method === 'POST')
          return Response.json({code:'INTERNAL_ERROR'},{status:503});
        if (payload.customerId && !denyForeign('clients',payload.customerId)) return Response.json({code:'VALIDATION_FAILED'},{status:400});
        const linkedDeal = payload.dealId ? denyForeign('orkto_deals',payload.dealId) : null;
        if (payload.dealId && !linkedDeal) return Response.json({code:'VALIDATION_FAILED'},{status:400});
        if (linkedDeal?.customer_ref && ![payload.customerId,payload.clientPhone].includes(linkedDeal.customer_ref))
          return Response.json({code:'VALIDATION_FAILED'},{status:400});
        const maxQuotes = database.rows('orkto_plan_price_versions').find(row => row.plan_key === 'pro')?.entitlements?.limits?.active_proposals;
        if (maxQuotes != null && database.rows('quotes').filter(row => row.workspace_id === workspaceId && !row.archived_at).length >= maxQuotes)
          return Response.json({code:'PERMISSION_DENIED'},{status:403});
        const items = [];
        for (const item of payload.items) {
          const catalog = item.catalogItemId ? database.rows('services').find(row => row.id === item.catalogItemId && row.workspace_id === workspaceId && !row.archived_at) : null;
          if (item.catalogItemId && !catalog) return Response.json({code:'VALIDATION_FAILED'},{status:400});
          items.push(catalog ? {...item,name:catalog.name,unitPrice:catalog.unit_price} : item);
        }
        const now=new Date().toISOString();
        const row={id:randomUUID(),workspace_id:workspaceId,user_id:user.id,client_name:payload.clientName,
          client_phone:payload.clientPhone,client_email:payload.clientEmail || null,customer_id:payload.customerId || null,
          deal_id:payload.dealId || null,notes:payload.notes || null,items,total:items.reduce((sum:number,item:Row)=>sum+item.quantity*item.unitPrice,0),
          status:'pending',quote_number:'TEST-0001',archived_at:null,created_at:now,updated_at:now};
        database.rows('quotes').push(row); audit('quote.created','quote',row.id);
        return ok({result:'CREATED',quote:row});
      }
      if (request.command === 'PUBLISH_LIVE_QUOTE') {
        const quote=denyForeign('quotes',payload.quoteId);
        if(!quote||quote.archived_at) return Response.json({code:'NOT_FOUND'},{status:404});
        if(!['draft','pending','sent','viewed'].includes(quote.status)) return Response.json({code:'CONFLICT'},{status:409});
        const validUntil=quote.valid_value_days?new Date(new Date(quote.created_at).getTime()+Number(quote.valid_value_days)*86_400_000).toISOString():null;
        if(validUntil&&new Date(validUntil).getTime()<=Date.now()) return Response.json({code:'CONFLICT'},{status:409});
        if(database.rows('orkto_live_quotes').some(row=>row.workspace_id===workspaceId&&row.quote_ref===quote.id&&row.status==='accepted'))
          return Response.json({code:'CONFLICT'},{status:409});
        for(const link of database.rows('orkto_live_quotes').filter(row=>row.workspace_id===workspaceId&&row.quote_ref===quote.id&&['active','viewed'].includes(row.status))) link.status='revoked';
        const version=Math.max(0,...database.rows('orkto_live_quotes').filter(row=>row.workspace_id===workspaceId&&row.quote_ref===quote.id).map(row=>Number(row.version||0)))+1;
        const operationKey=headers.get('x-idempotency-key')||randomUUID();
        const token=Buffer.from(operationKey).toString('base64url').slice(0,43).padEnd(43,'A');
        const snapshot={clientName:quote.client_name,company:quote.client_company,request:quote.client_vehicle_or_service,
          items:structuredClone(quote.items),subtotal:quote.subtotal,discountTotal:quote.discount_total,taxes:quote.taxes,total:quote.total,
          notes:quote.notes,paymentInstructions:quote.payment_instructions,validUntil};
        const row={id:randomUUID(),workspace_id:workspaceId,quote_ref:quote.id,version,snapshot,current_price_cents:Math.round(Number(quote.total)*100),status:'active',valid_until:validUntil,created_by:user.id,_test_token:token};
        database.rows('orkto_live_quotes').push(row);quote.status='sent';audit('live_quote.published','quote',quote.id);
        return ok({result:'CREATED',live_quote:row,token,publicPath:`/proposta-viva/${token}`});
      }
      if (request.command === 'EXTEND_QUOTE_RETENTION') {
        const quote=denyForeign('quotes',payload.quoteId);
        if(!quote||quote.archived_at) return Response.json({code:'NOT_FOUND'},{status:404});
        const key=`core:extend_quote_retention:${headers.get('x-idempotency-key')}`;
        const prior=database.rows('orkto_wia_events').find(row=>row.workspace_id===workspaceId&&row.idempotency_key===key);
        if(prior){
          if(prior.actor_user_id!==user.id||prior.entity_ref!==quote.id||prior.payload?.expectedExpiry!==payload.expectedExpiry)
            return Response.json({code:'IDEMPOTENCY_CONFLICT'},{status:409});
          return ok({result:'REPLAY',expires_at:prior.payload.expiresAt});
        }
        if(['approved','accepted','rejected','expired'].includes(quote.status)
          || !quote.sent_at || !quote.retention_expires_at
          || new Date(quote.retention_expires_at).getTime()<=Date.now()
          || quote.retention_expires_at!==payload.expectedExpiry)
          return Response.json({code:'CONFLICT'},{status:409});
        const next=new Date(new Date(quote.retention_expires_at).getTime()+14*86_400_000).toISOString();
        quote.retention_expires_at=next;
        database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,actor_user_id:user.id,
          event_type:'quote.retention_extended',entity_type:'quote',entity_ref:quote.id,idempotency_key:key,
          payload:{expectedExpiry:payload.expectedExpiry,expiresAt:next}});
        return ok({result:'EXTENDED',expires_at:next});
      }
      if (request.command === 'SET_CONVERSATION_PRIORITY') {
        const row = denyForeign('orkto_conversations',payload.conversationId);
        if (!row) return Response.json({code:'NOT_FOUND'},{status:404});
        row.priority_override=payload.priority; audit('conversation.priority_overridden','conversation',row.id);
        return ok({result:'UPDATED',conversation:row});
      }
      if (request.command === 'APPROVE_WIA_ACTION' || request.command === 'REJECT_WIA_ACTION') {
        const row = denyForeign('orkto_wia_actions',payload.actionId);
        if (!row) return Response.json({code:'NOT_FOUND'},{status:404});
        if (!['owner','admin','manager'].includes(membership.role)) return Response.json({code:'PERMISSION_DENIED'},{status:403});
        if (row.status !== 'awaiting_approval') return Response.json({code:'CONFLICT'},{status:409});
        if (request.command === 'REJECT_WIA_ACTION') row.status='rejected';
        else {
          row.status='executed';
          database.rows('orkto_tasks').push({id:randomUUID(),workspace_id:workspaceId,source_action_id:row.id,status:'open'});
        }
        audit(request.command === 'REJECT_WIA_ACTION' ? 'wia.action.rejected' : 'wia.action.approved_and_executed','wia_action',row.id);
        return ok({result:request.command === 'REJECT_WIA_ACTION' ? 'REJECTED' : 'EXECUTED',action:row,external_delivery:'CONFIGURATION_REQUIRED'});
      }
      if (request.command === 'UPDATE_QUOTE') {
        const headers = new Headers(init?.headers);
        const workspaceId = headers.get('x-orkto-workspace');
        const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        const user = token ? database.users.get(token) : null;
        if (!user) return Response.json({ code:'AUTH_REQUIRED' }, { status:401 });
        const membership = database.rows('orkto_workspace_members').find(row=>row.workspace_id===workspaceId&&row.user_id===user.id&&row.status==='active');
        if (!membership) return Response.json({ code:'WORKSPACE_ACCESS_DENIED' }, { status:403 });
        const quote = database.rows('quotes').find(row=>row.workspace_id===workspaceId&&row.id===request.payload?.quoteId&&!row.archived_at);
        if (!quote) return Response.json({ code:'NOT_FOUND' }, { status:404 });
        if (request.payload?.status!==undefined&&request.payload.status!==quote.status) return Response.json({code:'CONFIGURATION_REQUIRED'},{status:423});
        if (['approved','accepted'].includes(quote.status)) return Response.json({code:'CONFLICT'},{status:409});
        const changes=request.payload.changes||{};
        if (changes.customerId && !database.rows('clients').some(row=>row.id===changes.customerId && row.workspace_id===workspaceId && !row.archived_at))
          return Response.json({code:'VALIDATION_FAILED'},{status:400});
        for(const [key,column] of Object.entries({clientName:'client_name',clientPhone:'client_phone',notes:'notes',paymentInstructions:'payment_instructions'})) {
          if(Object.hasOwn(changes,key)) quote[column]=changes[key];
        }
        if (Object.keys(changes).length) {
          quote.updated_at = new Date().toISOString();
          for (const link of database.rows('orkto_live_quotes').filter(row=>row.workspace_id===workspaceId && row.quote_ref===quote.id && ['active','viewed'].includes(row.status))) link.status='revoked';
          for (const proposal of database.rows('proposals').filter(row=>row.workspace_id===workspaceId && row.quote_id===quote.id)) proposal.is_active=false;
        }
        database.rows('orkto_wia_events').push({id:randomUUID(),workspace_id:workspaceId,actor_user_id:user.id,event_type:'quote.updated',entity_type:'quote',entity_ref:quote.id});
        return Response.json({data:{result:'UPDATED',quote}});
      }
      if (request.command === 'ARCHIVE_QUOTE') {
        const headers = new Headers(init?.headers);
        const workspaceId = headers.get('x-orkto-workspace');
        const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        const user = token ? database.users.get(token) : null;
        if (!user) return Response.json({ code:'AUTH_REQUIRED' }, { status:401 });
        const membership = database.rows('orkto_workspace_members').find(row => row.workspace_id === workspaceId && row.user_id === user.id && row.status === 'active');
        if (!membership) return Response.json({ code:'WORKSPACE_ACCESS_DENIED' }, { status:403 });
        if (!['owner','admin'].includes(membership.role)) return Response.json({ code:'PERMISSION_DENIED' }, { status:403 });
        const quote = database.rows('quotes').find(row => row.workspace_id === workspaceId && row.id === request.payload?.quoteId && !row.archived_at);
        if (!quote) return Response.json({ code:'NOT_FOUND' }, { status:404 });
        if (['approved','accepted'].includes(quote.status)) return Response.json({ code:'CONFLICT' }, { status:409 });
        quote.archived_at = new Date().toISOString();
        for (const proposal of database.rows('proposals').filter(row => row.workspace_id === workspaceId && row.quote_id === quote.id)) proposal.is_active = false;
        for (const link of database.rows('orkto_live_quotes').filter(row => row.workspace_id === workspaceId && row.quote_ref === quote.id && ['active','viewed'].includes(row.status))) link.status = 'revoked';
        for (const job of database.rows('orkto_automation_jobs').filter(row => row.workspace_id === workspaceId && row.entity_ref === quote.id && row.status === 'scheduled')) job.status = 'cancelled';
        for (const action of database.rows('orkto_wia_actions').filter(row => row.workspace_id === workspaceId && row.payload?.quoteId === quote.id && ['prepared','awaiting_approval'].includes(row.status))) action.status = 'cancelled';
        database.rows('orkto_wia_events').push({ id:randomUUID(),workspace_id:workspaceId,actor_user_id:user.id,event_type:'quote.archived',entity_type:'quote',entity_ref:quote.id });
        return Response.json({ data:{ result:'ARCHIVED',quote_id:quote.id } });
      }
      if (request.command === 'MARK_CONVERSATION_READ' || request.command === 'SET_CONVERSATION_STATUS') {
        const headers = new Headers(init?.headers);
        const workspaceId = headers.get('x-orkto-workspace');
        const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        const user = token ? database.users.get(token) : null;
        if (!user) return Response.json({ code:'AUTH_REQUIRED' }, { status:401 });
        const membership = database.rows('orkto_workspace_members').find(row => row.workspace_id === workspaceId && row.user_id === user.id && row.status === 'active');
        if (!membership) return Response.json({ code:'WORKSPACE_ACCESS_DENIED' }, { status:403 });
        const conversation = database.rows('orkto_conversations').find(row => row.workspace_id === workspaceId && row.id === request.payload?.conversationId);
        if (!conversation) return Response.json({ code:'NOT_FOUND' }, { status:404 });
        if (request.command === 'SET_CONVERSATION_STATUS') {
          if (request.payload?.status === 'archived' && !['owner','admin'].includes(membership.role))
            return Response.json({ code:'PERMISSION_DENIED' }, { status:403 });
          conversation.status = request.payload.status;
          return Response.json({ data:{ result:'UPDATED',conversation:{ id:conversation.id,status:conversation.status } } });
        }
        const unread = database.rows('orkto_messages').filter(row => row.workspace_id === workspaceId
          && row.conversation_id === conversation.id && row.direction === 'incoming' && !row.read_at);
        for (const message of unread) message.read_at = new Date().toISOString();
        return Response.json({ data:{ result:'UPDATED',conversation:{ id:conversation.id,status:conversation.status },messages_marked_read:unread.length } });
      }
      profileGatewayCalls += 1;
      assert.equal(request.command, 'COMPLETE_ONBOARDING');
      assert.equal(new Headers(init?.headers).get('x-orkto-workspace'), WORKSPACE_A);
      assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${CLIENT_TOKEN_A}`);
      assert.deepEqual(Object.keys(request.payload).sort(), ['companyName', 'paymentInfo', 'whatsappNumber']);
      const profile = database.rows('profiles').find(row => row.id === USER_A);
      assert.ok(profile);
      profile.company_name = request.payload.companyName;
      profile.payment_info = request.payload.paymentInfo;
      profile.whatsapp_number = request.payload.whatsappNumber;
      profile.onboarding_completed = true;
      return Response.json({ data:{ result:'UPDATED', profile:{id:USER_A} } });
    }
    if (['https://ghrjongiodziasupakrk.supabase.co', SUPABASE_URL].includes(url.origin)
      && url.pathname === '/functions/v1/orkto-public-proposals') {
      const request=typeof init?.body==='string'?JSON.parse(init.body):{};
      const link=database.rows('orkto_live_quotes').find(row=>row._test_token===request.token);
      if(!link||['revoked','expired'].includes(link.status)) return Response.json({code:'NOT_FOUND'},{status:404});
      const quote=database.rows('quotes').find(row=>row.workspace_id===link.workspace_id&&row.id===link.quote_ref&&!row.archived_at);
      const stale=!quote||Math.round(Number(quote.total)*100)!==Number(link.current_price_cents)
        ||JSON.stringify(quote.items)!==JSON.stringify(link.snapshot.items);
      if(stale&&!['accepted','rejected'].includes(link.status)){link.status='revoked';return Response.json({code:'STALE'},{status:409});}
      if(request.command==='READ'||request.command==='VIEW'){
        if(link.status==='active') link.status='viewed';
        return Response.json({data:{result:'OK',proposal:{id:link.id,version:link.version,snapshot:link.snapshot,status:link.status,validUntil:link.valid_until}}});
      }
      if(request.command==='ACCEPT'){
        if(link.status==='accepted') return Response.json({data:{result:'REPLAY',status:'accepted'}});
        if(link.status==='rejected'||['approved','accepted','rejected'].includes(quote.status)) return Response.json({code:'CONFLICT'},{status:409});
        quote.status='approved';link.status='accepted';link.accepted_by_name=request.customerName;
      }else if(request.command==='REJECT'){
        if(link.status==='rejected') return Response.json({data:{result:'REPLAY',status:'rejected'}});
        if(link.status==='accepted'||['approved','accepted'].includes(quote.status)) return Response.json({code:'CONFLICT'},{status:409});
        quote.status='rejected';link.status='rejected';
      }else return Response.json({code:'VALIDATION_FAILED'},{status:400});
      for(const job of database.rows('orkto_automation_jobs').filter(row=>row.workspace_id===link.workspace_id&&row.entity_ref===link.quote_ref&&['scheduled','processing'].includes(row.status))) job.status='cancelled';
      for(const action of database.rows('orkto_wia_actions').filter(row=>row.workspace_id===link.workspace_id&&row.payload?.quoteId===link.quote_ref&&['prepared','awaiting_approval','executing'].includes(row.status))) action.status='cancelled';
      database.rows('orkto_audit_log').push({id:randomUUID(),workspace_id:link.workspace_id,user_id:link.created_by,event_type:`live_quote.${link.status}`,actor_type:'system',actor_id:'public_link'});
      return Response.json({data:{result:'UPDATED',status:link.status}});
    }
    if (url.origin === 'https://generativelanguage.googleapis.com') {
      if (failGeminiRequests) return Response.json({ error: { message: 'test provider quota failure' } }, { status: 429 });
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      lastGeminiRequestContents = body.contents || [];
      const prompt = JSON.stringify(body.contents || []);
      const decision = /FOLLOWUP_TEST_APPROVAL/i.test(prompt)
        ? { action: 'request_approval', messageDraft: 'Revisar follow-up antes de contato externo.', sourceIds: [], confidenceSignal: 'high', requiresApproval: true, reasonCode: 'human_review_required' }
        : { action: 'answer', messageDraft: 'Resposta preparada pela WIA com contexto do workspace.', sourceIds: [], confidenceSignal: 'medium', requiresApproval: false, reasonCode: 'contextual_answer' };
      return Response.json({ modelVersion: 'gemini-test', candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 } });
    }
    return database.fetch(input, init);
  }) as typeof fetch;
  const imported = await import('../backend/core-app.js');
  app = imported.default;
});

after(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalTestEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await Promise.all([...servers].map(server => new Promise<void>(resolve => {
    server.closeAllConnections();
    server.close(() => resolve());
  })));
});

function resetDatabase() { database = new FakePostgrest(); }

async function serve(handler: Express): Promise<string> {
  const server = createServer(handler);
  servers.add(server);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function api(base: string, token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (!headers.has('x-forwarded-for')) {
    const port = Number(new URL(base).port) || 1;
    headers.set('x-forwarded-for', `198.51.${100 + Math.floor(port / 256) % 100}.${1 + port % 253}`);
  }
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${base}${path}`, { ...init, headers });
}

function json(body: unknown): RequestInit { return { method: 'POST', body: JSON.stringify(body) }; }

test('demo, owner profile and public PIX safety gates reject unauthorized use', async () => {
  resetDatabase();
  const base = await serve(app);
  assert.equal((await fetch(`${base}/api/auth/demo-login`, { method: 'POST' })).status, 403);
  const previousAppEnv = process.env.APP_ENV;
  const previousDemoFlag = process.env.ORKTO_ENABLE_DEMO_LOGIN;
  try {
    process.env.APP_ENV = 'staging';
    process.env.ORKTO_ENABLE_DEMO_LOGIN = 'true';
    assert.equal((await fetch(`${base}/api/auth/demo-login`, { method: 'POST' })).status, 403,
      'staging must not enable the local demo-login capability');
  } finally {
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
    if (previousDemoFlag === undefined) delete process.env.ORKTO_ENABLE_DEMO_LOGIN;
    else process.env.ORKTO_ENABLE_DEMO_LOGIN = previousDemoFlag;
  }
  assert.equal((await fetch(`${base}/api/proposal/untrusted/pix`, { method: 'POST' })).status, 503);
  const profile = { display_name: 'Proprietário', email: 'owner@example.test', company_name: 'Empresa A', payment_info: 'Dados originais', whatsapp_number: '+5511999999999', onboarding_completed:true };
  const memberUpdate = await api(base, CLIENT_TOKEN_A_RECIPIENT, '/api/profile', { method: 'PUT', body: JSON.stringify({ ...profile, payment_info: 'Conta alterada' }) });
  assert.equal(memberUpdate.status, 403);
  assert.equal(database.rows('profiles').find(row => row.id === USER_A)?.payment_info, undefined);
  const priorGatewayCalls = profileGatewayCalls;
  const previousGatewayEnv = process.env.APP_ENV;
  delete process.env.APP_ENV;
  const missingGateway = await api(base, CLIENT_TOKEN_A, '/api/profile', { method: 'PUT', body: JSON.stringify(profile) });
  process.env.APP_ENV = previousGatewayEnv;
  assert.equal(missingGateway.status, 503);
  assert.equal(profileGatewayCalls, priorGatewayCalls);
  assert.equal(database.rows('profiles').find(row => row.id === USER_A)?.payment_info, undefined);
  const previousUrl = process.env.VITE_SUPABASE_URL;
  try {
    process.env.APP_ENV = 'staging';
    process.env.VITE_SUPABASE_URL = 'https://ghrjongiodziasupakrk.supabase.co';
    const ownerUpdate = await api(base, CLIENT_TOKEN_A, '/api/profile', { method: 'PUT', body: JSON.stringify(profile) });
    assert.equal(ownerUpdate.status, 200);
    assert.equal(profileGatewayCalls, priorGatewayCalls + 1);
    assert.equal(database.rows('profiles').find(row => row.id === USER_A)?.payment_info, 'Dados originais');
  } finally {
    process.env.APP_ENV = previousGatewayEnv;
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
  }
});

test('Asaas webhook uses durable claim idempotency, rejects payload conflicts, and never downgrades confirmed payment', async () => {
  resetDatabase();
  database.rows('payment_records').push({
    payment_id: 'payment-already-confirmed', user_id: USER_A, workspace_id: WORKSPACE_A, quote_id: null,
    amount: 10, status: 'confirmed', confirmed_at: '2026-09-28T10:00:00.000Z',
  });
  const base = await serve(app);
  const body = { id: 'evt-asaas-idempotency-001', event: 'PAYMENT_OVERDUE', payment: { id: 'payment-already-confirmed' } };
  const sendWebhook = (payload: unknown, token = 'test-only-asaas-webhook-secret') => fetch(`${base}/api/asaas/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': token }, body: JSON.stringify(payload),
  });

  assert.equal((await sendWebhook(body, 'wrong-secret')).status, 401);
  assert.equal(database.rows('orkto_payment_webhook_events').length, 0);

  const first = await sendWebhook(body);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    received: true, processingState: 'processed', requestId: first.headers.get('x-request-id'),
  });
  assert.equal(database.rows('payment_records')[0]?.status, 'confirmed');
  assert.equal(database.rows('orkto_payment_webhook_events')[0]?.status, 'processed');
  assert.equal(database.rows('orkto_payment_webhook_events')[0]?.attempt_count, 1);
  assert.equal(database.rows('asaas_webhook_events').length, 1);

  const duplicate = await sendWebhook(body);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json() as Row).duplicate, true);
  assert.equal(database.rows('orkto_payment_webhook_events')[0]?.attempt_count, 1);

  const conflict = await sendWebhook({ ...body, payment: { id: 'a-different-payment' } });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json() as Row).category, 'idempotency_conflict');
  assert.equal(database.rows('payment_records')[0]?.status, 'confirmed');
});

test('Asaas paid event resolves quote and tenant from durable intent, not provider externalReference', async () => {
  resetDatabase();
  database.rows('quotes').push(
    { id: 'quote-payment-a', user_id: USER_A, workspace_id: WORKSPACE_A, total: 100, status: 'draft', archived_at: null,
      client_vehicle_or_service: 'Synthetic A', quote_number: 'A-001', customer_id: null, client_phone: null },
    { id: 'quote-payment-b', user_id: USER_B, workspace_id: WORKSPACE_B, total: 100, status: 'draft', archived_at: null,
      client_vehicle_or_service: 'Synthetic B', quote_number: 'B-001', customer_id: null, client_phone: null },
  );
  database.rows('orkto_payment_intents').push({
    id: 'intent-payment-a', workspace_id: WORKSPACE_A, quote_id: 'quote-payment-a', provider: 'asaas',
    idempotency_key: 'test-payment-a', provider_reference: 'payment-provider-a', amount_cents: 10000,
    currency: 'BRL', status: 'request_accepted', last_provider_event_at: null,
  });
  const base = await serve(app);
  const response = await fetch(`${base}/api/asaas/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': 'test-only-asaas-webhook-secret' },
    body: JSON.stringify({
      id: 'evt-durable-intent-a', event: 'PAYMENT_RECEIVED',
      payment: { id: 'payment-provider-a', externalReference: 'quote-payment-b', value: 100, currency: 'BRL' },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(database.rows('quotes').find(row => row.id === 'quote-payment-a')?.status, 'approved');
  assert.equal(database.rows('quotes').find(row => row.id === 'quote-payment-b')?.status, 'draft');
  assert.equal(database.rows('orkto_payment_intents').find(row => row.id === 'intent-payment-a')?.status, 'succeeded');
  assert.equal(database.rows('payment_records').length, 1);
  assert.equal(database.rows('payment_records')[0].workspace_id, WORKSPACE_A);
  assert.equal(database.rows('payment_records')[0].quote_id, 'quote-payment-a');
  assert.equal(database.rows('orkto_payment_webhook_events')[0]?.status, 'processed');
});

test('Asaas paid event without a durable intent cannot approve a quote by externalReference', async () => {
  resetDatabase();
  database.rows('quotes').push({ id: 'quote-unbound-b', user_id: USER_B, workspace_id: WORKSPACE_B,
    total: 100, status: 'draft', archived_at: null, client_vehicle_or_service: 'Synthetic B', quote_number: 'B-002',
    customer_id: null, client_phone: null });
  const base = await serve(app);
  const response = await fetch(`${base}/api/asaas/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': 'test-only-asaas-webhook-secret' },
    body: JSON.stringify({ id: 'evt-without-intent-b', event: 'PAYMENT_RECEIVED',
      payment: { id: 'unbound-provider-reference', externalReference: 'quote-unbound-b', value: 100, currency: 'BRL' } }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json() as Row).category, 'payment_intent_required');
  assert.equal(database.rows('quotes').find(row => row.id === 'quote-unbound-b')?.status, 'draft');
  assert.equal(database.rows('payment_records').length, 0);
  assert.equal(database.rows('orkto_payment_webhook_events')[0]?.status, 'failed');
});

test('request correlation IDs are bounded and readiness proves database reachability without leaking configuration', async () => {
  resetDatabase();
  const base = await serve(app);
  const health = await fetch(`${base}/api/health`);
  const generatedRequestId = health.headers.get('x-request-id') || '';
  assert.match(generatedRequestId, /^[0-9a-f-]{36}$/i);
  const accepted = await fetch(`${base}/api/ready`, { headers: { 'x-request-id': '11111111-1111-4111-8111-111111111111' } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get('x-request-id'), '11111111-1111-4111-8111-111111111111');
  const body = await accepted.text();
  assert.match(body, /"status":"ready"/);
  assert.equal(body.includes(SUPABASE_URL), false);
  assert.equal(body.includes('service-role'), false);
  const replaced = await fetch(`${base}/api/health`, { headers: { 'x-request-id': 'spoofed' } });
  assert.match(replaced.headers.get('x-request-id') || '', /^[0-9a-f-]{36}$/i);
  assert.notEqual(replaced.headers.get('x-request-id'), 'spoofed');
});

test('WIA audit history is tenant-scoped, safely projected, and keyset paginated', async () => {
  resetDatabase();
  const base = await serve(app);
  const times = [
    '2026-09-28T12:00:00.000Z',
    '2026-09-28T11:00:00.000Z',
    '2026-09-28T10:00:00.000Z',
  ];
  const runIds = times.map(() => randomUUID());
  for (let i = 0; i < times.length; i += 1) {
    database.rows('orkto_wia_runs').push({
      id: runIds[i], workspace_id: WORKSPACE_A, user_id: USER_A, feature: 'wia_contact', agent: 'sales_agent',
      task_type: 'standard', status: 'succeeded', provider: 'gemini', model: 'test-model', trace_id: `trace-a-${i}`,
      summary: 'Sensitive response body must not be exposed.', started_at: times[i], completed_at: times[i], created_at: times[i],
    });
  }
  database.rows('orkto_wia_runs').push({
    id: randomUUID(), workspace_id: WORKSPACE_B, user_id: USER_B, feature: 'secret-feature', status: 'succeeded',
    provider: 'private-provider', model: 'private-model', trace_id: 'trace-b', started_at: '2026-09-28T13:00:00.000Z',
  });
  database.rows('orkto_wia_actions').push({
    id: randomUUID(), workspace_id: WORKSPACE_A, run_id: runIds[0], action_type: 'request_approval', status: 'awaiting_approval',
    requires_approval: true, created_at: times[0], payload: { credential: 'DO_NOT_RETURN' }, result: { token: 'DO_NOT_RETURN' },
  });
  database.rows('orkto_wia_events').push({
    id: randomUUID(), workspace_id: WORKSPACE_A, run_id: runIds[0], actor_user_id: USER_A, event_type: 'wia.decision.prepared',
    source: 'wia', entity_type: 'deal', entity_ref: randomUUID(), occurred_at: times[0], payload: { provider_secret: 'DO_NOT_RETURN' },
  });
  database.rows('orkto_audit_log').push({
    id: randomUUID(), workspace_id: WORKSPACE_A, user_id: USER_A, trace_id: 'trace-a-0', event_type: 'wia.draft.approved',
    actor_type: 'human', actor_id: USER_A, conversation_id: null, approval_task_id: null, created_at: times[0],
    event_data: { access_token: 'DO_NOT_RETURN', provider_payload: 'DO_NOT_RETURN' },
  });

  const unauthenticated = await fetch(`${base}/api/wia/history?limit=2`);
  assert.equal(unauthenticated.status, 401);
  assert.equal((await api(base, CLIENT_TOKEN_A, '/api/wia/history?limit=0')).status, 400);
  assert.equal((await api(base, CLIENT_TOKEN_A, '/api/wia/history?cursor=not-a-cursor')).status, 400);
  const first = await api(base, CLIENT_TOKEN_A, '/api/wia/history?limit=2');
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { data: Row[]; page: { nextCursor: string | null } };
  assert.deepEqual(firstBody.data.map(row => row.id), runIds.slice(0, 2));
  assert.ok(firstBody.page.nextCursor);
  assert.equal(JSON.stringify(firstBody).includes('DO_NOT_RETURN'), false, 'provider payloads, action bodies and raw audit JSON stay private');
  assert.equal(JSON.stringify(firstBody).includes('Sensitive response body'), false, 'raw WIA summaries are not returned');
  assert.equal(firstBody.data[0].actions[0].id != null, true);
  assert.equal(firstBody.data[0].actions[0].approvalPath, `/api/wia/actions/${firstBody.data[0].actions[0].id}/approve`);
  assert.equal(firstBody.data[0].events.some((event: Row) => event.target?.type === 'deal'), true);

  const second = await api(base, CLIENT_TOKEN_A, `/api/wia/history?limit=2&cursor=${encodeURIComponent(firstBody.page.nextCursor!)}`);
  assert.equal(second.status, 200);
  const secondBody = await second.json() as { data: Row[]; page: { nextCursor: string | null } };
  assert.deepEqual(secondBody.data.map(row => row.id), runIds.slice(2));
  assert.equal(secondBody.page.nextCursor, null);
  const otherTenant = await api(base, CLIENT_TOKEN_B, '/api/wia/history?limit=10');
  assert.equal(otherTenant.status, 200);
  const otherBody = await otherTenant.json() as { data: Row[] };
  assert.equal(otherBody.data.length, 1);
  assert.notEqual(otherBody.data[0].id, runIds[0]);
  const foreignRunId = database.rows('orkto_wia_runs').find(row => row.workspace_id === WORKSPACE_B)!.id;
  const foreignFilter = await api(base, CLIENT_TOKEN_A, `/api/wia/history?runId=${foreignRunId}`);
  assert.equal(foreignFilter.status, 200);
  assert.deepEqual((await foreignFilter.json() as { data: Row[] }).data, []);
});

test('staging Auth and WIA history reads use the verified user JWT rather than service-role', async () => {
  resetDatabase();
  const base = await serve(app);
  const previousAppEnv = process.env.APP_ENV;
  try {
    process.env.APP_ENV = 'staging';
    const response = await api(base, CLIENT_TOKEN_A, '/api/wia/history?limit=2');
    assert.equal(response.status, 200);
    const relevant = database.requestAuthorization.filter(item =>
      item.path === '/rest/v1/orkto_workspace_members' || item.path === '/rest/v1/orkto_wia_runs');
    assert.equal(relevant.length, 2);
    assert.ok(relevant.every(item => item.authorization === `Bearer ${CLIENT_TOKEN_A}`));
    assert.equal((await api(base, CLIENT_TOKEN_A, '/api/wia/history?limit=2', {
      headers: { 'x-orkto-workspace': WORKSPACE_B },
    })).status, 403);
  } finally {
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
  }
});

test('staging Inbox read and status writes cross the explicit gateway with tenant and role checks', async () => {
  resetDatabase();
  const conversationId = randomUUID();
  const messageId = randomUUID();
  database.rows('orkto_conversations').push({ id:conversationId,workspace_id:WORKSPACE_A,user_id:USER_A,status:'open' });
  database.rows('orkto_messages').push({ id:messageId,workspace_id:WORKSPACE_A,conversation_id:conversationId,direction:'incoming',read_at:null });
  const base = await serve(app);
  const priorAppEnv = process.env.APP_ENV;
  const priorUrl = process.env.VITE_SUPABASE_URL;
  try {
    process.env.APP_ENV = 'staging';
    process.env.VITE_SUPABASE_URL = 'https://ghrjongiodziasupakrk.supabase.co';
    const read = await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/read`, { method:'POST' });
    assert.equal(read.status, 200);
    assert.equal((await read.json() as Row).messagesMarkedRead, 1);
    assert.ok(database.rows('orkto_messages')[0].read_at);
    const status = await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}`, {
      method:'PATCH',body:JSON.stringify({ status:'closed' }),
    });
    assert.equal(status.status, 200);
    assert.equal((await status.json() as Row).data.status, 'closed');
    assert.equal((await api(base, CLIENT_TOKEN_B, `/api/conversations/${conversationId}/read`, { method:'POST' })).status, 404);
    assert.equal((await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}`, {
      method:'PATCH',headers:{ 'x-orkto-workspace':WORKSPACE_B },body:JSON.stringify({ status:'open' }),
    })).status, 403);
    assert.equal((await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/conversations/${conversationId}`, {
      method:'PATCH',body:JSON.stringify({ status:'archived' }),
    })).status, 403);
  } finally {
    if (priorAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = priorAppEnv;
    if (priorUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = priorUrl;
  }
});

test('core HTTP flow persists client, deal, catalog-priced proposal, inbox, WIA approval and audit in workspace A only', async () => {
  resetDatabase();
  const base = await serve(app);
  const createdClientResponse = await api(base, CLIENT_TOKEN_A, '/api/clients', json({ name: 'Cliente A', phone: '+5511999000001' }));
  assert.equal(createdClientResponse.status, 201);
  const client = (await createdClientResponse.json() as { data: Row }).data;

  const foreignClientQuote = await api(base, CLIENT_TOKEN_B, '/api/quotes', json({ clientName: 'Cliente A', clientPhone: '+5511999000001', customerId: client.id, items: [{ id: 'line', name: 'Falso', quantity: 1, unitPrice: 10, discount: 0 }] }));
  assert.equal(foreignClientQuote.status, 400, 'cross-workspace customer ID must be rejected at create');

  const createdDealResponse = await api(base, CLIENT_TOKEN_A, '/api/deals', json({ title: 'Negócio A', customerRef: client.id, stage: 'qualification', valueCents: 12500, workspace_id: WORKSPACE_B }));
  assert.equal(createdDealResponse.status, 201);
  const deal = (await createdDealResponse.json() as { data: Row }).data;
  assert.equal(deal.workspace_id, WORKSPACE_A, 'tenant is resolved from the authenticated membership, never the browser payload');

  const crossDeal = await api(base, CLIENT_TOKEN_B, '/api/deals', json({ title: 'Referência cruzada', customerRef: client.id }));
  assert.equal(crossDeal.status, 400);

  const quoteResponse = await api(base, CLIENT_TOKEN_A, '/api/quotes', json({
    workspace_id: WORKSPACE_B, clientName: 'Cliente A', clientPhone: '+5511999000001', customerId: client.id, dealId: deal.id,
    items: [{ id: 'line-1', catalogItemId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', name: 'Preço adulterado', description: '', quantity: 2, unitPrice: 1, discount: 0 }],
  }));
  assert.equal(quoteResponse.status, 201);
  const quote = await quoteResponse.json() as Row;
  assert.equal(quote.workspace_id, WORKSPACE_A);
  assert.equal(quote.customer_id, client.id);
  assert.equal(quote.deal_id, deal.id);
  assert.equal(quote.items[0].unitPrice, 125, 'server must replace client/LLM price with catalog price');
  assert.equal(Number(quote.total), 250);
  const quoteEdit = await api(base, CLIENT_TOKEN_A, `/api/quotes/${quote.id}`, { method: 'PUT', body: JSON.stringify({ notes: 'Conferida pela equipe.' }) });
  assert.equal(quoteEdit.status, 200);
  const forgedApproval = await api(base, CLIENT_TOKEN_A, `/api/quotes/${quote.id}`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
  assert.equal(forgedApproval.status, 400, 'generic quote edit must not approve a proposal');
  assert.notEqual(database.rows('quotes').find(row => row.id === quote.id)?.status, 'approved');
  assert.equal(database.rows('quotes').find(row => row.id === quote.id)?.notes, 'Conferida pela equipe.');

  const foreignList = await api(base, CLIENT_TOKEN_B, '/api/quotes/list');
  assert.deepEqual(await foreignList.json(), []);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/quotes/detail/${quote.id}`)).status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/quotes/${quote.id}`, { method: 'PUT', body: JSON.stringify({ notes: 'vazamento' }) })).status, 404);
  const archiveTestUrl = process.env.VITE_SUPABASE_URL;
  const archiveTestEnv = process.env.APP_ENV;
  process.env.VITE_SUPABASE_URL = 'https://ghrjongiodziasupakrk.supabase.co';
  process.env.APP_ENV = 'staging';
  try {
    const foreignArchive = await api(base, CLIENT_TOKEN_B, `/api/quotes/${quote.id}`, { method: 'DELETE' });
    assert.equal(foreignArchive.status, 404, `foreign quote archive is not allowed: ${await foreignArchive.text()}`);
  } finally {
    process.env.APP_ENV = archiveTestEnv;
    if (archiveTestUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = archiveTestUrl;
  }
  const generated = await api(base, CLIENT_TOKEN_A, '/api/proposal/generate', {
    ...json({ quoteId: quote.id }),
    headers: { host: 'attacker.example', 'x-forwarded-host': 'attacker.example' },
  });
  assert.equal(generated.status, 201);
  const proposal = await generated.json() as Row;
  assert.equal(new URL(proposal.link).origin, 'https://orkto-staging.test', 'forged Host/Forwarded headers cannot alter public proposal links');
  assert.equal(proposal.version, 1);
  const proposalToken=new URL(proposal.link).pathname.split('/').at(-1)!;
  assert.match(proposalToken, /^[A-Za-z0-9_-]{43}$/, 'new share links use 256 bits of entropy');
  const revised = await api(base, CLIENT_TOKEN_A, '/api/proposal/generate', json({ quoteId: quote.id }));
  const revisedProposal = await revised.json() as Row;
  assert.equal(revisedProposal.version, 2);
  const revisedToken=new URL(revisedProposal.link).pathname.split('/').at(-1)!;
  assert.ok(database.rows('orkto_live_quotes').some(row=>row._test_token===revisedToken&&row.status==='active'),
    JSON.stringify(database.rows('orkto_live_quotes').map(row=>({token:row._test_token,status:row.status}))));
  const preview = await api(base, '', `/api/public/live-quotes/${revisedToken}`);
  assert.equal(preview.status, 200,await preview.clone().text());
  assert.equal(preview.headers.get('cache-control'), 'no-store');
  const publicProposal = await preview.json() as Row;
  assert.equal(publicProposal.snapshot.total, quote.total);
  assert.equal(publicProposal.workspace_id, undefined);
  assert.equal(publicProposal.quote_ref, undefined);
  assert.equal((await api(base, '', '/api/public/live-quotes/not-a-valid-bearer-token')).status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_A, '/api/proposal/Legacy01')).status, 410, 'legacy links fail closed and cannot mutate proposal state');
  assert.equal(database.rows('proposals').filter(row => row.quote_id === quote.id).length, 0);
  assert.equal((await api(base, CLIENT_TOKEN_B, '/api/proposal/generate', json({ quoteId: quote.id }))).status, 404);
  assert.equal(database.rows('orkto_live_quotes').filter(row => row.quote_ref === quote.id && row.workspace_id === WORKSPACE_A).length, 2, 'tenant B must not add or alter proposal versions');

  database.rows('orkto_automation_jobs').push(
    { id:randomUUID(),workspace_id:WORKSPACE_A,entity_type:'quote',entity_ref:quote.id,step_key:'D+4',status:'scheduled',idempotency_key:`reply-stop:${quote.id}` },
    { id:randomUUID(),workspace_id:WORKSPACE_A,entity_type:'repurchase',entity_ref:'+5511999000001',step_key:'all',status:'scheduled',idempotency_key:'reply-stop:repurchase-a' },
  );
  database.rows('orkto_wia_actions').push(
    { id:randomUUID(),workspace_id:WORKSPACE_A,action_type:'send_proposal_followup',payload:{ quoteId:quote.id,step:'D+4' },status:'awaiting_approval' },
    { id:randomUUID(),workspace_id:WORKSPACE_A,action_type:'prepare_repurchase_followup',payload:{ customerPhone:'+5511999000001' },status:'awaiting_approval' },
  );

  const webhook = await fetch(`${base}/api/whatsapp/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-orkto-webhook-secret': WHATSAPP_SECRET },
    body: JSON.stringify({ sender_number: '+5511999000001', contact_name: 'Cliente A', content: 'Olá, gostaria de saber sobre a proposta.', message_id: 'external-a-1' }),
  });
  assert.equal(webhook.status, 200);
  const inboxCreated = await webhook.json() as Row;
  const conversationId = inboxCreated.conversation_id as string;
  const messageId = inboxCreated.message_id as string;
  const taskId = inboxCreated.approval_task_id as string;
  const conversation = database.rows('orkto_conversations').find(row => row.id === conversationId)!;
  assert.equal(conversation.workspace_id, WORKSPACE_A);
  assert.equal(conversation.customer_id, client.id);
  assert.equal(conversation.deal_id, deal.id);
  assert.equal(database.rows('orkto_messages').find(row => row.id === messageId)?.workspace_id, WORKSPACE_A);
  assert.equal(database.rows('orkto_messages').find(row => row.id === messageId)?.read_at, null);
  const priorityInbox = await api(base,CLIENT_TOKEN_A,'/api/priority/inbox');
  assert.equal(priorityInbox.status,200);
  const rankedConversation = ((await priorityInbox.json() as { data:Row[] }).data).find(row => row.id === conversationId)!;
  assert.ok(['ENGAGED','NEUTRAL','STUCK','LOYAL'].includes(rankedConversation.mood_state));
  assert.ok(Array.isArray(rankedConversation.mood_reasons) && rankedConversation.mood_reasons.length > 0);
  assert.equal(typeof rankedConversation.mood_confidence,'number');
  assert.ok(Array.isArray(rankedConversation.priority_reason));
  const priorityOverride = await api(base,CLIENT_TOKEN_A,`/api/conversations/${conversationId}/priority`,{ ...json({ priority:'urgent' }),method:'PUT' });
  assert.equal(priorityOverride.status,200);
  assert.equal(database.rows('orkto_conversations').find(row => row.id === conversationId)?.priority_override,'urgent');
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/conversations/${conversationId}/priority`,{ ...json({ priority:'low' }),method:'PUT' })).status,404);
  assert.equal(database.rows('orkto_conversations').find(row => row.id === conversationId)?.priority_override,'urgent','manual triage remains workspace scoped');
  const refreshedPriorityInbox = await api(base,CLIENT_TOKEN_A,'/api/priority/inbox');
  assert.equal(((await refreshedPriorityInbox.json() as { data:Row[] }).data.find(row => row.id === conversationId)?.priority_overridden),true,'manual override is refresh-safe and remains visible');
  assert.equal(((await (await api(base,CLIENT_TOKEN_B,'/api/priority/inbox')).json() as { data:Row[] }).data.some(row => row.id === conversationId)),false,'triage and mood data stay inside workspace A');
  assert.ok(database.rows('orkto_automation_jobs').filter(row => row.entity_ref === quote.id || row.entity_ref === '+5511999000001').every(row => row.status === 'cancelled'), 'customer reply cancels pending recovery and repurchase jobs immediately');
  assert.ok(database.rows('orkto_wia_actions').filter(row => row.action_type === 'send_proposal_followup' || row.action_type === 'prepare_repurchase_followup').every(row => row.status === 'cancelled'), 'customer reply cancels prepared external-contact drafts immediately');
  assert.equal((await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/conversations/${conversationId}`)).status, 200, 'active members share workspace conversations');

  const whisperCreate = await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/sussurros`, json({ content: 'Priorize a revisão desta proposta.', toUserId: USER_A_RECIPIENT }));
  assert.equal(whisperCreate.status, 201);
  const whisper = (await whisperCreate.json() as { data: Row }).data;
  assert.equal(whisper.workspace_id, WORKSPACE_A);
  assert.equal(whisper.to_user_id, USER_A_RECIPIENT);
  assert.ok(database.rows('orkto_wia_events').some(row => row.event_type === 'sussurro.created' && row.entity_ref === whisper.id));
  const senderWhispers = await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/sussurros`);
  assert.equal(((await senderWhispers.json() as { data: Row[] }).data).length, 1, 'sender retains access to its own instruction');
  const recipientWhispers = await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/conversations/${conversationId}/sussurros`);
  assert.equal(((await recipientWhispers.json() as { data: Row[] }).data).length, 1);
  const unrelatedMemberWhispers = await api(base, CLIENT_TOKEN_A_OTHER, `/api/conversations/${conversationId}/sussurros`);
  assert.deepEqual((await unrelatedMemberWhispers.json() as { data: Row[] }).data, [], 'a different member cannot read a targeted instruction');
  assert.equal((await api(base, CLIENT_TOKEN_A_OTHER, `/api/conversations/${conversationId}/sussurros/${whisper.id}/read`, { method: 'POST' })).status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/conversations/${conversationId}/sussurros/${whisper.id}/read`, { method: 'POST' })).status, 200);
  assert.equal((await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/conversations/${conversationId}/sussurros/${whisper.id}/read`, { method: 'POST' })).status, 404, 'read transition is single-use');
  assert.equal((await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/sussurros`, json({ content: 'Destino fora do workspace.', toUserId: USER_B }))).status, 400);
  assert.equal((await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/sussurros`, json({ content: 'Expiração passada.', expiresAt: new Date(Date.now() - 60_000).toISOString() }))).status, 400);
  assert.equal(database.rows('orkto_messages').some(row => row.content === 'Priorize a revisão desta proposta.'), false, 'private instructions never become customer messages');
  assert.ok(database.rows('orkto_wia_events').some(row => row.event_type === 'sussurro.read' && row.entity_ref === whisper.id));

  const inboxB = await api(base, CLIENT_TOKEN_B, '/api/conversations');
  assert.deepEqual(await inboxB.json(), []);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/conversations/${conversationId}`)).status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/conversations/${conversationId}/messages`)).status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/conversations/${conversationId}/read`, { method: 'POST' })).status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) })).status, 404);
  assert.deepEqual(await (await api(base, CLIENT_TOKEN_B, '/api/approval-tasks')).json(), []);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/approval-tasks/${taskId}/approve`, json({ reason: 'not allowed' }))).status, 404);

  const messages = await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/messages`);
  assert.equal(((await messages.json() as { data: Row[] }).data).length, 1);
  assert.equal((await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/read`, { method: 'POST' })).status, 200);
  assert.ok(database.rows('orkto_messages').find(row => row.id === messageId)?.read_at);
  assert.equal((await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) })).status, 200);
  assert.equal(database.rows('orkto_conversations').find(row => row.id === conversationId)?.status, 'closed');
  const externalSend = await api(base, CLIENT_TOKEN_A, `/api/conversations/${conversationId}/send`, json({ content: 'Mensagem de teste: não deve sair sem canal conectado.' }));
  assert.equal(externalSend.status, 503);
  assert.equal((await externalSend.json() as Row).status, 'CONFIGURATION_REQUIRED');
  assert.ok(database.rows('orkto_audit_log').some(row => row.workspace_id === WORKSPACE_A && row.conversation_id === conversationId && row.event_type === 'channel.send.configuration_required'));
  assert.equal(database.rows('orkto_messages').filter(row => row.direction === 'outgoing').length, 0, 'an unconfigured adapter must not create a sent message');
  const approvalKey=`approval-e2e-${randomUUID()}`;
  const approvalInput={reason:'Aprovado para registrar; canal não conectado'};
  const approvalRequest={...json(approvalInput),headers:{'x-idempotency-key':approvalKey}};
  assert.equal((await api(base,CLIENT_TOKEN_A_RECIPIENT,`/api/approval-tasks/${taskId}/approve`,approvalRequest)).status,403,
    'ordinary workspace member cannot approve an Inbox draft');
  const approval = await api(base, CLIENT_TOKEN_A, `/api/approval-tasks/${taskId}/approve`, approvalRequest);
  assert.equal(approval.status, 200);
  assert.equal((await approval.json() as Row).deliveryStatus, 'CONFIGURATION_REQUIRED');
  const approvalReplay=await api(base,CLIENT_TOKEN_A,`/api/approval-tasks/${taskId}/approve`,approvalRequest);
  assert.equal(approvalReplay.status,200);
  assert.equal((await approvalReplay.json() as Row).idempotentReplay,true);
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/approval-tasks/${taskId}/reject`,
    {...json({reason:'Conflicting decision'}),headers:{'x-idempotency-key':approvalKey}})).status,409);
  assert.equal(database.rows('orkto_audit_log').filter(row=>row.approval_task_id===taskId&&row.event_type==='wia.draft.approved').length,1,
    'one decision creates one audit row across retries');
  assert.equal(database.rows('orkto_messages').filter(row => row.direction === 'outgoing').length, 0, 'approval must not pretend an external send happened');

  const wia = await api(base, CLIENT_TOKEN_A, '/api/wia/route-agent', json({ message: 'FOLLOWUP_TEST_APPROVAL prepare um follow-up para esta proposta' }));
  assert.equal(wia.status, 200);
  const wiaResult = await wia.json() as Row;
  const run = database.rows('orkto_wia_runs').find(row => row.id === wiaResult.runId)!;
  assert.equal(run.workspace_id, WORKSPACE_A);
  assert.equal(run.user_id, USER_A);
  assert.equal(run.provider, 'gemini');
  assert.equal(run.status, 'succeeded');
  assert.ok(run.model);
  assert.ok(run.task_type);
  assert.ok((run.context_refs as string[]).includes(`quote:${quote.id}`));
  const modelUsage = database.rows('orkto_model_usage').find(row => row.trace_id === wiaResult.traceId)!;
  assert.equal(modelUsage.workspace_id, WORKSPACE_A);
  assert.equal(modelUsage.user_id, USER_A);
  assert.equal(modelUsage.prompt_tokens, 12);
  assert.equal(modelUsage.completion_tokens, 8);
  assert.ok(modelUsage.latency_ms >= 0);
  const action = database.rows('orkto_wia_actions').find(row => row.run_id === run.id)!;
  assert.equal(action.status, 'awaiting_approval');
  const foreignActionApproval = await api(base, CLIENT_TOKEN_B, `/api/wia/actions/${action.id}/approve`, json({ confirm: true }));
  assert.equal(foreignActionApproval.status, 404);
  assert.equal((await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/wia/actions/${action.id}/approve`, json({ confirm: true }))).status, 403);
  assert.equal((await api(base, CLIENT_TOKEN_A_RECIPIENT, `/api/wia/actions/${action.id}/reject`, json({ reason: 'Não autorizado' }))).status, 403);
  assert.equal(database.rows('orkto_wia_actions').find(row => row.id === action.id)?.status, 'awaiting_approval');
  const approvedAction = await api(base, CLIENT_TOKEN_A, `/api/wia/actions/${action.id}/approve`, json({ confirm: true }));
  assert.equal(approvedAction.status, 200);
  assert.equal(database.rows('orkto_wia_actions').find(row => row.id === action.id)?.status, 'executed');
  assert.equal(database.rows('orkto_tasks').filter(row => row.workspace_id === WORKSPACE_A).length, 1);
  assert.ok(database.rows('orkto_wia_events').some(row => row.workspace_id === WORKSPACE_A && row.run_id === run.id));
  assert.ok(database.rows('orkto_audit_log').some(row => row.workspace_id === WORKSPACE_A));

  const toolWia = await api(base, CLIENT_TOKEN_A, '/api/wia/route-agent', json({ message: 'Mostre os orçamentos abertos' }));
  assert.equal(toolWia.status, 200);
  const toolResult = await toolWia.json() as Row;
  assert.equal(toolResult.path, 't0');
  const toolRun = database.rows('orkto_wia_runs').find(row => row.id === toolResult.runId)!;
  assert.equal(toolRun.workspace_id, WORKSPACE_A);
  assert.equal(toolRun.provider, 'none');
  assert.equal(toolRun.status, 'succeeded');
  assert.ok(database.rows('orkto_wia_tool_calls').some(row => row.run_id === toolRun.id && row.tool_name === 'get_open_quotes' && row.status === 'succeeded'),
    JSON.stringify(database.rows('orkto_wia_tool_calls').filter(row => row.run_id === toolRun.id).map(row => ({tool_name:row.tool_name,status:row.status,error_category:row.error_category}))));

  const riskId = randomUUID();
  const memoryId = randomUUID();
  database.rows('orkto_risk_assessments').push({ id:riskId,workspace_id:WORKSPACE_A,customer_ref:client.id,score:72,confidence:0.84,reasons:['promessa de pagamento não cumprida'],signals:[{ type:'missed_promise' }],recommended_action:'human_review',assessed_at:new Date().toISOString() });
  database.rows('orkto_wia_memories').push({ id:memoryId,workspace_id:WORKSPACE_A,memory_type:'preference',entity_type:'customer',entity_ref:client.id,content:{ contactWindow:'morning' },provenance:{ source:'operator_note' },confidence:0.9,status:'active',expires_at:null,created_at:new Date().toISOString() });
  const customerContextWia = await api(base,CLIENT_TOKEN_A,'/api/wia/route-agent',json({ message:'Qual é o risco e a preferência deste cliente +55 11 99900-0001?' }));
  assert.equal(customerContextWia.status,200);
  const customerContextResult = await customerContextWia.json() as Row;
  assert.equal(customerContextResult.path,'t0');
  assert.match(customerContextResult.decision.messageDraft,/Risco alto \(72\/100/);
  assert.match(customerContextResult.decision.messageDraft,/contactWindow/);
  assert.ok(customerContextResult.decision.sourceIds.includes(`risk:${riskId}`));
  assert.ok(customerContextResult.decision.sourceIds.includes(`memory:${memoryId}`));
  const customerContextRun = database.rows('orkto_wia_runs').find(row => row.id === customerContextResult.runId)!;
  assert.ok(customerContextRun.context_refs.includes(`risk:${riskId}`));
  assert.ok(customerContextRun.context_refs.includes(`memory:${memoryId}`));
  assert.ok(database.rows('orkto_wia_tool_calls').some(row => row.run_id === customerContextRun.id && row.tool_name === 'get_customer_operational_context'));
  const foreignCustomerContext = await api(base,CLIENT_TOKEN_B,'/api/wia/route-agent',json({ message:'Qual é o risco e a preferência deste cliente +55 11 99900-0001?' }));
  assert.equal(foreignCustomerContext.status,200);
  assert.match((await foreignCustomerContext.json() as Row).decision.messageDraft,/Não encontrei esse cliente neste workspace/);

  failGeminiRequests = true;
  const failedWia = await api(base, CLIENT_TOKEN_A, '/api/wia/route-agent', json({ message: 'Resuma as propostas abertas' }));
  failGeminiRequests = false;
  assert.equal(failedWia.status, 503);
  const failedRun = database.rows('orkto_wia_runs').at(-1)!;
  assert.equal(failedRun.workspace_id, WORKSPACE_A);
  assert.equal(failedRun.user_id, USER_A);
  assert.equal(failedRun.status, 'failed');
  assert.ok(failedRun.error_category, 'provider errors are retained on the durable WiaRun');

  const persistedQuote = database.rows('quotes').find(row => row.id === quote.id)!;
  assert.equal((await api(base, CLIENT_TOKEN_A, `/api/quotes/detail/${quote.id}`)).status, 200);
  assert.equal(persistedQuote.deal_id, deal.id, 'relation remains stored after a new authenticated HTTP request (refresh equivalent)');
  const finalArchiveUrl = process.env.VITE_SUPABASE_URL;
  const finalArchiveEnv = process.env.APP_ENV;
  process.env.VITE_SUPABASE_URL = 'https://ghrjongiodziasupakrk.supabase.co';
  process.env.APP_ENV = 'staging';
  let quoteArchive: Response;
  try {
    quoteArchive = await api(base, CLIENT_TOKEN_A, `/api/quotes/${quote.id}`, { method: 'DELETE' });
  } finally {
    process.env.APP_ENV = finalArchiveEnv;
    if (finalArchiveUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = finalArchiveUrl;
  }
  assert.equal(quoteArchive.status, 200);
  assert.ok(database.rows('quotes').find(row => row.id === quote.id)?.archived_at);
  assert.equal((await api(base, CLIENT_TOKEN_A, `/api/quotes/detail/${quote.id}`)).status, 404);
  assert.equal(database.rows('proposals').filter(row => row.quote_id === quote.id && row.is_active).length, 0);
  assert.ok(database.rows('orkto_wia_events').some(row => row.event_type === 'quote.archived' && row.entity_ref === quote.id));
});

test('quote archive gateway denies foreign IDs and removes pending internal effects', async () => {
  const base = await serve(app);
  const quoteId = randomUUID();
  const linkId = randomUUID();
  const proposalId = randomUUID();
  database.rows('quotes').push({id:quoteId,workspace_id:WORKSPACE_A,user_id:USER_A,status:'pending',client_name:'Archive Test',client_phone:'+5511999111222'});
  database.rows('proposals').push({id:proposalId,workspace_id:WORKSPACE_A,quote_id:quoteId,is_active:true});
  database.rows('orkto_live_quotes').push({id:linkId,workspace_id:WORKSPACE_A,quote_ref:quoteId,status:'active'});
  database.rows('orkto_automation_jobs').push({id:randomUUID(),workspace_id:WORKSPACE_A,entity_type:'quote',entity_ref:quoteId,status:'scheduled'});
  database.rows('orkto_wia_actions').push({id:randomUUID(),workspace_id:WORKSPACE_A,action_type:'send_proposal_followup',payload:{quoteId},status:'awaiting_approval'});
  const previousUrl = process.env.VITE_SUPABASE_URL;
  const previousArchiveEnv = process.env.APP_ENV;
  process.env.VITE_SUPABASE_URL = 'https://ghrjongiodziasupakrk.supabase.co';
  process.env.APP_ENV = 'staging';
  try {
    assert.equal((await api(base,CLIENT_TOKEN_B,`/api/quotes/${quoteId}`,{method:'DELETE'})).status,404);
    assert.equal(database.rows('quotes').find(row=>row.id===quoteId)?.archived_at,undefined);
    assert.equal((await api(base,CLIENT_TOKEN_A,`/api/quotes/${quoteId}`,{method:'DELETE'})).status,200);
    assert.ok(database.rows('quotes').find(row=>row.id===quoteId)?.archived_at);
    assert.equal(database.rows('proposals').find(row=>row.id===proposalId)?.is_active,false);
    assert.equal(database.rows('orkto_live_quotes').find(row=>row.id===linkId)?.status,'revoked');
    assert.equal(database.rows('orkto_automation_jobs').find(row=>row.entity_ref===quoteId)?.status,'cancelled');
    assert.equal(database.rows('orkto_wia_actions').find(row=>row.payload?.quoteId===quoteId)?.status,'cancelled');
    assert.equal(database.rows('orkto_wia_events').filter(row=>row.event_type==='quote.archived' && row.entity_ref===quoteId).length,1);
  } finally {
    process.env.APP_ENV = previousArchiveEnv;
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
  }
});

test('staging Quote update routes editable fields through the gateway and rejects cross-tenant IDs', async () => {
  const base=await serve(app);
  const quoteId=randomUUID();
  database.rows('quotes').push({id:quoteId,workspace_id:WORKSPACE_A,user_id:USER_A,status:'pending',notes:'Before',total:25});
  const previousUrl=process.env.VITE_SUPABASE_URL;
  const previousAppEnv=process.env.APP_ENV;
  process.env.VITE_SUPABASE_URL='https://ghrjongiodziasupakrk.supabase.co';
  process.env.APP_ENV='staging';
  try {
    const own=await api(base,CLIENT_TOKEN_A,`/api/quotes/${quoteId}`,{method:'PUT',body:JSON.stringify({notes:'After',total:0,status:'pending',workspace_id:WORKSPACE_B})});
    assert.equal(own.status,200);
    assert.equal(database.rows('quotes').find(row=>row.id===quoteId)?.notes,'After');
    assert.equal(database.rows('quotes').find(row=>row.id===quoteId)?.total,25,'forged total is not forwarded');
    assert.equal((await api(base,CLIENT_TOKEN_B,`/api/quotes/${quoteId}`,{method:'PUT',body:JSON.stringify({notes:'Foreign'})})).status,404);
    assert.equal((await api(base,CLIENT_TOKEN_A,`/api/quotes/${quoteId}`,{method:'PUT',body:JSON.stringify({notes:'Forged',status:'approved'})})).status,423);
    assert.equal(database.rows('quotes').find(row=>row.id===quoteId)?.notes,'After');
  } finally {
    if(previousUrl===undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL=previousUrl;
    if(previousAppEnv===undefined) delete process.env.APP_ENV; else process.env.APP_ENV=previousAppEnv;
  }
});

test('quote persistence errors never disclose database details to the browser', async () => {
  resetDatabase();
  const base = await serve(app);
  const internalMarker = 'sql item password=internal-marker';
  database.forcedError = { table: 'quotes', method: 'POST', message: internalMarker };
  const response = await api(base, CLIENT_TOKEN_A, '/api/quotes', json({
    clientName: 'Cliente sintético', clientPhone: '+5511999000300',
    items: [{ id: 'line', name: 'Serviço', quantity: 1, unitPrice: 10, discount: 0 }],
  }));
  assert.equal(response.status, 503);
  const payload = await response.text();
  assert.equal(payload.includes(internalMarker), false);
  assert.equal(payload.includes('PGRST999'), false);
});

test('core writes fail closed without a configured gateway in every route', async () => {
  resetDatabase();
  const base = await serve(app);
  const previousEnv = process.env.APP_ENV;
  delete process.env.APP_ENV;
  try {
    const client = await api(base,CLIENT_TOKEN_A,'/api/clients',json({name:'No fallback',phone:'+5511999000333'}));
    const deal = await api(base,CLIENT_TOKEN_A,'/api/deals',json({title:'No fallback'}));
    const quote = await api(base,CLIENT_TOKEN_A,'/api/quotes',json({clientName:'No fallback',clientPhone:'+5511999000333',
      items:[{name:'Service',quantity:1,unitPrice:10,discount:0}]}));
    for (const response of [client,deal,quote]) {
      assert.equal(response.status,503);
      assert.equal((await response.json() as Row).category,'CONFIGURATION_REQUIRED');
    }
    assert.equal(database.rows('clients').length,0);
    assert.equal(database.rows('orkto_deals').length,0);
    assert.equal(database.rows('quotes').length,0);
  } finally {
    process.env.APP_ENV = previousEnv;
  }
});

test('terminal deal commands deny foreign IDs, conflicting outcomes and member archive', async () => {
  resetDatabase();
  const base = await serve(app);
  const created = await api(base,CLIENT_TOKEN_A,'/api/deals',json({title:'Terminal gateway',stage:'proposal'}));
  assert.equal(created.status,201);
  const deal = (await created.json() as {data:Row}).data;
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/deals/${deal.id}`,{method:'PATCH',body:JSON.stringify({stage:'won'})})).status,404);
  assert.equal((await api(base,CLIENT_TOKEN_A_RECIPIENT,`/api/deals/${deal.id}`,{method:'DELETE'})).status,403);
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/deals/${deal.id}`,{method:'PATCH',body:JSON.stringify({stage:'won',title:'Forged simultaneous edit'})})).status,400);
  assert.equal(database.rows('orkto_deals').find(row=>row.id===deal.id)?.status,'open');
  const headers={'x-idempotency-key':'terminal-gateway-key-001'};
  const close=()=>api(base,CLIENT_TOKEN_A,`/api/deals/${deal.id}`,{method:'PATCH',headers,body:JSON.stringify({stage:'won'})});
  assert.equal((await close()).status,200);
  assert.equal((await close()).status,200);
  assert.equal(database.rows('orkto_wia_events').filter(row=>row.entity_ref===deal.id && row.event_type==='deal.stage_changed').length,1);
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/deals/${deal.id}`,{method:'PATCH',body:JSON.stringify({stage:'lost'})})).status,409);
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/deals/${deal.id}`,{method:'DELETE'})).status,200);
  assert.equal(database.rows('orkto_deals').find(row=>row.id===deal.id)?.status,'archived');
  assert.equal(database.rows('orkto_wia_events').filter(row=>row.entity_ref===deal.id && row.event_type==='deal.archived').length,1);
});

test('versioned plan entitlements enforce seat, proposal and WIA limits on authenticated APIs', async () => {
  resetDatabase();
  const policy = database.rows('orkto_plan_price_versions').find(row => row.plan_key === 'pro')!;
  policy.entitlements.limits = { seats:4, monthly_wia_runs:1, active_proposals:1 };
  const base = await serve(app);

  const invite = () => api(base,CLIENT_TOKEN_A,'/api/team/invites',json({ email:'new-member@example.test',role:'member' }));
  assert.equal((await invite()).status,201,'fourth seat is allowed');
  const seatsBlocked = await invite();
  assert.equal(seatsBlocked.status,403,'a second outstanding invite cannot bypass the configured seat cap');
  assert.equal((await seatsBlocked.json() as Row).category,'limit_reached');

  const proposal = () => api(base,CLIENT_TOKEN_A,'/api/quotes',json({
    clientName:'Manual client',clientPhone:'+5511999000099',items:[{ id:'line',name:'Service',quantity:1,unitPrice:100,discount:0 }],
  }));
  assert.equal((await proposal()).status,201,'first active proposal is allowed');
  const proposalsBlocked = await proposal();
  assert.equal(proposalsBlocked.status,403,'a second active proposal cannot bypass the server-side cap');
  assert.equal((await proposalsBlocked.json() as Row).category,'PERMISSION_DENIED');

  const wia = () => api(base,CLIENT_TOKEN_A,'/api/wia/route-agent',json({ message:'Mostre os orçamentos abertos' }));
  assert.equal((await wia()).status,200,'first WIA run is allowed');
  const wiaBlocked = await wia();
  assert.equal(wiaBlocked.status,429,'a second WIA run cannot bypass the atomic monthly usage limit');
  assert.equal((await wiaBlocked.json() as Row).category,'plan_limit_reached');
  assert.equal(database.rows('orkto_plan_usage').find(row => row.feature_key === 'monthly_wia_runs')?.quantity,1);
});

test('quote relation edits, arbitrary workspace selectors and tenant B mutation attempts are denied', async () => {
  resetDatabase();
  const base = await serve(app);
  const created = await api(base, CLIENT_TOKEN_A, '/api/clients', json({ name: 'Cliente A', phone: '+5511888777666' }));
  const client = (await created.json() as { data: Row }).data;
  const quoteResponse = await api(base, CLIENT_TOKEN_A, '/api/quotes', json({ clientName: client.name, clientPhone: client.phone, customerId: client.id, items: [{ id: 'line', name: 'Mão de obra', quantity: 1, unitPrice: 50, discount: 0 }] }));
  const quote = await quoteResponse.json() as Row;
  const invalidRelation = await api(base, CLIENT_TOKEN_A, `/api/quotes/${quote.id}`, { method: 'PUT', body: JSON.stringify({ customerId: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', clientPhone: client.phone }) });
  assert.equal(invalidRelation.status, 400);
  assert.equal(database.rows('quotes').find(row => row.id === quote.id)?.customer_id, client.id);
  const spoofWorkspace = await api(base, CLIENT_TOKEN_B, '/api/quotes/list', { headers: { 'x-orkto-workspace': WORKSPACE_A } });
  assert.equal(spoofWorkspace.status, 403);
  assert.deepEqual((await api(base, CLIENT_TOKEN_B, '/api/deals').then(response => response.json()) as { data: Row[] }).data, []);
  assert.equal((await api(base, CLIENT_TOKEN_B, `/api/deals/${randomUUID()}`)).status, 404);
});

test('workspace invite acceptance is reachable without membership and cannot redeem a revoked token', async () => {
  resetDatabase();
  const base = await serve(app);
  const createInvite = async () => {
    const response = await api(base,CLIENT_TOKEN_A,'/api/team/invites',json({email:'new@example.test',role:'member'}));
    assert.equal(response.status,201);
    return await response.json() as {data:Row;invitePath:string};
  };

  const revoked = await createInvite();
  const revokedToken = new URL(revoked.invitePath,'https://orkto-staging.test').searchParams.get('token')!;
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/team/invites/${revoked.data.id}/revoke`,json({}))).status,200);
  assert.equal((await api(base,CLIENT_TOKEN_NO_WORKSPACE,'/api/team/invites/accept',json({token:revokedToken}))).status,404);
  assert.equal(database.rows('orkto_workspace_members').some(row=>row.user_id===USER_WITHOUT_WORKSPACE),false);

  const active = await createInvite();
  const token = new URL(active.invitePath,'https://orkto-staging.test').searchParams.get('token')!;
  assert.equal((await api(base,CLIENT_TOKEN_A_OTHER,'/api/team/invites/accept',json({token}))).status,403,
    'a token cannot be redeemed by a session with a different verified email');
  const accepted = await api(base,CLIENT_TOKEN_NO_WORKSPACE,'/api/team/invites/accept',json({token}));
  assert.equal(accepted.status,200,'a user without an existing workspace can join through a verified invitation');
  assert.equal((await accepted.json() as Row).workspaceId,WORKSPACE_A);
  assert.equal(database.rows('orkto_workspace_members').filter(row=>row.user_id===USER_WITHOUT_WORKSPACE&&row.workspace_id===WORKSPACE_A).length,1);
  assert.equal((await api(base,CLIENT_TOKEN_NO_WORKSPACE,'/api/team/invites/accept',json({token}))).status,200,
    'same-user retry recovers the already claimed invite without duplicate membership');
  assert.equal(database.rows('orkto_workspace_members').filter(row=>row.user_id===USER_WITHOUT_WORKSPACE&&row.workspace_id===WORKSPACE_A).length,1);
});

test('WIA fails closed when the authenticated user has no existing workspace membership', async () => {
  resetDatabase();
  const base = await serve(app);
  const response = await api(base, CLIENT_TOKEN_NO_WORKSPACE, '/api/wia/route-agent', json({ message: 'Olá WIA' }));
  assert.equal(response.status, 403);
  assert.match(String((await response.json() as Row).error), /workspace|membership/i);
  assert.equal(database.rows('orkto_workspaces').some(row => row.id === USER_WITHOUT_WORKSPACE), false);
  assert.equal(database.rows('orkto_workspace_members').some(row => row.user_id === USER_WITHOUT_WORKSPACE), false);
  assert.equal(database.rows('orkto_wia_runs').length, 0);
});

test('advanced HTTP flows persist report interpretation, memory corrections, collection approvals and replay provenance', async () => {
  resetDatabase();
  const pro = database.rows('orkto_plan_price_versions').find(row => row.plan_key === 'pro')!;
  pro.entitlements.limits = { ...pro.entitlements.limits, monthly_wia_runs:20 };
  const base = await serve(app);

  const reportResponse = await api(base,CLIENT_TOKEN_A,'/api/reports/generate',json({ reportType:'DAILY_OPERATIONAL',periodStart:'2026-09-26',periodEnd:'2026-09-27' }));
  assert.equal(reportResponse.status,201);
  const report = (await reportResponse.json() as { data:Row }).data;
  const metricsBefore = JSON.stringify(report.metrics);
  const interpreted = await api(base,CLIENT_TOKEN_A,`/api/reports/${report.id}/interpret`,json({}));
  assert.equal(interpreted.status,200);
  const reportContents = lastGeminiRequestContents as Array<{ parts?: Array<{ text?: string }> }>;
  const reportEnvelope = JSON.parse(reportContents.at(-1)?.parts?.[0]?.text || '{}') as Row;
  assert.deepEqual(reportEnvelope.operationalContext.reportMetrics,report.metrics,'WIA receives the calculated report metrics as its scoped context');
  assert.deepEqual(reportEnvelope.operationalContext.reportPeriod,{ start:report.period_start,end:report.period_end });
  assert.equal('openQuotes' in reportEnvelope.operationalContext,false,'report interpretation must not receive fabricated operational counters');
  const interpretation = await interpreted.json() as Row;
  assert.equal(interpretation.provider,'gemini');
  assert.equal(interpretation.metricsChanged,false);
  assert.equal(JSON.stringify(database.rows('orkto_reports').find(row => row.id === report.id)?.metrics),metricsBefore,'WIA interpretation cannot modify calculated metrics');
  assert.ok(database.rows('orkto_wia_runs').some(row => row.id === interpretation.runId && row.agent === 'reporting_agent' && row.status === 'succeeded'));

  const memoryResponse = await api(base,CLIENT_TOKEN_A,'/api/memories',json({ type:'preference',entityType:'customer',entityRef:'customer-memory-a',content:{ contactWindow:'morning' },provenance:{ source:'operator_note',sourceRef:'note-1' },confidence:0.9 }));
  assert.equal(memoryResponse.status,201);
  const memory = (await memoryResponse.json() as { data:Row }).data;
  assert.equal(memory.provenance.source,'operator_input','manual memory provenance must not impersonate trusted ingestion');
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/memories',json({ type:'raw_event',entityType:'workspace',entityRef:WORKSPACE_A,content:{event:'spoofed'},provenance:{source:'channel_message'} }))).status,403,
    'raw events are reserved for verified ingestion paths');
  const corrected = await api(base,CLIENT_TOKEN_A,`/api/memories/${memory.id}/correct`,json({ content:{ contactWindow:'afternoon' },provenance:{ source:'operator_correction',sourceRef:'note-2' },reason:'Preferência confirmada pela equipe.' }));
  assert.equal(corrected.status,201);
  const correctedBody = await corrected.json() as { data:Row; supersededId:string };
  assert.equal(correctedBody.supersededId,memory.id);
  assert.equal(database.rows('orkto_wia_memories').find(row => row.id === memory.id)?.status,'superseded');
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/memories/${correctedBody.data.id}/correct`,json({ content:{ bad:true },provenance:{ source:'test' },reason:'tenant check' }))).status,404);

  database.rows('orkto_feature_configs').push({ id:randomUUID(),workspace_id:WORKSPACE_A,feature_key:'collection_analyst',status:'ACTIVE',version:2,config:{ defaultTone:'cordial',targetCents:30000 } });
  const foreignCollectionDealId = randomUUID();
  database.rows('orkto_deals').push({ id:foreignCollectionDealId,workspace_id:WORKSPACE_B,customer_ref:'foreign',status:'open' });
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/collections',json({ customerRef:'customer-memory-a',dealId:foreignCollectionDealId,amountCents:30000,dueAt:new Date(Date.now()-86_400_000).toISOString(),tone:'cordial',idempotencyKey:'collection-cross-deal-01' }))).status,404);
  const caseResponse = await api(base,CLIENT_TOKEN_A,'/api/collections',json({ customerRef:'customer-memory-a',amountCents:30000,dueAt:new Date(Date.now()-86_400_000).toISOString(),tone:'cordial',idempotencyKey:'collection-case-a-01' }));
  assert.equal(caseResponse.status,201);
  const collectionCase = (await caseResponse.json() as { data:Row }).data;
  const prepared = await api(base,CLIENT_TOKEN_A,`/api/collections/${collectionCase.id}/prepare-contact`,json({}));
  assert.equal(prepared.status,201);
  const preparedBody = await prepared.json() as { data:Row; externalDelivery:string };
  assert.equal(preparedBody.externalDelivery,'CONFIGURATION_REQUIRED');
  assert.equal(preparedBody.data.status,'awaiting_approval');
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/collections/${collectionCase.id}/prepare-contact`,json({}))).status,404);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/wia/actions/${preparedBody.data.id}/approve`,json({confirm:true}))).status,404);
  const approved = await api(base,CLIENT_TOKEN_A,`/api/wia/actions/${preparedBody.data.id}/approve`,json({confirm:true}));
  assert.equal(approved.status,200);
  assert.equal((await approved.json() as Row).externalDelivery,'CONFIGURATION_REQUIRED');
  assert.equal(database.rows('orkto_messages').filter(row => row.direction === 'outgoing').length,0,'collection approval creates only an internal task; no false channel send');

  const conversationId = randomUUID();
  database.rows('orkto_conversations').push({ id:conversationId,workspace_id:WORKSPACE_A,contact_name:'Cliente Replay',contact_phone:'+5511999000044',status:'open' });
  const replayFirst = await api(base,CLIENT_TOKEN_A,'/api/replay',json({ conversationId,customerRef:'+5511999000044',objectionType:'preço',responseStrategy:'explicar valor',responseText:'O serviço inclui garantia e revisão.',outcome:'won',conversionResult:true,evidence:{ messageRef:'msg-1' } }));
  const replaySecond = await api(base,CLIENT_TOKEN_A,'/api/replay',json({ conversationId,customerRef:'+5511999000044',objectionType:'preço',responseStrategy:'explicar valor',responseText:'Posso dividir em duas vezes.',outcome:'lost',conversionResult:false,evidence:{ messageRef:'msg-2' } }));
  assert.equal(replayFirst.status,201); assert.equal(replaySecond.status,201);
  const replayBody = await replaySecond.json() as { data:Row; policy:string };
  const replay = replayBody.data;
  assert.equal(replay.version,2);
  assert.equal(replay.evidence.responseText,'Posso dividir em duas vezes.');
  assert.equal(replayBody.policy,'recommendation_only_no_global_policy_mutation');
  const ownReplayHistory = await api(base,CLIENT_TOKEN_A,'/api/replay');
  assert.equal(((await ownReplayHistory.json() as { data:Row[] }).data).length,2);
  const foreignReplaySummary = await api(base,CLIENT_TOKEN_B,'/api/replay/summary');
  assert.equal((await foreignReplaySummary.json() as Row).data.length,0);
  assert.equal(((await (await api(base,CLIENT_TOKEN_B,'/api/replay')).json() as { data:Row[] }).data).length,0);
  assert.equal(database.rows('orkto_wia_events').some(row => row.event_type === 'replay.recorded' && row.entity_ref === replay.id),true);

  const wrappedGenerated = await api(base,CLIENT_TOKEN_A,'/api/wrapped/generate',json({ periodStart:'2026-09-01',periodEnd:'2026-09-27' }));
  assert.equal(wrappedGenerated.status,201);
  const wrapped = (await wrappedGenerated.json() as { data:Row }).data;
  assert.equal(((await (await api(base,CLIENT_TOKEN_A,'/api/wrapped')).json() as { data:Row[] }).data).length,1);
  assert.equal(((await (await api(base,CLIENT_TOKEN_B,'/api/wrapped')).json() as { data:Row[] }).data).length,0);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/wrapped/${wrapped.id}/share`,json({ confirmShare:true }))).status,404,'a workspace cannot distinguish another tenant Wrapped ID from an absent record');
  const shareWrapped = await api(base,CLIENT_TOKEN_A,`/api/wrapped/${wrapped.id}/share`,json({ confirmShare:true }));
  assert.equal(shareWrapped.status,200);
  const frozenMetrics = JSON.stringify(database.rows('orkto_wrapped').find(row=>row.id===wrapped.id)?.metrics);
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/wrapped/generate',json({ periodStart:'2026-09-01',periodEnd:'2026-09-27' }))).status,409,
    'a shared Wrapped snapshot cannot be regenerated or changed');
  assert.equal(JSON.stringify(database.rows('orkto_wrapped').find(row=>row.id===wrapped.id)?.metrics),frozenMetrics);
  const shareBody = await shareWrapped.json() as { publicPath:string };
  assert.match(shareBody.publicPath,/^\/orkto-wrapped\//);
  assert.equal(database.rows('orkto_wia_events').some(row => row.event_type === 'wrapped.shared' && row.entity_ref === wrapped.id),true);
  const publicWrapped = await api(base,'',`/api/public/wrapped/${shareBody.publicPath.split('/').at(-1)}`);
  assert.equal(publicWrapped.status,200);
  assert.equal((await publicWrapped.json() as Row).period_start,'2026-09-01');

  const generatedCase = await api(base,CLIENT_TOKEN_A,'/api/case-studies/generate',json({ baselineStart:'2026-01-01',baselineEnd:'2026-01-30',afterStart:'2026-01-31',afterEnd:'2026-03-01' }));
  assert.equal(generatedCase.status,201);
  const study = (await generatedCase.json() as { data:Row }).data;
  assert.equal(((await (await api(base,CLIENT_TOKEN_A,'/api/case-studies')).json() as { data:Row[] }).data).length,1);
  assert.equal(((await (await api(base,CLIENT_TOKEN_B,'/api/case-studies')).json() as { data:Row[] }).data).length,0);
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/case-studies/${study.id}/review`,json({ decision:'approve',note:'Dados conferidos.' }))).status,200);
  const blockedOptIn = await api(base,CLIENT_TOKEN_A,`/api/case-studies/${study.id}/opt-in`,json({ confirmConsent:true }));
  assert.equal(blockedOptIn.status,423,'public case study stays blocked until legal approval');
  assert.equal(database.rows('orkto_case_studies').find(row => row.id === study.id)?.status,'approved','blocked opt-in must not create an unusable public token or mutate publication status');

  const stagedMemory = await api(base,CLIENT_TOKEN_A,'/api/collective-memory/contributions',json({ confirmStage:true,sectorKey:'automotive',patternKey:'quote_acceptance',periodStart:'2026-09-01',periodEnd:'2026-09-27' }));
  assert.equal(stagedMemory.status,201);
  const stagedMemoryBody = await stagedMemory.json() as { data:Row; activation:string };
  assert.equal(stagedMemoryBody.data.consent_status,'disabled','workspace aggregate remains private until an explicit legal gate allows opt-in');
  assert.equal(stagedMemoryBody.activation,'BLOCKED_LEGAL_ACTIVATION');
  assert.equal(((await (await api(base,CLIENT_TOKEN_A,'/api/collective-memory')).json() as { data:Row[] }).data).length,1);
  assert.equal(((await (await api(base,CLIENT_TOKEN_B,'/api/collective-memory')).json() as { data:Row[] }).data).length,0,'workspace summaries remain tenant-local before consent');
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/collective-memory/contributions/${stagedMemoryBody.data.id}/consent`,json({ confirmConsent:true }))).status,423);
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/collective-memory/patterns')).status,423);
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/internal/collective-memory/aggregate',json({}))).status,423);
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/features/collective_memory',{ method:'PUT',body:JSON.stringify({ status:'ACTIVE',config:{} }) })).status,423);
});

test('advanced scheduler gates, cadence cancellation, repurchase threshold and live-quote terminal state are enforced', async () => {
  resetDatabase();
  const base = await serve(app);
  const now = Date.now();
  const quoteId = randomUUID();
  database.rows('quotes').push({ id:quoteId,workspace_id:WORKSPACE_A,user_id:USER_A,status:'sent',client_name:'Cliente Recuperação',client_phone:'+5511999000077',created_at:new Date(now).toISOString(),retention_expires_at:null,items:[{ name:'Revisão técnica',catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',quantity:1,unitPrice:125,discount:0 }],subtotal:125,discount_total:0,taxes:0,total:125,valid_value_days:30 });
  database.rows('orkto_feature_configs').push({ id:randomUUID(),workspace_id:WORKSPACE_A,feature_key:'proposal_recovery',status:'ACTIVE',config:{ cadenceDays:[1,4,10,30,90] } });
  const scheduled = await api(base,CLIENT_TOKEN_A,`/api/automations/proposal-recovery/${quoteId}/schedule`,json({ enabled:true }));
  assert.equal(scheduled.status,201);
  assert.deepEqual(((await scheduled.json() as { data:Row[] }).data).map(job => job.step_key),['D+1','D+4','D+10','D+30','D+90']);
  const foreignCadence = await api(base,CLIENT_TOKEN_B,`/api/automations/proposal-recovery/${quoteId}`,{ method:'GET' });
  assert.equal(foreignCadence.status,200);
  assert.deepEqual((await foreignCadence.json() as { data:Row[] }).data,[],'foreign workspace cannot see the recovery jobs');
  const cancelled = await api(base,CLIENT_TOKEN_A,`/api/automations/proposal-recovery/${quoteId}/cancel`,json({}));
  assert.equal(cancelled.status,200);
  assert.ok(database.rows('orkto_automation_jobs').filter(job => job.entity_ref === quoteId).every(job => job.status === 'cancelled'));

  const customerRef = '+5511999000088';
  const customerId = randomUUID();
  database.rows('clients').push({ id:customerId,workspace_id:WORKSPACE_A,user_id:USER_A,name:'Cliente Recorrente',phone:customerRef,archived_at:null });
  database.rows('orkto_feature_configs').push({ id:randomUUID(),workspace_id:WORKSPACE_A,feature_key:'repurchase_reactivation',status:'ACTIVE',config:{ minimumConfidence:0.65 } });
  for (const daysAgo of [150,120,90,60]) database.rows('orkto_purchases').push({ id:randomUUID(),workspace_id:WORKSPACE_A,customer_ref:customerId,product_ref:'oil',product_name:'Óleo',amount_cents:5000,purchased_at:new Date(now-daysAgo*86_400_000).toISOString() });
  const repurchaseView = await api(base,CLIENT_TOKEN_A,`/api/customers/${customerId}/repurchase`);
  assert.equal(repurchaseView.status,200);
  assert.equal(((await repurchaseView.json() as { data:Row }).data).eligible,true);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/customers/${customerId}/repurchase`)).status,404,'customer history cannot be read from another workspace');
  const repurchase = await api(base,CLIENT_TOKEN_A,`/api/automations/repurchase/${encodeURIComponent(customerRef)}/schedule`,json({ confirm:true,productRef:'oil' }));
  assert.equal(repurchase.status,201);
  const repurchaseBody = await repurchase.json() as { data:Row; estimate:Row };
  assert.ok(Number(repurchaseBody.estimate.confidence) >= 0.65);
  assert.equal(repurchaseBody.data.entity_ref,customerId,'phone aliases resolve to the workspace customer ID before persistence');
  const queuedAction = { id:randomUUID(),workspace_id:WORKSPACE_A,action_type:'prepare_repurchase_followup',payload:{ customerRef:customerId,productRef:'oil' },status:'awaiting_approval' };
  database.rows('orkto_wia_actions').push(queuedAction);
  const durableSchedule = await api(base,CLIENT_TOKEN_A,`/api/automations/repurchase/${customerId}`);
  assert.equal((await durableSchedule.json() as { data:Row[] }).data.some(job => job.id === repurchaseBody.data.id),true,'scheduled state can be reloaded after refresh');
  const stop = await api(base,CLIENT_TOKEN_A,`/api/automations/repurchase/${encodeURIComponent(customerRef)}/cancel`,json({ productRef:'oil' }));
  assert.equal(stop.status,200);
  assert.equal(database.rows('orkto_automation_jobs').find(job => job.entity_ref === customerId)?.status,'cancelled');
  assert.equal(queuedAction.status,'cancelled','cancellation also removes an unexecuted approval draft');
  const untrustedPurchase = await api(base,CLIENT_TOKEN_B,'/api/purchases',json({ customerRef:customerId,productRef:'oil',productName:'Óleo',quantity:1,amountCents:5000,purchasedAt:new Date(now-10*86_400_000).toISOString(),idempotencyKey:'foreign-purchase-01' }));
  assert.equal(untrustedPurchase.status,400,'a purchase reference from another workspace is rejected');

  const createdDeal = await api(base,CLIENT_TOKEN_A,'/api/deals',json({ title:'Fechar cancela follow-up',stage:'proposal',valueCents:12500 }));
  assert.equal(createdDeal.status,201);
  const closeDeal = (await createdDeal.json() as { data:Row }).data;
  const closeQuoteId = randomUUID();
  database.rows('quotes').push({ id:closeQuoteId,workspace_id:WORKSPACE_A,user_id:USER_A,deal_id:closeDeal.id,status:'sent',client_name:'Cliente Fechamento',client_phone:'+5511999000078',created_at:new Date(now).toISOString(),items:[{ name:'Revisão técnica',catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',quantity:1,unitPrice:125,discount:0 }],subtotal:125,discount_total:0,taxes:0,total:125,valid_value_days:30 });
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/automations/proposal-recovery/${closeQuoteId}/schedule`,json({ enabled:true }))).status,201);
  const closeAction = { id:randomUUID(),workspace_id:WORKSPACE_A,action_type:'send_proposal_followup',payload:{ quoteId:closeQuoteId },status:'awaiting_approval' };
  database.rows('orkto_wia_actions').push(closeAction);
  const closeDealUpdated = await api(base,CLIENT_TOKEN_A,`/api/deals/${closeDeal.id}`,{ ...json({ stage:'won' }),method:'PATCH' });
  assert.equal(closeDealUpdated.status,200,await closeDealUpdated.text());
  assert.ok(database.rows('orkto_automation_jobs').filter(job => job.entity_ref === closeQuoteId).every(job => job.status === 'cancelled'),'closing a deal cancels its recovery cadence');
  assert.equal(closeAction.status,'cancelled','closing a deal cancels an unexecuted proposal-follow-up action');

  const liveQuoteId = randomUUID();
  database.rows('quotes').push({ id:liveQuoteId,workspace_id:WORKSPACE_A,user_id:USER_A,status:'sent',client_name:'Cliente Live',client_company:'Empresa A',client_vehicle_or_service:'Revisão',client_phone:'+5511999000099',items:[{ name:'Revisão técnica',catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',quantity:1,unitPrice:125,discount:0 }],subtotal:125,discount_total:0,taxes:0,total:125,notes:'',payment_instructions:'',valid_value_days:30,created_at:new Date(now).toISOString() });
  const liveCreated = await api(base,CLIENT_TOKEN_A,`/api/live-quotes/from-quote/${liveQuoteId}`,json({}));
  assert.equal(liveCreated.status,201);
  const liveBody = await liveCreated.json() as { data:Row; token:string };
  database.rows('orkto_automation_jobs').push({ id:randomUUID(),workspace_id:WORKSPACE_A,entity_type:'quote',entity_ref:liveQuoteId,step_key:'D+1',status:'scheduled',idempotency_key:`live-cancel:${liveQuoteId}` });
  database.rows('orkto_wia_actions').push({ id:randomUUID(),workspace_id:WORKSPACE_A,action_type:'send_proposal_followup',payload:{ quoteId:liveQuoteId },status:'awaiting_approval' });
  const opened = await api(base,CLIENT_TOKEN_A,`/api/public/live-quotes/${liveBody.token}`,{ method:'GET' });
  assert.equal(opened.status,200);
  const reject = await api(base,CLIENT_TOKEN_A,`/api/public/live-quotes/${liveBody.token}/reject`,json({ reason:'Cliente recusou a condição.' }));
  assert.equal(reject.status,200);
  assert.equal(database.rows('orkto_live_quotes').find(row => row.id === liveBody.data.id)?.status,'rejected');
  assert.equal(database.rows('quotes').find(row => row.id === liveQuoteId)?.status,'rejected');
  assert.ok(database.rows('orkto_automation_jobs').find(job => job.entity_ref === liveQuoteId)?.status === 'cancelled');
  assert.ok(database.rows('orkto_wia_actions').find(action => action.action_type === 'send_proposal_followup' && action.payload.quoteId === liveQuoteId)?.status === 'cancelled');
  assert.equal(database.rows('orkto_messages').filter(row => row.direction === 'outgoing').length,0,'cadence and public status changes never fake a channel send');
});

test('accounting export persists an idempotent structured record and stays blocked without a configured adapter', async () => {
  resetDatabase();
  const quoteId = randomUUID();
  database.rows('quotes').push({ id:quoteId,workspace_id:WORKSPACE_A,user_id:USER_A,status:'approved',client_name:'Cliente Contábil',items:[{ name:'Serviço',quantity:2,unitPrice:125 }],total:250,approved_at:'2026-09-27T10:00:00.000Z',updated_at:'2026-09-27T10:00:00.000Z' });
  const base = await serve(app);
  const exportSale = () => api(base,CLIENT_TOKEN_A,`/api/accounting/exports/from-quote/${quoteId}`,json({ paymentMethod:'pix',paymentStatus:'paid',idempotencyKey:'accounting-export-quote-1' }));
  const response = await exportSale();
  assert.equal(response.status,201);
  const body = await response.json() as Row;
  assert.equal(body.delivery,'CONFIGURATION_REQUIRED');
  assert.equal(body.data.status,'configuration_required');
  assert.equal(body.data.adapter,'unconfigured');
  assert.equal(body.data.payload.amountCents,25000);
  assert.equal(body.data.payload.items[0].unitPriceCents,12500);
  assert.equal(database.rows('orkto_accounting_exports').length,1);
  const replay = await exportSale();
  assert.equal(replay.status,200);
  assert.equal((await replay.json() as Row).idempotentReplay,true);
  assert.equal(database.rows('orkto_accounting_exports').length,1,'replay cannot duplicate the export record or trigger a second delivery');
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/accounting/exports/from-quote/${quoteId}`,json({ idempotencyKey:'accounting-export-foreign-1' }))).status,404);
});

test('automatic Replay captures only eligible closed-deal conversations and is idempotent across tenants', async () => {
  resetDatabase();
  const base = await serve(app);
  const now = Date.now();
  const makeSample = async (index:number, outcome:'won'|'lost', objection = true) => {
    const customerResponse = await api(base,CLIENT_TOKEN_A,'/api/clients',json({ name:`Replay ${index}`,phone:`+55119990001${String(index).padStart(2,'0')}` }));
    assert.equal(customerResponse.status,201);
    const customer = (await customerResponse.json() as {data:Row}).data;
    const conversationId = randomUUID();
    database.rows('orkto_conversations').push({ id:conversationId,workspace_id:WORKSPACE_A,customer_id:customer.id,contact_name:customer.name,contact_phone:customer.phone,status:'closed' });
    const conversationMessages = objection ? [
      { id:randomUUID(),workspace_id:WORKSPACE_A,conversation_id:conversationId,direction:'incoming',content:'Achei caro. Há outra opção?',sent_at:new Date(now-120_000).toISOString() },
      { id:randomUUID(),workspace_id:WORKSPACE_A,conversation_id:conversationId,direction:'outgoing',content:'Podemos dividir em duas parcelas.',sent_at:new Date(now-60_000).toISOString() },
    ] : [{ id:randomUUID(),workspace_id:WORKSPACE_A,conversation_id:conversationId,direction:'incoming',content:'Olá, tudo bem?',sent_at:new Date(now-120_000).toISOString() }];
    database.rows('orkto_messages').push(...conversationMessages);
    const created = await api(base,CLIENT_TOKEN_A,'/api/deals',json({ title:`Deal Replay ${index}`,customerRef:customer.id,conversationRef:conversationId,stage:'negotiation',valueCents:5000 }));
    assert.equal(created.status,201);
    const deal = (await created.json() as {data:Row}).data;
    const closed = await api(base,CLIENT_TOKEN_A,`/api/deals/${deal.id}`,{ ...json({stage:outcome}),method:'PATCH' });
    assert.equal(closed.status,200);
    return deal.id as string;
  };

  const wonDealIds = [await makeSample(1,'won'),await makeSample(2,'won'),await makeSample(3,'lost')];
  const ineligibleDealId = await makeSample(4,'won',false);
  const jobsBefore = database.rows('orkto_automation_jobs').filter(row=>row.entity_type==='replay_capture');
  assert.equal(jobsBefore.length,4,'closed deals with a conversation enqueue one idempotent local capture job each');
  const dispatched = await fetch(`${base}/api/cron/automation-dispatch`,{headers:{authorization:'Bearer test-only-cron-secret'}});
  assert.equal(dispatched.status,200);
  assert.deepEqual(await dispatched.json(),{scanned:4,prepared:0,captured:3,skipped:1,failed:0});
  const captured = database.rows('orkto_replay_records');
  assert.equal(captured.length,3);
  assert.deepEqual(captured.map(row=>row.outcome).sort(),['lost','won','won']);
  assert.ok(captured.every(row=>row.evidence?.provenance?.source==='automatic_deal_outcome' && row.evidence?.objectionMessageId && row.evidence?.responseMessageId));
  assert.ok(captured.some(row=>row.recommendation?.eligibleForRecommendation===true),'a recommendation is created after the workspace reaches the minimum sample size');
  assert.equal(database.rows('orkto_wia_memories').filter(row=>row.memory_type==='commercial_pattern' && row.workspace_id===WORKSPACE_A).length,1);
  assert.equal(database.rows('orkto_automation_runs').find(row=>row.job_id===jobsBefore.find(row=>row.entity_ref===ineligibleDealId)?.id)?.result.reason,'no_objection_response_pair');
  assert.equal((await api(base,CLIENT_TOKEN_A,'/api/replay')).status,200);
  assert.equal(((await (await api(base,CLIENT_TOKEN_A,'/api/replay')).json() as {data:Row[]}).data).length,3);
  assert.equal(((await (await api(base,CLIENT_TOKEN_B,'/api/replay')).json() as {data:Row[]}).data).length,0,'Replay history is workspace-isolated');
  const repeatClose = await api(base,CLIENT_TOKEN_A,`/api/deals/${wonDealIds[0]}`,{...json({stage:'won'}),method:'PATCH'});
  assert.equal(repeatClose.status,200);
  const repeatDispatch = await fetch(`${base}/api/cron/automation-dispatch`,{headers:{authorization:'Bearer test-only-cron-secret'}});
  assert.deepEqual(await repeatDispatch.json(),{scanned:0,prepared:0,captured:0,skipped:0,failed:0});
  assert.equal(database.rows('orkto_replay_records').length,3,'reprocessing the same closed outcome does not duplicate a replay capture');
});

test('commercial Graph emits only evidence-backed workspace-local edges and navigable record IDs', async () => {
  resetDatabase();
  const base = await serve(app);
  const addClient = async (token:string,name:string,phone:string) => {
    const response = await api(base,token,'/api/clients',json({name,phone,company:'Oficina Norte'}));
    assert.equal(response.status,201);
    return (await response.json() as {data:Row}).data;
  };
  const referrer = await addClient(CLIENT_TOKEN_A,'Origem','+5511999000201');
  const customer = await addClient(CLIENT_TOKEN_A,'Indicado','+5511999000202');
  const foreign = await addClient(CLIENT_TOKEN_B,'Outra empresa','+5511999000203');
  const conversationId = randomUUID();
  database.rows('orkto_conversations').push({id:conversationId,workspace_id:WORKSPACE_A,customer_id:customer.id,contact_name:customer.name,contact_phone:customer.phone,status:'open'});
  const dealResponse = await api(base,CLIENT_TOKEN_A,'/api/deals',json({title:'Indicação real',customerRef:customer.id,conversationRef:conversationId,source:referrer.id,stage:'qualification',valueCents:9000}));
  assert.equal(dealResponse.status,201);
  const deal = (await dealResponse.json() as {data:Row}).data;
  const quoteResponse = await api(base,CLIENT_TOKEN_A,'/api/quotes',json({clientName:customer.name,clientPhone:customer.phone,customerId:customer.id,dealId:deal.id,items:[{id:'line',catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',name:'Revisão',quantity:1,unitPrice:999,discount:0}]}));
  assert.ok([200,201].includes(quoteResponse.status));
  const quote = await quoteResponse.json() as Row;

  const graphResponse = await api(base,CLIENT_TOKEN_A,'/api/graph');
  assert.equal(graphResponse.status,200);
  const graph = await graphResponse.json() as {workspaceId:string;nodes:Row[];edges:Row[];clusters:Row[]};
  assert.equal(graph.workspaceId,WORKSPACE_A);
  assert.ok(graph.edges.some(edge=>edge.type==='CUSTOMER_REFERRAL' && edge.source===`customer:${referrer.id}` && edge.target===`customer:${customer.id}`));
  assert.ok(graph.edges.some(edge=>edge.type==='DEAL_ORIGIN' && edge.target===`deal:${deal.id}`));
  assert.ok(graph.edges.some(edge=>edge.type==='DEAL_PROPOSAL' && edge.source===`deal:${deal.id}` && edge.target===`proposal:${quote.id}`));
  assert.ok(graph.edges.some(edge=>edge.type==='SUPPORTED_SIMILARITY' && edge.provenance?.field==='company'));
  assert.ok(graph.edges.every(edge=>edge.workspaceId===WORKSPACE_A && edge.provenance && !String(edge.source).includes(foreign.id) && !String(edge.target).includes(foreign.id)));
  assert.ok(graph.nodes.every(node=>node.workspaceId===WORKSPACE_A && node.entityRef!==foreign.id));
  const foreignGraph = await api(base,CLIENT_TOKEN_B,'/api/graph');
  assert.equal(foreignGraph.status,200);
  assert.equal(((await foreignGraph.json() as {nodes:Row[]}).nodes.some(node=>node.entityRef===customer.id)),false,'a workspace cannot navigate to another workspace records');
});

test('Quote retention extension is workspace-scoped, idempotent and rejects stale expiry', async () => {
  resetDatabase();
  const base=await serve(app);
  const current=new Date(Date.now()+7*86_400_000).toISOString();
  const quoteId=randomUUID();
  database.rows('quotes').push({id:quoteId,workspace_id:WORKSPACE_A,user_id:USER_A,
    status:'sent',sent_at:new Date().toISOString(),retention_expires_at:current,
    archived_at:null});
  const path=`/api/quotes/${quoteId}/extend`;
  assert.equal((await api(base,CLIENT_TOKEN_B,path,json({expectedExpiry:current}))).status,404);
  const key='quote-extension-12345678';
  const extend=await api(base,CLIENT_TOKEN_A,path,{
    ...json({expectedExpiry:current}),headers:{'content-type':'application/json','x-idempotency-key':key},
  });
  assert.equal(extend.status,200);
  const expiresAt=(await extend.json() as {expiresAt:string}).expiresAt;
  assert.equal(new Date(expiresAt).getTime()-new Date(current).getTime(),14*86_400_000);
  const replay=await api(base,CLIENT_TOKEN_A,path,{
    ...json({expectedExpiry:current}),headers:{'content-type':'application/json','x-idempotency-key':key},
  });
  assert.equal(replay.status,200);
  assert.equal((await replay.json() as {expiresAt:string}).expiresAt,expiresAt);
  assert.equal((await api(base,CLIENT_TOKEN_A,path,json({expectedExpiry:current}))).status,409);
  assert.equal(database.rows('orkto_wia_events').filter(row=>row.event_type==='quote.retention_extended').length,1);
  assert.equal((await api(base,CLIENT_TOKEN_A,path,json({expectedExpiry:current,workspace_id:WORKSPACE_B}))).status,400);
});

test('universal import pipeline previews, validates, commits, deduplicates and compensates entity types', async () => {
  resetDatabase();
  const base = await serve(app);
  const customerResponse = await api(base,CLIENT_TOKEN_A,'/api/clients',json({name:'Import Customer',phone:'+5511999000301',company:'Oficina Norte'}));
  assert.equal(customerResponse.status,201);
  const customer = (await customerResponse.json() as {data:Row}).data;

  const contactsPreview = await api(base,CLIENT_TOKEN_A,'/api/imports/preview',json({
    source:'contacts.csv',entityType:'contacts',mapping:{fullName:'name',phone:'phone',customerRef:'customer'},rows:[
      {name:'Contato Importado',phone:'+5511999000302',customer:customer.id},
      {name:'Duplicado',phone:'+55 11 99900 0302',customer:customer.id},
    ],
  }));
  assert.equal(contactsPreview.status,201);
  const contactsPreviewBody = (await contactsPreview.json() as {data:{job:Row;rows:Row[]}}).data;
  assert.deepEqual(contactsPreviewBody.rows.map(row=>row.status),['valid','duplicate']);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/imports/${contactsPreviewBody.job.id}/commit`,json({}))).status,404);
  const contactsCommit = await api(base,CLIENT_TOKEN_A,`/api/imports/${contactsPreviewBody.job.id}/commit`,json({}));
  assert.equal(contactsCommit.status,200);
  assert.equal(database.rows('orkto_contacts').filter(row=>row.workspace_id===WORKSPACE_A).length,1);
  assert.equal(((await contactsCommit.json() as Row).imported),1);
  const contactsReplay = await api(base,CLIENT_TOKEN_A,`/api/imports/${contactsPreviewBody.job.id}/commit`,json({}));
  assert.equal((await contactsReplay.json() as Row).idempotentReplay,true);
  assert.equal(database.rows('orkto_contacts').length,1,'refresh/retry does not duplicate committed contacts');
  assert.equal((await api(base,CLIENT_TOKEN_A_RECIPIENT,`/api/imports/${contactsPreviewBody.job.id}/rollback`,json({}))).status,403,'a member cannot compensate another actor\'s import');
  assert.equal(database.rows('orkto_contacts').length,1);
  const contactsRollback = await api(base,CLIENT_TOKEN_A,`/api/imports/${contactsPreviewBody.job.id}/rollback`,json({}));
  assert.deepEqual(await contactsRollback.json(),{removed:1,conflicts:[],status:'rolled_back'});
  assert.equal(database.rows('orkto_contacts').length,0,'unchanged contact import is compensatable');

  const proposalPreview = await api(base,CLIENT_TOKEN_A,'/api/imports/preview',json({
    source:'proposals.csv',entityType:'proposals',mapping:{customerRef:'customer',quoteNumber:'number',validDays:'days',items:'items'},rows:[
      {customer:customer.id,number:'IMP-QUOTE-01',days:45,items:[{catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',quantity:2,unitPrice:1}]},
    ],
  }));
  assert.equal(proposalPreview.status,201);
  const proposalJob = ((await proposalPreview.json() as {data:{job:Row}}).data).job;
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/imports/${proposalJob.id}/commit`,json({}))).status,200);
  const importedQuote = database.rows('quotes').find(row=>row.orkto_import_job_id===proposalJob.id)!;
  assert.equal(importedQuote.workspace_id,WORKSPACE_A);
  assert.equal(importedQuote.customer_id,customer.id);
  assert.equal(importedQuote.items[0].unitPrice,125,'imported proposal price is resolved from this workspace catalog');
  assert.equal(importedQuote.total,250);
  assert.equal(importedQuote.valid_value_days,45);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/quotes/detail/${importedQuote.id}`)).status,404);
  const proposalRollback = await api(base,CLIENT_TOKEN_A,`/api/imports/${proposalJob.id}/rollback`,json({}));
  assert.deepEqual(await proposalRollback.json(),{removed:1,conflicts:[],status:'rolled_back'});
  assert.ok(database.rows('quotes').find(row=>row.id===importedQuote.id)?.archived_at,'proposal compensation archives the unchanged imported quote instead of deleting its history');

  const foreignCustomer = await api(base,CLIENT_TOKEN_B,'/api/clients',json({name:'Foreign customer',phone:'+5511999000399'}));
  assert.equal(foreignCustomer.status,201);
  const foreignId = ((await foreignCustomer.json() as {data:Row}).data).id;
  const commercialPreview = await api(base,CLIENT_TOKEN_A,'/api/imports/preview',json({
    source:'deals.csv',entityType:'commercial_records',mapping:{customerRef:'customer',title:'title',stage:'stage',valueCents:'value',externalRef:'external'},rows:[
      {customer:customer.id,title:'Imported deal',stage:'qualification',value:9000,external:'external-1'},
      {customer:foreignId,title:'Cross-tenant should fail',stage:'qualification',value:9000,external:'external-2'},
    ],
  }));
  assert.equal(commercialPreview.status,201);
  const commercialJob = ((await commercialPreview.json() as {data:{job:Row;rows:Row[]}}).data);
  assert.deepEqual(commercialJob.rows.map(row=>row.status),['valid','valid'],'preview validates shape; the authoritative workspace relation is checked again on commit');
  const partialCommit = await api(base,CLIENT_TOKEN_A,`/api/imports/${commercialJob.job.id}/commit`,json({}));
  assert.equal(partialCommit.status,400,'a foreign customer relation is reported as validation failure and aborts further writes');
  assert.equal((await partialCommit.clone().json() as Row).category,'tenant_validation_error');
  assert.equal(database.rows('orkto_deals').filter(row=>row.orkto_import_job_id===commercialJob.job.id).length,1);
  assert.equal(database.rows('orkto_import_jobs').find(row=>row.id===commercialJob.job.id)?.status,'failed');
  const importedDeal = database.rows('orkto_deals').find(row=>row.orkto_import_job_id===commercialJob.job.id)!;
  importedDeal.title = 'Edited by operator after partial import';
  const retryCommit = await api(base,CLIENT_TOKEN_A,`/api/imports/${commercialJob.job.id}/commit`,json({}));
  assert.equal(retryCommit.status,400,'retry still stops at the foreign-customer row');
  assert.equal(database.rows('orkto_deals').find(row=>row.id===importedDeal.id)?.title,'Edited by operator after partial import',
    'retry reuses the import-linked record instead of overwriting subsequent operator edits');
  importedDeal.title = 'Imported deal';
  const compensation = await api(base,CLIENT_TOKEN_A,`/api/imports/${commercialJob.job.id}/rollback`,json({}));
  assert.deepEqual(await compensation.json(),{removed:1,conflicts:[],status:'rolled_back'});
  assert.equal(database.rows('orkto_deals').find(row=>row.orkto_import_job_id===commercialJob.job.id)?.status,'archived');
  assert.equal(database.rows('orkto_deals').some(row=>row.customer_ref===foreignId && row.orkto_import_job_id===commercialJob.job.id),false);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/imports/${commercialJob.job.id}/rollback`,json({}))).status,404);
});

test('import compensation finds a durable entity when the import-row state write failed', async () => {
  resetDatabase();
  const base = await serve(app);
  const preview = await api(base,CLIENT_TOKEN_A,'/api/imports/preview',json({
    source:'customers.csv',entityType:'customers',mapping:{name:'name',phone:'phone'},rows:[
      {name:'Retry-safe customer',phone:'+5511999000991'},
    ],
  }));
  assert.equal(preview.status,201);
  const job = ((await preview.json() as {data:{job:Row}}).data).job;
  database.beforePatch = (table,body) => {
    if (table === 'orkto_import_rows' && body.status === 'imported') throw new Error('simulated import-row persistence outage');
  };
  const commit = await api(base,CLIENT_TOKEN_A,`/api/imports/${job.id}/commit`,json({}));
  assert.equal(commit.status,503,'failed persistence is surfaced as an unavailable dependency, not success');
  const created = database.rows('clients').find(row=>row.orkto_import_job_id===job.id);
  assert.ok(created,'entity insert completed before import-row state persistence failed');
  assert.equal(database.rows('orkto_import_rows').find(row=>row.job_id===job.id)?.status,'valid');
  const rollback = await api(base,CLIENT_TOKEN_A,`/api/imports/${job.id}/rollback`,json({}));
  assert.deepEqual(await rollback.json(),{removed:1,conflicts:[],status:'rolled_back'});
  assert.equal(database.rows('clients').some(row=>row.orkto_import_job_id===job.id),false,
    'compensation locates the row-linked entity even though the row never reached imported status');
  assert.equal(database.rows('orkto_import_rows').find(row=>row.job_id===job.id)?.status,'rolled_back');
});

test('live quote versions keep accepted snapshots immutable and revoke obsolete or expired links', async () => {
  resetDatabase();
  const base = await serve(app);
  const customerResponse = await api(base,CLIENT_TOKEN_A,'/api/clients',json({name:'Live version customer',phone:'+5511999000401'}));
  const customer = (await customerResponse.json() as {data:Row}).data;
  const quoteResponse = await api(base,CLIENT_TOKEN_A,'/api/quotes',json({clientName:customer.name,clientPhone:customer.phone,customerId:customer.id,items:[{id:'line',catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',name:'Stale name',quantity:1,unitPrice:125,discount:0}]}));
  assert.ok([200,201].includes(quoteResponse.status));
  const quote = await quoteResponse.json() as Row;
  const firstLinkResponse = await api(base,CLIENT_TOKEN_A,`/api/live-quotes/from-quote/${quote.id}`,json({}));
  assert.equal(firstLinkResponse.status,201);
  const firstLink = await firstLinkResponse.json() as {data:Row;token:string};
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/live-quotes/from-quote/${quote.id}`,json({}))).status,404,
    'workspace B cannot mint a public token for workspace A quote');
  assert.equal((await api(base,'',`/api/public/live-quotes/${randomUUID()}`,{method:'GET'})).status,404,
    'arbitrary public token cannot select a quote');
  const update = await api(base,CLIENT_TOKEN_A,`/api/quotes/${quote.id}`,{method:'PUT',body:JSON.stringify({notes:'Condição atualizada'})});
  assert.equal(update.status,200);
  assert.equal(database.rows('orkto_live_quotes').find(row=>row.id===firstLink.data.id)?.status,'revoked');
  assert.equal((await api(base,'',`/api/public/live-quotes/${firstLink.token}`,{method:'GET'})).status,404);
  const secondLinkResponse = await api(base,CLIENT_TOKEN_A,`/api/live-quotes/from-quote/${quote.id}`,json({}));
  assert.equal(secondLinkResponse.status,201);
  const secondLink = await secondLinkResponse.json() as {data:Row;token:string};
  assert.equal(secondLink.data.version,2);
  assert.equal(secondLink.data.snapshot.notes,'Condição atualizada');
  const changedSource = database.rows('quotes').find(row=>row.id===quote.id)!;
  changedSource.items=structuredClone(changedSource.items);
  changedSource.items[0].quantity=2;
  changedSource.subtotal=250;changedSource.total=250;
  changedSource.updated_at='2026-09-28T23:59:59.999Z';
  const accept = () => api(base,'',`/api/public/live-quotes/${secondLink.token}/accept`,json({customerName:'Cliente'}));
  const concurrentAccept = await accept();
  assert.equal(concurrentAccept.status,409,await concurrentAccept.clone().text());
  assert.equal(database.rows('orkto_live_quotes').find(row=>row.id===secondLink.data.id)?.status,'revoked');
  assert.equal(database.rows('quotes').find(row=>row.id===quote.id)?.status,'sent','the stale acceptance cannot approve newly edited terms');

  const thirdLinkResponse = await api(base,CLIENT_TOKEN_A,`/api/live-quotes/from-quote/${quote.id}`,json({}));
  assert.equal(thirdLinkResponse.status,201);
  const thirdLink = await thirdLinkResponse.json() as {data:Row;token:string};
  const acceptCurrent = () => api(base,'',`/api/public/live-quotes/${thirdLink.token}/accept`,json({customerName:'Cliente'}));
  const accepted = await acceptCurrent();
  assert.equal(accepted.status,200);
  assert.equal(database.rows('orkto_live_quotes').find(row=>row.id===thirdLink.data.id)?.status,'accepted');
  const acceptedSnapshot = JSON.stringify(database.rows('orkto_live_quotes').find(row=>row.id===thirdLink.data.id)?.snapshot);
  assert.notEqual(JSON.stringify(database.rows('orkto_live_quotes').find(row=>row.id===secondLink.data.id)?.snapshot),acceptedSnapshot,
    'the accepted snapshot is the current third version, not the obsolete pre-concurrency second version');
  assert.equal((await api(base,CLIENT_TOKEN_A,`/api/quotes/${quote.id}`,{method:'PUT',body:JSON.stringify({notes:'Tentativa de alterar proposta aceita'})})).status,409);
  assert.equal(JSON.stringify(database.rows('orkto_live_quotes').find(row=>row.id===thirdLink.data.id)?.snapshot),acceptedSnapshot,'an accepted customer-visible version is immutable');
  assert.equal((await acceptCurrent()).status,200,'repeat acceptance is idempotent and does not create another version or external action');

  const expiredQuote = randomUUID();
  database.rows('quotes').push({id:expiredQuote,workspace_id:WORKSPACE_A,user_id:USER_A,status:'sent',client_name:'Expirada',client_company:'Oficina Norte',client_vehicle_or_service:'Revisão',client_phone:'+5511999000402',items:[{name:'Revisão técnica',catalogItemId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',quantity:1,unitPrice:125,discount:0}],subtotal:125,discount_total:0,taxes:0,total:125,valid_value_days:30,created_at:new Date(Date.now()-40*86_400_000).toISOString()});
  const expiredLink = await api(base,CLIENT_TOKEN_A,`/api/live-quotes/from-quote/${expiredQuote}`,json({}));
  assert.equal(expiredLink.status,409,'expired source validity blocks creation instead of publishing an obsolete snapshot');
  assert.equal(database.rows('orkto_live_quotes').some(row=>row.quote_ref===expiredQuote),false);
});

test('automatic message memory is idempotent, contextual in WIA and isolated by workspace', async () => {
  resetDatabase();
  const base = await serve(app);
  const customerResponse = await api(base,CLIENT_TOKEN_A,'/api/clients',json({name:'Memory customer',phone:'+5511999000501'}));
  assert.equal(customerResponse.status,201);
  const customer = (await customerResponse.json() as {data:Row}).data;
  const webhook = async (messageId:string) => fetch(`${base}/api/whatsapp/webhook`,{
    method:'POST',headers:{'content-type':'application/json','x-orkto-webhook-secret':WHATSAPP_SECRET},
    body:JSON.stringify({sender_number:customer.phone,contact_name:customer.name,content:'Prefiro falar de manhã, por favor.',message_id:messageId}),
  });
  const first = await webhook('memory-source-1');
  assert.equal(first.status,200);
  const firstBody = await first.json() as Row;
  const rawEvents = database.rows('orkto_wia_memories').filter(row=>row.workspace_id===WORKSPACE_A&&row.memory_type==='raw_event');
  const preferences = database.rows('orkto_wia_memories').filter(row=>row.workspace_id===WORKSPACE_A&&row.memory_type==='preference');
  assert.equal(rawEvents.length,1);
  assert.equal(preferences.length,1);
  assert.equal(preferences[0].content.contactWindow,'morning');
  assert.deepEqual(preferences[0].provenance,{source:'channel_message',sourceRef:database.rows('orkto_messages').find(row=>row.external_event_id==='memory-source-1')?.id,conversationId:firstBody.conversation_id});
  const repeated = await webhook('memory-source-1');
  assert.equal(repeated.status,200);
  assert.equal(database.rows('orkto_wia_memories').filter(row=>row.workspace_id===WORKSPACE_A&&row.memory_type==='raw_event').length,1,'duplicate channel event does not create duplicate memory');
  const ownMemories = await api(base,CLIENT_TOKEN_A,`/api/customers/${customer.id}/memories`);
  assert.equal(((await ownMemories.json() as {data:Row[]}).data).length,2);
  assert.equal((await api(base,CLIENT_TOKEN_B,`/api/customers/${customer.id}/memories`)).status,200);
  assert.deepEqual(((await (await api(base,CLIENT_TOKEN_B,`/api/customers/${customer.id}/memories`)).json() as {data:Row[]}).data),[],'another workspace receives no customer memory');

  const pro = database.rows('orkto_plan_price_versions').find(row=>row.plan_key==='pro')!;
  pro.entitlements.limits.monthly_wia_runs=20;
  const wia = await api(base,CLIENT_TOKEN_A,'/api/wia/decide',json({message:'Como devo abordar a objeção de preço?',contextRefs:{customerId:customer.id,conversationId:firstBody.conversation_id}}));
  assert.equal(wia.status,200);
  const prompt = JSON.stringify(lastGeminiRequestContents);
  assert.match(prompt,/contactWindow/,'WIA receives the exact, provenance-bearing preference memory for the selected customer');
  assert.match(prompt,/memory-source-1|raw_event|preference/);
  const patternId=randomUUID();
  database.rows('orkto_wia_memories').push({id:patternId,workspace_id:WORKSPACE_A,memory_type:'commercial_pattern',entity_type:'workspace',entity_ref:WORKSPACE_A,content:{objectionType:'price',strategy:'oferecer alternativas de escopo sem inventar desconto'},provenance:{source:'replay',sourceRef:'replay-version-1'},confidence:0.8,status:'active',expires_at:null,created_at:new Date().toISOString()});
  const patternWia=await api(base,CLIENT_TOKEN_A,'/api/wia/decide',json({message:'Como responder quando dizem que está caro?'}));
  assert.equal(patternWia.status,200);
  assert.match(JSON.stringify(lastGeminiRequestContents),/oferecer alternativas de escopo sem inventar desconto/,'relevant workspace-level Replay memory is retrieved selectively without attaching it to an approximate customer name');
  assert.equal((await api(base,CLIENT_TOKEN_B,'/api/wia/decide',json({message:'Mostre a preferência do outro workspace',contextRefs:{customerId:customer.id}}))).status,404);
  assert.equal(database.rows('orkto_wia_memories').every(row=>row.workspace_id===WORKSPACE_A),true);
});
