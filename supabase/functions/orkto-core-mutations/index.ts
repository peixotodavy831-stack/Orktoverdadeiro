import { createClient } from '@supabase/supabase-js';
import { clientInput } from './_shared/client-input.ts';
import { serviceInput } from './_shared/service-input.ts';
import { dealInput, dealPatchInput } from './_shared/deal-input.ts';
import { quoteCreateInput, quotePatchInput, calculateQuoteMoney, quoteCustomerMatchesDeal } from './_shared/quote-input.ts';
import { onboardingInput } from './_shared/profile-input.ts';
import { checkPlanLimit, hasPlanFeature, loadWorkspacePlanAccess } from './_shared/plan-access.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const MAX_BODY_BYTES = 16_384;

function response(status: number, code: string, requestId: string, data?: unknown, origin?: string) {
  const headers: Record<string,string> = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-request-id': requestId,
    'vary': 'Origin',
  };
  if (origin) headers['access-control-allow-origin'] = origin;
  return new Response(JSON.stringify({ code, requestId, ...(data === undefined ? {} : { data }) }), { status, headers });
}

function allowedOrigin(origin: string | null): string | undefined | false {
  if (!origin) return undefined;
  const allowed = (Deno.env.get('ORKTO_ALLOWED_ORIGINS') || '').split(',').map(v => v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : false;
}

async function fingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const suppliedId = req.headers.get('x-request-id') || '';
  const requestId = UUID.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const origin = allowedOrigin(req.headers.get('origin'));
  if (origin === false) return response(403, 'PERMISSION_DENIED', requestId);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin || '',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-orkto-workspace, x-idempotency-key, x-request-id',
      'vary': 'Origin',
    } });
  }
  if (req.method !== 'POST') return response(405, 'VALIDATION_FAILED', requestId, undefined, origin);
  const url = Deno.env.get('SUPABASE_URL') || '';
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !publicKey || !serviceKey) return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
  const bearer = req.headers.get('authorization') || '';
  if (!/^Bearer [^\s]+$/.test(bearer)) return response(401, 'AUTH_REQUIRED', requestId, undefined, origin);
  const workspaceId = req.headers.get('x-orkto-workspace') || '';
  if (!UUID.test(workspaceId)) return response(403, 'WORKSPACE_ACCESS_DENIED', requestId, undefined, origin);
  const idempotencyKey = req.headers.get('x-idempotency-key') || '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
  const length = Number(req.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) return response(413, 'VALIDATION_FAILED', requestId, undefined, origin);

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return response(413, 'VALIDATION_FAILED', requestId, undefined, origin);
    let envelope: unknown;
    try { envelope = JSON.parse(raw); } catch { return response(400, 'VALIDATION_FAILED', requestId, undefined, origin); }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
        || Object.keys(envelope).some(key => key !== 'command' && key !== 'payload')) {
      return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
    }
    const { command, payload: suppliedPayload } = envelope as { command?: unknown; payload?: unknown };
    let canonical: Record<string,unknown>;
    let functionName: string;
    let argumentsForCommand: Record<string,unknown>;
    let eventType: string;
    if (command === 'COMPLETE_ONBOARDING') {
      const parsed = onboardingInput.safeParse(suppliedPayload);
      if (!parsed.success) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      canonical = parsed.data;
      functionName = 'orkto_complete_onboarding_command';
      eventType = 'profile.onboarding_completed';
      const names: Record<string,string> = {
        companyName:'company_name',taxId:'tax_id',whatsappNumber:'whatsapp_number',
        whatsappTemplate:'whatsapp_template',companyLogo:'company_logo',
        address:'address',paymentInfo:'payment_info',profession:'profession',
        brandName:'brand_name',brandTone:'brand_tone',quoteColor:'quote_color',
      };
      argumentsForCommand = { p_fields:Object.fromEntries(Object.entries(parsed.data).map(([key,value]) => [names[key],value])) };
    } else if (command === 'CREATE_CLIENT') {
      const parsed = clientInput.safeParse(suppliedPayload);
      if (!parsed.success) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      const client = parsed.data;
      canonical = { name:client.name,phone:client.phone,company:client.company || null,
        vehicleOrService:client.vehicleOrService || null,notes:client.notes || null };
      functionName = 'orkto_create_client_command';
      eventType = 'client.created';
      argumentsForCommand = { p_name:canonical.name,p_phone:canonical.phone,p_company:canonical.company,
        p_vehicle_or_service:canonical.vehicleOrService,p_notes:canonical.notes };
    } else if (command === 'UPDATE_CLIENT') {
      const holder = suppliedPayload as { clientId?: unknown; changes?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'clientId' && key !== 'changes')
          || typeof holder.clientId !== 'string' || !UUID.test(holder.clientId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      const parsed = clientInput.partial().strict().safeParse(holder.changes);
      if (!parsed.success || !Object.keys(parsed.data).length) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      const patch = parsed.data;
      const changes: Record<string,unknown> = {};
      for (const [key,value] of Object.entries(patch)) changes[key === 'vehicleOrService' ? 'vehicle_or_service' : key] = value;
      canonical = { clientId:holder.clientId,changes };
      functionName = 'orkto_update_client_command';
      eventType = 'client.updated';
      argumentsForCommand = { p_client_id:holder.clientId,p_changes:changes };
    } else if (command === 'ARCHIVE_CLIENT') {
      const holder = suppliedPayload as { clientId?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'clientId')
          || typeof holder.clientId !== 'string' || !UUID.test(holder.clientId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { clientId:holder.clientId };
      functionName = 'orkto_archive_client_command';
      eventType = 'client.archived';
      argumentsForCommand = { p_client_id:holder.clientId };
    } else if (command === 'CREATE_CATALOG_ITEM') {
      const parsed = serviceInput.safeParse(suppliedPayload);
      if (!parsed.success) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      const item = parsed.data;
      const fields = { name:item.name,description:item.description || null,unit_price:item.unitPrice,category:item.category };
      canonical = { fields };
      functionName = 'orkto_catalog_item_command';
      eventType = 'catalog_item.created';
      argumentsForCommand = { p_command:command,p_service_id:null,p_fields:fields };
    } else if (command === 'UPDATE_CATALOG_ITEM') {
      const holder = suppliedPayload as { serviceId?: unknown; changes?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'serviceId' && key !== 'changes')
          || typeof holder.serviceId !== 'string' || !UUID.test(holder.serviceId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      const parsed = serviceInput.partial().strict().safeParse(holder.changes);
      if (!parsed.success || !Object.keys(parsed.data).length) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      const fields: Record<string,unknown> = {};
      for (const [key,value] of Object.entries(parsed.data)) fields[key === 'unitPrice' ? 'unit_price' : key] = value;
      canonical = { serviceId:holder.serviceId,fields };
      functionName = 'orkto_catalog_item_command';
      eventType = 'catalog_item.updated';
      argumentsForCommand = { p_command:command,p_service_id:holder.serviceId,p_fields:fields };
    } else if (command === 'ARCHIVE_CATALOG_ITEM') {
      const holder = suppliedPayload as { serviceId?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'serviceId')
          || typeof holder.serviceId !== 'string' || !UUID.test(holder.serviceId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { serviceId:holder.serviceId };
      functionName = 'orkto_catalog_item_command';
      eventType = 'catalog_item.archived';
      argumentsForCommand = { p_command:command,p_service_id:holder.serviceId,p_fields:{} };
    } else if (command === 'CREATE_DEAL') {
      const parsed = dealInput.strict().safeParse(suppliedPayload);
      if (!parsed.success) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      if (parsed.data.stage === 'won' || parsed.data.stage === 'lost') return response(423, 'CONFIGURATION_REQUIRED', requestId, undefined, origin);
      const deal = parsed.data;
      const fields = { title:deal.title,description:deal.description,customer_ref:deal.customerRef || null,
        conversation_ref:deal.conversationRef || null,stage:deal.stage,value_cents:deal.valueCents,
        probability_percent:deal.probabilityPercent ?? null,owner_user_id:deal.ownerUserId || null,
        expected_close_on:deal.expectedCloseOn || null,source:deal.source };
      canonical = { fields };
      functionName = 'orkto_deal_command';
      eventType = 'deal.created';
      argumentsForCommand = { p_command:command,p_deal_id:null,p_fields:fields };
    } else if (command === 'UPDATE_DEAL') {
      const holder = suppliedPayload as { dealId?: unknown; changes?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'dealId' && key !== 'changes')
          || typeof holder.dealId !== 'string' || !UUID.test(holder.dealId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      const parsed = dealPatchInput.strict().safeParse(holder.changes);
      if (!parsed.success || !Object.keys(parsed.data).length || parsed.data.lostReason !== undefined) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      if (parsed.data.stage === 'won' || parsed.data.stage === 'lost') return response(423, 'CONFIGURATION_REQUIRED', requestId, undefined, origin);
      const fields: Record<string,unknown> = {};
      const columns: Record<string,string> = { valueCents:'value_cents',probabilityPercent:'probability_percent',ownerUserId:'owner_user_id',expectedCloseOn:'expected_close_on' };
      for (const [key,value] of Object.entries(parsed.data)) fields[columns[key] || key] = value;
      canonical = { dealId:holder.dealId,fields };
      functionName = 'orkto_deal_command';
      eventType = 'deal.updated';
      argumentsForCommand = { p_command:command,p_deal_id:holder.dealId,p_fields:fields };
    } else if (command === 'CLOSE_DEAL' || command === 'ARCHIVE_DEAL') {
      const holder = suppliedPayload as { dealId?: unknown; stage?: unknown; lostReason?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => !(command === 'ARCHIVE_DEAL' ? ['dealId'] : ['dealId','stage','lostReason']).includes(key))
          || typeof holder.dealId !== 'string' || !UUID.test(holder.dealId)
          || (command === 'CLOSE_DEAL' && !['won','lost'].includes(String(holder.stage)))
          || !(holder.lostReason === null || holder.lostReason === undefined
            || (typeof holder.lostReason === 'string' && holder.lostReason.length <= 500))
          || (holder.stage === 'won' && holder.lostReason !== null && holder.lostReason !== undefined))
        return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      const stage=command === 'ARCHIVE_DEAL' ? 'archived' : holder.stage;
      canonical={dealId:holder.dealId,stage,lostReason:holder.lostReason || null};
      functionName='orkto_transition_deal_command';
      eventType=command === 'ARCHIVE_DEAL' ? 'deal.archived' : 'deal.stage_changed';
      argumentsForCommand={p_deal_id:holder.dealId,p_stage:stage,p_lost_reason:holder.lostReason || null};
    } else if (command === 'APPROVE_WIA_ACTION' || command === 'REJECT_WIA_ACTION') {
      const holder = suppliedPayload as { actionId?: unknown; confirm?: unknown; reason?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'actionId' && key !== 'confirm' && key !== 'reason')
          || typeof holder.actionId !== 'string' || !UUID.test(holder.actionId)
          || (command === 'APPROVE_WIA_ACTION' && (holder.confirm !== true || holder.reason !== undefined))
          || (command === 'REJECT_WIA_ACTION' && (holder.confirm !== undefined || (holder.reason !== undefined && (typeof holder.reason !== 'string' || holder.reason.length > 500))))) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { actionId:holder.actionId,decision:command,reason:holder.reason || '' };
      functionName = 'orkto_wia_decide_command';
      eventType = command === 'APPROVE_WIA_ACTION' ? 'wia.action.approved_and_executed' : 'wia.action.rejected';
      argumentsForCommand = { p_action_id:holder.actionId,p_decision:command === 'APPROVE_WIA_ACTION' ? 'APPROVE' : 'REJECT',p_reason:holder.reason || '' };
    } else if (command === 'CREATE_QUOTE') {
      const parsed = quoteCreateInput.safeParse(suppliedPayload);
      if (!parsed.success) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      canonical = { input:parsed.data };
      functionName = 'orkto_create_quote_command';
      eventType = 'quote.created';
      argumentsForCommand = {};
    } else if (command === 'UPDATE_QUOTE') {
      const holder = suppliedPayload as { quoteId?: unknown; changes?: unknown; status?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => !['quoteId','changes','status'].includes(key))
          || typeof holder.quoteId !== 'string' || !UUID.test(holder.quoteId)
          || (holder.status !== undefined && typeof holder.status !== 'string')) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      const parsed = quotePatchInput.safeParse(holder.changes);
      if (!parsed.success || !Object.keys(parsed.data).length) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      canonical = { quoteId:holder.quoteId,changes:parsed.data,status:holder.status || null };
      functionName = 'orkto_update_quote_command';
      eventType = 'quote.updated';
      argumentsForCommand = { p_quote_id:holder.quoteId };
    } else if (command === 'ARCHIVE_QUOTE') {
      const holder = suppliedPayload as { quoteId?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'quoteId')
          || typeof holder.quoteId !== 'string' || !UUID.test(holder.quoteId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { quoteId:holder.quoteId };
      functionName = 'orkto_archive_quote_command';
      eventType = 'quote.archived';
      argumentsForCommand = { p_quote_id:holder.quoteId };
    } else if (command === 'SET_CONVERSATION_PRIORITY') {
      const holder = suppliedPayload as { conversationId?: unknown; priority?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key=>key!=='conversationId' && key!=='priority')
          || typeof holder.conversationId!=='string' || !UUID.test(holder.conversationId)
          || !(holder.priority===null || ['low','normal','high','urgent'].includes(String(holder.priority)))) {
        return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      }
      canonical={conversationId:holder.conversationId,priority:holder.priority};
      functionName='orkto_set_conversation_priority_command';
      eventType='conversation.priority_overridden';
      argumentsForCommand={p_conversation_id:holder.conversationId,p_priority:holder.priority};
    } else if (command === 'MARK_CONVERSATION_READ' || command === 'SET_CONVERSATION_STATUS') {
      const holder = suppliedPayload as { conversationId?: unknown; status?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'conversationId' && key !== 'status')
          || typeof holder.conversationId !== 'string' || !UUID.test(holder.conversationId)
          || (command === 'MARK_CONVERSATION_READ' && holder.status !== undefined)
          || (command === 'SET_CONVERSATION_STATUS' && !['open','active','paused','closed','archived'].includes(String(holder.status)))) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { conversationId:holder.conversationId,command,status:command === 'SET_CONVERSATION_STATUS' ? holder.status : null };
      functionName = 'orkto_inbox_state_command';
      eventType = command === 'MARK_CONVERSATION_READ' ? 'conversation.read' : 'conversation.status_changed';
      argumentsForCommand = { p_command:command,p_conversation_id:holder.conversationId,
        p_status:command === 'SET_CONVERSATION_STATUS' ? holder.status : null };
    } else if (command === 'AUDIT_MESSAGE_CONFIGURATION_REQUIRED') {
      const holder = suppliedPayload as { conversationId?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'conversationId')
          || typeof holder.conversationId !== 'string' || !UUID.test(holder.conversationId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { conversationId:holder.conversationId };
      functionName = '';
      eventType = 'channel.send.configuration_required';
      argumentsForCommand = {};
    } else {
      return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
    }

    const userClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser(bearer.slice(7));
    if (authError || !user) return response(401, 'AUTH_REQUIRED', requestId, undefined, origin);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: membership, error: membershipError } = await admin.from('orkto_workspace_members')
      .select('workspace_id,role,status').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (membershipError) return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
    if (!membership || membership.status !== 'active') return response(403, 'WORKSPACE_ACCESS_DENIED', requestId, undefined, origin);
    if (!['owner','admin','manager','member'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'AUDIT_MESSAGE_CONFIGURATION_REQUIRED') {
      const conversationId = String(canonical.conversationId);
      const { data:conversation,error:conversationError } = await admin.from('orkto_conversations')
        .select('id').eq('workspace_id',membership.workspace_id).eq('id',conversationId).maybeSingle();
      if (conversationError) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if (!conversation) return response(404,'NOT_FOUND',requestId,undefined,origin);
      const { error:auditError } = await admin.from('orkto_audit_log').insert({
        user_id:user.id,workspace_id:membership.workspace_id,conversation_id:conversationId,
        event_type:'channel.send.configuration_required',actor_type:'human',actor_id:user.id,
        event_data:{ status:'CONFIGURATION_REQUIRED',idempotency_key:idempotencyKey,request_id:requestId },
      });
      if (auditError) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      return response(200,'OK',requestId,{result:'AUDITED'},origin);
    }
    if ((command === 'ARCHIVE_CLIENT' || command === 'ARCHIVE_CATALOG_ITEM' || command === 'ARCHIVE_QUOTE' || command === 'ARCHIVE_DEAL') && !['owner','admin'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'COMPLETE_ONBOARDING' && membership.role !== 'owner') return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if ((command === 'APPROVE_WIA_ACTION' || command === 'REJECT_WIA_ACTION') && !['owner','admin','manager'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'SET_CONVERSATION_STATUS' && canonical.status === 'archived'
        && !['owner','admin'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);

    const plan = await loadWorkspacePlanAccess(admin, membership.workspace_id);
    if (plan.configurationRequired || plan.readOnly) return response(423, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'CREATE_QUOTE' || command === 'UPDATE_QUOTE' || command === 'ARCHIVE_QUOTE') {
      if (!hasPlanFeature(plan,'proposals')) return response(423, 'CONFIGURATION_REQUIRED', requestId, undefined, origin);
    }
    if (command === 'UPDATE_QUOTE') {
      const holder=suppliedPayload as {quoteId:string;changes:unknown;status?:string};
      const patch=quotePatchInput.parse(holder.changes);
      const {data:existing,error:existingError}=await admin.from('quotes')
        .select('id,workspace_id,status,updated_at,client_name,client_phone,client_email,client_company,client_vehicle_or_service,customer_id,deal_id,notes,items,taxes,valid_value_days,payment_instructions')
        .eq('workspace_id',membership.workspace_id).eq('id',holder.quoteId).is('archived_at',null).maybeSingle();
      if(existingError) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if(!existing) return response(404,'NOT_FOUND',requestId,undefined,origin);
      if(['approved','accepted'].includes(String(existing.status).toLowerCase())) return response(409,'CONFLICT',requestId,undefined,origin);
      if(holder.status!==undefined && holder.status!==existing.status) return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const names:Record<string,string>={clientName:'client_name',clientPhone:'client_phone',clientEmail:'client_email',
        clientCompany:'client_company',clientVehicleOrService:'client_vehicle_or_service',notes:'notes',
        validValueDays:'valid_value_days',paymentInstructions:'payment_instructions'};
      const fields:Record<string,unknown>={};
      for(const [key,column] of Object.entries(names)) if(Object.hasOwn(patch,key)) fields[column]=(patch as Record<string,unknown>)[key];
      if(patch.items!==undefined || patch.taxes!==undefined){
        const rawItems=patch.items ?? existing.items;
        const parsedItems=quoteCreateInput.shape.items.safeParse(rawItems);
        if(!parsedItems.success) return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
        const ids=[...new Set(parsedItems.data.map(item=>item.catalogItemId).filter((id):id is string=>Boolean(id)))];
        const catalog=new Map<string,{name:string;description:string|null;unit_price:number}>();
        if(ids.length){
          const {data,error}=await admin.from('services').select('id,name,description,unit_price')
            .eq('workspace_id',membership.workspace_id).in('id',ids).is('archived_at',null);
          if(error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
          for(const row of data||[]) catalog.set(row.id,row);
          if(catalog.size!==ids.length) return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
        }
        const items=parsedItems.data.map(item=>{
          const priced=item.catalogItemId?catalog.get(item.catalogItemId):null;
          return {id:item.id||crypto.randomUUID(),...(item.catalogItemId?{catalogItemId:item.catalogItemId}:{}),
            name:priced?.name||item.name,description:item.description||priced?.description||'',
            quantity:item.quantity,unitPrice:priced?Number(priced.unit_price):item.unitPrice,discount:item.discount};
        });
        let money:ReturnType<typeof calculateQuoteMoney>;
        try{money=calculateQuoteMoney(items,patch.taxes??Number(existing.taxes));}
        catch{return response(400,'VALIDATION_FAILED',requestId,undefined,origin);}
        Object.assign(fields,{items,...money});
      }
      const relationshipChanged=['clientPhone','customerId','dealId'].some(key=>Object.hasOwn(patch,key));
      if(relationshipChanged){
        const phone=patch.clientPhone??existing.client_phone;
        let customerId:string|null=patch.customerId!==undefined?patch.customerId:
          patch.clientPhone!==undefined?null:existing.customer_id;
        if(customerId){
          const {data,error}=await admin.from('clients').select('id,phone').eq('workspace_id',membership.workspace_id)
            .eq('id',customerId).is('archived_at',null).maybeSingle();
          if(error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
          if(!data || data.phone!==phone) return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
        }else{
          const {data,error}=await admin.from('clients').select('id,phone').eq('workspace_id',membership.workspace_id)
            .eq('phone',phone).is('archived_at',null).limit(1).maybeSingle();
          if(error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
          customerId=data?.id||null;
        }
        const dealId=patch.dealId!==undefined?patch.dealId:existing.deal_id;
        if(dealId){
          const {data,error}=await admin.from('orkto_deals').select('id,customer_ref,status')
            .eq('workspace_id',membership.workspace_id).eq('id',dealId).neq('status','archived').maybeSingle();
          if(error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
          if(!data || !quoteCustomerMatchesDeal(data.customer_ref,customerId,phone))
            return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
        }
        Object.assign(fields,{customer_id:customerId,deal_id:dealId});
      }
      argumentsForCommand={p_quote_id:holder.quoteId,p_expected_updated_at:existing.updated_at,p_fields:fields};
    }
    if (command === 'CREATE_QUOTE') {
      const quote = quoteCreateInput.parse(suppliedPayload);
      const { count:activeCount,error:countError } = await admin.from('quotes').select('id',{count:'exact',head:true})
        .eq('workspace_id',membership.workspace_id).is('archived_at',null).not('status','in','(rejected,expired)');
      if (countError) return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
      const limit = checkPlanLimit(plan.entitlements,'active_proposals',activeCount || 0);
      if (!limit.allowed) return response(limit.reason === 'limit_reached' ? 403 : 423,
        limit.reason === 'limit_reached' ? 'PERMISSION_DENIED' : 'CONFIGURATION_REQUIRED', requestId, undefined, origin);
      const ids=[...new Set(quote.items.map(item=>item.catalogItemId).filter((id):id is string=>Boolean(id)))];
      const catalog=new Map<string,{name:string;description:string|null;unit_price:number}>();
      if (ids.length) {
        const { data,error }=await admin.from('services').select('id,name,description,unit_price')
          .eq('workspace_id',membership.workspace_id).in('id',ids).is('archived_at',null);
        if (error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
        for (const row of data || []) catalog.set(row.id,row);
        if (catalog.size!==ids.length) return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      }
      const items=quote.items.map(item=>{
        const itemFromCatalog=item.catalogItemId ? catalog.get(item.catalogItemId) : null;
        return { id:item.id || crypto.randomUUID(),...(item.catalogItemId ? {catalogItemId:item.catalogItemId}:{}),
          name:itemFromCatalog?.name || item.name,description:item.description || itemFromCatalog?.description || '',
          quantity:item.quantity,unitPrice:itemFromCatalog ? Number(itemFromCatalog.unit_price) : item.unitPrice,discount:item.discount };
      });
      let money:ReturnType<typeof calculateQuoteMoney>;
      try { money=calculateQuoteMoney(items,quote.taxes); }
      catch { return response(400,'VALIDATION_FAILED',requestId,undefined,origin); }
      let customerId:string|null=quote.customerId || null;
      let customerPhone:string|null=null;
      if (customerId) {
        const { data,error }=await admin.from('clients').select('id,phone').eq('workspace_id',membership.workspace_id).eq('id',customerId).is('archived_at',null).maybeSingle();
        if (error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
        if (!data || data.phone!==quote.clientPhone) return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
        customerPhone=data.phone;
      } else {
        const { data,error }=await admin.from('clients').select('id,phone').eq('workspace_id',membership.workspace_id).eq('phone',quote.clientPhone).is('archived_at',null).limit(1).maybeSingle();
        if (error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
        customerId=data?.id || null;customerPhone=data?.phone || null;
      }
      if (quote.dealId) {
        const { data,error }=await admin.from('orkto_deals').select('id,customer_ref,status').eq('workspace_id',membership.workspace_id).eq('id',quote.dealId).neq('status','archived').maybeSingle();
        if (error) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
        if (!data || !quoteCustomerMatchesDeal(data.customer_ref,customerId,quote.clientPhone))
          return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      }
      const fields={ client_name:quote.clientName,client_phone:quote.clientPhone,client_email:quote.clientEmail || null,
        client_company:quote.clientCompany || null,client_vehicle_or_service:quote.clientVehicleOrService || null,
        customer_id:customerId,deal_id:quote.dealId || null,notes:quote.notes || null,items,...money,
        valid_value_days:quote.validValueDays,payment_instructions:quote.paymentInstructions || null };
      canonical={fields};
      argumentsForCommand={p_fields:fields,p_limit:plan.entitlements.limits?.active_proposals ?? null};
    }
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateError } = await admin.from('orkto_wia_events')
      .select('id', { count: 'exact', head: true }).eq('workspace_id', membership.workspace_id)
      .eq('actor_user_id', user.id).eq('event_type',eventType).gte('occurred_at', since);
    if (rateError) return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
    if ((count || 0) >= 30) return response(429, 'RATE_LIMITED', requestId, undefined, origin);

    const wiaDecision = command === 'APPROVE_WIA_ACTION' || command === 'REJECT_WIA_ACTION';
    const { data, error } = await admin.rpc(functionName, {
      p_actor_user_id: user.id,
      p_workspace_id: membership.workspace_id,
      p_request_id: requestId,
      ...(wiaDecision ? {} : { p_idempotency_key: idempotencyKey,p_fingerprint: await fingerprint(canonical) }),
      ...argumentsForCommand,
    });
    if (error) {
      const known: Record<string,[number,string]> = {
        ORKTO_WORKSPACE_ACCESS_DENIED: [403,'WORKSPACE_ACCESS_DENIED'],
        ORKTO_PERMISSION_DENIED: [403,'PERMISSION_DENIED'],
        ORKTO_NOT_FOUND: [404,'NOT_FOUND'],
        ORKTO_CONFLICT: [409,'CONFLICT'],
        ORKTO_VALIDATION_FAILED: [400,'VALIDATION_FAILED'],
        ORKTO_IDEMPOTENCY_CONFLICT: [409,'IDEMPOTENCY_CONFLICT'],
        ORKTO_CONFIGURATION_REQUIRED: [423,'CONFIGURATION_REQUIRED'],
      };
      const mapped = known[error.message];
      return response(mapped?.[0] || 503, mapped?.[1] || 'INTERNAL_ERROR', requestId, undefined, origin);
    }
    return response((command === 'CREATE_CLIENT' || command === 'CREATE_CATALOG_ITEM' || command === 'CREATE_DEAL' || command === 'CREATE_QUOTE') && data?.result !== 'REPLAY' ? 201 : 200, 'OK', requestId, data, origin);
  } catch {
    return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
  }
});
