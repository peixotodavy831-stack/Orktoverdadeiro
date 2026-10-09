import crypto from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import {
  aggregateCollectiveMemory, aggregateReplay, assessOperationalRisk, auditProposalPrice, buildRecoverySchedule, classifyConversationSignals, classifyImportDuplicates, compareCustomers, computeOperationalMetrics,
  deriveMoodRing, estimateRepurchaseWindow, identifyReplayCandidate, rankConversation, recoveryStopReason, scoreOperationalAnxiety, transitionCollection, validateImportRows,
  type CollectionStatus, type CustomerMatchInput, type PriorityLevel, type RiskSignal,
} from './orkto-core/full-operational.js';
import { buildCommercialGraph } from './orkto-core/commercial-graph.js';
import { clientInput } from './orkto-core/client-input.js';
import { contactInput, contactPatchInput } from './orkto-core/contact-input.js';
import { serviceInput } from './orkto-core/service-input.js';
import { dealInput, dealPatchInput } from './orkto-core/deal-input.js';
import { scheduleRepurchaseCandidate } from './orkto-core/repurchase-scheduler.js';
import { applyResponsePipeline } from './wiaos/response-pipeline.js';
import { buildVerifiedCommercialFact, persistAutomaticMemory } from './orkto-core/memory-engine.js';
import { logStructured } from './observability/structured-logger.js';
import type { TenantContext } from './tenancy/tenant-context.js';
import { checkPlanLimit, hasPlanFeature, loadWorkspacePlanAccess } from './billing/plan-access.js';
import { accountingAdapterRegistry, type AccountingSaleExport } from './accounting/accounting-adapter.js';
import { invokeCoreMutation } from './core-mutation-client.js';
import { invokePublicProposal } from './public-proposal-client.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email?: string };
    tenantContext?: TenantContext;
    authenticatedSupabase?: Database;
  }
}

type Database = any;
type WorkspaceContext = { id: string; ownerUserId: string; role: 'owner' | 'admin' | 'manager' | 'member' };

function blockOptionalDirectWrite(res: Response): boolean {
  if (!['staging','production'].includes((process.env.APP_ENV || '').trim().toLowerCase())) return false;
  res.status(423).json({ error:'Recurso desativado até concluir a fronteira de mutação.', category:'FEATURE_DISABLED' });
  return true;
}

const collectionInput = z.object({
  customerRef: z.string().trim().min(1).max(200), dealId: z.string().uuid().optional(), amountCents: z.number().int().positive().max(10_000_000_000),
  dueAt: z.string().datetime({ offset: true }), tone: z.enum(['cordial','standard','firm']).default('standard'), nextFollowupAt: z.string().datetime({ offset: true }).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});
const memoryInput = z.object({
  type: z.enum(['raw_event','fact','preference','summary','commercial_pattern','inference']), entityType: z.string().trim().min(1).max(80),
  entityRef: z.string().trim().max(200).optional(), content: z.record(z.string(), z.unknown()),
  provenance: z.object({ source: z.string().trim().min(1).max(80), sourceRef: z.string().trim().max(200).optional() }),
  confidence: z.number().min(0).max(1).optional(), expiresAt: z.string().datetime({ offset: true }).optional(), explicitlyConfirmed: z.boolean().default(false),
});

function normalizeCustomerPhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

async function findWorkspaceCustomer(db: Database, workspaceId: string, reference: string): Promise<any | null> {
  const { data: byId, error: idError } = await db.from('clients').select('id,name,phone,company').eq('workspace_id',workspaceId).eq('id',reference).is('archived_at',null).maybeSingle();
  if (idError) throw idError;
  if (byId) return byId;
  const phone = normalizeCustomerPhone(reference);
  if (phone.length < 8) return null;
  const { data: clients, error } = await db.from('clients').select('id,name,phone,company').eq('workspace_id',workspaceId).is('archived_at',null).limit(5000);
  if (error) throw error;
  const matches = (clients || []).filter((client: any) => normalizeCustomerPhone(client.phone) === phone);
  return matches.length === 1 ? matches[0] : null;
}

function failure(res: Response, error: unknown, userMessage: string) {
  const code = (error as { code?: string })?.code;
  console.error('[Operational API]', { code: code || 'unknown', message: error instanceof Error ? error.message.slice(0, 300) : 'unknown' });
  return res.status(503).json({ error: userMessage, category: code === '42P01' || code === 'PGRST205' ? 'schema_not_applied' : 'persistence_unavailable' });
}

function importValidationError(message: string, code: 'import_validation_error' | 'tenant_validation_error' = 'import_validation_error') {
  return Object.assign(new Error(message), { code });
}

async function workspaceContext(req: Request, res: Response, db: Database, allowPersonalWorkspaceProvision = true, planCheckInGateway = false): Promise<WorkspaceContext | null> {
  // Every Preview request must keep the caller's JWT-bound RLS context. The
  // shared public client is only a construction fallback; using it here turns
  // a valid membership into an anonymous query and incorrectly returns 503.
  const requestDb = req.authenticatedSupabase || db;
  const userId = req.tenantContext?.userId || req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Sessão necessária.' }); return null; }
  const requestedWorkspace = typeof req.headers['x-orkto-workspace'] === 'string'
    ? req.headers['x-orkto-workspace']
    : req.tenantContext?.workspaceId || userId;
  try {
    const { data: membership, error: membershipError } = await requestDb.from('orkto_workspace_members')
      .select('workspace_id,role,status').eq('workspace_id', requestedWorkspace).eq('user_id', userId).eq('status','active').maybeSingle();
    if (membershipError) throw membershipError;
    if (membership) {
      const { data: workspace, error: workspaceError } = await requestDb.from('orkto_workspaces').select('owner_user_id').eq('id',membership.workspace_id).maybeSingle();
      if (workspaceError) throw workspaceError;
      if (!workspace?.owner_user_id) { res.status(409).json({ error:'Workspace sem proprietário válido.' }); return null; }
      const context = { id: membership.workspace_id, ownerUserId:workspace.owner_user_id, role: membership.role } as WorkspaceContext;
      if (!planCheckInGateway && !['GET','HEAD','OPTIONS'].includes(req.method)) {
        const access = await loadWorkspacePlanAccess(db, context.id);
        if (access.configurationRequired) { res.status(503).json({ error:'Plano/workspace ainda não está configurado para escrita.', category:'configuration_required' }); return null; }
        if (access.readOnly) { res.status(423).json({ error:'Este workspace está somente para leitura. Verifique o trial ou o status da assinatura.', category:'workspace_read_only', status:access.status, trialEndsAt:access.trialEndsAt }); return null; }
      }
      return context;
    }
    if (requestedWorkspace !== userId) { res.status(403).json({ error: 'Você não tem acesso a este workspace.' }); return null; }
    if (!allowPersonalWorkspaceProvision) {
      res.status(403).json({ error: 'A WIA exige um workspace já provisionado e uma membership ativa.', category: 'configuration_required' });
      return null;
    }

    // Provision only the authenticated user's personal workspace; shared workspaces require membership.
    const { error: workspaceError } = await requestDb.from('orkto_workspaces').upsert({ id: userId, owner_user_id: userId, name: 'Minha empresa' }, { onConflict: 'id', ignoreDuplicates: true });
    if (workspaceError) throw workspaceError;
    const { error: ownerError } = await requestDb.from('orkto_workspace_members').upsert({ workspace_id: userId, user_id: userId, role: 'owner', status: 'active', joined_at: new Date().toISOString() }, { onConflict: 'workspace_id,user_id', ignoreDuplicates: true });
    if (ownerError) throw ownerError;
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const access = await loadWorkspacePlanAccess(db,userId);
      if (access.configurationRequired) { res.status(503).json({ error:'Plano/workspace ainda não está configurado para escrita.', category:'configuration_required' }); return null; }
      if (access.readOnly) { res.status(423).json({ error:'Este workspace está somente para leitura. Verifique o trial ou o status da assinatura.', category:'workspace_read_only', status:access.status, trialEndsAt:access.trialEndsAt }); return null; }
    }
    return { id: userId, ownerUserId:userId, role: 'owner' };
  } catch (error) { failure(res, error, 'A camada operacional ainda não está disponível. Verifique a migration local antes de ativá-la.'); return null; }
}

function addAudit(db: Database, workspaceId: string, userId: string | undefined, type: string, entityType: string, entityRef: string, payload: Record<string, unknown> = {}) {
  return db.from('orkto_wia_events').insert({ workspace_id: workspaceId, actor_user_id: userId || null, event_type: type, source: 'user', entity_type: entityType, entity_ref: entityRef, payload });
}

async function addAuditOrThrow(db: Database, workspaceId: string, userId: string | undefined, type: string, entityType: string, entityRef: string, payload: Record<string, unknown> = {}) {
  const { error } = await addAudit(db, workspaceId, userId, type, entityType, entityRef, payload);
  if (error) throw error;
}

async function persistDealOutcomeMemory(db: Database, workspaceId: string, deal: any, userId?: string) {
  if (!['won','lost'].includes(String(deal.status)) || !deal.customer_ref) return { status:'not_applicable' as const };
  const customer = await findWorkspaceCustomer(db,workspaceId,String(deal.customer_ref));
  if (!customer) return { status:'customer_not_resolved' as const };
  const candidate = buildVerifiedCommercialFact({
    workspaceId,customerId:String(customer.id),factType:'deal_outcome',source:'workspace_deal',sourceRef:String(deal.id),actorUserId:userId || null,
    facts:{ dealId:String(deal.id),title:String(deal.title || '').slice(0,180),status:String(deal.status),stage:String(deal.stage || ''),valueCents:Number(deal.value_cents || 0),outcomeRecordedAt:String(deal.updated_at || new Date().toISOString()) },
  });
  if (!candidate) return { status:'not_applicable' as const };
  const saved = await persistAutomaticMemory(db,candidate);
  if (saved.inserted && saved.id) await addAuditOrThrow(db,workspaceId,userId,'memory.commercial_fact_captured','customer',String(customer.id),{ memory_id:saved.id,fact_type:'deal_outcome',source_ref:String(deal.id) });
  return { status:saved.id ? 'persisted' as const : 'retryable' as const, id:saved.id };
}

async function scheduleReplayCapture(db: Database, workspaceId: string, deal: any, userId?: string) {
  if (!['won','lost'].includes(String(deal.status)) || !deal.conversation_ref) return null;
  const outcomeKey = `replay-capture:${deal.id}:${deal.status}`;
  const { data, error } = await db.from('orkto_automation_jobs').upsert({
    workspace_id: workspaceId, entity_type: 'replay_capture', entity_ref: String(deal.id), step_key: String(deal.status),
    due_at: new Date().toISOString(), status: 'scheduled', idempotency_key: outcomeKey,
  }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) throw error;
  if (data?.id) await addAuditOrThrow(db,workspaceId,userId,'replay.capture_scheduled','deal',String(deal.id),{ conversation_id:deal.conversation_ref, outcome:deal.status, job_id:data.id });
  return data?.id || null;
}

async function captureReplayFromDeal(db: Database, job: any) {
  const { data: deal, error: dealError } = await db.from('orkto_deals').select('id,customer_ref,conversation_ref,status,updated_at')
    .eq('workspace_id',job.workspace_id).eq('id',job.entity_ref).maybeSingle();
  if (dealError) throw dealError;
  if (!deal || !['won','lost'].includes(String(deal.status)) || !deal.conversation_ref) return { captured: false, reason: 'deal_outcome_or_conversation_missing' };
  if (String(job.step_key) !== String(deal.status)) return { captured: false, reason: 'outcome_changed_after_capture_was_scheduled' };
  const { data: conversation, error: conversationError } = await db.from('orkto_conversations').select('id,customer_id,contact_phone')
    .eq('workspace_id',job.workspace_id).eq('id',deal.conversation_ref).maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) return { captured: false, reason: 'conversation_not_found' };
  const { data: messages, error: messagesError } = await db.from('orkto_messages').select('id,direction,content,sent_at')
    .eq('workspace_id',job.workspace_id).eq('conversation_id',conversation.id).order('sent_at',{ascending:true}).limit(500);
  if (messagesError) throw messagesError;
  const candidate = identifyReplayCandidate((messages || []).map((message:any)=>({ id:String(message.id),direction:message.direction,content:String(message.content || ''),sentAt:message.sent_at })));
  if (!candidate) return { captured: false, reason: 'no_objection_response_pair' };
  const captureKey = String(job.idempotency_key);
  const priorQuery = db.from('orkto_replay_records').select('version').eq('workspace_id',job.workspace_id).eq('conversation_id',conversation.id).order('version',{ascending:false}).limit(1).maybeSingle();
  const { data: prior, error: priorError } = await priorQuery;
  if (priorError) throw priorError;
  const evidence = { responseText:candidate.responseText, objectionMessageId:candidate.objectionMessageId, responseMessageId:candidate.responseMessageId,
    provenance:{ source:'automatic_deal_outcome', dealId:deal.id, conversationId:conversation.id, outcomeField:'orkto_deals.status', captureKey, capturedAt:new Date().toISOString() } };
  const { data: inserted, error: insertError } = await db.from('orkto_replay_records').upsert({
    workspace_id:job.workspace_id, conversation_id:conversation.id, customer_ref:deal.customer_ref || conversation.customer_id || conversation.contact_phone || null,
    objection_type:candidate.objectionType, response_strategy:candidate.strategy, outcome:deal.status, conversion_result:deal.status === 'won', evidence,
    version:Number(prior?.version || 0)+1, capture_key:captureKey,
  },{onConflict:'workspace_id,capture_key',ignoreDuplicates:true}).select('*').maybeSingle();
  if (insertError) throw insertError;
  let record = inserted;
  if (!record) {
    const { data, error } = await db.from('orkto_replay_records').select('*').eq('workspace_id',job.workspace_id).eq('capture_key',captureKey).maybeSingle();
    if (error) throw error;
    record = data;
  }
  if (!record) throw new Error('Replay automático não pôde ser recuperado após a gravação.');
  if (inserted) {
    const { data: history, error: historyError } = await db.from('orkto_replay_records').select('id,objection_type,response_strategy,outcome').eq('workspace_id',job.workspace_id)
      .eq('objection_type',candidate.objectionType).eq('response_strategy',candidate.strategy).order('created_at',{ascending:false}).limit(1000);
    if (historyError) throw historyError;
    const recommendation = aggregateReplay((history || []).map((row:any)=>({objectionType:row.objection_type,strategy:row.response_strategy,outcome:row.outcome})))
      .find((item:any)=>item.objectionType === candidate.objectionType && item.strategy === candidate.strategy) || null;
    if (recommendation) {
      const { error: recommendationError } = await db.from('orkto_replay_records').update({ recommendation }).eq('workspace_id',job.workspace_id).eq('id',record.id);
      if (recommendationError) throw recommendationError;
      record.recommendation = recommendation;
      if (recommendation.eligibleForRecommendation) {
        const patternKey = `replay-pattern:${crypto.createHash('sha256').update(`${candidate.objectionType}|${candidate.strategy}`).digest('hex').slice(0,24)}:v1`;
        const { data: priorPattern, error: priorPatternError } = await db.from('orkto_wia_memories').select('id,content').eq('workspace_id',job.workspace_id).eq('idempotency_key',patternKey).maybeSingle();
        if (priorPatternError) throw priorPatternError;
        const patternVersion = Number(priorPattern?.content?.version || 0) + 1;
        const patternContent = {
          patternType:'objection_response_outcome',objectionType:candidate.objectionType,strategy:candidate.strategy,
          sampleSize:recommendation.sampleSize,resolvedSampleSize:Number(recommendation.wins || 0)+Number(recommendation.losses || 0),
          wins:Number(recommendation.wins || 0),losses:Number(recommendation.losses || 0),conversionRate:recommendation.conversionRate,
          recommendation:recommendation.recommendation,version:patternVersion,
        };
        const { data: pattern, error: patternError } = await db.from('orkto_wia_memories').upsert({
          workspace_id:job.workspace_id,memory_type:'commercial_pattern',entity_type:'workspace',entity_ref:job.workspace_id,
          content:patternContent,provenance:{source:'replay_aggregate',replayRecordIds:(history || []).slice(0,50).map((item:any)=>item.id),algorithm:'replay-aggregate-v1',createdAt:new Date().toISOString()},
          confidence:Number(Math.min(0.95,0.5+patternContent.resolvedSampleSize*0.05).toFixed(2)),status:'active',idempotency_key:patternKey,created_by:null,
        },{onConflict:'workspace_id,idempotency_key'}).select('id').maybeSingle();
        if (patternError) throw patternError;
        if (pattern?.id) await addAuditOrThrow(db,job.workspace_id,undefined,'memory.commercial_pattern_updated','wia_memory',String(pattern.id),{ objection_type:candidate.objectionType,strategy:candidate.strategy,version:patternVersion,sample_size:patternContent.sampleSize,recommendation_only:true });
      }
    }
    await addAuditOrThrow(db,job.workspace_id,undefined,'replay.automatically_captured','replay_record',String(record.id),{ deal_id:deal.id, conversation_id:conversation.id, capture_key:captureKey, outcome:deal.status, recommendation_only:true });
  }
  return { captured: Boolean(inserted), id:record.id, reason:inserted ? null : 'idempotent_replay' };
}

async function cancelQuoteRecovery(db: Database, workspaceId: string, quoteId: string, userId: string | undefined, reason: string) {
  const now = new Date().toISOString();
  const [jobs, actions] = await Promise.all([
    db.from('orkto_automation_jobs').update({ status:'cancelled',updated_at:now }).eq('workspace_id',workspaceId).eq('entity_type','quote').eq('entity_ref',quoteId).eq('status','scheduled').select('id'),
    db.from('orkto_wia_actions').update({ status:'cancelled',updated_at:now }).eq('workspace_id',workspaceId).eq('action_type','send_proposal_followup').in('status',['prepared','awaiting_approval']).contains('payload',{ quoteId }).select('id'),
  ]);
  if (jobs.error) throw jobs.error;
  if (actions.error) throw actions.error;
  const cancelledJobs = jobs.data?.length || 0;
  const cancelledActions = actions.data?.length || 0;
  if (cancelledJobs || cancelledActions) await addAuditOrThrow(db,workspaceId,userId,'proposal_recovery.cancelled','quote',quoteId,{ reason,cancelled_jobs:cancelledJobs,cancelled_actions:cancelledActions });
  return { cancelledJobs,cancelledActions };
}

async function isActiveWorkspaceMember(db: Database, workspaceId: string, userId: string): Promise<boolean> {
  const { data, error } = await db.from('orkto_workspace_members').select('user_id')
    .eq('workspace_id',workspaceId).eq('user_id',userId).eq('status','active').maybeSingle();
  if (error) throw error;
  return Boolean(data?.user_id);
}

async function loadWorkspaceMetrics(db: Database, workspaceId: string, startAt: string, endAt: string) {
  const [quotesResult, dealsResult, conversationsResult] = await Promise.all([
    db.from('quotes').select('id,total,status,created_at').eq('workspace_id',workspaceId).gte('created_at',startAt).lte('created_at',endAt).limit(5000),
    db.from('orkto_deals').select('value_cents,status,stage,updated_at').eq('workspace_id',workspaceId).gte('updated_at',startAt).lte('updated_at',endAt).limit(5000),
    db.from('orkto_conversations').select('id,status,created_at').eq('workspace_id',workspaceId).gte('created_at',startAt).lte('created_at',endAt).limit(5000),
  ]);
  if (quotesResult.error) throw quotesResult.error;
  if (dealsResult.error) throw dealsResult.error;
  if (conversationsResult.error) throw conversationsResult.error;
  // Do not infer response-time metrics from old outgoing rows: this codebase does not yet
  // receive delivery receipts, so a historical outgoing row is not proof of delivery.
  return computeOperationalMetrics({ quotes: quotesResult.data || [], deals: dealsResult.data || [], conversations: conversationsResult.data || [] });
}

