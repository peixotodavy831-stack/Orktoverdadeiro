import { estimateRepurchaseWindow, type PurchaseEvent } from './full-operational.js';

type Database = any;

/** Derives and durably schedules a workspace-local reactivation candidate from recorded purchases. */
export async function scheduleRepurchaseCandidate(db: Database, input: {
  workspaceId: string; customerId: string; productRef?: string | null; actorUserId?: string | null; now?: Date;
}) {
  const now = input.now || new Date();
  const { data: customer, error: customerError } = await db.from('clients').select('id,name,phone').eq('workspace_id',input.workspaceId).eq('id',input.customerId).is('archived_at',null).maybeSingle();
  if (customerError) throw customerError;
  if (!customer) return { scheduled: [], skipped: 'customer_not_found' };

  const { data: feature, error: featureError } = await db.from('orkto_feature_configs').select('status,config').eq('workspace_id',input.workspaceId).eq('feature_key','repurchase_reactivation').maybeSingle();
  if (featureError) throw featureError;
  if (String(feature?.status || '').toUpperCase() !== 'ACTIVE') return { scheduled: [], skipped: 'automation_disabled' };
  const config = (feature.config || {}) as Record<string, unknown>;
  const threshold = typeof config.minimumConfidence === 'number' ? Math.min(0.95,Math.max(0.65,config.minimumConfidence)) : 0.75;

  const refs = [...new Set([customer.id,customer.phone].filter((value): value is string => typeof value === 'string' && value.length > 0))];
  const optOutQuery = db.from('orkto_customer_signals').select('id').eq('workspace_id',input.workspaceId).eq('signal_type','explicit_opt_out').in('customer_ref',refs).limit(1);
  const [optOut, purchaseResult] = await Promise.all([
    optOutQuery,
    db.from('orkto_purchases').select('product_ref,product_name,purchased_at,amount_cents').eq('workspace_id',input.workspaceId).eq('customer_ref',customer.id).order('purchased_at',{ascending:true}).limit(500),
  ]);
  if (optOut.error) throw optOut.error;
  if (purchaseResult.error) throw purchaseResult.error;
  if (optOut.data?.length) return { scheduled: [], skipped: 'customer_opt_out' };

  const productKey = input.productRef?.trim() || 'all';
  const purchaseRows = (purchaseResult.data || []).filter((row: any) => productKey === 'all' ? !row.product_ref : String(row.product_ref || '') === productKey);
  const events: PurchaseEvent[] = purchaseRows.map((row: any) => ({ purchasedAt: row.purchased_at, amountCents: Number(row.amount_cents), productKey: productKey === 'all' ? undefined : productKey }));
  const estimate = estimateRepurchaseWindow(events,now);

  // A new confirmed purchase invalidates the previous candidate/action for this product.
  const cancelledAt = now.toISOString();
  let cancelJobs = db.from('orkto_automation_jobs').update({ status:'cancelled',updated_at:cancelledAt }).eq('workspace_id',input.workspaceId).eq('entity_type','repurchase').eq('entity_ref',customer.id).eq('status','scheduled').select('id');
  if (productKey !== 'all') cancelJobs = cancelJobs.eq('step_key',productKey);
  const { data: cancelledJobs, error: cancelJobError } = await cancelJobs;
  if (cancelJobError) throw cancelJobError;
  let actionQuery = db.from('orkto_wia_actions').select('id,payload').eq('workspace_id',input.workspaceId).eq('action_type','prepare_repurchase_followup').in('status',['prepared','awaiting_approval']).limit(500);
  const { data: actions, error: actionError } = await actionQuery;
  if (actionError) throw actionError;
  const actionIds = (actions || []).filter((action: any) => String(action.payload?.customerRef || action.payload?.customerId || '') === customer.id
    && (productKey === 'all' || String(action.payload?.productRef || '') === productKey)).map((action: any) => action.id);
  if (actionIds.length) {
    const { error } = await db.from('orkto_wia_actions').update({ status:'cancelled',updated_at:cancelledAt }).eq('workspace_id',input.workspaceId).in('id',actionIds);
    if (error) throw error;
  }

  const eligible = estimate.eligible && estimate.confidence >= threshold && estimate.estimatedAt;
  if (!eligible) return { scheduled: [], estimate, skipped: estimate.eligible ? 'confidence_below_threshold' : 'insufficient_history', cancelledJobs:cancelledJobs?.length || 0 };

  const automationName = `Recompra ${productKey}`;
  const { data: automation, error: automationError } = await db.from('orkto_automations').upsert({
    workspace_id:input.workspaceId,feature_key:'repurchase_reactivation',name:automationName,status:'active',
    config:{ minimumConfidence:threshold,mode:'prepare_for_approval' },created_by:input.actorUserId || null,
  },{onConflict:'workspace_id,feature_key,name'}).select('id').single();
  if (automationError) throw automationError;
  const dueAt = new Date(Math.max(new Date(estimate.estimatedAt).getTime(),now.getTime())).toISOString();
  const idempotencyKey = `repurchase:${customer.id}:${productKey}:${dueAt.slice(0,10)}`;
  const { data: job, error: jobError } = await db.from('orkto_automation_jobs').upsert({
    workspace_id:input.workspaceId,automation_id:automation.id,entity_type:'repurchase',entity_ref:customer.id,
    step_key:productKey,due_at:dueAt,status:'scheduled',idempotency_key:idempotencyKey,
  },{onConflict:'workspace_id,idempotency_key',ignoreDuplicates:true}).select('id,step_key,due_at,status').maybeSingle();
  if (jobError) throw jobError;
  let saved = job;
  if (!saved) {
    const { data, error } = await db.from('orkto_automation_jobs').select('id,step_key,due_at,status').eq('workspace_id',input.workspaceId).eq('idempotency_key',idempotencyKey).maybeSingle();
    if (error) throw error;
    saved = data;
  }
  if (!saved) throw new Error('Candidato de recompra não pôde ser recuperado após a gravação.');
  if (job) {
    const { error } = await db.from('orkto_wia_events').insert({ workspace_id:input.workspaceId,actor_user_id:input.actorUserId || null,event_type:'repurchase.candidate_scheduled',source:'system',entity_type:'automation_job',entity_ref:job.id,payload:{ customer_id:customer.id,product_ref:productKey === 'all' ? null : productKey,due_at:dueAt,confidence:estimate.confidence,threshold,provenance:'orkto_purchases' } });
    if (error) throw error;
  }
  return { scheduled:[saved],estimate,threshold,cancelledJobs:cancelledJobs?.length || 0,idempotentReplay:!job };
}