export function registerOperationalRoutes(app: Express, authenticate: RequestHandler, db: Database | null) {
  const requireDb: RequestHandler = (_req, res, next) => {
    if (!db) { res.status(503).json({ error: 'Banco de dados indisponível.', category: 'configuration_error' }); return; }
    next();
  };

  app.get('/api/operational/workspace', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db);
    if (!context) return;
    try {
      const [workspaceResult, membersResult] = await Promise.all([
        db.from('orkto_workspaces').select('id,name,plan_key,subscription_status,settings,created_at').eq('id', context.id).maybeSingle(),
        db.from('orkto_workspace_members').select('user_id,role,status,joined_at').eq('workspace_id', context.id).eq('status','active'),
      ]);
      if (workspaceResult.error) throw workspaceResult.error;
      if (membersResult.error) throw membersResult.error;
      res.json({ workspace: workspaceResult.data, members: membersResult.data || [], currentRole: context.role });
    } catch (error) { failure(res, error, 'Não foi possível carregar o workspace.'); }
  });

  app.get('/api/clients', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    const search = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase() : '';
    try {
      const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '500'), 10) || 500));
      const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
      const { data, error, count } = await db.from('clients').select('*',{ count:'exact' }).eq('workspace_id',context.id).is('archived_at',null).order('created_at',{ascending:false}).range(offset,offset + limit - 1);
      if (error) throw error;
      const rows = (data || []).filter((row: any) => !search || `${row.name || ''} ${row.phone || ''} ${row.company || ''}`.toLocaleLowerCase().includes(search));
      res.json({ data: rows, total: count ?? rows.length, offset, limit });
    } catch (error) { failure(res,error,'Não foi possível carregar os clientes.'); }
  });

  app.get('/api/clients/:clientId', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const { data,error } = await db.from('clients').select('*').eq('workspace_id',context.id).eq('id',req.params.clientId).is('archived_at',null).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error:'Cliente não encontrado neste workspace.' });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível carregar o cliente.'); }
  });

  app.post('/api/clients', authenticate, requireDb, async (req, res) => {
    const parsed = clientInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados do cliente inválidos.' });
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'CREATE_CLIENT',parsed.data);
      if (!result) return;
      if (!result.client) return res.status(503).json({ error:'Resposta inválida do Mutation Gateway.', category:'mutation_gateway_unavailable' });
      return res.status(result.result === 'REPLAY' ? 200 : 201).json({ data:result.client, requestId:req.requestId });
  });

  app.patch('/api/clients/:clientId', authenticate, requireDb, async (req, res) => {
    const parsed = clientInput.partial().strict().safeParse(req.body);
    if (!parsed.success || !Object.values(parsed.data || {}).some(value => value !== undefined)) return res.status(400).json({ error: parsed.success ? 'Informe ao menos um campo.' : parsed.error.issues[0]?.message });
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'UPDATE_CLIENT',{ clientId:req.params.clientId,changes:parsed.data });
      if (!result) return;
      if (!result.client) return res.status(503).json({ error:'Resposta inválida do Mutation Gateway.', category:'mutation_gateway_unavailable' });
      return res.json({ data:result.client, requestId:req.requestId });
  });

  app.delete('/api/clients/:clientId', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Somente owner/admin pode arquivar clientes.' });
    const result = await invokeCoreMutation(req,res,context,'ARCHIVE_CLIENT',{ clientId:req.params.clientId });
      if (!result) return;
      if (!result.client_id) return res.status(503).json({ error:'Resposta inválida do Mutation Gateway.', category:'mutation_gateway_unavailable' });
      return res.json({ data:{ id:result.client_id }, archived:true, requestId:req.requestId });
  });

  app.get('/api/contacts', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : null;
    if (customerId && !z.string().uuid().safeParse(customerId).success) return res.status(400).json({ error:'Cliente inválido.' });
    try {
      let query = db.from('orkto_contacts').select('id,workspace_id,customer_id,full_name,phone,email,company,role,created_at,updated_at',{count:'exact'})
        .eq('workspace_id',context.id).order('created_at',{ascending:false}).range(offset,offset+limit-1);
      if (customerId) query = query.eq('customer_id',customerId);
      const {data,error,count} = await query;
      if (error) throw error;
      return res.json({data:data || [],total:count ?? 0,limit,offset});
    } catch (error) { failure(res,error,'Não foi possível carregar os contatos.'); }
  });

  app.post('/api/contacts', authenticate, requireDb, async (req,res) => {
    const parsed = contactInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:parsed.error.issues[0]?.message || 'Contato inválido.'});
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'CREATE_CONTACT',parsed.data);
    if (!result) return;
    if (!result.contact) return res.status(503).json({error:'Resposta inválida do Mutation Gateway.',category:'mutation_gateway_unavailable'});
    return res.status(result.result === 'REPLAY' ? 200 : 201).json({data:result.contact,requestId:req.requestId});
  });

  app.patch('/api/contacts/:contactId', authenticate, requireDb, async (req,res) => {
    const parsed = contactPatchInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:parsed.error.issues[0]?.message || 'Contato inválido.'});
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'UPDATE_CONTACT',{contactId:req.params.contactId,changes:parsed.data});
    if (!result) return;
    if (!result.contact) return res.status(503).json({error:'Resposta inválida do Mutation Gateway.',category:'mutation_gateway_unavailable'});
    return res.json({data:result.contact,requestId:req.requestId});
  });

  app.get('/api/catalog', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    const search = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase() : '';
    try {
      const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '500'), 10) || 500));
      const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
      const { data, error, count } = await db.from('services').select('*',{ count:'exact' }).eq('workspace_id',context.id).is('archived_at',null).order('created_at',{ascending:false}).range(offset,offset + limit - 1);
      if (error) throw error;
      const rows = (data || []).filter((row: any) => !search || `${row.name || ''} ${row.description || ''} ${row.category || ''}`.toLocaleLowerCase().includes(search));
      res.json({ data:rows,total:count ?? rows.length,offset,limit });
    } catch (error) { failure(res,error,'Não foi possível carregar o catálogo.'); }
  });

  app.get('/api/catalog/:serviceId', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const { data,error } = await db.from('services').select('*').eq('workspace_id',context.id).eq('id',req.params.serviceId).is('archived_at',null).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error:'Item não encontrado neste workspace.' });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível carregar o item do catálogo.'); }
  });

  app.post('/api/catalog', authenticate, requireDb, async (req, res) => {
    const parsed = serviceInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:parsed.error.issues[0]?.message || 'Dados do serviço inválidos.' });
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'CREATE_CATALOG_ITEM',parsed.data);
      if (!result) return;
      if (!result.service) return res.status(503).json({ error:'Resposta inválida do Mutation Gateway.', category:'mutation_gateway_unavailable' });
      return res.status(result.result === 'REPLAY' ? 200 : 201).json({ data:result.service, requestId:req.requestId });
  });

  app.patch('/api/catalog/:serviceId', authenticate, requireDb, async (req, res) => {
    const parsed = serviceInput.partial().strict().safeParse(req.body);
    if (!parsed.success || !Object.values(parsed.data || {}).some(value => value !== undefined)) return res.status(400).json({ error:parsed.success ? 'Informe ao menos um campo.' : parsed.error.issues[0]?.message });
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'UPDATE_CATALOG_ITEM',{ serviceId:req.params.serviceId,changes:parsed.data });
      if (!result) return;
      if (!result.service) return res.status(503).json({ error:'Resposta inválida do Mutation Gateway.', category:'mutation_gateway_unavailable' });
      return res.json({ data:result.service, requestId:req.requestId });
  });

  app.delete('/api/catalog/:serviceId', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error:'Somente owner/admin pode arquivar itens do catálogo.' });
    const result = await invokeCoreMutation(req,res,context,'ARCHIVE_CATALOG_ITEM',{ serviceId:req.params.serviceId });
      if (!result) return;
      if (!result.service_id) return res.status(503).json({ error:'Resposta inválida do Mutation Gateway.', category:'mutation_gateway_unavailable' });
      return res.json({ data:{ id:result.service_id }, archived:true, requestId:req.requestId });
  });

  app.patch('/api/operational/workspace', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ name: z.string().trim().min(2).max(120).optional(), autonomyLevel: z.enum(['LEVEL_0_OBSERVE','LEVEL_1_SAFE_INTERNAL','LEVEL_2_CONTROLLED_AUTONOMY','LEVEL_3_HUMAN_APPROVAL']).optional(), confidenceThreshold: z.number().min(0).max(1).optional() }).refine(value => Object.values(value).some(item => item !== undefined)).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Configuração inválida.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Apenas owner/admin podem alterar as configurações operacionais.' });
    try {
      const { data: current, error: readError } = await db.from('orkto_workspaces').select('name,settings').eq('id',context.id).maybeSingle();
      if (readError) throw readError;
      const settings = (current?.settings && typeof current.settings === 'object' ? current.settings : {}) as Record<string, unknown>;
      const wia = (settings.wia && typeof settings.wia === 'object' ? settings.wia : {}) as Record<string, unknown>;
      const nextSettings = { ...settings, ...(parsed.data.autonomyLevel || parsed.data.confidenceThreshold !== undefined ? { wia: { ...wia, ...(parsed.data.autonomyLevel ? { autonomyLevel: parsed.data.autonomyLevel } : {}), ...(parsed.data.confidenceThreshold !== undefined ? { confidenceThreshold: parsed.data.confidenceThreshold } : {}) } } : {}) };
      // Persist the intent before changing settings so an audit outage cannot
      // silently produce an unaudited privileged write.
      await addAuditOrThrow(db,context.id,req.user?.id,'workspace.settings_change_requested','workspace',context.id,{ request_id:req.requestId || null, changed_fields:Object.keys(parsed.data) });
      const { data, error } = await db.from('orkto_workspaces').update({ ...(parsed.data.name ? { name: parsed.data.name } : {}), settings: nextSettings, updated_at: new Date().toISOString() }).eq('id',context.id).select('id,name,settings,updated_at').single();
      if (error) throw error;
      await addAuditOrThrow(db,context.id,req.user?.id,'workspace.settings_changed','workspace',context.id,{ request_id:req.requestId || null, changed_fields: Object.keys(parsed.data) });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível salvar as configurações operacionais.'); }
  });

  app.get('/api/features', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_feature_configs').select('feature_key,status,config,version,updated_at').eq('workspace_id',context.id).order('feature_key');
      if (error) throw error;
      res.json({ data: data || [], collectiveMemory: 'BLOCKED_LEGAL_ACTIVATION' });
    } catch (error) { failure(res,error,'Não foi possível carregar a configuração das funcionalidades.'); }
  });

  app.put('/api/features/:featureKey', authenticate, requireDb, async (req, res) => {
    const featureKey = z.enum(['proposal_recovery','repurchase_reactivation','replay','risk_score','collection_analyst','priority_triage','mood_rings','orkto_swarm','sussurro','orkto_graph','live_quotes','large_transfusion','collective_memory','case_study','orkto_wrapped','accounting_export','artifact_signature']).safeParse(req.params.featureKey);
    const parsed = z.object({ status: z.enum(['ACTIVE','CONFIGURABLE','EXPERIMENTAL','DISABLED','INTERNAL','PENDING_CONFIGURATION']), config: z.record(z.string(),z.unknown()).default({}) }).safeParse(req.body);
    if (!featureKey.success || !parsed.success) return res.status(400).json({ error: 'Configuração de funcionalidade inválida.' });
    if (featureKey.data === 'collective_memory' && ['ACTIVE','CONFIGURABLE'].includes(parsed.data.status)) return res.status(423).json({ error: 'Memória coletiva permanece bloqueada até aprovação jurídica específica.', category: 'policy_error', status: 'BLOCKED_LEGAL_ACTIVATION' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Apenas owner/admin podem alterar funcionalidades do workspace.' });
    try {
      const { data: prior, error: priorError } = await db.from('orkto_feature_configs').select('version').eq('workspace_id',context.id).eq('feature_key',featureKey.data).maybeSingle();
      if (priorError) throw priorError;
      await addAuditOrThrow(db,context.id,req.user?.id,'feature.configuration_requested','feature',featureKey.data,{ request_id:req.requestId || null, status:parsed.data.status });
      const { data, error } = await db.from('orkto_feature_configs').upsert({ workspace_id: context.id, feature_key: featureKey.data, status: parsed.data.status, config: parsed.data.config, version: Number(prior?.version || 0) + 1, updated_by: req.user?.id || null, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,feature_key' }).select('feature_key,status,config,version,updated_at').single();
      if (error) throw error;
      await addAuditOrThrow(db,context.id,req.user?.id,'feature.configured','feature',featureKey.data,{ request_id:req.requestId || null, status: data.status, version: data.version });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível salvar a configuração da funcionalidade.'); }
  });

  app.get('/api/collective-memory', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const { data,error } = await db.from('orkto_collective_memory_contributions')
        .select('id,sector_key,pattern_key,aggregate,consent_status,contribution_version,created_at,updated_at')
        .eq('workspace_id',context.id).order('updated_at',{ascending:false}).limit(100);
      if (error) throw error;
      res.json({ data:data || [], activation:'BLOCKED_LEGAL_ACTIVATION', canManage:['owner','admin'].includes(context.role) });
    } catch (error) { failure(res,error,'Não foi possível carregar as contribuições privadas do workspace.'); }
  });

  app.post('/api/collective-memory/contributions', authenticate, requireDb, async (req,res) => {
    const parsed = z.object({
      confirmStage:z.literal(true), sectorKey:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,59}$/),
      patternKey:z.enum(['quote_acceptance','response_time']), periodStart:z.string().date(), periodEnd:z.string().date(),
    }).safeParse(req.body);
    if (!parsed.success || parsed.data.periodEnd < parsed.data.periodStart) return res.status(400).json({ error:'Informe setor/categoria controlados e um período válido.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error:'Somente owner/admin podem preparar uma contribuição agregada.' });
    try {
      const metrics = await loadWorkspaceMetrics(db,context.id,`${parsed.data.periodStart}T00:00:00.000Z`,`${parsed.data.periodEnd}T23:59:59.999Z`);
      const aggregate = {
        periodStart:parsed.data.periodStart, periodEnd:parsed.data.periodEnd,
        ...(parsed.data.patternKey === 'quote_acceptance' ? {
          quoteCount:metrics.quotes.count, acceptedQuotes:metrics.quotes.accepted,
          conversationCount:null, responseMinutesTotal:null, responseSamples:null,
        } : {
          quoteCount:null, acceptedQuotes:null, conversationCount:null,
          responseMinutesTotal:metrics.response.medianMinutes == null ? null : Math.round(metrics.response.medianMinutes*metrics.response.samples),
          responseSamples:metrics.response.medianMinutes == null ? null : metrics.response.samples,
        }),
        anonymizationVersion:'workspace-summary-v1', sourceCoverage:metrics.coverage,
      };
      const { data:prior,error:priorError } = await db.from('orkto_collective_memory_contributions')
        .select('contribution_version').eq('workspace_id',context.id).eq('sector_key',parsed.data.sectorKey).eq('pattern_key',parsed.data.patternKey)
        .order('contribution_version',{ascending:false}).limit(1).maybeSingle();
      if (priorError) throw priorError;
      const version = Number(prior?.contribution_version || 0)+1;
      const { data,error } = await db.from('orkto_collective_memory_contributions').insert({
        workspace_id:context.id,sector_key:parsed.data.sectorKey,pattern_key:parsed.data.patternKey,
        aggregate,consent_status:'disabled',contribution_version:version,
      }).select('id,sector_key,pattern_key,aggregate,consent_status,contribution_version,created_at,updated_at').single();
      if (error) throw error;
      await addAuditOrThrow(db,context.id,req.user?.id,'collective_memory.contribution_staged','collective_memory_contribution',data.id,{ pattern_key:data.pattern_key,version,sharing_enabled:false });
      res.status(201).json({ data,activation:'BLOCKED_LEGAL_ACTIVATION',message:'Resumo numérico salvo somente neste workspace. Nenhum dado foi compartilhado entre empresas.' });
    } catch (error) { failure(res,error,'Não foi possível preparar o resumo agregado do workspace.'); }
  });

  app.post('/api/collective-memory/contributions/:contributionId/consent', authenticate, requireDb, async (req,res) => {
    const parsed = z.object({ confirmConsent:z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:'Confirme explicitamente o consentimento.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error:'Somente owner/admin podem autorizar a contribuição.' });
    if (process.env.COLLECTIVE_MEMORY_LEGAL_APPROVED !== 'true') return res.status(423).json({ error:'Consentimento de compartilhamento bloqueado até a validação jurídica específica.',category:'policy_error',status:'BLOCKED_LEGAL_ACTIVATION' });
    try {
      const { data,error } = await db.from('orkto_collective_memory_contributions').update({ consent_status:'approved',updated_at:new Date().toISOString() })
        .eq('workspace_id',context.id).eq('id',req.params.contributionId).eq('consent_status','disabled')
        .select('id,sector_key,pattern_key,consent_status,contribution_version').maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error:'Contribuição não encontrada neste workspace ou já alterada.' });
      await addAuditOrThrow(db,context.id,req.user?.id,'collective_memory.consent_granted','collective_memory_contribution',data.id,{ pattern_key:data.pattern_key,version:data.contribution_version });
      res.json({ data,activation:'WAITING_FOR_AGGREGATION' });
    } catch (error) { failure(res,error,'Não foi possível registrar o consentimento da contribuição.'); }
  });

  app.post('/api/collective-memory/contributions/:contributionId/retract', authenticate, requireDb, async (req,res) => {
    const parsed = z.object({ confirmRetraction:z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:'Confirme explicitamente a retirada da contribuição.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error:'Somente owner/admin podem retirar a contribuição.' });
    try {
      const { data,error } = await db.from('orkto_collective_memory_contributions').update({ consent_status:'retracted',updated_at:new Date().toISOString() })
        .eq('workspace_id',context.id).eq('id',req.params.contributionId).in('consent_status',['staged','approved','disabled'])
        .select('id,sector_key,pattern_key,contribution_version').maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error:'Contribuição não encontrada neste workspace ou já retirada.' });
      if (process.env.COLLECTIVE_MEMORY_LEGAL_APPROVED === 'true') {
        const { error: disableError } = await db.from('orkto_collective_memory_items').update({ status:'disabled',updated_at:new Date().toISOString() }).eq('status','approved');
        if (disableError) throw disableError;
      }
      await addAuditOrThrow(db,context.id,req.user?.id,'collective_memory.consent_retracted','collective_memory_contribution',data.id,{ pattern_key:data.pattern_key,version:data.contribution_version,shared_items_disabled:true });
      res.json({ data,sharedItems:'disabled_pending_reaggregation' });
    } catch (error) { failure(res,error,'Não foi possível retirar a contribuição.'); }
  });

  app.post('/api/internal/collective-memory/aggregate', requireDb, async (req,res) => {
    if (process.env.COLLECTIVE_MEMORY_LEGAL_APPROVED !== 'true') return res.status(423).json({ error:'Ativação coletiva bloqueada por validação jurídica.',category:'policy_error',status:'BLOCKED_LEGAL_ACTIVATION' });
    const secret = process.env.CRON_SECRET; const authorization = req.header('authorization') || '';
    if (!secret) return res.status(503).json({ error:'CRON_SECRET ausente; agregação interna permanece inativa.',category:'configuration_error' });
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (supplied.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(secret))) return res.status(401).json({ error:'Não autorizado.' });
    try {
      const { data:contributions,error } = await db.from('orkto_collective_memory_contributions')
        .select('workspace_id,sector_key,pattern_key,aggregate,consent_status,contribution_version,updated_at').limit(10000);
      if (error) throw error;
      const result = aggregateCollectiveMemory(contributions || []);
      const { error:disableError } = await db.from('orkto_collective_memory_items').update({ status:'disabled',updated_at:new Date().toISOString() }).eq('status','approved');
      if (disableError) throw disableError;
      for (const item of result.items) {
        const version = `numeric-aggregate-v1:${item.periodStart}:${item.periodEnd}`;
        const { error:upsertError } = await db.from('orkto_collective_memory_items').upsert({
          sector_key:item.sectorKey,pattern_key:item.patternKey,aggregate:{ ...item.aggregate,periodStart:item.periodStart,periodEnd:item.periodEnd },
          contributing_workspace_count:item.contributingWorkspaceCount,anonymization_version:version,provenance:item.provenance,
          status:'approved',updated_at:new Date().toISOString(),
        },{ onConflict:'sector_key,pattern_key,anonymization_version' });
        if (upsertError) throw upsertError;
      }
      res.json({ eligibleGroups:result.eligibleGroupCount,suppressedGroups:result.suppressedGroupCount,minimumCohort:result.minimumCohort,anonymizationVersion:'numeric-aggregate-v1' });
    } catch (error) { failure(res,error,'Não foi possível executar a agregação coletiva.'); }
  });

  app.get('/api/collective-memory/patterns', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    if (process.env.COLLECTIVE_MEMORY_LEGAL_APPROVED !== 'true') return res.status(423).json({ error:'Memória coletiva não pode ser consultada antes da validação jurídica.',status:'BLOCKED_LEGAL_ACTIVATION' });
    try {
      const { data:feature,error:featureError } = await db.from('orkto_feature_configs').select('status').eq('workspace_id',context.id).eq('feature_key','collective_memory').maybeSingle();
      if (featureError) throw featureError;
      if (String(feature?.status || '').toUpperCase() !== 'ACTIVE') return res.status(423).json({ error:'Memória coletiva não está ativada neste workspace.',status:'DISABLED' });
      const { data,error } = await db.from('orkto_collective_memory_items')
        .select('sector_key,pattern_key,aggregate,contributing_workspace_count,anonymization_version,provenance,updated_at')
        .eq('status','approved').gte('contributing_workspace_count',5).order('updated_at',{ascending:false}).limit(100);
      if (error) throw error;
      res.json({ data:data || [],note:'Somente agregados numéricos com coorte mínima; nenhum identificador de workspace é incluído.' });
    } catch (error) { failure(res,error,'Não foi possível consultar padrões agregados aprovados.'); }
  });

  app.get('/api/deals', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      let query = db.from('orkto_deals').select('*').eq('workspace_id', context.id).neq('status', 'archived').order('updated_at', { ascending: false }).limit(250);
      if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);
      const [{ data, error }, { data: risks, error: riskError }] = await Promise.all([
        query,
        db.from('orkto_risk_assessments').select('customer_ref,score,confidence,reasons,recommended_action,assessed_at').eq('workspace_id',context.id).order('assessed_at',{ascending:false}).limit(1000),
      ]);
      if (error) throw error; if (riskError) throw riskError;
      const latestRisk = new Map<string,any>();
      for (const assessment of risks || []) if (!latestRisk.has(assessment.customer_ref)) latestRisk.set(assessment.customer_ref,assessment);
      res.json({ data: (data || []).map((deal: any) => ({ ...deal, risk: deal.customer_ref ? latestRisk.get(deal.customer_ref) || null : null })) });
    } catch (error) { failure(res, error, 'Não foi possível carregar os negócios.'); }
  });

  app.get('/api/deals/:dealId', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: deal, error } = await db.from('orkto_deals').select('*')
        .eq('workspace_id', context.id).eq('id', req.params.dealId).maybeSingle();
      if (error) throw error;
      if (!deal) return res.status(404).json({ error: 'Negócio não encontrado neste workspace.' });
      const [{ data: events, error: eventError }, { data: quotes, error: quoteError }] = await Promise.all([
        db.from('orkto_wia_events').select('*').eq('workspace_id', context.id).eq('entity_type', 'deal').eq('entity_ref', deal.id).order('occurred_at', { ascending: true }).limit(500),
        db.from('quotes').select('id,quote_number,status,total,created_at,updated_at').eq('workspace_id', context.id).eq('deal_id', deal.id).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
      ]);
      if (eventError) throw eventError;
      if (quoteError) throw quoteError;
      const memoryEntities = [{type:'deal',ref:String(deal.id)}, ...(deal.customer_ref ? [{type:'customer',ref:String(deal.customer_ref)}] : [])];
      const { data: contextualMemories, error: memoryError } = await db.from('orkto_wia_memories').select('id,memory_type,entity_type,entity_ref,content,provenance,confidence,created_at')
        .eq('workspace_id',context.id).eq('status','active').in('entity_ref',memoryEntities.map(item=>item.ref)).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at',{ascending:false}).limit(20);
      if (memoryError) throw memoryError;
      const allowedMemories = new Set(memoryEntities.map(item=>`${item.type}:${item.ref}`));
      const memories = (contextualMemories || []).filter((item:any)=>allowedMemories.has(`${item.entity_type}:${item.entity_ref}`)).filter((item:any)=>item.memory_type==='raw_event' || item.confidence == null || Number(item.confidence)>=0.5).slice(0,8);
      res.json({ data: { ...deal, history: events || [], proposals: quotes || [], contextual_memories:memories } });
    } catch (error) { failure(res, error, 'Não foi possível carregar o negócio.'); }
  });

  app.get('/api/deals/:dealId/history', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: deal, error: dealError } = await db.from('orkto_deals').select('id')
        .eq('workspace_id', context.id).eq('id', req.params.dealId).maybeSingle();
      if (dealError) throw dealError;
      if (!deal) return res.status(404).json({ error: 'Negócio não encontrado neste workspace.' });
      const { data, error } = await db.from('orkto_wia_events').select('*').eq('workspace_id', context.id)
        .eq('entity_type', 'deal').eq('entity_ref', deal.id).order('occurred_at', { ascending: true }).limit(500);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res, error, 'Não foi possível carregar o histórico do negócio.'); }
  });

  app.post('/api/deals', authenticate, requireDb, async (req, res) => {
    const parsed = dealInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados do negócio inválidos.' });
    const context = await workspaceContext(req, res, db, false, true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'CREATE_DEAL',parsed.data);
      if (result) res.status(result.result === 'REPLAY' ? 200 : 201).json({ data:result.deal, memoryStatus:result.memory_status || 'not_applicable', idempotentReplay:result.result === 'REPLAY' });
      return;
  });

  app.patch('/api/deals/:dealId', authenticate, requireDb, async (req, res) => {
    const parsed = dealPatchInput.safeParse(req.body);
    if (!parsed.success || !Object.values(parsed.data || {}).some(value => value !== undefined)) return res.status(400).json({ error: parsed.success ? 'Informe ao menos um campo.' : parsed.error.issues[0]?.message });
    const context = await workspaceContext(req, res, db, false, true); if (!context) return;
    const terminal = parsed.data.stage === 'won' || parsed.data.stage === 'lost';
    if (terminal && Object.keys(parsed.data).some(key => key !== 'stage' && key !== 'lostReason'))
      return res.status(400).json({ error:'Fechamento do negócio exige um comando separado.', category:'VALIDATION_FAILED' });
    const result = terminal
      ? await invokeCoreMutation(req,res,context,'CLOSE_DEAL',{
        dealId:req.params.dealId,stage:parsed.data.stage,lostReason:parsed.data.lostReason || null,
      })
      : await invokeCoreMutation(req,res,context,'UPDATE_DEAL',{ dealId:req.params.dealId,changes:parsed.data });
      if (result) res.json({ data:result.deal, memoryStatus:result.memory_status || 'not_applicable', idempotentReplay:result.result === 'REPLAY' });
      return;
  });

  app.delete('/api/deals/:dealId', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db, false, true); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Apenas owner/admin podem arquivar negócios.' });
    const result = await invokeCoreMutation(req,res,context,'ARCHIVE_DEAL',{dealId:req.params.dealId});
    if (result) res.json({data:result.deal,idempotentReplay:result.result==='REPLAY'});
  });

  app.get('/api/priority/inbox', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const [{ data: conversations, error: convError }, { data: deals, error: dealError }, { data: risks, error: riskError }, { data: purchases, error: purchaseError }, { data: config, error: configError }, { data: clients, error: clientError }, { data: customerSignals, error: signalsError }] = await Promise.all([
        db.from('orkto_conversations').select('id,workspace_id,contact_name,contact_phone,status,source_channel,mood_state,priority_score,priority_reason,priority_override,last_message_at,updated_at').eq('workspace_id', context.id).order('updated_at',{ascending:false}).limit(250),
        db.from('orkto_deals').select('id,customer_ref,conversation_ref,value_cents,stage,status').eq('workspace_id', context.id).eq('status','open').limit(500),
        db.from('orkto_risk_assessments').select('customer_ref,score,assessed_at').eq('workspace_id', context.id).order('assessed_at',{ascending:false}).limit(500),
        db.from('orkto_purchases').select('customer_ref').eq('workspace_id',context.id).limit(2000),
        db.from('orkto_feature_configs').select('config,status').eq('workspace_id',context.id).eq('feature_key','priority_triage').maybeSingle(),
        db.from('clients').select('id,phone').eq('workspace_id',context.id).is('archived_at',null).limit(1000),
        db.from('orkto_customer_signals').select('customer_ref,signal_type,expires_at').eq('workspace_id',context.id).limit(2000),
      ]);
      if (convError) throw convError; if (dealError) throw dealError; if (riskError) throw riskError; if (purchaseError) throw purchaseError; if (configError) throw configError; if (clientError) throw clientError; if (signalsError) throw signalsError;
      const ids = (conversations || []).map((row: any) => row.id);
      const { data: messages, error: messageError } = ids.length ? await db.from('orkto_messages').select('conversation_id,direction,sent_at,content,read_at').in('conversation_id', ids).order('sent_at',{ascending:false}).limit(1000) : { data: [], error: null };
      if (messageError) throw messageError;
      const latest = new Map<string, any>(); const latestIncoming = new Map<string, any>(); const unread = new Map<string, number>();
      for (const message of messages || []) {
        if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
        if (message.direction === 'incoming' && !latestIncoming.has(message.conversation_id)) latestIncoming.set(message.conversation_id, message);
        if (message.direction === 'incoming' && !message.read_at) unread.set(message.conversation_id, (unread.get(message.conversation_id) || 0) + 1);
      }
      const latestRisk = new Map<string, number>();
      for (const risk of risks || []) if (!latestRisk.has(risk.customer_ref)) latestRisk.set(risk.customer_ref, Number(risk.score));
      const clientIdByPhone = new Map((clients || []).filter((client: any) => client.phone).map((client: any) => [String(client.phone).replace(/\D/g,''),String(client.id)]));
      const purchaseCounts = new Map<string, number>();
      for (const purchase of purchases || []) purchaseCounts.set(String(purchase.customer_ref), (purchaseCounts.get(String(purchase.customer_ref)) || 0) + 1);
      const signalCounts = new Map<string,{ positive:number; negative:number }>();
      for (const signal of customerSignals || []) {
        if (signal.expires_at && new Date(signal.expires_at).getTime() <= Date.now()) continue;
        const key = String(signal.customer_ref); const counts = signalCounts.get(key) || { positive:0,negative:0 };
        if (['positive_response','positive_feedback','repeat_buyer','positive_payment_history'].includes(String(signal.signal_type))) counts.positive++;
        if (['complaint','proposal_unanswered','missed_promise','negative_response'].includes(String(signal.signal_type))) counts.negative++;
        signalCounts.set(key,counts);
      }
      const configRecord = (config?.config || {}) as Record<string,unknown>;
      const slaMinutes = typeof configRecord.slaMinutes === 'number' ? Math.min(1440,Math.max(5,configRecord.slaMinutes)) : 60;
      const now = Date.now();
      const ranked = (conversations || []).map((conversation: any) => {
        const phone = conversation.contact_phone;
        const clientId = clientIdByPhone.get(String(phone || '').replace(/\D/g,''));
        const customerRefs = new Set<string>([String(phone || ''), ...(clientId ? [String(clientId)] : [])]);
        const relatedDeals = (deals || []).filter((deal: any) => customerRefs.has(String(deal.customer_ref || '')) || deal.conversation_ref === conversation.id);
        const last = latest.get(conversation.id);
        const waited = last?.direction === 'incoming' ? Math.max(0, (now - new Date(last.sent_at).getTime()) / 60_000) : 0;
        const riskScore = latestRisk.get(phone) || 0;
        const lastIncoming = latestIncoming.get(conversation.id);
        const classified = classifyConversationSignals(typeof lastIncoming?.content === 'string' ? lastIncoming.content : null);
        const recurringCustomer = [...customerRefs].some(ref => (purchaseCounts.get(ref) || 0) >= 2);
        const stage = relatedDeals.find((deal: any) => ['proposal','negotiation'].includes(String(deal.stage)))?.stage;
        const result = rankConversation({ valueCents: relatedDeals.reduce((sum: number, deal: any) => sum + Number(deal.value_cents || 0), 0), urgency: classified.urgency, minutesWaiting: waited, slaMinutes, riskScore, recurringCustomer, stage, intent: classified.intent === 'unknown' && relatedDeals.length ? 'buy' : classified.intent, override: conversation.priority_override as PriorityLevel | undefined });
        const conversationMessages = (messages || []).filter((message: any) => message.conversation_id === conversation.id).slice().sort((a:any,b:any) => new Date(a.sent_at).getTime()-new Date(b.sent_at).getTime());
        const unansweredIncoming: number[] = []; const responseTimes: number[] = [];
        for (const message of conversationMessages) {
          const sentAt = new Date(message.sent_at).getTime();
          if (!Number.isFinite(sentAt)) continue;
          if (message.direction === 'incoming') unansweredIncoming.push(sentAt);
          else if (message.direction === 'outgoing' && unansweredIncoming.length) responseTimes.push(Math.max(0,(sentAt-unansweredIncoming.shift()!)/60_000));
        }
        const refs = [...customerRefs];
        const positiveSignals = refs.reduce((sum,ref) => sum+(signalCounts.get(ref)?.positive || 0),0);
        const negativeSignals = refs.reduce((sum,ref) => sum+(signalCounts.get(ref)?.negative || 0),0);
        const incomingCount = conversationMessages.filter((message:any)=>message.direction === 'incoming').length;
        const replyRate = incomingCount ? responseTimes.length/incomingCount : undefined;
        const waitingForReplyMinutes = unansweredIncoming.length ? Math.max(0,(now-unansweredIncoming[unansweredIncoming.length-1])/60_000) : undefined;
        const responseMinutes = waitingForReplyMinutes ?? (responseTimes.length ? [...responseTimes].sort((a,b)=>a-b)[Math.floor(responseTimes.length/2)] : undefined);
        const mood = deriveMoodRing({ completedPurchases: refs.reduce((sum,ref)=>sum+(purchaseCounts.get(ref)||0),0), positiveSignals, negativeSignals, replyRate, responseMinutes });
        const operationalSignals = scoreOperationalAnxiety({ responseMinutes:waitingForReplyMinutes, messagesLastDay:conversationMessages.filter((message:any)=>message.direction==='incoming' && now-new Date(message.sent_at).getTime()<=86_400_000).length, urgencyWords:conversationMessages.filter((message:any)=>message.direction==='incoming').reduce((sum:number,message:any)=>sum+((String(message.content||'').match(/\b(urgente|hoje|agora|imediato|prazo|atrasado)\b/gi)||[]).length),0) });
        return { ...conversation, last_message: String(last?.content || '').slice(0,240), last_message_by: last?.direction === 'incoming' ? 'customer' : last?.direction === 'outgoing' ? 'operator' : null, recent_messages: conversationMessages.slice(-5).reverse().map((message: any) => ({ content: String(message.content || '').slice(0,240), direction: message.direction, sent_at: message.sent_at })), unread_count: unread.get(conversation.id) || 0, priority: result.level, priority_score: result.score, priority_reason: result.reasons, priority_overridden: result.overridden, risk_score: riskScore, priority_signals: classified.signals, operational_signals: operationalSignals, mood_state: mood.state, mood_confidence: mood.confidence, mood_explanation: mood.explanation, mood_reasons: mood.reasons, related_deal_ids: relatedDeals.map((deal: any) => deal.id) };
      }).sort((a: any, b: any) => b.priority_score - a.priority_score);
      res.json({ data: ranked });
    } catch (error) { failure(res, error, 'Não foi possível calcular a fila prioritária.'); }
  });

  app.put('/api/conversations/:conversationId/priority', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ priority: z.enum(['low','normal','high','urgent']).nullable() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Prioridade inválida.' });
    const context = await workspaceContext(req,res,db,false,true); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'SET_CONVERSATION_PRIORITY',{
      conversationId:req.params.conversationId,priority:parsed.data.priority,
    });
    if (result) res.json({ data:result.conversation, idempotentReplay:result.result==='REPLAY' });
  });

  app.post('/api/customers/:customerRef/risk/assess', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    const customerRef = req.params.customerRef.slice(0, 200);
    try {
      const { data: signals, error } = await db.from('orkto_customer_signals').select('signal_type,value,occurred_at').eq('workspace_id', context.id).eq('customer_ref', customerRef).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(200);
      if (error) throw error;
      const validTypes = new Set(['overdue_payment','missed_promise','proposal_unanswered','long_silence','repeat_buyer','positive_payment_history','explicit_opt_out']);
      const assessment = assessOperationalRisk((signals || []).filter((signal: any) => validTypes.has(signal.signal_type)).map((signal: any) => ({ type: signal.signal_type, severity: signal.value == null ? 1 : Math.min(2, Math.max(0, Number(signal.value))), observedAt: signal.occurred_at })) as RiskSignal[]);
      const { data, error: insertError } = await db.from('orkto_risk_assessments').insert({ workspace_id: context.id, customer_ref: customerRef, score: assessment.score, confidence: assessment.confidence, reasons: assessment.reasons, signals: assessment.signals, recommended_action: assessment.recommendedAction, engine_version: assessment.engineVersion, assessed_by: 'wia_rules_v1' }).select('*').single();
      if (insertError) throw insertError;
      await addAuditOrThrow(db, context.id, req.user?.id, 'risk.assessed', 'customer', customerRef, { assessment_id: data.id, score: assessment.score, risk_level: assessment.riskLevel, confidence: assessment.confidence, signal_count: assessment.signals.length });
      res.json({ data: { ...data, risk_level: assessment.riskLevel } });
    } catch (error) { failure(res, error, 'Não foi possível avaliar o risco com os dados disponíveis.'); }
  });

  app.get('/api/customers/:customerRef/memories', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_wia_memories').select('id,memory_type,entity_type,entity_ref,content,provenance,confidence,status,expires_at,created_at').eq('workspace_id', context.id).eq('entity_ref', req.params.customerRef.slice(0,200)).eq('status','active').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at',{ascending:false}).limit(100);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res, error, 'Não foi possível recuperar a memória comercial.'); }
  });

  app.post('/api/memories', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const parsed = memoryInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Memória inválida.' });
    if (parsed.data.type === 'raw_event') return res.status(403).json({ error:'Eventos brutos só podem ser registrados por ingestões confiáveis.', category:'permission_denied' });
    if (parsed.data.type === 'inference' && !parsed.data.explicitlyConfirmed) return res.status(409).json({ error: 'Inferências precisam ser confirmadas por uma pessoa antes de virarem memória persistente.', category: 'human_confirmation_required' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_wia_memories').insert({ workspace_id: context.id, memory_type: parsed.data.type, entity_type: parsed.data.entityType, entity_ref: parsed.data.entityRef || null, content: parsed.data.content, provenance:{ source:'operator_input', sourceRef:parsed.data.provenance.sourceRef }, confidence: parsed.data.confidence ?? null, status:'active', expires_at: parsed.data.expiresAt || null, created_by: req.user?.id || null }).select('*').single();
      if (error) throw error;
      await addAuditOrThrow(db, context.id, req.user?.id, 'memory.created', 'memory', data.id, { memory_type: data.memory_type, entity_ref: data.entity_ref });
      res.status(201).json({ data });
    } catch (error) { failure(res, error, 'Não foi possível registrar a memória.'); }
  });

  app.post('/api/memories/:memoryId/correct', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const parsed = z.object({ content: z.record(z.string(),z.unknown()), provenance: z.object({ source:z.string().trim().min(1).max(80), sourceRef:z.string().trim().max(200).optional() }), confidence:z.number().min(0).max(1).optional(), expiresAt:z.string().datetime({offset:true}).nullable().optional(), reason:z.string().trim().min(1).max(500) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Correção de memória inválida.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const { data: prior, error: priorError } = await db.from('orkto_wia_memories').select('*').eq('workspace_id',context.id).eq('id',req.params.memoryId).eq('status','active').maybeSingle();
      if (priorError) throw priorError; if (!prior) return res.status(404).json({ error:'Memória ativa não encontrada neste workspace.' });
      if (prior.memory_type === 'raw_event') return res.status(409).json({ error:'Eventos brutos são imutáveis. Registre uma memória factual corrigida com provenance apontando para o evento.', category:'policy_error' });
      const { data: replacement, error: insertError } = await db.from('orkto_wia_memories').insert({ workspace_id:context.id, memory_type:prior.memory_type, entity_type:prior.entity_type, entity_ref:prior.entity_ref, content:parsed.data.content, provenance:{ ...parsed.data.provenance, correction_reason:parsed.data.reason, corrects:prior.id }, confidence:parsed.data.confidence ?? prior.confidence, status:'active', supersedes:prior.id, expires_at:parsed.data.expiresAt === undefined ? prior.expires_at : parsed.data.expiresAt, created_by:req.user?.id || null }).select('*').single();
      if (insertError) throw insertError;
      const { error: supersedeError } = await db.from('orkto_wia_memories').update({ status:'superseded', updated_at:new Date().toISOString() }).eq('workspace_id',context.id).eq('id',prior.id).eq('status','active');
      if (supersedeError) {
        await db.from('orkto_wia_memories').delete().eq('workspace_id',context.id).eq('id',replacement.id);
        throw supersedeError;
      }
      await addAuditOrThrow(db,context.id,req.user?.id,'memory.corrected','memory',replacement.id,{ supersedes:prior.id, entity_ref:prior.entity_ref });
      res.status(201).json({ data:replacement, supersededId:prior.id });
    } catch (error) { failure(res,error,'Não foi possível corrigir a memória comercial.'); }
  });

  app.get('/api/collections', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const [cases, config, pendingActions] = await Promise.all([
        db.from('orkto_collection_cases').select('*').eq('workspace_id', context.id).order('due_at',{ascending:true}).limit(250),
        db.from('orkto_feature_configs').select('status,config,version').eq('workspace_id',context.id).eq('feature_key','collection_analyst').maybeSingle(),
        db.from('orkto_wia_actions').select('id,run_id,action_type,payload,status,created_at').eq('workspace_id',context.id).eq('action_type','prepare_collection_contact').eq('status','awaiting_approval').order('created_at',{ascending:false}).limit(100),
      ]);
      if (cases.error) throw cases.error; if (config.error) throw config.error; if (pendingActions.error) throw pendingActions.error;
      const ids = (cases.data || []).map((item: any) => item.id);
      const events = ids.length ? await db.from('orkto_collection_events').select('*').eq('workspace_id',context.id).in('case_id',ids).order('occurred_at',{ascending:true}) : { data: [], error: null };
      if (events.error) throw events.error;
      const byCase = new Map<string,any[]>();
      for (const event of events.data || []) byCase.set(event.case_id,[...(byCase.get(event.case_id) || []),event]);
      res.json({ data: (cases.data || []).map((item: any) => ({ ...item, events: byCase.get(item.id) || [] })), configuration: config.data || { status:'PENDING_CONFIGURATION', config:{} }, pendingActions:pendingActions.data || [] });
    } catch (error) { failure(res, error, 'Não foi possível carregar os casos de cobrança.'); }
  });

  app.put('/api/collections/config', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ targetCents: z.number().int().nonnegative().max(10_000_000_000).nullable().optional(), defaultTone: z.enum(['cordial','standard','firm']).optional(), escalationAfterDays: z.number().int().min(1).max(90).optional(), status: z.enum(['ACTIVE','CONFIGURABLE','EXPERIMENTAL','DISABLED','INTERNAL','PENDING_CONFIGURATION']).default('ACTIVE') }).refine(value => value.targetCents !== undefined || value.defaultTone !== undefined || value.escalationAfterDays !== undefined || value.status !== undefined).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Configuração da cobrança inválida.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error:'Apenas owner/admin podem alterar as metas de cobrança.' });
    try {
      const { data: prior, error: priorError } = await db.from('orkto_feature_configs').select('version,config').eq('workspace_id',context.id).eq('feature_key','collection_analyst').maybeSingle();
      if (priorError) throw priorError;
      const config = { ...((prior?.config || {}) as Record<string,unknown>), ...(parsed.data.targetCents !== undefined ? { targetCents: parsed.data.targetCents } : {}), ...(parsed.data.defaultTone ? { defaultTone: parsed.data.defaultTone } : {}), ...(parsed.data.escalationAfterDays ? { escalationAfterDays: parsed.data.escalationAfterDays } : {}) };
      const { data, error } = await db.from('orkto_feature_configs').upsert({ workspace_id:context.id, feature_key:'collection_analyst', status:parsed.data.status, config, version:Number(prior?.version || 0)+1, updated_by:req.user?.id || null, updated_at:new Date().toISOString() },{onConflict:'workspace_id,feature_key'}).select('*').single();
      if (error) throw error;
      await addAudit(db,context.id,req.user?.id,'collection.configured','collection_config',data.id,{ status:data.status, version:data.version });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível salvar a meta de cobrança.'); }
  });

  app.post('/api/collections', authenticate, requireDb, async (req, res) => {
    const parsed = collectionInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Caso de cobrança inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      if (parsed.data.dealId) {
        const { data: deal, error: dealError } = await db.from('orkto_deals').select('id').eq('workspace_id', context.id).eq('id', parsed.data.dealId).maybeSingle();
        if (dealError) throw dealError;
        if (!deal) return res.status(404).json({ error: 'Negócio não encontrado neste workspace.' });
      }
      const { data, error } = await db.from('orkto_collection_cases').upsert({ workspace_id: context.id, customer_ref: parsed.data.customerRef, deal_id: parsed.data.dealId || null, amount_cents: parsed.data.amountCents, due_at: parsed.data.dueAt, tone: parsed.data.tone, next_followup_at: parsed.data.nextFollowupAt || null, idempotency_key: parsed.data.idempotencyKey, created_by: req.user?.id || null }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('*').maybeSingle();
      if (error) throw error;
      let saved = data;
      if (!saved) { const existing = await db.from('orkto_collection_cases').select('*').eq('workspace_id', context.id).eq('idempotency_key', parsed.data.idempotencyKey).maybeSingle(); if (existing.error) throw existing.error; saved = existing.data; }
      if (data?.id) {
        await db.from('orkto_collection_events').insert({ workspace_id:context.id, case_id:data.id, event_type:'case_opened', note:'Caso criado para acompanhamento; nenhum contato externo foi enviado.', amount_cents:parsed.data.amountCents, actor_user_id:req.user?.id || null });
        await addAudit(db,context.id,req.user?.id,'collection.case_opened','collection_case',data.id,{ amount_cents:parsed.data.amountCents, due_at:parsed.data.dueAt });
      }
      res.status(data ? 201 : 200).json({ data: saved, idempotentReplay: !data });
    } catch (error) { failure(res, error, 'Não foi possível criar o caso de cobrança.'); }
  });

  app.patch('/api/collections/:caseId/status', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ status: z.enum(['OPEN','CONTACTED','NEGOTIATING','PROMISED','PAID','ESCALATED','CLOSED']), note: z.string().trim().max(1000).default(''), promiseAt: z.string().datetime({ offset: true }).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Estado de cobrança inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: current, error: readError } = await db.from('orkto_collection_cases').select('*').eq('workspace_id',context.id).eq('id',req.params.caseId).maybeSingle();
      if (readError) throw readError; if (!current) return res.status(404).json({ error: 'Caso de cobrança não encontrado.' });
      transitionCollection(String(current.status).toUpperCase() as CollectionStatus, parsed.data.status);
      const { data, error } = await db.from('orkto_collection_cases').update({ status: parsed.data.status.toLowerCase(), promise_at: parsed.data.promiseAt || current.promise_at, updated_at: new Date().toISOString(), ...(parsed.data.status === 'ESCALATED' ? { escalated_at: new Date().toISOString() } : {}) }).eq('workspace_id',context.id).eq('id',req.params.caseId).eq('status',String(current.status).toLowerCase()).select('*').maybeSingle();
      if (error) throw error; if (!data) return res.status(409).json({ error: 'O caso foi alterado em outra operação. Atualize a tela e tente novamente.' });
      const { error: eventError } = await db.from('orkto_collection_events').insert({ workspace_id: context.id, case_id: data.id, event_type: 'status_changed', note: parsed.data.note, actor_user_id: req.user?.id || null, occurred_at: new Date().toISOString() });
      if (eventError) throw eventError;
      await addAudit(db,context.id,req.user?.id,'collection.status_changed','collection_case',data.id,{ previous_status:current.status, status:data.status, promise_at:data.promise_at });
      if (parsed.data.status === 'ESCALATED') await db.from('orkto_notifications').upsert({ workspace_id:context.id, user_id:req.user?.id || null, type:'collection_escalated', title:'Caso de cobrança escalado', body:'Um caso de cobrança precisa de revisão humana.', entity_type:'collection_case', entity_ref:data.id, idempotency_key:`collection-escalated:${data.id}` },{onConflict:'workspace_id,idempotency_key',ignoreDuplicates:true});
      res.json({ data });
    } catch (error) { if (error instanceof Error && error.message.includes('Transição de cobrança inválida')) return res.status(409).json({ error: error.message, category: 'policy_error' }); failure(res, error, 'Não foi possível atualizar o caso de cobrança.'); }
  });

  app.get('/api/collections/:caseId/events', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const { data: current, error: caseError } = await db.from('orkto_collection_cases').select('id').eq('workspace_id',context.id).eq('id',req.params.caseId).maybeSingle();
      if (caseError) throw caseError; if (!current) return res.status(404).json({ error:'Caso de cobrança não encontrado.' });
      const { data, error } = await db.from('orkto_collection_events').select('*').eq('workspace_id',context.id).eq('case_id',current.id).order('occurred_at',{ascending:true}).limit(500);
      if (error) throw error;
      res.json({ data:data || [] });
    } catch (error) { failure(res,error,'Não foi possível carregar o histórico de cobrança.'); }
  });

  app.post('/api/collections/:caseId/prepare-contact', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db,false); if (!context) return;
    const actorId = req.user?.id || context.ownerUserId;
    try {
      const { data: current, error } = await db.from('orkto_collection_cases').select('*').eq('workspace_id',context.id).eq('id',req.params.caseId).maybeSingle();
      if (error) throw error; if (!current) return res.status(404).json({ error:'Caso de cobrança não encontrado.' });
      if (['paid','closed'].includes(String(current.status).toLowerCase())) return res.status(409).json({ error:'Um caso pago ou encerrado não pode gerar novo contato.', category:'policy_error' });
      const { data: policy, error: policyError } = await db.from('orkto_feature_configs').select('status,config').eq('workspace_id',context.id).eq('feature_key','collection_analyst').maybeSingle();
      if (policyError) throw policyError;
      if (String(policy?.status || '').toUpperCase() !== 'ACTIVE') return res.status(409).json({ error:'Ative a Collection Analyst nas configurações antes de preparar contato.', category:'configuration_required' });
      const { data: optOut, error: optOutError } = await db.from('orkto_customer_signals').select('id').eq('workspace_id',context.id).eq('customer_ref',current.customer_ref).eq('signal_type','explicit_opt_out').limit(1);
      if (optOutError) throw optOutError;
      if (optOut?.length) return res.status(409).json({ error:'O cliente solicitou interrupção de contato. A ação foi bloqueada.', category:'policy_error' });
      const idempotencyKey = `collection-contact:${current.id}:${current.updated_at || current.status}`;
      const { data: existing, error: existingError } = await db.from('orkto_wia_actions').select('*').eq('workspace_id',context.id).eq('idempotency_key',idempotencyKey).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return res.json({ data:existing, idempotentReplay:true, externalDelivery:'CONFIGURATION_REQUIRED' });
      const amount = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(current.amount_cents)/100);
      const due = new Date(current.due_at).toLocaleDateString('pt-BR');
      const tone = String(current.tone || 'standard').toLowerCase();
      const rawDraft = tone === 'cordial'
        ? `Olá! Estamos organizando nossos registros e identificamos um pagamento de ${amount}, com vencimento em ${due}. Você poderia nos informar se já foi pago ou uma previsão? Ficamos à disposição para ajudar.`
        : tone === 'firm'
          ? `Olá. Consta em nossos registros o pagamento de ${amount}, vencido em ${due}. Por favor, informe a situação ou uma previsão para atualizarmos o acompanhamento.`
          : `Olá! Consta em nossos registros um pagamento de ${amount}, com vencimento em ${due}. Você poderia nos confirmar a situação ou uma previsão?`;
      const messageDraft = applyResponsePipeline({
        draft:rawDraft,
        surface:'collection',
        tone:tone === 'cordial' ? 'cordial' : tone === 'firm' ? 'firm' : 'standard',
        verifiedFacts:[`Valor registrado: ${amount}`,`Vencimento registrado: ${due}`],
        sourceRefs:[`collection_case:${current.id}`],
      });
      const traceId = crypto.randomUUID();
      const { data: run, error: runError } = await db.from('orkto_wia_runs').insert({ workspace_id:context.id,user_id:actorId,feature:'collection_contact_draft',agent:'collection_agent',task_type:'fast',status:'succeeded',provider:'none',model:'deterministic-collection-draft-v1',trace_id:traceId,context_refs:[`collection_case:${current.id}`],summary:messageDraft,started_at:new Date().toISOString(),completed_at:new Date().toISOString() }).select('id').single();
      if (runError) throw runError; if (!run?.id) throw new Error('WiaRun não foi persistido.');
      const payload = { caseId:current.id, customerRef:current.customer_ref, amountCents:Number(current.amount_cents), dueAt:current.due_at, tone, messageDraft, responsePolicyVersion:'response-safety-v1', externalDelivery:'CONFIGURATION_REQUIRED' };
      const { data, error: actionError } = await db.from('orkto_wia_actions').insert({ workspace_id:context.id,run_id:run.id,action_type:'prepare_collection_contact',payload,rationale:'Rascunho determinístico com valor e vencimento do caso; contato externo exige aprovação e canal configurado.',risk_level:'medium',confidence:0.9,status:'awaiting_approval',requires_approval:true,idempotency_key:idempotencyKey,created_by:actorId }).select('*').single();
      if (actionError) throw actionError;
      await addAuditOrThrow(db,context.id,actorId,'collection.contact_prepared','collection_case',current.id,{ action_id:data.id,run_id:run.id,external_delivery:'configuration_required',tone });
      const { error: eventError } = await db.from('orkto_collection_events').insert({ workspace_id:context.id,case_id:current.id,event_type:'contact_prepared',note:'Rascunho preparado pela WIA para aprovação; nenhum contato foi enviado.',actor_user_id:actorId });
      if (eventError) throw eventError;
      res.status(201).json({ data, runId:run.id, externalDelivery:'CONFIGURATION_REQUIRED', requiresApproval:true });
    } catch (error) { failure(res,error,'Não foi possível preparar o contato de cobrança.'); }
  });

  app.post('/api/customers/duplicate-check', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ name: z.string().trim().max(200).optional(), phone: z.string().trim().max(80).optional(), email: z.string().trim().email().max(200).optional(), address: z.string().trim().max(300).optional() }).refine(value => Object.values(value).some(Boolean)).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Informe ao menos um campo de cliente para comparar.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: clients, error } = await db.from('clients').select('id,name,phone,company,vehicle_or_service').eq('workspace_id', context.id).is('archived_at',null).limit(500);
      if (error) throw error;
      const candidate: CustomerMatchInput = { id: 'candidate', ...parsed.data };
      const matches = (clients || []).map((client: any) => ({ client, match: compareCustomers(candidate, { id: client.id, name: client.name, phone: client.phone, address: client.company }) }))
        .filter((entry: any) => entry.match.status !== 'NO_MATCH').sort((a: any, b: any) => b.match.score - a.match.score).slice(0,20);
      res.json({ status: matches.some((item: any) => item.match.status === 'MATCH') ? 'MATCH' : matches.length ? 'POSSIBLE_MATCH' : 'NO_MATCH', matches });
    } catch (error) { failure(res, error, 'Não foi possível comparar clientes existentes.'); }
  });

  app.get('/api/customers/:customerRef/mood', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    const customerRef = req.params.customerRef.slice(0,200);
    try {
      const [customer, purchases, signals, riskResult] = await Promise.all([
        db.from('clients').select('id,phone').eq('workspace_id',context.id).eq('id',customerRef).maybeSingle(),
        db.from('orkto_purchases').select('id').eq('workspace_id',context.id).eq('customer_ref',customerRef).limit(500),
        db.from('orkto_customer_signals').select('signal_type,occurred_at').eq('workspace_id',context.id).eq('customer_ref',customerRef).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(200),
        db.from('orkto_risk_assessments').select('score,confidence,reasons,recommended_action,assessed_at').eq('workspace_id',context.id).eq('customer_ref',customerRef).order('assessed_at',{ascending:false}).limit(1).maybeSingle(),
      ]);
      if (customer.error) throw customer.error; if (purchases.error) throw purchases.error; if (signals.error) throw signals.error; if (riskResult.error) throw riskResult.error;
      const phone = customer.data?.phone || customerRef;
      const { data: conversations, error: conversationsError } = await db.from('orkto_conversations').select('id,created_at').eq('workspace_id',context.id).eq('contact_phone',phone).limit(20);
      if (conversationsError) throw conversationsError;
      const signalRows = signals.data || [];
      const positiveSignals = signalRows.filter((signal: any) => ['positive_response','positive_feedback','repeat_buyer'].includes(signal.signal_type)).length;
      const negativeSignals = signalRows.filter((signal: any) => ['complaint','proposal_unanswered','missed_promise'].includes(signal.signal_type)).length;
      let mood = deriveMoodRing({ completedPurchases: purchases.data?.length || 0, positiveSignals, negativeSignals });
      let messages: any[] = [];
      const conversationIds = (conversations || []).map((conversation: any) => conversation.id);
      if (conversationIds.length) {
        const result = await db.from('orkto_messages').select('conversation_id,content,sent_at,direction').in('conversation_id',conversationIds).order('sent_at',{ascending:true}).limit(2000);
        if (result.error) throw result.error;
        messages = result.data || [];
      }
      const now = Date.now();
      const validMessages = messages.filter((message: any) => Number.isFinite(new Date(message.sent_at).getTime()));
      const incoming = validMessages.filter((message: any) => message.direction === 'incoming');
      const lastDay = incoming.filter((message: any) => now - new Date(message.sent_at).getTime() <= 86_400_000);
      const lastWeek = incoming.filter((message: any) => now - new Date(message.sent_at).getTime() <= 7 * 86_400_000).length;
      const previousWeek = incoming.filter((message: any) => { const age = now - new Date(message.sent_at).getTime(); return age > 7 * 86_400_000 && age <= 14 * 86_400_000; }).length;
      const patternChange = previousWeek ? Math.abs(lastWeek - previousWeek) / previousWeek : 0;
      const urgencyWords = lastDay.reduce((count: number, message: any) => count + ((String(message.content || '').match(/\b(urgente|hoje|agora|imediato|prazo|atrasado)\b/gi) || []).length), 0);
      const responseTimes: number[] = []; const pendingByConversation = new Map<string,number[]>();
      for (const message of validMessages) {
        const time = new Date(message.sent_at).getTime();
        const conversationId = String(message.conversation_id || '');
        const pendingIncoming = pendingByConversation.get(conversationId) || [];
        if (message.direction === 'incoming') pendingIncoming.push(time);
        else if (message.direction === 'outgoing' && pendingIncoming.length) {
          const receivedAt = pendingIncoming.shift()!;
          responseTimes.push(Math.max(0,(time-receivedAt)/60_000));
        }
        pendingByConversation.set(conversationId,pendingIncoming);
      }
      const awaitingReplySince = [...pendingByConversation.values()].flat().sort((a,b)=>b-a)[0] ?? null;
      const replyRate = incoming.length ? responseTimes.length / incoming.length : undefined;
      const responseMinutes = responseTimes.length ? [...responseTimes].sort((a,b)=>a-b)[Math.floor(responseTimes.length/2)] : undefined;
      mood = deriveMoodRing({ completedPurchases: purchases.data?.length || 0, positiveSignals, negativeSignals, replyRate, responseMinutes });
      const awaitingMinutes = awaitingReplySince ? (now-awaitingReplySince)/60_000 : undefined;
      const anxiety = scoreOperationalAnxiety({ responseMinutes: awaitingMinutes, messagesLastDay: lastDay.length, urgencyWords, patternChange });
      const riskScore = riskResult.data ? Number(riskResult.data.score) : null;
      const riskLevel = riskScore === null ? null : riskScore >= 85 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW';
      res.json({ mood, operationalSignals: { score: anxiety.score, signals: anxiety.signals }, risk: riskResult.data ? { ...riskResult.data, risk_level:riskLevel } : null, note: 'Sinais de conversas e operação; não são diagnóstico emocional ou perfil psicológico.' });
    } catch (error) { failure(res,error,'Não foi possível calcular os sinais de relacionamento.'); }
  });

  app.get('/api/graph', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const [clients, deals, conversations, proposals] = await Promise.all([
        db.from('clients').select('id,name,phone,company').eq('workspace_id',context.id).is('archived_at',null).limit(1000),
        db.from('orkto_deals').select('id,title,customer_ref,status,value_cents,conversation_ref,source').eq('workspace_id',context.id).limit(1000),
        db.from('orkto_conversations').select('id,contact_name,contact_phone,status').eq('workspace_id',context.id).limit(1000),
        db.from('quotes').select('id,quote_number,status,deal_id,customer_id').eq('workspace_id',context.id).is('archived_at',null).limit(1000),
      ]);
      if (clients.error) throw clients.error; if (deals.error) throw deals.error; if (conversations.error) throw conversations.error; if (proposals.error) throw proposals.error;
      res.json(buildCommercialGraph({ workspaceId:context.id, customers:clients.data || [], deals:deals.data || [], conversations:conversations.data || [], proposals:proposals.data || [] }));
    } catch (error) { failure(res,error,'Não foi possível montar o grafo comercial.'); }
  });

  app.get('/api/team', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const [members, invites] = await Promise.all([
        db.from('orkto_workspace_members').select('user_id,role,status,joined_at').eq('workspace_id',context.id).order('created_at',{ascending:true}),
        db.from('orkto_workspace_invites').select('id,email,role,status,expires_at,created_at').eq('workspace_id',context.id).eq('status','invited').order('created_at',{ascending:false}),
      ]);
      if (members.error) throw members.error; if (invites.error) throw invites.error;
      res.json({ members: members.data || [], invites: invites.data || [], currentRole: context.role });
    } catch (error) { failure(res,error,'Não foi possível carregar a equipe.'); }
  });

  app.post('/api/team/invites', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ email: z.string().trim().email().max(254), role: z.enum(['admin','manager','member']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Convite inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role) || (parsed.data.role === 'admin' && context.role !== 'owner')) return res.status(403).json({ error: 'Seu papel não pode convidar essa função.' });
    try {
      const access = await loadWorkspacePlanAccess(db,context.id);
      const [members, invites] = await Promise.all([
        db.from('orkto_workspace_members').select('user_id',{count:'exact',head:true}).eq('workspace_id',context.id).eq('status','active'),
        db.from('orkto_workspace_invites').select('id',{count:'exact',head:true}).eq('workspace_id',context.id).eq('status','invited').gt('expires_at',new Date().toISOString()),
      ]);
      if (members.error) throw members.error; if (invites.error) throw invites.error;
      const seatCheck = checkPlanLimit(access.entitlements,'seats',(members.count || 0)+(invites.count || 0));
      if (seatCheck.allowed === false) return res.status(seatCheck.reason === 'limit_reached' ? 403 : 503).json({ error:seatCheck.reason === 'limit_reached' ? 'Limite de pessoas do plano atingido.' : 'Limite de pessoas ainda não configurado para este plano.', category:seatCheck.reason });
      const token = crypto.randomBytes(32).toString('base64url'); const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const { data, error } = await db.from('orkto_workspace_invites').insert({ workspace_id:context.id, email:parsed.data.email.toLowerCase(), role:parsed.data.role, token_hash:tokenHash, invited_by:req.user?.id, expires_at:new Date(Date.now()+7*86_400_000).toISOString() }).select('id,email,role,expires_at').single();
      if (error) throw error;
      res.status(201).json({ data, invitePath:`/join-workspace?token=${token}`, delivery:'manual_link_copy_required', emailProvider:'not_configured' });
    } catch (error) { failure(res,error,'Não foi possível criar o convite.'); }
  });

  app.post('/api/team/invites/accept', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ token: z.string().min(32).max(200) }).safeParse(req.body);
    if (!parsed.success || !req.user?.email) return res.status(400).json({ error: 'Convite ou e-mail de sessão inválido.' });
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    try {
      const { data: invite, error } = await db.from('orkto_workspace_invites').select('*').eq('token_hash',tokenHash).maybeSingle();
      if (error) throw error;
      if (!invite) return res.status(404).json({ error: 'Convite expirado ou já utilizado.' });
      if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) return res.status(403).json({ error: 'Entre com o e-mail que recebeu o convite.' });
      const resumableAcceptance = invite.status === 'accepted' && invite.accepted_by === req.user.id;
      if (!resumableAcceptance && (invite.status !== 'invited' || new Date(invite.expires_at).getTime() <= Date.now())) return res.status(404).json({ error: 'Convite expirado, revogado ou já utilizado.' });
      const access = await loadWorkspacePlanAccess(db,invite.workspace_id);
      if (access.configurationRequired) return res.status(503).json({ error:'Plano/workspace ainda não configurado.', category:'configuration_required' });
      if (access.readOnly) return res.status(423).json({ error:'Este workspace está somente para leitura e não pode aceitar novos membros.', category:'workspace_read_only' });
      const [{count:memberCount,error:memberCountError},{count:pendingCount,error:pendingCountError}] = await Promise.all([
        db.from('orkto_workspace_members').select('user_id',{count:'exact',head:true}).eq('workspace_id',invite.workspace_id).eq('status','active'),
        db.from('orkto_workspace_invites').select('id',{count:'exact',head:true}).eq('workspace_id',invite.workspace_id).eq('status','invited').gt('expires_at',new Date().toISOString()),
      ]);
      if (memberCountError) throw memberCountError; if (pendingCountError) throw pendingCountError;
      const alreadyActive = await isActiveWorkspaceMember(db,invite.workspace_id,req.user.id);
      if (!alreadyActive) {
        const seatCheck = checkPlanLimit(access.entitlements,'seats',(memberCount || 0)+(pendingCount || 0)-1);
        if (seatCheck.allowed === false) return res.status(seatCheck.reason === 'limit_reached' ? 403 : 503).json({ error:seatCheck.reason === 'limit_reached' ? 'Limite de pessoas do plano atingido.' : 'Limite de pessoas ainda não configurado para este plano.', category:seatCheck.reason });
      }
      if (!resumableAcceptance) {
        const acceptedAt = new Date().toISOString();
        const { data: claimed, error: claimError } = await db.from('orkto_workspace_invites').update({ status:'accepted',accepted_by:req.user.id,accepted_at:acceptedAt })
          .eq('workspace_id',invite.workspace_id).eq('id',invite.id).eq('status','invited').gt('expires_at',acceptedAt).select('id').maybeSingle();
        if (claimError) throw claimError;
        if (!claimed) return res.status(409).json({ error:'O convite foi revogado, expirou ou foi aceito por outra sessão.',category:'invite_state_conflict' });
      }
      const member = await db.from('orkto_workspace_members').upsert({ workspace_id:invite.workspace_id, user_id:req.user.id, role:invite.role, status:'active', invited_by:invite.invited_by, joined_at:new Date().toISOString() }, { onConflict:'workspace_id,user_id' });
      if (member.error) throw member.error;
      await addAuditOrThrow(db,invite.workspace_id,req.user.id,'workspace.invite.accepted','workspace_invite',invite.id,{ role:invite.role });
      res.json({ success:true,workspaceId:invite.workspace_id,role:invite.role });
    } catch (error) { failure(res,error,'Não foi possível aceitar o convite.'); }
  });

  app.post('/api/team/invites/:inviteId/revoke', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error:'Apenas owner/admin podem revogar convites.' });
    try {
      const { data, error } = await db.from('orkto_workspace_invites').update({ status:'revoked' }).eq('workspace_id',context.id).eq('id',req.params.inviteId).eq('status','invited').select('id').maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error:'Convite não encontrado ou já encerrado.' });
      res.json({ success:true });
    } catch (error) { failure(res,error,'Não foi possível revogar o convite.'); }
  });

  app.get('/api/plan/catalog', authenticate, requireDb, async (_req, res) => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await db.from('orkto_plan_price_versions').select('plan_key,price_cents,currency,price_is_public,entitlements,version,effective_from,effective_until').eq('status','approved').lte('effective_from',now).or(`effective_until.is.null,effective_until.gt.${now}`).order('effective_from',{ascending:false}).limit(100);
      if (error) throw error;
      const latest = new Map<string,any>();
      for (const version of data || []) if (!latest.has(version.plan_key)) latest.set(version.plan_key,version);
      const catalog = [...latest.values()].map(plan => ({ ...plan, price_cents:plan.price_is_public && plan.price_cents !== null ? plan.price_cents : null }));
      res.json({ data: catalog, catalogKeys:['starter','pro','business','scale','enterprise','founders','legacy_standard'], publicPricesApproved: catalog.some((plan: any) => plan.price_is_public && plan.price_cents !== null), pricingSource: 'versioned_assumptions' });
    } catch (error) { failure(res,error,'Não foi possível carregar o catálogo de planos.'); }
  });

  app.get('/api/billing/current', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const [workspace, subscription, usage] = await Promise.all([
        db.from('orkto_workspaces').select('plan_key,subscription_status').eq('id',context.id).maybeSingle(),
        db.from('orkto_workspace_subscriptions').select('plan_key,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end').eq('workspace_id',context.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        db.from('orkto_plan_usage').select('feature_key,quantity,period_start').eq('workspace_id',context.id).order('period_start',{ascending:false}).limit(100),
      ]);
      if (workspace.error) throw workspace.error; if (subscription.error) throw subscription.error; if (usage.error) throw usage.error;
      const access = await loadWorkspacePlanAccess(db,context.id);
      res.json({ subscription: subscription.data, workspacePlan: access.planKey, status: access.status, trialEndsAt:access.trialEndsAt, readOnly:access.readOnly, configurationRequired:access.configurationRequired, entitlements:access.entitlements, effectivePriceVersion:access.effectivePriceVersion, usage: usage.data || [], checkout: 'not_configured', pricesPublic:access.publicPriceApproved });
    } catch (error) { failure(res,error,'Não foi possível carregar o plano e o uso.'); }
  });

  app.get('/api/notifications', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_notifications').select('*').eq('workspace_id',context.id).or(`user_id.is.null,user_id.eq.${req.user?.id}`).order('created_at',{ascending:false}).limit(100);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res,error,'Não foi possível carregar as notificações.'); }
  });

  app.post('/api/notifications/:notificationId/read', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_notifications').update({ read_at:new Date().toISOString() }).eq('workspace_id',context.id).eq('id',req.params.notificationId).or(`user_id.is.null,user_id.eq.${req.user?.id}`).select('id,read_at').maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error:'Notificação não encontrada.' });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível marcar a notificação.'); }
  });

  app.post('/api/conversations/:conversationId/sussurros', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ content: z.string().trim().min(1).max(2000), toUserId: z.string().uuid().optional(), expiresAt: z.string().datetime({ offset: true }).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Instrução privada inválida.' });
    const context = await workspaceContext(req, res, db, false); if (!context) return;
    if (!['owner','admin','manager'].includes(context.role)) return res.status(403).json({ error:'Apenas gestores podem criar instruções privadas.' });
    try {
      const { data: conversation, error: conversationError } = await db.from('orkto_conversations').select('id').eq('id',req.params.conversationId).eq('workspace_id',context.id).maybeSingle();
      if (conversationError) throw conversationError; if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
      const expiresAt = parsed.data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (new Date(expiresAt).getTime() <= Date.now() || new Date(expiresAt).getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'A expiração precisa estar entre agora e 30 dias.' });
      if (parsed.data.toUserId) {
        const { data: recipient, error: recipientError } = await db.from('orkto_workspace_members').select('user_id').eq('workspace_id',context.id).eq('user_id',parsed.data.toUserId).eq('status','active').maybeSingle();
        if (recipientError) throw recipientError; if (!recipient) return res.status(400).json({ error: 'Operador não pertence a este workspace.' });
      }
      const { data, error } = await db.from('orkto_sussurros').insert({ workspace_id: context.id, conversation_id: conversation.id, from_user_id: req.user?.id || null, to_user_id: parsed.data.toUserId || null, source: 'manager', content: parsed.data.content, expires_at: expiresAt }).select('*').single();
      if (error) throw error;
      const { error: auditError } = await addAudit(db,context.id,req.user?.id,'sussurro.created','sussurro',data.id,{ conversation_id: conversation.id, to_user_id: data.to_user_id || null });
      if (auditError) throw auditError;
      res.status(201).json({ data });
    } catch (error) { failure(res, error, 'Não foi possível registrar a instrução privada.'); }
  });

  app.get('/api/conversations/:conversationId/sussurros', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db, false); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_sussurros').select('*').eq('workspace_id',context.id).eq('conversation_id',req.params.conversationId)
        .or(`to_user_id.is.null,to_user_id.eq.${req.user?.id},from_user_id.eq.${req.user?.id}`)
        .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res, error, 'Não foi possível carregar as instruções privadas.'); }
  });

  app.post('/api/conversations/:conversationId/sussurros/:sussurroId/read', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db, false); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_sussurros').update({ read_at: new Date().toISOString() })
        .eq('workspace_id',context.id).eq('conversation_id',req.params.conversationId).eq('id',req.params.sussurroId)
        .is('read_at',null).or(`to_user_id.is.null,to_user_id.eq.${req.user?.id}`).select('id,read_at').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Instrução não encontrada, expirada ou já lida.' });
      await addAudit(db,context.id,req.user?.id,'sussurro.read','sussurro',data.id,{});
      res.json({ data });
    } catch (error) { failure(res, error, 'Não foi possível marcar a instrução privada como lida.'); }
  });

  app.post('/api/wia/route-agent', authenticate, async (req, res) => {
    const parsed = z.object({ message: z.string().trim().min(1).max(4000), overdueAmountCents: z.number().int().nonnegative().optional(), reportRequest: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Comando da WIA inválido.' });
    if (!db) return res.status(503).json({ error: 'WIA indisponível sem banco persistente.', category: 'configuration_error' });
    // START_WIA_RUN/COMPLETE_WIA_RUN are authorized by the Core Mutation
    // Gateway, including plan enforcement. Do not query plan state through the
    // shared public client before the gateway sees the authenticated request.
    const context = await workspaceContext(req, res, db, false, true); if (!context) return;
    const requestDb = req.authenticatedSupabase || db;
    const agent = (await import('./orkto-core/full-operational.js')).routeSwarmAgent(parsed.data.message, parsed.data);
    const ownerId = context.ownerUserId;
    const traceId = crypto.randomUUID();
    const started = await invokeCoreMutation(req,res,context,'START_WIA_RUN',{ traceId,agent });
    if (!started?.wia_run_id) return;
    const runId = started.wia_run_id;
    let sourceIds: string[] = [];
    try {
      const [quotesResult, clientsResult, profileResult] = await Promise.all([
        requestDb.from('quotes').select('id,total').eq('workspace_id',context.id).in('status',['pending','sent','viewed']).limit(50),
        requestDb.from('clients').select('id',{count:'exact',head:true}).eq('workspace_id',context.id),
        requestDb.from('profiles').select('company_name').eq('id',ownerId).maybeSingle(),
      ]);
      if (quotesResult.error) throw quotesResult.error; if (clientsResult.error) throw clientsResult.error; if (profileResult.error) throw profileResult.error;
      sourceIds = (quotesResult.data || []).map((quote: any) => `quote:${quote.id}`);
      const { decideWithWia } = await import('./wiaos/wia-service.js');
      const result = await decideWithWia({
        message: parsed.data.message,
        context: { openQuotes: quotesResult.data?.length || 0, pendingValue: (quotesResult.data || []).reduce((sum: number, quote: any) => sum + Number(quote.total || 0),0), clients: clientsResult.count || 0, companyName: profileResult.data?.company_name || undefined },
        sourceIds, agent,
        ...(req.tenantContext ? { toolRuntime: { registry: (await import('./wiaos/t0-tools.js')).createT0ToolRegistry(new (await import('./wiaos/t0-tools.js')).SupabaseT0DataSource(requestDb)), context: { tenant: req.tenantContext, traceId } } } : {}),
      });
      const resolvedContextRefs = [...new Set([...sourceIds, ...result.decision.sourceIds])].slice(0,30);
      const completed = await invokeCoreMutation(req,res,context,'COMPLETE_WIA_RUN',{
        traceId,status:'succeeded',agent,contextRefs:resolvedContextRefs,path:result.path,mode:result.mode,
        decision:result.decision,usage:result.usage,toolExecutions:result.toolExecutions.map(execution=>({
          toolName:execution.toolName,status:execution.status,sourceIds:execution.sourceIds,
          durationMs:execution.durationMs,...(execution.error?{error:execution.error}:{}),
        })),
      });
      if (!completed) return;
      const { runId: serviceRunId, ...decisionResult } = result;
      return res.json({ success: true, agent, traceId, runId, serviceRunId, ...decisionResult });
    } catch (error) {
      await invokeCoreMutation(req,res,context,'COMPLETE_WIA_RUN',{
        traceId,status:'failed',errorCategory:(error as { code?: string })?.code || 'execution_error',agent,
      });
      if (res.headersSent) return;
      failure(res, error, 'A WIA não conseguiu preparar a resposta com os dados disponíveis.');
    }
  });

  app.get('/api/reports', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_reports').select('id,report_type,period_start,period_end,metrics,interpretation,generated_at').eq('workspace_id',context.id).order('generated_at',{ascending:false}).limit(100);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res,error,'Não foi possível carregar os relatórios.'); }
  });

  app.post('/api/reports/generate', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ reportType: z.enum(['DAILY_OPERATIONAL','WEEKLY_TACTICAL','MONTHLY_STRATEGIC','ANNUAL_STRATEGIC']), periodStart: z.string().date(), periodEnd: z.string().date() }).safeParse(req.body);
    if (!parsed.success || parsed.data.periodEnd < parsed.data.periodStart) return res.status(400).json({ error: 'Período de relatório inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const metrics = await loadWorkspaceMetrics(db,context.id,`${parsed.data.periodStart}T00:00:00.000Z`,`${parsed.data.periodEnd}T23:59:59.999Z`);
      const { data: prior, error: priorError } = await db.from('orkto_reports').select('version').eq('workspace_id',context.id).eq('report_type',parsed.data.reportType).eq('period_start',parsed.data.periodStart).eq('period_end',parsed.data.periodEnd).order('version',{ascending:false}).limit(1).maybeSingle();
      if (priorError) throw priorError;
      const { data, error } = await db.from('orkto_reports').insert({ workspace_id: context.id, report_type: parsed.data.reportType, period_start: parsed.data.periodStart, period_end: parsed.data.periodEnd, metrics, interpretation: null, version: Number(prior?.version || 0) + 1, created_by: req.user?.id || null }).select('*').single();
      if (error) throw error;
      await addAudit(db,context.id,req.user?.id,'report.generated','report',data.id,{ report_type: data.report_type, period_start: data.period_start, period_end: data.period_end });
      res.status(201).json({ data, interpretationStatus: 'not_generated', message: 'Os números vêm dos registros existentes. A interpretação WIA ainda não foi solicitada.' });
    } catch (error) { failure(res,error,'Não foi possível gerar o relatório com os dados disponíveis.'); }
  });

  app.post('/api/reports/:reportId/interpret', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db,false); if (!context) return;
    const actorId = req.user?.id || context.ownerUserId;
    let runId: string | null = null;
    let traceId = crypto.randomUUID();
    try {
      const { data: report, error: reportError } = await db.from('orkto_reports').select('id,report_type,period_start,period_end,metrics,interpretation').eq('workspace_id',context.id).eq('id',req.params.reportId).maybeSingle();
      if (reportError) throw reportError; if (!report) return res.status(404).json({ error:'Relatório não encontrado neste workspace.' });
      if (report.interpretation) return res.status(409).json({ error:'Este relatório já possui uma interpretação WIA. Gere outra versão calculada se precisar de nova análise.', category:'already_interpreted' });
      const access = await loadWorkspacePlanAccess(db,context.id);
      if (!hasPlanFeature(access,'wia')) return res.status(403).json({ error:'O plano atual não inclui interpretação WIA.', category:'entitlement_required', feature:'wia' });
      const monthlyLimit = access.entitlements.limits?.monthly_wia_runs;
      if (monthlyLimit === undefined) return res.status(503).json({ error:'Limite mensal da WIA não está configurado para este plano.', category:'configuration_required' });
      const usageResult = await db.rpc('orkto_consume_plan_usage',{ p_workspace_id:context.id, p_period_start:`${new Date().toISOString().slice(0,7)}-01`, p_feature_key:'monthly_wia_runs', p_delta:1, p_limit:monthlyLimit });
      if (usageResult.error) throw usageResult.error;
      const usage = Array.isArray(usageResult.data) ? usageResult.data[0] : usageResult.data;
      if (!usage?.allowed) return res.status(429).json({ error:'Limite mensal da WIA atingido para este plano.', category:'plan_limit_reached', feature:'monthly_wia_runs', limit:monthlyLimit });

      traceId = crypto.randomUUID();
      const { data: run, error: runError } = await db.from('orkto_wia_runs').insert({ workspace_id:context.id, user_id:actorId, feature:'report_interpretation', agent:'reporting_agent', task_type:'deep_analysis', status:'running', trace_id:traceId, context_refs:[`report:${report.id}`], started_at:new Date().toISOString() }).select('id').single();
      if (runError) throw runError; runId = run?.id || null; if (!runId) throw new Error('WiaRun não foi iniciado com persistência.');
      const { decideWithWia } = await import('./wiaos/wia-service.js');
      const reportMetrics = report.metrics && typeof report.metrics === 'object' && !Array.isArray(report.metrics)
        ? report.metrics as Record<string, unknown>
        : {};
      const result = await decideWithWia({
        agent:'reporting_agent',
        message:`Interprete este relatório ORKTO. Use somente os dados calculados incluídos abaixo; se algo estiver ausente, diga que não há dados. Separe observações, limites e próximos passos sugeridos. Não invente métricas, não alegue causalidade e não execute nem altere ações, negócios, propostas ou políticas.\n${JSON.stringify({ type:report.report_type, periodStart:report.period_start, periodEnd:report.period_end, metrics:report.metrics })}`,
        context:{ reportMetrics, reportType:report.report_type, reportPeriod:{ start:report.period_start, end:report.period_end } },
        sourceIds:[`report:${report.id}`],
      });
      if (result.decision.action !== 'answer' || !result.decision.messageDraft.trim()) {
        await db.from('orkto_wia_runs').update({ status:'failed', error_category:'policy_error', completed_at:new Date().toISOString() }).eq('workspace_id',context.id).eq('id',runId);
        return res.status(409).json({ error:'A WIA não produziu uma interpretação segura; nenhuma alteração foi aplicada ao relatório.', category:'policy_error' });
      }
      const completedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await db.from('orkto_reports').update({ interpretation:result.decision.messageDraft, wia_run_id:runId }).eq('workspace_id',context.id).eq('id',report.id).is('interpretation',null).select('*').maybeSingle();
      if (updateError) throw updateError; if (!updated) return res.status(409).json({ error:'O relatório recebeu outra interpretação durante esta solicitação.', category:'concurrent_update' });
      const { error: runUpdateError } = await db.from('orkto_wia_runs').update({ status:'succeeded', provider:result.usage.provider, model:result.usage.model, task_type:result.usage.taskType, summary:result.decision.messageDraft, completed_at:completedAt }).eq('workspace_id',context.id).eq('id',runId);
      if (runUpdateError) throw runUpdateError;
      if (result.path === 'model') {
        const { error: modelUsageError } = await db.from('orkto_model_usage').insert({ user_id:actorId, workspace_id:context.id, trace_id:traceId, feature:'report_interpretation', task_class:result.usage.taskType, provider:result.usage.provider, model:result.usage.model, prompt_tokens:result.usage.promptTokens, cached_input_tokens:result.usage.cachedInputTokens, completion_tokens:result.usage.completionTokens, total_tokens:result.usage.totalTokens, latency_ms:result.usage.latencyMs, mode:result.mode, billing_period_start:`${new Date().toISOString().slice(0,7)}-01` });
        if (modelUsageError) throw modelUsageError;
      }
      await addAuditOrThrow(db,context.id,actorId,'report.interpreted','report',report.id,{ run_id:runId, provider:result.usage.provider, model:result.usage.model, metrics_unchanged:true });
      res.json({ data:updated, runId, agent:'reporting_agent', provider:result.usage.provider, model:result.usage.model, interpretationType:'WIA_INTERPRETATION', metricsChanged:false });
    } catch (error) {
      if (runId) { try { await db.from('orkto_wia_runs').update({ status:'failed', error_category:(error as {code?:string})?.code || 'execution_error', completed_at:new Date().toISOString() }).eq('workspace_id',context.id).eq('id',runId); } catch { /* retain original failure */ } }
      failure(res,error,'A WIA não conseguiu interpretar os dados calculados do relatório.');
    }
  });

  app.post('/api/case-studies/generate', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ baselineStart: z.string().date(), baselineEnd: z.string().date(), afterStart: z.string().date(), afterEnd: z.string().date() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Informe períodos válidos para a comparação.' });
    const spanDays = (start: string, end: string) => (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
    if (parsed.data.baselineEnd < parsed.data.baselineStart || parsed.data.afterEnd < parsed.data.afterStart || parsed.data.afterStart <= parsed.data.baselineEnd || spanDays(parsed.data.baselineStart,parsed.data.baselineEnd) < 29 || spanDays(parsed.data.afterStart,parsed.data.afterEnd) < 29) return res.status(400).json({ error: 'Cada período precisa cobrir pelo menos 30 dias e o período posterior deve vir depois do baseline.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin','manager'].includes(context.role)) return res.status(403).json({ error: 'Seu papel não pode gerar cases de sucesso.' });
    try {
      const baseline = await loadWorkspaceMetrics(db,context.id,`${parsed.data.baselineStart}T00:00:00.000Z`,`${parsed.data.baselineEnd}T23:59:59.999Z`);
      const afterMetrics = await loadWorkspaceMetrics(db,context.id,`${parsed.data.afterStart}T00:00:00.000Z`,`${parsed.data.afterEnd}T23:59:59.999Z`);
      const delta = (before: number | null, after: number | null) => before === null || after === null ? null : Number((after-before).toFixed(4));
      const comparison = {
        quoteAcceptanceRateDelta: delta(baseline.quotes.acceptanceRate,afterMetrics.quotes.acceptanceRate),
        wonRevenueCentsDelta: afterMetrics.deals.wonRevenueCents - baseline.deals.wonRevenueCents,
        conversationCountDelta: afterMetrics.conversations.total - baseline.conversations.total,
        coverage: { baseline: baseline.coverage, after: afterMetrics.coverage },
        note: 'Comparação calculada de registros existentes; sem benchmark externo nem inferência causal.'
      };
      const { data, error } = await db.from('orkto_case_studies').insert({ workspace_id: context.id, baseline: { periodStart: parsed.data.baselineStart, periodEnd: parsed.data.baselineEnd, metrics: baseline }, after_metrics: { periodStart: parsed.data.afterStart, periodEnd: parsed.data.afterEnd, metrics: afterMetrics }, comparison, status: 'draft' }).select('*').single();
      if (error) throw error;
      await addAudit(db,context.id,req.user?.id,'case_study.generated','case_study',data.id,{ status: data.status });
      res.status(201).json({ data, publication: 'requires_workspace_opt_in_and_legal_gate' });
    } catch (error) { failure(res,error,'Não foi possível comparar os períodos com os dados disponíveis.'); }
  });

  app.get('/api/case-studies', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_case_studies')
        .select('id,baseline,after_metrics,comparison,status,opted_in_at,review_notes,created_at,updated_at')
        .eq('workspace_id', context.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      res.json({ data: data || [], canReview: ['owner','admin'].includes(context.role), publication: 'BLOCKED_LEGAL_VALIDATION' });
    } catch (error) { failure(res,error,'Não foi possível carregar os cases deste workspace.'); }
  });

  app.post('/api/case-studies/:caseId/review', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ decision: z.enum(['approve','reject']), note: z.string().trim().max(1000).default('') }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Revisão inválida.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Apenas owner/admin podem revisar a publicação de um case.' });
    try {
      const { data, error } = await db.from('orkto_case_studies').update({ status: parsed.data.decision === 'approve' ? 'approved' : 'rejected', reviewed_by: req.user?.id || null, review_notes: parsed.data.note, updated_at: new Date().toISOString() }).eq('workspace_id',context.id).eq('id',req.params.caseId).in('status',['draft','review']).select('*').maybeSingle();
      if (error) throw error; if (!data) return res.status(409).json({ error: 'Case não encontrado ou já revisado.' });
      await addAudit(db,context.id,req.user?.id,`case_study.${parsed.data.decision}d`,'case_study',data.id,{ note: parsed.data.note });
      res.json({ data, publicSharing: 'blocked_pending_legal_validation' });
    } catch (error) { failure(res,error,'Não foi possível registrar a revisão do case.'); }
  });

  app.post('/api/case-studies/:caseId/opt-in', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ confirmConsent: z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Confirme o opt-in explícito do workspace.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Apenas owner/admin podem autorizar o opt-in.' });
    if (process.env.CASE_STUDY_LEGAL_APPROVED !== 'true') return res.status(423).json({ error: 'O opt-in público está bloqueado até aprovação jurídica específica.', category: 'policy_error', status: 'BLOCKED_LEGAL' });
    try {
      const token = crypto.randomBytes(32).toString('base64url'); const hash = crypto.createHash('sha256').update(token).digest('hex');
      const { data, error } = await db.from('orkto_case_studies').update({ status: 'opted_in', opted_in_at: new Date().toISOString(), share_token_hash: hash, updated_at: new Date().toISOString() }).eq('workspace_id',context.id).eq('id',req.params.caseId).eq('status','approved').select('id').maybeSingle();
      if (error) throw error; if (!data) return res.status(409).json({ error: 'O case precisa estar aprovado antes do opt-in.' });
      await addAudit(db,context.id,req.user?.id,'case_study.opted_in','case_study',data.id,{ legal_gate: 'pending' });
      res.json({ success: true, publicPath: `/api/public/case-studies/${token}`, token, publication: 'BLOCKED_LEGAL_VALIDATION' });
    } catch (error) { failure(res,error,'Não foi possível registrar o opt-in do case.'); }
  });

  app.get('/api/public/case-studies/:token', async (req, res) => {
    if (process.env.CASE_STUDY_LEGAL_APPROVED !== 'true') return res.status(423).json({ error: 'Publicação suspensa até a aprovação jurídica.', category: 'policy_error', status: 'BLOCKED_LEGAL' });
    if (!db) return res.status(503).json({ error: 'Cases públicos indisponíveis.' });
    try {
      const hash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
      const { data, error } = await db.from('orkto_case_studies').select('baseline,after_metrics,comparison,opted_in_at').eq('share_token_hash',hash).eq('status','opted_in').maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error: 'Case não encontrado ou sem opt-in.' });
      res.json({ data });
    } catch (error) { failure(res,error,'Não foi possível carregar o case.'); }
  });

  app.post('/api/accounting/exports/from-quote/:quoteId', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ paymentMethod: z.string().trim().max(80).optional(), paymentStatus: z.enum(['paid','awaiting_payment','unknown']).default('unknown'), idempotencyKey: z.string().trim().min(8).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados de exportação inválidos.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: quote, error: quoteError } = await db.from('quotes').select('id,user_id,client_name,items,total,status,approved_at,updated_at').eq('id',req.params.quoteId).eq('workspace_id',context.id).maybeSingle();
      if (quoteError) throw quoteError; if (!quote) return res.status(404).json({ error: 'Proposta não encontrada.' });
      if (!['approved','accepted'].includes(String(quote.status).toLowerCase())) return res.status(409).json({ error: 'Somente propostas aceitas podem ser exportadas como venda.' });
      const items = Array.isArray(quote.items) ? quote.items.map((item: any) => ({ product: String(item.name || '').slice(0,180), quantity: Number(item.quantity || 1), unitPriceCents: Math.round(Number(item.unitPrice || 0) * 100) })) : [];
      if (!items.length || items.some((item: any) => !item.product || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.unitPriceCents))) return res.status(409).json({ error: 'A proposta não tem itens estruturados válidos para a exportação.' });
      const payload: AccountingSaleExport = { workspaceId: context.id, saleRef: quote.id, customer: { name: quote.client_name }, items, amountCents: Math.round(Number(quote.total || 0) * 100), saleDate: quote.approved_at || quote.updated_at || null, paymentMethod: parsed.data.paymentMethod || null, paymentStatus: parsed.data.paymentStatus };
      const { data: integration, error: integrationError } = await db.from('orkto_feature_configs').select('status,config').eq('workspace_id',context.id).eq('feature_key','accounting_export').maybeSingle();
      if (integrationError) throw integrationError;
      const integrationConfig = (integration?.config || {}) as Record<string,unknown>;
      const providerId = String(integration?.status || '').toUpperCase() === 'ACTIVE' && typeof integrationConfig.providerId === 'string' ? integrationConfig.providerId : null;
      const adapter = accountingAdapterRegistry.resolve(providerId);
      const initialStatus = adapter ? 'prepared' : 'configuration_required';
      const initialError = adapter ? null : providerId ? 'accounting_adapter_unavailable' : 'accounting_provider_not_configured';
      const { data: priorExport, error: priorExportError } = await db.from('orkto_accounting_exports').select('*').eq('workspace_id',context.id).eq('idempotency_key',parsed.data.idempotencyKey).maybeSingle();
      if (priorExportError) throw priorExportError;
      if (priorExport) return res.status(200).json({ data: priorExport, idempotentReplay: true, delivery: String(priorExport.status || 'configuration_required').toUpperCase() });
      const { data: prepared, error } = await db.from('orkto_accounting_exports').upsert({ workspace_id: context.id, sale_ref: quote.id, payload, adapter: providerId || 'unconfigured', status: initialStatus, idempotency_key: parsed.data.idempotencyKey, error_category: initialError }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('*').maybeSingle();
      if (error) throw error;
      if (!prepared) {
        const { data: existing, error: existingError } = await db.from('orkto_accounting_exports').select('*').eq('workspace_id',context.id).eq('idempotency_key',parsed.data.idempotencyKey).maybeSingle();
        if (existingError) throw existingError;
        return res.status(200).json({ data: existing, idempotentReplay: true, delivery: String(existing?.status || 'configuration_required').toUpperCase() });
      }
      const delivery = await accountingAdapterRegistry.exportSale(providerId, payload, parsed.data.idempotencyKey);
      const { data, error: updateError } = await db.from('orkto_accounting_exports').update({ adapter: delivery.providerId || 'unconfigured', status: delivery.status, external_ref: delivery.status === 'sent' ? delivery.externalRef : null, error_category: delivery.status === 'sent' ? null : delivery.errorCategory, updated_at: new Date().toISOString() }).eq('workspace_id',context.id).eq('id',prepared.id).select('*').single();
      if (updateError) throw updateError;
      await addAudit(db,context.id,req.user?.id,'accounting_export.prepared','accounting_export',data.id,{ provider: delivery.providerId || 'not_configured', status: delivery.status, sale_ref: quote.id });
      res.status(delivery.status === 'failed' ? 502 : 201).json({ data, idempotentReplay: false, delivery: delivery.status.toUpperCase() });
    } catch (error) { failure(res,error,'Não foi possível preparar os dados contábeis.'); }
  });

  app.post('/api/wrapped/generate', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ periodStart: z.string().date(), periodEnd: z.string().date() }).safeParse(req.body);
    if (!parsed.success || parsed.data.periodEnd < parsed.data.periodStart) return res.status(400).json({ error: 'Período inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const metrics = await loadWorkspaceMetrics(db,context.id,`${parsed.data.periodStart}T00:00:00.000Z`,`${parsed.data.periodEnd}T23:59:59.999Z`);
      const { data: existing, error: existingError } = await db.from('orkto_wrapped')
        .select('id,period_start,period_end,metrics,shared_at,created_at')
        .eq('workspace_id',context.id).eq('period_start',parsed.data.periodStart).eq('period_end',parsed.data.periodEnd).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.shared_at) return res.status(409).json({error:'Este Wrapped já foi compartilhado e seu conteúdo está congelado.',category:'shared_snapshot_immutable'});
      let data: any = null;
      let error: any = null;
      if (existing) {
        const update = await db.from('orkto_wrapped').update({metrics})
          .eq('workspace_id',context.id).eq('id',existing.id).is('shared_at',null)
          .select('id,period_start,period_end,metrics,shared_at,created_at').maybeSingle();
        data = update.data; error = update.error;
        if (!error && !data) return res.status(409).json({error:'O Wrapped mudou enquanto era gerado; atualize e tente novamente.',category:'concurrent_update'});
      } else {
        const insert = await db.from('orkto_wrapped').insert({workspace_id:context.id,period_start:parsed.data.periodStart,period_end:parsed.data.periodEnd,metrics})
          .select('id,period_start,period_end,metrics,shared_at,created_at').single();
        data = insert.data; error = insert.error;
        if (error?.code === '23505') return res.status(409).json({error:'Outro operador já gerou este Wrapped. Atualize a lista.',category:'concurrent_update'});
      }
      if (error) throw error;
      if (!data) return res.status(409).json({error:'O Wrapped mudou durante a geração.',category:'concurrent_update'});
      res.status(201).json({ data, shareStatus: data.shared_at ? 'shared' : 'private_until_explicit_share' });
    } catch (error) { failure(res,error,'Não foi possível montar o ORKTO Wrapped.'); }
  });

  app.get('/api/wrapped', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_wrapped')
        .select('id,period_start,period_end,metrics,shared_at,created_at')
        .eq('workspace_id', context.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      res.json({ data: data || [], canShare: ['owner','admin'].includes(context.role) });
    } catch (error) { failure(res,error,'Não foi possível carregar os ORKTO Wrapped deste workspace.'); }
  });

  app.post('/api/wrapped/:wrappedId/share', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ confirmShare: z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Confirme explicitamente o compartilhamento.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    if (!['owner','admin'].includes(context.role)) return res.status(403).json({ error: 'Apenas owner/admin podem criar um link público do Wrapped.' });
    try {
      const token = crypto.randomBytes(32).toString('base64url'); const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const { data, error } = await db.from('orkto_wrapped').update({ share_token_hash: tokenHash, shared_at: new Date().toISOString() }).eq('workspace_id',context.id).eq('id',req.params.wrappedId).select('id').maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error: 'Wrapped não encontrado neste workspace.' });
      await addAuditOrThrow(db,context.id,req.user?.id,'wrapped.shared','wrapped',data.id,{ explicit_confirmation:true });
      res.json({ success: true, publicPath: `/orkto-wrapped/${token}`, token });
    } catch (error) { failure(res,error,'Não foi possível criar o link compartilhável.'); }
  });

  app.get('/api/public/wrapped/:token', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Serviço de Wrapped indisponível.' });
    try {
      const hash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
      const { data, error } = await db.from('orkto_wrapped').select('period_start,period_end,metrics,shared_at').eq('share_token_hash',hash).not('shared_at','is',null).maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error: 'Este Wrapped não está disponível.' });
      res.json(data);
    } catch (error) { failure(res,error,'Não foi possível carregar o Wrapped compartilhado.'); }
  });

  app.get('/api/replay/summary', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_replay_records').select('objection_type,response_strategy,outcome').eq('workspace_id',context.id).order('created_at',{ascending:false}).limit(1000);
      if (error) throw error;
      res.json({ data: aggregateReplay((data || []).map((row: any) => ({ objectionType: row.objection_type, strategy: row.response_strategy, outcome: row.outcome }))) });
    } catch (error) { failure(res,error,'Não foi possível calcular o Replay.'); }
  });

  app.get('/api/replay', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_replay_records')
        .select('id,conversation_id,customer_ref,objection_type,response_strategy,outcome,conversion_result,evidence,recommendation,version,created_at')
        .eq('workspace_id', context.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res,error,'Não foi possível carregar o histórico do Replay.'); }
  });

  app.post('/api/replay', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ conversationId: z.string().uuid().optional(), customerRef: z.string().trim().max(200).optional(), objectionType: z.string().trim().min(1).max(120), responseStrategy: z.string().trim().min(1).max(160), responseText: z.string().trim().min(1).max(2000), outcome: z.enum(['won','lost','pending','unknown']), conversionResult: z.boolean().nullable().optional(), evidence: z.record(z.string(),z.unknown()).default({}) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Registro Replay inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      if (parsed.data.conversationId) {
        const { data: conversation, error } = await db.from('orkto_conversations').select('id,contact_phone').eq('id',parsed.data.conversationId).eq('workspace_id',context.id).maybeSingle();
        if (error) throw error; if (!conversation) return res.status(404).json({ error: 'Conversa fora do workspace.' });
      }
      const referenceQuery = db.from('orkto_replay_records').select('version').eq('workspace_id',context.id);
      if (parsed.data.conversationId) referenceQuery.eq('conversation_id',parsed.data.conversationId);
      else if (parsed.data.customerRef) referenceQuery.eq('customer_ref',parsed.data.customerRef);
      const { data: priorVersion, error: versionError } = await referenceQuery.order('version',{ascending:false}).limit(1).maybeSingle();
      if (versionError) throw versionError;
      const evidence = { ...parsed.data.evidence, responseText: parsed.data.responseText, provenance:{ source:'operator_recorded', actorUserId:req.user?.id || null, capturedAt:new Date().toISOString(), conversationId:parsed.data.conversationId || null } };
      const { data, error } = await db.from('orkto_replay_records').insert({ workspace_id: context.id, conversation_id: parsed.data.conversationId || null, customer_ref: parsed.data.customerRef || null, objection_type: parsed.data.objectionType, response_strategy: parsed.data.responseStrategy, outcome: parsed.data.outcome, conversion_result: parsed.data.conversionResult ?? null, evidence, version: Number(priorVersion?.version || 0) + 1 }).select('*').single();
      if (error) throw error;
      const { data: history, error: historyError } = await db.from('orkto_replay_records').select('objection_type,response_strategy,outcome,conversion_result,version').eq('workspace_id',context.id).eq('objection_type',parsed.data.objectionType).eq('response_strategy',parsed.data.responseStrategy).order('version',{ascending:false}).limit(1000);
      if (historyError) throw historyError;
      const recommendation = aggregateReplay((history || []).map((row:any)=>({ objectionType:row.objection_type, strategy:row.response_strategy, outcome:row.outcome }))).find((row:any)=>row.objectionType === parsed.data.objectionType && row.strategy === parsed.data.responseStrategy) || null;
      if (recommendation) {
        const { error: recommendationError } = await db.from('orkto_replay_records').update({ recommendation }).eq('workspace_id',context.id).eq('id',data.id);
        if (recommendationError) throw recommendationError;
        data.recommendation = recommendation;
      }
      await addAuditOrThrow(db,context.id,req.user?.id,'replay.recorded','replay_record',data.id,{ conversation_id:data.conversation_id, outcome:data.outcome, version:data.version, recommendation_only:true });
      res.status(201).json({ data, recommendation, policy:'recommendation_only_no_global_policy_mutation' });
    } catch (error) { failure(res,error,'Não foi possível registrar a evidência de conversa.'); }
  });

  app.get('/api/customers/:customerRef/repurchase', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const customer = await findWorkspaceCustomer(db,context.id,req.params.customerRef.slice(0,200));
      if (!customer) return res.status(404).json({ error:'Cliente não encontrado neste workspace.' });
      const { data, error } = await db.from('orkto_purchases').select('purchased_at,amount_cents,product_ref').eq('workspace_id',context.id).eq('customer_ref',customer.id).order('purchased_at',{ascending:true}).limit(100);
      if (error) throw error;
      const estimate = estimateRepurchaseWindow((data || []).map((row: any) => ({ purchasedAt: row.purchased_at, amountCents: Number(row.amount_cents), productKey: row.product_ref || undefined })));
      const { data: jobs, error: jobsError } = await db.from('orkto_automation_jobs').select('id,step_key,due_at,status,updated_at').eq('workspace_id',context.id).eq('entity_type','repurchase').eq('entity_ref',customer.id).order('due_at',{ascending:false}).limit(50);
      if (jobsError) throw jobsError;
      res.json({ customer:{ id:customer.id,name:customer.name }, data:estimate, jobs:jobs || [] });
    } catch (error) { failure(res,error,'Não foi possível estimar o ciclo de recompra.'); }
  });

  app.get('/api/automations/repurchase/:customerRef', authenticate, requireDb, async (req,res) => {
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const customer = await findWorkspaceCustomer(db,context.id,req.params.customerRef.slice(0,200));
      if (!customer) return res.status(404).json({ error:'Cliente não encontrado neste workspace.' });
      const { data, error } = await db.from('orkto_automation_jobs').select('id,step_key,due_at,status,updated_at').eq('workspace_id',context.id).eq('entity_type','repurchase').eq('entity_ref',customer.id).order('due_at',{ascending:false}).limit(50);
      if (error) throw error;
      res.json({ data:data || [] });
    } catch (error) { failure(res,error,'Não foi possível carregar as programações de recompra.'); }
  });

  app.post('/api/automations/repurchase/:customerRef/schedule', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const parsed = z.object({ productRef: z.string().trim().max(200).optional(), confirm: z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Confirme a programação da reativação.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    const requestedCustomerRef = req.params.customerRef.slice(0,200);
    try {
      const customer = await findWorkspaceCustomer(db,context.id,requestedCustomerRef);
      if (!customer) return res.status(404).json({ error:'Cliente não encontrado neste workspace.' });
      const customerRef = String(customer.id);
      const { data: feature, error: featureError } = await db.from('orkto_feature_configs').select('status,config').eq('workspace_id',context.id).eq('feature_key','repurchase_reactivation').maybeSingle();
      if (featureError) throw featureError;
      if (String(feature?.status || '').toUpperCase() !== 'ACTIVE') return res.status(409).json({ error: 'Ative e configure a reativação por recompra antes de programar contatos.', category: 'configuration_error' });
      const { data: purchases, error: purchaseError } = await db.from('orkto_purchases').select('purchased_at,amount_cents,product_ref').eq('workspace_id',context.id).eq('customer_ref',customerRef).order('purchased_at',{ascending:true}).limit(100);
      if (purchaseError) throw purchaseError;
      const relevant = (purchases || []).filter((purchase: any) => parsed.data.productRef ? purchase.product_ref === parsed.data.productRef : !purchase.product_ref);
      const estimate = estimateRepurchaseWindow(relevant.map((row: any) => ({ purchasedAt: row.purchased_at, amountCents: Number(row.amount_cents), productKey: row.product_ref || undefined })));
      const config = (feature.config || {}) as Record<string,unknown>;
      const threshold = typeof config.minimumConfidence === 'number' ? Math.min(0.95,Math.max(0.65,config.minimumConfidence)) : 0.75;
      if (!estimate.eligible || estimate.confidence < threshold || !estimate.estimatedAt) return res.status(409).json({ error: estimate.reason, category: 'policy_error', estimate, requiredConfidence: threshold });
      const { data: optOut, error: optOutError } = await db.from('orkto_customer_signals').select('id').eq('workspace_id',context.id).eq('customer_ref',customerRef).eq('signal_type','explicit_opt_out').limit(1);
      if (optOutError) throw optOutError;
      if (optOut?.length) return res.status(409).json({ error: 'O cliente pediu para interromper contatos. A reativação foi bloqueada.', category: 'policy_error' });
      const automationName = `Recompra ${parsed.data.productRef || 'geral'}`;
      const { data: automation, error: automationError } = await db.from('orkto_automations').upsert({ workspace_id: context.id, feature_key: 'repurchase_reactivation', name: automationName, status: 'active', config: { minimumConfidence: threshold, mode: 'prepare_for_approval' }, created_by: req.user?.id || null }, { onConflict:'workspace_id,feature_key,name' }).select('id').single();
      if (automationError) throw automationError;
      const idempotencyKey = `repurchase:${customerRef}:${parsed.data.productRef || 'all'}:${estimate.estimatedAt.slice(0,10)}`;
      const { data: job, error } = await db.from('orkto_automation_jobs').upsert({ workspace_id: context.id, automation_id: automation.id, entity_type: 'repurchase', entity_ref: customerRef, step_key: parsed.data.productRef || 'all', due_at: estimate.estimatedAt, status:'scheduled', idempotency_key: idempotencyKey }, { onConflict:'workspace_id,idempotency_key', ignoreDuplicates:true }).select('id,step_key,due_at,status').maybeSingle();
      if (error) throw error;
      let savedJob = job;
      if (!savedJob) { const { data, error: readError } = await db.from('orkto_automation_jobs').select('id,step_key,due_at,status').eq('workspace_id',context.id).eq('idempotency_key',idempotencyKey).maybeSingle(); if (readError) throw readError; savedJob = data; }
      if (!savedJob) throw new Error('A programação da recompra não pôde ser recuperada após a gravação.');
      if (job) await addAuditOrThrow(db,context.id,req.user?.id,'repurchase.scheduled','automation_job',job.id,{ customer_ref:customerRef, product_ref:parsed.data.productRef || null, due_at:job.due_at, confidence:estimate.confidence, threshold });
      res.status(job ? 201 : 200).json({ data: savedJob, estimate, mode:'approval_required', externalDelivery:'CONFIGURATION_REQUIRED', windowOpen:estimate.windowOpen, idempotentReplay:!job });
    } catch (error) { failure(res,error,'Não foi possível programar a reativação por recompra.'); }
  });

  app.post('/api/automations/repurchase/:customerRef/cancel', authenticate, requireDb, async (req,res) => {
    if (blockOptionalDirectWrite(res)) return;
    const parsed = z.object({ productRef:z.string().trim().max(200).optional() }).strict().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error:'Filtro de cancelamento inválido.' });
    const context = await workspaceContext(req,res,db); if (!context) return;
    try {
      const customer = await findWorkspaceCustomer(db,context.id,req.params.customerRef.slice(0,200));
      if (!customer) return res.status(404).json({ error:'Cliente não encontrado neste workspace.' });
      let query = db.from('orkto_automation_jobs').update({ status:'cancelled', updated_at:new Date().toISOString() }).eq('workspace_id',context.id).eq('entity_type','repurchase').eq('entity_ref',customer.id).eq('status','scheduled').select('id,step_key');
      if (parsed.data.productRef) query = query.eq('step_key',parsed.data.productRef);
      const { data, error } = await query;
      if (error) throw error;
      let actionsQuery = db.from('orkto_wia_actions').select('id,payload').eq('workspace_id',context.id).eq('action_type','prepare_repurchase_followup').eq('status','awaiting_approval').limit(1000);
      const { data: actions, error: actionsError } = await actionsQuery;
      if (actionsError) throw actionsError;
      const cancelledActionIds = (actions || []).filter((action:any) => String(action.payload?.customerRef || action.payload?.customerId || '') === String(customer.id) && (!parsed.data.productRef || String(action.payload?.productRef || '') === parsed.data.productRef)).map((action:any) => action.id);
      if (cancelledActionIds.length) {
        const { error: actionUpdateError } = await db.from('orkto_wia_actions').update({ status:'cancelled',updated_at:new Date().toISOString() }).eq('workspace_id',context.id).in('id',cancelledActionIds);
        if (actionUpdateError) throw actionUpdateError;
      }
      await addAuditOrThrow(db,context.id,req.user?.id,'repurchase.cancelled','customer',String(customer.id),{ product_ref:parsed.data.productRef || null, cancelled_jobs:data?.length || 0, cancelled_actions:cancelledActionIds.length });
      res.json({ cancelled:data?.length || 0, cancelledActions:cancelledActionIds.length, data:data || [] });
    } catch (error) { failure(res,error,'Não foi possível cancelar a reativação por recompra.'); }
  });

  app.post('/api/purchases', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const parsed = z.object({ customerRef: z.string().trim().min(1).max(200), productRef: z.string().trim().max(200).optional(), productName: z.string().trim().min(1).max(180), quantity: z.number().positive().max(100000).default(1), amountCents: z.number().int().nonnegative().max(10_000_000_000), purchasedAt: z.string().datetime({offset:true}), source: z.string().trim().min(1).max(80).default('manual'), idempotencyKey: z.string().trim().min(8).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Compra inválida.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const customer = await findWorkspaceCustomer(db,context.id,parsed.data.customerRef);
      if (!customer) return res.status(400).json({ error:'A compra precisa pertencer a um cliente ativo deste workspace.', category:'tenant_validation_error' });
      if (new Date(parsed.data.purchasedAt).getTime() > Date.now()) return res.status(400).json({ error:'A data de uma compra registrada não pode estar no futuro.' });
      const { data, error } = await db.from('orkto_purchases').upsert({ workspace_id: context.id, customer_ref: customer.id, product_ref: parsed.data.productRef || null, product_name: parsed.data.productName, quantity: parsed.data.quantity, amount_cents: parsed.data.amountCents, purchased_at: parsed.data.purchasedAt, source: parsed.data.source, idempotency_key: parsed.data.idempotencyKey }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('*').maybeSingle();
      if (error) throw error;
      let savedPurchase = data;
      if (!savedPurchase) { const { data: existing, error: readError } = await db.from('orkto_purchases').select('*').eq('workspace_id',context.id).eq('idempotency_key',parsed.data.idempotencyKey).maybeSingle(); if (readError) throw readError; savedPurchase = existing; }
      if (!savedPurchase) throw new Error('A compra não pôde ser recuperada após a gravação.');
      if (data) await addAuditOrThrow(db,context.id,req.user?.id,'purchase.recorded','purchase',data.id,{ customer_ref:customer.id, product_ref:parsed.data.productRef || null, amount_cents:parsed.data.amountCents, source:parsed.data.source });
      let memoryStatus:'persisted'|'retryable' = 'persisted';
      const fact = buildVerifiedCommercialFact({
        workspaceId:context.id,customerId:String(customer.id),factType:'recorded_purchase',source:'workspace_purchase_record',sourceRef:String(savedPurchase.id),actorUserId:req.user?.id || null,
        facts:{ productName:String(savedPurchase.product_name || parsed.data.productName),productRef:savedPurchase.product_ref || parsed.data.productRef || null,quantity:Number(savedPurchase.quantity || parsed.data.quantity),amountCents:Number(savedPurchase.amount_cents || parsed.data.amountCents),purchasedAt:savedPurchase.purchased_at || parsed.data.purchasedAt,recordedSource:String(savedPurchase.source || parsed.data.source) },
      });
      if (fact) {
        try {
          const saved = await persistAutomaticMemory(db,fact);
          if (saved.inserted && saved.id) await addAuditOrThrow(db,context.id,req.user?.id,'memory.commercial_fact_captured','customer',String(customer.id),{ memory_id:saved.id,fact_type:'recorded_purchase',source_ref:String(savedPurchase.id) });
          else if (!saved.id) memoryStatus = 'retryable';
        } catch (memoryError) {
          memoryStatus = 'retryable';
          console.error('[Memory] purchase_fact_capture_failed',{workspaceId:context.id,code:(memoryError as {code?:string})?.code || 'persistence_error'});
        }
      }
      const reactivation = savedPurchase ? await scheduleRepurchaseCandidate(db,{workspaceId:context.id,customerId:String(customer.id),productRef:savedPurchase.product_ref || parsed.data.productRef || null,actorUserId:req.user?.id || null}) : null;
      res.status(data ? 201 : 200).json({ data:savedPurchase, reactivation, memoryStatus, idempotentReplay: !data });
    } catch (error) { failure(res,error,'Não foi possível registrar a compra.'); }
  });

  app.post('/api/imports/preview', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const parsed = z.object({ source: z.string().trim().min(1).max(80), entityType:z.enum(['customers','contacts','proposals','commercial_records']).default('customers'), rows: z.array(z.record(z.string(),z.unknown())).min(1).max(1000), mapping: z.record(z.string(),z.string()).default({}) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Arquivo ou mapeamento inválido.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    const ownerId = context.ownerUserId;
    try {
      const entityType = parsed.data.entityType;
      const mapped = parsed.data.rows.map(row => Object.fromEntries(Object.entries(parsed.data.mapping).map(([target,source]) => [target,row[source]])));
      let results: any[];
      if (entityType === 'customers') {
        const checked = validateImportRows(mapped,['name','phone']);
        const { data: existingClients, error: clientsError } = await db.from('clients').select('id,name,phone,company').eq('workspace_id',context.id).is('archived_at',null).limit(5000);
        if (clientsError) throw clientsError;
        results = classifyImportDuplicates(checked,(existingClients || []).map((client:any)=>({id:client.id,name:client.name || '',phone:client.phone || '',address:client.company || ''})))
          .map(row=>({...row,status:row.status,duplicateMatches:row.duplicateMatches || []}));
      } else {
        const requiredFields = entityType === 'contacts' ? ['fullName'] : entityType === 'proposals' ? ['customerRef','items'] : ['title','customerRef','stage','valueCents'];
        const normalized = mapped.map((row,index)=>{
          const data = Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value === 'string' ? value.trim() : value])) as Record<string,any>;
          const errors = requiredFields.filter(field=>data[field] == null || String(data[field]).trim()==='').map(field=>`Campo obrigatório ausente: ${field}`);
          if (entityType === 'contacts') {
            if (!data.phone && !data.email) errors.push('Informe telefone ou e-mail para identificar o contato.');
            if (data.phone && normalizeCustomerPhone(data.phone).length < 8) errors.push('Telefone inválido.');
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) errors.push('E-mail inválido.');
          } else if (entityType === 'proposals') {
            try { data.items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items; }
            catch { errors.push('Itens da proposta precisam ser uma lista JSON válida.'); }
            if (!Array.isArray(data.items) || !data.items.length || data.items.length > 100) errors.push('A proposta precisa ter de 1 a 100 itens mapeados.');
            if (Array.isArray(data.items) && data.items.some((item:any)=>!String(item.catalogItemId || item.serviceId || item.catalog_item_id || '').trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || Number(item.discount || 0) !== 0)) errors.push('Cada item precisa ter catalogItemId/serviceId, quantidade positiva e desconto zero; o preço vem do Catálogo.');
            if (data.validDays !== undefined && (!Number.isInteger(Number(data.validDays)) || Number(data.validDays) < 1 || Number(data.validDays) > 365)) errors.push('A validade da proposta deve ser de 1 a 365 dias.');
          } else {
            if (!['new','qualification','proposal','negotiation','won','lost'].includes(String(data.stage))) errors.push('Estágio de negócio inválido.');
            if (!Number.isSafeInteger(Number(data.valueCents)) || Number(data.valueCents) < 0) errors.push('valueCents deve ser um inteiro não negativo.');
          }
          return { rowNumber:index+1,valid:errors.length===0,errors,normalized:data,status:errors.length ? 'error' : 'valid',duplicateMatches:[] as unknown[] };
        });
        if (entityType === 'contacts') {
          const {data: existing, error} = await db.from('orkto_contacts').select('id,full_name,phone,email').eq('workspace_id',context.id).limit(5000); if (error) throw error;
          const identities = new Set((existing || []).flatMap((item:any)=>[item.phone ? `p:${normalizeCustomerPhone(item.phone)}` : '',item.email ? `e:${String(item.email).toLowerCase()}` : ''].filter(Boolean)));
          const incoming = new Set<string>();
          for (const row of normalized) if (row.status==='valid') {
            const keys = [row.normalized.phone ? `p:${normalizeCustomerPhone(row.normalized.phone)}` : '',row.normalized.email ? `e:${String(row.normalized.email).toLowerCase()}` : ''].filter(Boolean);
            if (keys.some(key=>identities.has(key) || incoming.has(key))) { row.status='duplicate'; row.errors.push('Possível contato duplicado por telefone ou e-mail; revisar antes de importar.'); }
            else keys.forEach(key=>incoming.add(key));
          }
        } else if (entityType === 'proposals') {
          const {data: existingQuotes,error:existingQuotesError}=await db.from('quotes').select('quote_number').eq('workspace_id',context.id).limit(5000);
          if(existingQuotesError) throw existingQuotesError;
          const existingNumbers=new Set((existingQuotes || []).map((quote:any)=>String(quote.quote_number || '').trim()).filter(Boolean));
          const quoteNumbers = new Set<string>();
          for (const row of normalized) {
            const quoteNumber = String(row.normalized.quoteNumber || row.normalized.quote_number || '').trim();
            if (row.status==='valid' && quoteNumber && existingNumbers.has(quoteNumber)) { row.status='duplicate'; row.errors.push('Número de proposta já existe neste workspace.'); }
            else if (row.status==='valid' && quoteNumber && quoteNumbers.has(quoteNumber)) { row.status='duplicate'; row.errors.push('Número de proposta repetido neste arquivo.'); }
            if (quoteNumber) quoteNumbers.add(quoteNumber);
          }
        } else if (entityType === 'commercial_records') {
          const {data: existingDeals,error:existingDealsError}=await db.from('orkto_deals').select('metadata').eq('workspace_id',context.id).limit(5000);
          if(existingDealsError) throw existingDealsError;
          const existingExternalRefs=new Set((existingDeals || []).map((deal:any)=>String(deal.metadata?.importExternalRef || '')).filter(Boolean));
          const externalRefs = new Set<string>();
          for (const row of normalized) {
            const externalRef = String(row.normalized.externalRef || row.normalized.external_ref || '').trim();
            if (row.status==='valid' && externalRef && existingExternalRefs.has(externalRef)) { row.status='duplicate'; row.errors.push('Referência externa já foi importada neste workspace.'); }
            else if (row.status==='valid' && externalRef && externalRefs.has(externalRef)) { row.status='duplicate'; row.errors.push('Referência externa repetida neste arquivo.'); }
            if (externalRef) externalRefs.add(externalRef);
          }
        }
        results = normalized;
      }
      const { data: job, error: jobError } = await db.from('orkto_import_jobs').insert({ workspace_id: context.id, source: parsed.data.source, entity_type:entityType, status: results.some(row => row.status === 'valid') ? 'ready' : 'preview', mapping: parsed.data.mapping, summary: { entityType,total: results.length, valid: results.filter(row => row.status === 'valid').length, duplicates: results.filter(row => row.status === 'duplicate').length, errors: results.filter(row => row.status === 'error').length }, created_by: req.user?.id || null }).select('*').single();
      if (jobError) throw jobError;
      const rowInserts = results.map(row => ({ workspace_id: context.id, job_id: job.id, row_number: row.rowNumber, source_digest: crypto.createHash('sha256').update(JSON.stringify(row.normalized)).digest('hex'), mapped_data: row.normalized, status: row.status === 'valid' ? 'valid' : row.status === 'duplicate' ? 'duplicate' : 'error', errors: row.errors }));
      const { error: rowsError } = await db.from('orkto_import_rows').insert(rowInserts);
      if (rowsError) throw rowsError;
      res.status(201).json({ data: { job, rows: results } });
    } catch (error) { failure(res,error,'Não foi possível validar os dados de importação.'); }
  });

  app.post('/api/imports/:jobId/commit', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const context = await workspaceContext(req, res, db); if (!context) return;
    const ownerId = context.ownerUserId;
    const importJobId = String(req.params.jobId || '');
    try {
      const { data: job, error: jobError } = await db.from('orkto_import_jobs').select('id,status,summary,entity_type,mapping').eq('workspace_id',context.id).eq('id',importJobId).maybeSingle();
      if (jobError) throw jobError; if (!job) return res.status(404).json({ error: 'Importação não encontrada.' });
      if (job.status === 'completed') return res.json({ success: true, imported: Number(job.summary?.imported) || 0, rows: [], idempotentReplay: true });
      if (!['ready','failed'].includes(job.status)) return res.status(409).json({ error: 'A importação já está sendo processada ou não está validada para gravação.' });
      const { data: claim, error: startError } = await db.from('orkto_import_jobs').update({ status:'importing',started_at:new Date().toISOString() })
        .eq('workspace_id',context.id).eq('id',job.id).eq('status',job.status).select('id').maybeSingle();
      if (startError) throw startError;
      if (!claim) return res.status(409).json({ error:'Outra operação assumiu esta importação. Atualize e tente novamente.',category:'import_already_claimed' });
      const { data: rows, error: rowsError } = await db.from('orkto_import_rows').select('*').eq('workspace_id',context.id).eq('job_id',job.id).in('status',['valid','imported']).order('row_number',{ascending:true});
      if (rowsError) throw rowsError;
      const entityType = String(job.entity_type || 'customers');
      const results: Array<{ rowId: string; entityType:string; recordId: string }> = [];
      for (const row of rows || []) {
        if (row.status === 'imported' && row.imported_ref) {
          results.push({rowId:row.id,entityType,recordId:String(row.imported_ref)});
          continue;
        }
        const data = row.mapped_data as Record<string, any>;
        const entityTable: Record<string,string> = {customers:'clients',contacts:'orkto_contacts',proposals:'quotes',commercial_records:'orkto_deals'};
        const table = entityTable[entityType];
        if (!table) throw importValidationError(`Tipo de importação não suportado: ${entityType}`);
        const {data:existingEntity,error:existingEntityError}=await db.from(table).select('id').eq('workspace_id',context.id).eq('orkto_import_job_id',job.id).eq('orkto_import_row_id',row.id).maybeSingle();
        if (existingEntityError) throw existingEntityError;
        let imported: any = existingEntity;
        if (!imported) {
        if (entityType === 'customers') {
          const result = await db.from('clients').insert({
            user_id:ownerId,workspace_id:context.id,name:String(data.name || '').trim(),phone:String(data.phone || '').trim(),company:String(data.company || '').trim(),
            vehicle_or_service:String(data.vehicleOrService || data.vehicle_or_service || '').trim(),notes:String(data.notes || '').trim(),orkto_import_job_id:job.id,orkto_import_row_id:row.id,
          }).select('id').single();
          if (result.error) throw result.error;
          imported = result.data;
        } else if (entityType === 'contacts') {
          const customer = data.customerRef ? await findWorkspaceCustomer(db,context.id,String(data.customerRef)) : null;
          if (data.customerRef && !customer) throw importValidationError(`Linha ${row.row_number}: cliente vinculado não pertence ao workspace.`, 'tenant_validation_error');
          const result = await db.from('orkto_contacts').insert({
            workspace_id:context.id,customer_id:customer?.id || null,full_name:String(data.fullName || '').trim(),phone:String(data.phone || '').trim() || null,
            email:String(data.email || '').trim().toLowerCase() || null,company:String(data.company || '').trim() || null,role:String(data.role || '').trim() || null,
            source:'csv_import',orkto_import_job_id:job.id,orkto_import_row_id:row.id,created_by:req.user?.id || null,
          }).select('id').single();
          if (result.error) throw result.error;
          imported = result.data;
        } else if (entityType === 'proposals') {
          const customer = await findWorkspaceCustomer(db,context.id,String(data.customerRef || ''));
          if (!customer) throw importValidationError(`Linha ${row.row_number}: cliente não encontrado neste workspace.`, 'tenant_validation_error');
          let deal: any = null;
          if (data.dealRef) {
            const {data:dealData,error:dealError}=await db.from('orkto_deals').select('id,customer_ref').eq('workspace_id',context.id).eq('id',String(data.dealRef)).maybeSingle();
            if (dealError) throw dealError; if (!dealData) throw importValidationError(`Linha ${row.row_number}: negócio não encontrado neste workspace.`, 'tenant_validation_error');
            const linkedCustomer = await findWorkspaceCustomer(db,context.id,String(dealData.customer_ref || ''));
            if (linkedCustomer && linkedCustomer.id !== customer.id) throw importValidationError(`Linha ${row.row_number}: cliente e negócio pertencem a relações diferentes.`, 'tenant_validation_error');
            deal = dealData;
          }
          const rawItems = Array.isArray(data.items) ? data.items : typeof data.items === 'string' ? JSON.parse(data.items) : [];
          const serviceIds = [...new Set(rawItems.map((item:any)=>String(item.catalogItemId || item.serviceId || item.catalog_item_id || '')).filter(Boolean))];
          if(!Number.isInteger(Number(data.validDays || 15)) || Number(data.validDays || 15)<1 || Number(data.validDays || 15)>365) throw importValidationError(`Linha ${row.row_number}: validade da proposta precisa ser de 1 a 365 dias.`);
          const {data:services,error:servicesError}=await db.from('services').select('id,name,description,unit_price,archived_at').eq('workspace_id',context.id).in('id',serviceIds);
          if (servicesError) throw servicesError;
          const serviceById = new Map((services || []).map((service:any)=>[String(service.id),service]));
          if (serviceById.size !== serviceIds.length) throw importValidationError(`Linha ${row.row_number}: um ou mais itens de Catálogo não pertencem ao workspace.`, 'tenant_validation_error');
          const quoteItems = rawItems.map((item:any)=>{
            const service = serviceById.get(String(item.catalogItemId || item.serviceId || item.catalog_item_id || '')) as any;
            if (service.archived_at) throw importValidationError(`Linha ${row.row_number}: o item ${service.name} está arquivado.`);
            const quantity=Number(item.quantity); if(!Number.isFinite(quantity)||quantity<=0) throw importValidationError(`Linha ${row.row_number}: quantidade inválida.`);
            return {catalogItemId:service.id,name:service.name,description:service.description || '',quantity,unitPrice:Number(service.unit_price),discount:0};
          });
          const subtotal = Math.round(quoteItems.reduce((sum:number,item:any)=>sum+item.quantity*item.unitPrice,0)*100)/100;
          const quoteNumber = String(data.quoteNumber || data.quote_number || `IMP-${String(job.id).slice(0,8)}-${row.row_number}`).trim().slice(0,80);
          const {data:duplicateQuote,error:duplicateQuoteError}=await db.from('quotes').select('id,orkto_import_row_id').eq('workspace_id',context.id).eq('quote_number',quoteNumber).maybeSingle();
          if (duplicateQuoteError) throw duplicateQuoteError;
          if (duplicateQuote && duplicateQuote.orkto_import_row_id !== row.id) throw importValidationError(`Linha ${row.row_number}: o número de proposta ${quoteNumber} já existe neste workspace.`);
          const result = await db.from('quotes').insert({
            user_id:ownerId,workspace_id:context.id,quote_number:quoteNumber,client_name:customer.name,client_phone:customer.phone,
            client_email:String(data.email || '').trim() || null,client_company:String(customer.company || '').trim() || null,
            client_vehicle_or_service:String(data.vehicleOrService || '').trim() || null,notes:String(data.notes || '').trim() || null,
            customer_id:customer.id,deal_id:deal?.id || null,items:quoteItems,subtotal,discount_total:0,taxes:0,total:subtotal,status:'draft',
            valid_value_days:Math.min(365,Math.max(1,Number(data.validDays || 15))),orkto_import_job_id:job.id,orkto_import_row_id:row.id,
          }).select('id').single();
          if (result.error) throw result.error;
          imported = result.data;
        } else if (entityType === 'commercial_records') {
          const customer = await findWorkspaceCustomer(db,context.id,String(data.customerRef || ''));
          if (!customer) throw importValidationError(`Linha ${row.row_number}: cliente não encontrado neste workspace.`, 'tenant_validation_error');
          const ownerUserId = String(data.ownerUserId || req.user?.id || ownerId);
          if (!await isActiveWorkspaceMember(db,context.id,ownerUserId)) throw importValidationError(`Linha ${row.row_number}: responsável não é membro ativo deste workspace.`, 'tenant_validation_error');
          let conversationRef: string | null = null;
          if (data.conversationRef) {
            const {data:conversation,error:conversationError}=await db.from('orkto_conversations').select('id,customer_id').eq('workspace_id',context.id).eq('id',String(data.conversationRef)).maybeSingle();
            if (conversationError) throw conversationError;
            if (!conversation || (conversation.customer_id && conversation.customer_id !== customer.id)) throw importValidationError(`Linha ${row.row_number}: conversa não pertence ao cliente/workspace informado.`, 'tenant_validation_error');
            conversationRef=conversation.id;
          }
          const externalRef=String(data.externalRef || data.external_ref || '').trim() || null;
          const result = await db.from('orkto_deals').insert({
            workspace_id:context.id,customer_ref:customer.id,conversation_ref:conversationRef,title:String(data.title || '').trim(),description:String(data.description || '').trim(),
            stage:String(data.stage),status:['won','lost'].includes(String(data.stage)) ? String(data.stage) : 'open',value_cents:Number(data.valueCents),
            owner_user_id:ownerUserId,source:'csv_import',metadata:externalRef ? {importExternalRef:externalRef} : {},created_by:req.user?.id || null,
            orkto_import_job_id:job.id,orkto_import_row_id:row.id,
          }).select('id').single();
          if (result.error) throw result.error;
          imported=result.data;
        } else throw importValidationError(`Tipo de importação não suportado: ${entityType}`);
        }
        const { data: markedRow, error: markError } = await db.from('orkto_import_rows').update({ status:'imported',imported_ref:imported.id }).eq('workspace_id',context.id).eq('id',row.id).eq('status','valid').select('id').maybeSingle();
        if (markError) throw markError;
        if (!markedRow) {
          const {data:currentRow,error:currentRowError}=await db.from('orkto_import_rows').select('id,status,imported_ref').eq('workspace_id',context.id).eq('id',row.id).maybeSingle();
          if(currentRowError) throw currentRowError;
          if(currentRow?.status!=='imported'||String(currentRow.imported_ref)!==String(imported.id)) throw Object.assign(new Error('A linha mudou durante a importação.'),{code:'import_row_state_conflict'});
        }
        results.push({ rowId:row.id,entityType,recordId:imported.id });
      }
      const { data: finished, error: finishError } = await db.from('orkto_import_jobs').update({ status:'completed',completed_at:new Date().toISOString(),summary:{entityType,imported:results.length,duplicatesHeldForReview:true,rows:results} }).eq('workspace_id',context.id).eq('id',job.id).eq('status','importing').select('id').maybeSingle();
      if (finishError) throw finishError;
      if (!finished) return res.status(409).json({error:'O estado da importação mudou antes de finalizar.',category:'import_state_conflict'});
      res.json({ success:true,entityType,imported:results.length,rows:results });
    } catch (error) {
      const code=(error as {code?:string})?.code || 'unknown';
      const validationFailure = code === 'import_validation_error' || code === 'tenant_validation_error';
      const {error:statusError}=await db.from('orkto_import_jobs').update({status:'failed',error_summary:[{category:validationFailure ? code : 'import_failed',code,occurredAt:new Date().toISOString()}]}).eq('workspace_id',context.id).eq('id',importJobId).eq('status','importing');
      if(statusError) console.error('[Import] failure_status_persistence_failed',{workspaceId:context.id,jobId:importJobId,code:statusError.code || 'unknown'});
      if (validationFailure) return res.status(400).json({ error:error instanceof Error ? error.message : 'Os dados da importação não passaram na validação.', category:code });
      failure(res,error,'A importação falhou. As linhas já gravadas mantêm vínculo idempotente para retomar ou compensar sem duplicação.');
    }
  });

  app.post('/api/imports/:jobId/rollback', authenticate, requireDb, async (req, res) => {
    if (blockOptionalDirectWrite(res)) return;
    const context = await workspaceContext(req, res, db); if (!context) return;
    const ownerId = context.ownerUserId;
    try {
      const {data:job,error:jobError}=await db.from('orkto_import_jobs').select('id,entity_type,created_by').eq('workspace_id',context.id).eq('id',req.params.jobId).maybeSingle();
      if (jobError) throw jobError; if (!job) return res.status(404).json({error:'Importação não encontrada neste workspace.'});
      if (!['owner','admin'].includes(context.role) && job.created_by !== req.user?.id) return res.status(403).json({ error:'Somente o responsável pela importação ou owner/admin pode compensá-la.', category:'permission_denied' });
      const entityType=String(job.entity_type || 'customers');
      const { data: rows, error } = await db.from('orkto_import_rows').select('id,imported_ref,mapped_data,row_number,status').eq('workspace_id',context.id).eq('job_id',req.params.jobId).in('status',['valid','imported']);
      if (error) throw error;
      let removed = 0; const conflicts: string[] = [];
      const markRowRolledBack = async (rowId: string) => {
        const { error: rowUpdateError } = await db.from('orkto_import_rows').update({ status:'rolled_back' })
          .eq('workspace_id',context.id).eq('job_id',req.params.jobId).eq('id',rowId).in('status',['valid','imported']);
        if (rowUpdateError) throw rowUpdateError;
      };
      for (const row of rows || []) {
        const original = row.mapped_data as Record<string, any>;
        if (entityType === 'customers') {
          const {data:client,error:clientError}=await db.from('clients').select('id,name,phone,company,vehicle_or_service,notes').eq('workspace_id',context.id).eq('user_id',ownerId).eq('orkto_import_row_id',row.id).maybeSingle();
          if (clientError) throw clientError; if (!client) { await markRowRolledBack(row.id); continue; }
          const unchanged=client.name===String(original.name || '').trim()&&client.phone===String(original.phone || '').trim()&&client.company===String(original.company || '').trim()&&client.vehicle_or_service===String(original.vehicleOrService || original.vehicle_or_service || '').trim()&&client.notes===String(original.notes || '').trim();
          if(!unchanged){conflicts.push(row.id);continue;}
          const {error:deleteError}=await db.from('clients').delete().eq('workspace_id',context.id).eq('user_id',ownerId).eq('orkto_import_row_id',row.id);
          if(deleteError){conflicts.push(row.id);continue;}
        } else if (entityType === 'contacts') {
          const {data:contact,error:contactError}=await db.from('orkto_contacts').select('id,full_name,phone,email,company,role').eq('workspace_id',context.id).eq('orkto_import_row_id',row.id).maybeSingle();
          if(contactError) throw contactError; if(!contact) { await markRowRolledBack(row.id); continue; }
          const unchanged=contact.full_name===String(original.fullName || '').trim()&&contact.phone===(String(original.phone || '').trim() || null)&&contact.email===(String(original.email || '').trim().toLowerCase() || null)&&contact.company===(String(original.company || '').trim() || null)&&contact.role===(String(original.role || '').trim() || null);
          if(!unchanged){conflicts.push(row.id);continue;}
          const {error:deleteError}=await db.from('orkto_contacts').delete().eq('workspace_id',context.id).eq('id',contact.id);
          if(deleteError){conflicts.push(row.id);continue;}
        } else if (entityType === 'proposals') {
          const {data:quote,error:quoteError}=await db.from('quotes').select('id,status,items,archived_at').eq('workspace_id',context.id).eq('orkto_import_row_id',row.id).maybeSingle();
          if(quoteError) throw quoteError; if(!quote) { await markRowRolledBack(row.id); continue; }
          const {data:live,error:liveError}=await db.from('orkto_live_quotes').select('id').eq('workspace_id',context.id).eq('quote_ref',quote.id).limit(1);
          if(liveError) throw liveError;
          const {data:payments,error:paymentsError}=await db.from('payment_records').select('id').eq('workspace_id',context.id).eq('quote_id',quote.id).limit(1);
          if(paymentsError && paymentsError.code !== 'PGRST205' && paymentsError.code !== '42P01') throw paymentsError;
          const untouched=quote.status==='draft'&&!quote.archived_at&&!live?.length&&!payments?.length;
          if(!untouched){conflicts.push(row.id);continue;}
          const {error:updateError}=await db.from('quotes').update({archived_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('workspace_id',context.id).eq('id',quote.id).eq('status','draft');
          if(updateError){conflicts.push(row.id);continue;}
        } else if (entityType === 'commercial_records') {
          const {data:deal,error:dealError}=await db.from('orkto_deals').select('id,title,description,stage,status,value_cents,customer_ref,orkto_import_row_id').eq('workspace_id',context.id).eq('orkto_import_row_id',row.id).maybeSingle();
          if(dealError) throw dealError; if(!deal) { await markRowRolledBack(row.id); continue; }
          const customer=await findWorkspaceCustomer(db,context.id,String(original.customerRef || ''));
          const unchanged=Boolean(customer)&&deal.title===String(original.title || '').trim()&&deal.description===String(original.description || '').trim()&&deal.stage===String(original.stage)&&Number(deal.value_cents)===Number(original.valueCents)&&String(deal.customer_ref)===String(customer.id);
          if(!unchanged||deal.status==='archived'){conflicts.push(row.id);continue;}
          const {error:updateError}=await db.from('orkto_deals').update({status:'archived',updated_at:new Date().toISOString()}).eq('workspace_id',context.id).eq('id',deal.id);
          if(updateError){conflicts.push(row.id);continue;}
          await addAuditOrThrow(db,context.id,req.user?.id,'import.compensated','deal',deal.id,{job_id:job.id,reason:'unchanged_imported_record'});
        }
        const {error:rowUpdateError}=await db.from('orkto_import_rows').update({ status: 'rolled_back' }).eq('workspace_id',context.id).eq('id',row.id);
        if(rowUpdateError) throw rowUpdateError;
        removed++;
      }
      if (!conflicts.length) {
        const {error:jobUpdateError}=await db.from('orkto_import_jobs').update({ status: 'rolled_back', completed_at: new Date().toISOString() }).eq('workspace_id',context.id).eq('id',req.params.jobId);
        if(jobUpdateError) throw jobUpdateError;
      }
      res.json({ removed, conflicts, status: conflicts.length ? 'partial_rollback_needs_review' : 'rolled_back' });
    } catch (error) { failure(res,error,'Não foi possível compensar a importação.'); }
  });

  app.get('/api/wia/actions', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db, false); if (!context) return;
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'awaiting_approval';
      const { data, error } = await db.from('orkto_wia_actions').select('*').eq('workspace_id',context.id).eq('status',status).order('created_at',{ascending:false}).limit(100);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res, error, 'Não foi possível carregar as ações da WIA.'); }
  });

  app.post('/api/wia/actions/:actionId/approve', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ confirm: z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Confirme explicitamente a aprovação.' });
    const context = await workspaceContext(req, res, db, false, true); if (!context) return;
    if (!['owner','admin','manager'].includes(context.role)) return res.status(403).json({ error:'Seu papel não permite aprovar ações da WIA.', category:'permission_denied' });
    const result = await invokeCoreMutation(req,res,context,'APPROVE_WIA_ACTION',{ actionId:req.params.actionId,confirm:true });
      if (result) res.json({ data:result.action, externalDelivery:result.external_delivery, idempotentReplay:result.result==='REPLAY' });
      return;
  });

  app.post('/api/wia/actions/:actionId/reject', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ reason: z.string().trim().max(500).default('') }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Motivo de rejeição inválido.' });
    const context = await workspaceContext(req, res, db, false, true); if (!context) return;
    if (!['owner','admin','manager'].includes(context.role)) return res.status(403).json({ error:'Seu papel não permite rejeitar ações da WIA.', category:'permission_denied' });
    const result = await invokeCoreMutation(req,res,context,'REJECT_WIA_ACTION',{ actionId:req.params.actionId,reason:parsed.data.reason });
      if (result) res.json({ data:result.action, idempotentReplay:result.result==='REPLAY' });
      return;
  });

  app.post('/api/automations/proposal-recovery/:quoteId/schedule', authenticate, requireDb, async (req, res) => {
    const parsed = z.object({ enabled: z.literal(true), cadenceDays: z.array(z.number().int().min(1).max(365)).max(10).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Confirme a ativação da recuperação antes de criar a cadência.' });
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: feature, error: featureError } = await db.from('orkto_feature_configs').select('status,config').eq('workspace_id',context.id).eq('feature_key','proposal_recovery').maybeSingle();
      if (featureError) throw featureError;
      if (String(feature?.status || '').toUpperCase() !== 'ACTIVE') return res.status(409).json({ error:'Ative e configure a recuperação de propostas antes de programar uma cadência.', category:'configuration_required' });
      const { data: quote, error: quoteError } = await db.from('quotes').select('id,user_id,status,client_phone,created_at,retention_expires_at').eq('id',req.params.quoteId).eq('workspace_id',context.id).maybeSingle();
      if (quoteError) throw quoteError; if (!quote) return res.status(404).json({ error: 'Proposta não encontrada neste workspace.' });
      if (!['draft','pending','sent','viewed'].includes(quote.status) || (quote.retention_expires_at && new Date(quote.retention_expires_at).getTime() <= Date.now())) return res.status(409).json({ error: 'A proposta não está ativa para recuperação.' });
       const cadenceDays = parsed.data.cadenceDays || (Array.isArray(feature.config?.cadenceDays) ? feature.config.cadenceDays as number[] : [1,4,10,30,90]);
       const { data: automation, error: automationError } = await db.from('orkto_automations').upsert({ workspace_id: context.id, feature_key: 'proposal_recovery', name: 'Recuperação de propostas', status: 'active', config: { cadenceDays, mode: 'prepare_for_approval' }, created_by: req.user?.id || null }, { onConflict: 'workspace_id,feature_key,name' }).select('id').single();
       if (automationError) throw automationError;
       const schedule = buildRecoverySchedule(new Date(quote.created_at), cadenceDays);
       const now = Date.now();
       const futureSchedule = schedule.filter(step => new Date(step.dueAt).getTime() > now);
       if (!futureSchedule.length) return res.status(409).json({ error:'Toda a janela D+1…D+90 já passou. Nenhuma mensagem ou job foi criado; programe um novo acompanhamento manual se apropriado.', category:'policy_error', expiredSteps:schedule.map(step=>step.step) });
       const jobs = futureSchedule.map(step => ({ workspace_id: context.id, automation_id: automation.id, entity_type: 'quote', entity_ref: quote.id, step_key: step.step, due_at: step.dueAt, status:'scheduled', idempotency_key: `proposal-recovery:${quote.id}:${step.step}` }));
      const { data, error } = await db.from('orkto_automation_jobs').upsert(jobs, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('id,step_key,due_at,status');
      if (error) throw error;
       const { data: allJobs, error: readJobsError } = await db.from('orkto_automation_jobs').select('id,step_key,due_at,status').eq('workspace_id',context.id).eq('automation_id',automation.id).eq('entity_ref',quote.id).order('due_at',{ascending:true});
       if (readJobsError) throw readJobsError;
       await addAuditOrThrow(db,context.id,req.user?.id,'proposal_recovery.scheduled','quote',quote.id,{ cadence_days:cadenceDays, skipped_elapsed_steps:schedule.filter(step=>new Date(step.dueAt).getTime()<=now).map(step=>step.step), scheduled_jobs:allJobs?.length || 0 });
       res.status(201).json({ data: allJobs || data || [], mode: 'approval_required', externalDelivery: 'not_configured', skippedElapsedSteps:schedule.filter(step=>new Date(step.dueAt).getTime()<=now).map(step=>step.step) });
    } catch (error) { failure(res, error, 'Não foi possível programar a recuperação.'); }
  });

  app.get('/api/automations/proposal-recovery/:quoteId', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data, error } = await db.from('orkto_automation_jobs').select('id,step_key,due_at,status,attempts,last_error').eq('workspace_id',context.id).eq('entity_type','quote').eq('entity_ref',req.params.quoteId).order('due_at',{ascending:true});
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error) { failure(res, error, 'Não foi possível carregar a cadência.'); }
  });

  app.post('/api/automations/proposal-recovery/:quoteId/cancel', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    try {
      const { data: quote, error: quoteError } = await db.from('quotes').select('id').eq('workspace_id',context.id).eq('id',req.params.quoteId).maybeSingle();
      if (quoteError) throw quoteError; if (!quote) return res.status(404).json({ error:'Proposta não encontrada neste workspace.' });
      const { data, error } = await db.from('orkto_automation_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('workspace_id',context.id).eq('entity_type','quote').eq('entity_ref',req.params.quoteId).eq('status','scheduled').select('id');
      if (error) throw error;
      await addAuditOrThrow(db,context.id,req.user?.id,'proposal_recovery.cancelled','quote',req.params.quoteId,{ cancelled_jobs:data?.length || 0 });
      res.json({ cancelled: data?.length || 0 });
    } catch (error) { failure(res, error, 'Não foi possível cancelar a cadência.'); }
  });

  app.get('/api/cron/automation-dispatch', requireDb, async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const authorization = req.header('authorization') || '';
    if (!secret) return res.status(503).json({ error: 'CRON_SECRET ausente; scheduler protegido permanece inativo.', category: 'configuration_error' });
    if (!authorization.startsWith('Bearer ') || authorization.slice(7).length !== secret.length || !crypto.timingSafeEqual(Buffer.from(authorization.slice(7)),Buffer.from(secret))) return res.status(401).json({ error: 'Não autorizado.' });
    const now = new Date().toISOString();
    try {
      const { data: jobs, error } = await db.from('orkto_automation_jobs').select('*').eq('status','scheduled').lte('due_at',now).order('due_at',{ascending:true}).limit(50);
      if (error) throw error;
      const report = { scanned: jobs?.length || 0, prepared: 0, captured: 0, skipped: 0, failed: 0 };
      for (const job of jobs || []) {
        try {
          const { data: claimed, error: claimError } = await db.from('orkto_automation_jobs').update({ status: 'processing', attempts: Number(job.attempts || 0) + 1, updated_at: now }).eq('id',job.id).eq('workspace_id',job.workspace_id).eq('status','scheduled').select('id').maybeSingle();
          if (claimError) throw claimError; if (!claimed) continue;
          const [automationResult, workspaceResult] = await Promise.all([
            job.automation_id ? db.from('orkto_automations').select('status').eq('id',job.automation_id).eq('workspace_id',job.workspace_id).maybeSingle() : Promise.resolve({data:{status:'active'},error:null}),
            db.from('orkto_workspaces').select('owner_user_id').eq('id',job.workspace_id).maybeSingle(),
          ]);
          if (automationResult.error) throw automationResult.error; if (workspaceResult.error) throw workspaceResult.error;
          const ownerId = workspaceResult.data?.owner_user_id;
          let customerRef = '';
          let quote: any = null;
          let actionType = '';
          let actionPayload: Record<string,unknown> = {};
          let rationale = '';
          let stop: string | null = null;
          if (job.entity_type === 'quote' && ownerId) {
            const quoteResult = await db.from('quotes').select('id,status,client_name,client_phone,quote_number,created_at,retention_expires_at').eq('id',job.entity_ref).eq('workspace_id',job.workspace_id).maybeSingle();
            if (quoteResult.error) throw quoteResult.error;
            quote = quoteResult.data;
            customerRef = quote?.client_phone || '';
            let optOut = false; let customerReplied = false; let dealClosed = false;
            if (customerRef) {
              const signals = await db.from('orkto_customer_signals').select('id').eq('workspace_id',job.workspace_id).eq('customer_ref',customerRef).eq('signal_type','explicit_opt_out').limit(1);
              if (signals.error) throw signals.error; optOut = Boolean(signals.data?.length);
              const conversationResult = await db.from('orkto_conversations').select('id').eq('workspace_id',job.workspace_id).eq('contact_phone',customerRef).limit(1).maybeSingle();
              if (conversationResult.error) throw conversationResult.error;
              if (conversationResult.data) {
                const incoming = await db.from('orkto_messages').select('id').eq('workspace_id',job.workspace_id).eq('conversation_id',conversationResult.data.id).eq('direction','incoming').gt('sent_at',quote.created_at).limit(1);
                if (incoming.error) throw incoming.error; customerReplied = Boolean(incoming.data?.length);
              }
              const closed = await db.from('orkto_deals').select('id').eq('workspace_id',job.workspace_id).eq('customer_ref',customerRef).in('status',['won','lost']).limit(1);
              if (closed.error) throw closed.error; dealClosed = Boolean(closed.data?.length);
            }
            stop = recoveryStopReason({ optedOut: optOut, customerReplied, dealClosed, automationDisabled: automationResult.data?.status !== 'active', activeQuote: Boolean(quote && ['draft','pending','sent','viewed'].includes(quote.status) && (!quote.retention_expires_at || new Date(quote.retention_expires_at).getTime() > Date.now())) });
            actionType = 'send_proposal_followup';
            const rawDraft = quote ? `Passando para saber se ficou alguma dúvida sobre a proposta${quote.quote_number ? ` #${quote.quote_number}` : ''}. Se quiser, posso ajudar com os próximos passos.` : '';
            const messageDraft = quote ? applyResponsePipeline({ draft:rawDraft,surface:'recovery',tone:'cordial',customerName:quote.client_name,sourceRefs:[`quote:${quote.id}`,`recovery-job:${job.id}`] }) : '';
            actionPayload = { quoteId: quote?.id || job.entity_ref, step: job.step_key, customerPhone: customerRef, messageDraft, responsePolicyVersion:'response-safety-v1', requiresHumanReview: true };
            rationale = 'A proposta segue aberta. A WIA preparou um rascunho com dados da proposta; nenhum canal externo enviará a mensagem sem configuração e revisão.';
          } else if (job.entity_type === 'repurchase' && ownerId) {
            customerRef = String(job.entity_ref).slice(0,200);
            const customer = await findWorkspaceCustomer(db,job.workspace_id,customerRef);
            if (!customer) { stop = 'customer_not_found_or_ambiguous'; }
            const purchases = customer ? await db.from('orkto_purchases').select('id,product_ref,product_name,purchased_at,amount_cents').eq('workspace_id',job.workspace_id).eq('customer_ref',customer.id).order('purchased_at',{ascending:true}).limit(100) : { data:[],error:null };
            if (purchases.error) throw purchases.error;
            const scopedPurchases = (purchases.data || []).filter((purchase: any) => job.step_key === 'all' ? !purchase.product_ref : purchase.product_ref === job.step_key);
            const estimate = estimateRepurchaseWindow(scopedPurchases.map((row: any) => ({ purchasedAt: row.purchased_at, amountCents: Number(row.amount_cents), productKey: row.product_ref || undefined })));
            const featureConfig = await db.from('orkto_feature_configs').select('status,config').eq('workspace_id',job.workspace_id).eq('feature_key','repurchase_reactivation').maybeSingle();
            if (featureConfig.error) throw featureConfig.error;
            const threshold = typeof featureConfig.data?.config?.minimumConfidence === 'number' ? Math.min(0.95,Math.max(0.65,featureConfig.data.config.minimumConfidence)) : 0.75;
            const customerRefs = customer ? [...new Set([customer.id,customer.phone].filter(Boolean))] : [customerRef];
            const signals = await db.from('orkto_customer_signals').select('id').eq('workspace_id',job.workspace_id).in('customer_ref',customerRefs).eq('signal_type','explicit_opt_out').limit(1);
            if (signals.error) throw signals.error;
            const latestPurchaseAt = scopedPurchases.at(-1)?.purchased_at;
            const conversationResult = customer?.phone ? await db.from('orkto_conversations').select('id').eq('workspace_id',job.workspace_id).eq('contact_phone',customer.phone).limit(1).maybeSingle() : { data:null,error:null };
            if (conversationResult.error) throw conversationResult.error;
            let customerReplied = false;
            if (conversationResult.data && latestPurchaseAt) {
              const incoming = await db.from('orkto_messages').select('id').eq('workspace_id',job.workspace_id).eq('conversation_id',conversationResult.data.id).eq('direction','incoming').gt('sent_at',latestPurchaseAt).limit(1);
              if (incoming.error) throw incoming.error; customerReplied = Boolean(incoming.data?.length);
            }
            stop = stop || (signals.data?.length ? 'opt_out' : customerReplied ? 'customer_replied' : automationResult.data?.status !== 'active' || String(featureConfig.data?.status || '').toUpperCase() !== 'ACTIVE' ? 'automation_disabled' : !estimate.eligible || !estimate.windowOpen || estimate.confidence < threshold ? 'confidence_below_threshold' : null);
            const productName = scopedPurchases.at(-1)?.product_name;
            actionType = 'prepare_repurchase_followup';
            const messageDraft = applyResponsePipeline({ draft:`Já faz algum tempo desde sua última compra${productName ? ` de ${productName}` : ''}. Se precisar de reposição ou de um novo atendimento, posso ajudar.`,surface:'reactivation',tone:'cordial',customerName:customer?.name,sourceRefs:latestPurchaseAt ? [`purchase:${customer?.id}:${latestPurchaseAt}`] : [] });
            actionPayload = { customerRef:customer?.id || customerRef, customerId:customer?.id || null, customerPhone: customer?.phone || null, productRef:job.step_key === 'all' ? null : job.step_key, productName: productName || null, estimatedAt: estimate.estimatedAt, confidence: estimate.confidence, messageDraft, responsePolicyVersion:'response-safety-v1', requiresHumanReview: true };
            rationale = 'O intervalo de recompra observado atingiu o limite de confiança configurado. A WIA preparou um rascunho; contato externo exige aprovação e canal configurado.';
          } else if (job.entity_type === 'replay_capture') {
            const result = await captureReplayFromDeal(db,job);
            const completedAt = new Date().toISOString();
            if (!result.captured) await addAuditOrThrow(db,job.workspace_id,undefined,'replay.capture_skipped','deal',String(job.entity_ref),{ job_id:job.id, reason:result.reason });
            const { error: runError } = await db.from('orkto_automation_runs').upsert({ workspace_id:job.workspace_id,automation_id:job.automation_id || null,job_id:job.id,status:result.captured ? 'succeeded' : 'skipped',result,started_at:now,completed_at:completedAt },{onConflict:'job_id'});
            if (runError) throw runError;
            const { error: finishError } = await db.from('orkto_automation_jobs').update({ status:'completed',updated_at:completedAt,last_error:null }).eq('workspace_id',job.workspace_id).eq('id',job.id).eq('status','processing');
            if (finishError) throw finishError;
            if (result.captured) report.captured++; else report.skipped++;
            continue;
          } else {
            stop = 'unsupported_job_type_or_missing_owner';
          }
          if (stop) {
            await db.from('orkto_automation_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('workspace_id',job.workspace_id).eq('id',job.id).in('status',['scheduled','processing']);
            await db.from('orkto_automation_runs').upsert({ workspace_id: job.workspace_id, automation_id: job.automation_id, job_id: job.id, status: 'skipped', result: { stop_reason: stop }, started_at: now, completed_at: new Date().toISOString() }, { onConflict:'job_id' });
            report.skipped++; continue;
          }
          const actionKey = `recovery-job:${job.id}`;
          const { data: action, error: actionError } = await db.from('orkto_wia_actions').upsert({ workspace_id: job.workspace_id, action_type: actionType, payload: actionPayload, rationale, risk_level: 'medium', status: 'awaiting_approval', requires_approval: true, idempotency_key: actionKey, created_by: null }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle();
          if (actionError) throw actionError;
          const resolvedAction = action?.id ? action : await db.from('orkto_wia_actions').select('id').eq('workspace_id',job.workspace_id).eq('idempotency_key',actionKey).maybeSingle();
          if (resolvedAction?.id) await db.from('orkto_notifications').upsert({ workspace_id: job.workspace_id, user_id: ownerId, type: 'approval_required', title: job.entity_type === 'quote' ? 'Follow-up de proposta pronto para revisão' : 'Reativação por recompra pronta para revisão', body: 'A WIA preparou um rascunho. Revise antes de qualquer contato; nada foi enviado.', entity_type: 'wia_action', entity_ref: resolvedAction.id, idempotency_key: `approval:${actionKey}` }, { onConflict:'workspace_id,idempotency_key', ignoreDuplicates:true });
          await db.from('orkto_automation_runs').upsert({ workspace_id: job.workspace_id, automation_id: job.automation_id, job_id: job.id, status: 'approval_required', result: { action_id: resolvedAction?.id || null, external_delivery: 'not_configured' }, started_at: now, completed_at: new Date().toISOString() }, { onConflict: 'job_id' });
          const { error: finishError } = await db.from('orkto_automation_jobs').update({ status: 'completed', updated_at: new Date().toISOString(), last_error: null }).eq('id',job.id).eq('workspace_id',job.workspace_id).eq('status','processing');
          if (finishError) throw finishError;
          report.prepared++;
        } catch (jobError) {
          const attempts = Number(job.attempts || 0) + 1;
          const retryAt = new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString();
          const retryError = await db.from('orkto_automation_jobs').update({ status: attempts >= 5 ? 'failed' : 'scheduled', due_at: retryAt, last_error: jobError instanceof Error ? jobError.message.slice(0,500) : 'Falha desconhecida', updated_at: new Date().toISOString() }).eq('id',job.id).eq('workspace_id',job.workspace_id);
          if (retryError.error) console.error('[Automation] retry_persistence_failed', { jobId: job.id, code: retryError.error.code || 'unknown' });
          report.failed++;
        }
      }
      res.json(report);
    } catch (error) { failure(res,error,'O scheduler não conseguiu processar a fila.'); }
  });

  app.post('/api/live-quotes/from-quote/:quoteId', authenticate, requireDb, async (req, res) => {
    const context = await workspaceContext(req, res, db); if (!context) return;
    const result = await invokeCoreMutation(req,res,context,'PUBLISH_LIVE_QUOTE',{quoteId:req.params.quoteId});
    if (!result) return;
    res.status(result.result === 'REPLAY' ? 200 : 201).json({
      data:result.live_quote, token:result.token, publicPath:result.publicPath,
      idempotentReplay:result.result === 'REPLAY',
    });
  });

  app.get('/api/public/live-quotes/:token', async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    const result = await invokePublicProposal(req,res,'READ',String(req.params.token || ''));
    if (res.headersSent) return;
    res.json(result.proposal);
  });

  app.post('/api/public/live-quotes/:token/accept', async (req, res) => {
    const parsed=z.object({customerName:z.string().trim().min(1).max(180)}).strict().safeParse(req.body);
    if(!parsed.success) return res.status(400).json({error:'Informe o nome para registrar o aceite.'});
    const result=await invokePublicProposal(req,res,'ACCEPT',String(req.params.token||''),parsed.data);
    if(res.headersSent) return;
    res.json({success:true,status:result.status,idempotentReplay:result.result==='REPLAY'});
  });

  app.post('/api/public/live-quotes/:token/reject', async (req, res) => {
    const parsed=z.object({reason:z.string().trim().max(500).default('')}).strict().safeParse(req.body||{});
    if(!parsed.success) return res.status(400).json({error:'Motivo de recusa inválido.'});
    const result=await invokePublicProposal(req,res,'REJECT',String(req.params.token||''),parsed.data);
    if(res.headersSent) return;
    res.json({success:true,status:result.status,idempotentReplay:result.result==='REPLAY'});
  });
}
