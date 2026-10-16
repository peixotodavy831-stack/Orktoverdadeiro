import { createClient } from '@supabase/supabase-js';
import { verifyPilotSession } from './_shared/pilot-access.ts';
import { clientInput } from './_shared/client-input.ts';
import { contactInput, contactPatchInput } from './_shared/contact-input.ts';
import { serviceInput } from './_shared/service-input.ts';
import { dealInput, dealPatchInput } from './_shared/deal-input.ts';
import { quoteCreateInput, quotePatchInput, calculateQuoteMoney, quoteCustomerMatchesDeal } from './_shared/quote-input.ts';
import { onboardingInput, personalProfileInput } from './_shared/profile-input.ts';
import { checkPlanLimit, hasPlanFeature, loadWorkspacePlanAccess } from './_shared/plan-access.ts';
import { routeT0Request } from './_shared/wia-t0.ts';
import { executeTrustedT0, t0Agent } from './_shared/wia-trusted.ts';
import { prepareTrustedRequest, WiaRequestError } from './_shared/wia-request.ts';
import { geminiTestConfiguration } from './_shared/wia-gemini.ts';
import { completeMetaEmbeddedSignup, MetaConnectionError, metaRuntimeConfig } from './_shared/meta-connection.ts';
import { MetaSendError, sendMetaText } from './_shared/meta-send.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const MAX_BODY_BYTES = 16_384;

function exactKeys(value: Record<string,unknown>, allowed: string[]) {
  return Object.keys(value).every(key => allowed.includes(key));
}


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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function traceUuid(value: string) {
  const hex = (await sha256Hex(value)).slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  const compact = hex.join('');
  return `${compact.slice(0,8)}-${compact.slice(8,12)}-${compact.slice(12,16)}-${compact.slice(16,20)}-${compact.slice(20)}`;
}

async function deterministicPublicToken(secret: string, workspaceId: string, quoteId: string, idempotencyKey: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`live-quote:${workspaceId}:${quoteId}:${idempotencyKey}`));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
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
    if (command === 'READ_PLAN_CATALOG' || command === 'READ_BILLING_CURRENT' || command === 'READ_WIA_RUNTIME'
        || command === 'READ_WHATSAPP_CONNECTION' || command === 'BEGIN_WHATSAPP_CONNECTION') {
      if (!suppliedPayload || typeof suppliedPayload !== 'object' || Array.isArray(suppliedPayload)
          || Object.keys(suppliedPayload).length !== 0) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      canonical = {};
      functionName = '';
      eventType = '';
      argumentsForCommand = {};
    } else if (command === 'COMPLETE_WHATSAPP_CONNECTION') {
      const holder=suppliedPayload as Record<string,unknown>|null;
      const allowed=['code','businessId','wabaId','phoneNumberId','coexistenceState'];
      const states=['unknown','eligible','enabled','ineligible','not_requested'];
      if(!holder||typeof holder!=='object'||Array.isArray(holder)||!exactKeys(holder,allowed)
        ||typeof holder.code!=='string'||holder.code.length<1||holder.code.length>4096
        ||!(holder.businessId===null||typeof holder.businessId==='string')
        ||typeof holder.wabaId!=='string'||typeof holder.phoneNumberId!=='string'
        ||typeof holder.coexistenceState!=='string'||!states.includes(holder.coexistenceState))
        return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      canonical={code:holder.code,businessId:holder.businessId,wabaId:holder.wabaId,
        phoneNumberId:holder.phoneNumberId,coexistenceState:holder.coexistenceState};
      functionName='';eventType='channel.meta.connected';argumentsForCommand={};
    } else if (command === 'SET_WHATSAPP_MODE') {
      const holder=suppliedPayload as Record<string,unknown>|null;
      if(!holder||typeof holder!=='object'||Array.isArray(holder)||!exactKeys(holder,['mode','humanTakeover'])
        ||typeof holder.mode!=='string'||!['manual','assisted','controlled'].includes(holder.mode)
        ||typeof holder.humanTakeover!=='boolean')
        return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      canonical={mode:holder.mode,humanTakeover:holder.humanTakeover};
      functionName='';eventType='channel.meta.mode_changed';argumentsForCommand={};
    } else if (command === 'SEND_WHATSAPP_MESSAGE') {
      const holder=suppliedPayload as Record<string,unknown>|null;
      if(!holder||typeof holder!=='object'||Array.isArray(holder)||!exactKeys(holder,['conversationId','content'])
        ||typeof holder.conversationId!=='string'||!UUID.test(holder.conversationId)
        ||typeof holder.content!=='string'||holder.content.trim().length<1||holder.content.length>4000)
        return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      canonical={conversationId:holder.conversationId,content:holder.content.trim()};
      functionName='';eventType='channel.send.requested';argumentsForCommand={};
    } else if (command === 'UPDATE_SELF_PROFILE') {
      const parsed = personalProfileInput.safeParse(suppliedPayload);
      if (!parsed.success) return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      canonical = parsed.data;
      functionName = 'orkto_update_self_profile_command';
      eventType = 'profile.personal_updated';
      argumentsForCommand = { p_display_name: parsed.data.displayName };
    } else if (command === 'COMPLETE_ONBOARDING') {
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
    } else if (command === 'CREATE_CONTACT' || command === 'UPDATE_CONTACT') {
      const holder = suppliedPayload as { contactId?: unknown; changes?: unknown } | null;
      const parsed = command === 'CREATE_CONTACT'
        ? contactInput.safeParse(suppliedPayload)
        : contactPatchInput.safeParse(holder?.changes);
      if (!parsed.success || (command === 'UPDATE_CONTACT' &&
          (!holder || typeof holder !== 'object' || Array.isArray(holder)
           || !exactKeys(holder as Record<string,unknown>,['contactId','changes'])
           || typeof holder.contactId !== 'string' || !UUID.test(holder.contactId)))) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      const names: Record<string,string> = {
        fullName:'full_name', customerId:'customer_id', phone:'phone', email:'email',
        company:'company', role:'role',
      };
      const fields = Object.fromEntries(Object.entries(parsed.data).map(([key,value]) => [names[key],value]));
      canonical = { command, contactId:command === 'UPDATE_CONTACT' ? holder?.contactId : null, fields };
      functionName = 'orkto_contact_command';
      eventType = command === 'CREATE_CONTACT' ? 'contact.created' : 'contact.updated';
      argumentsForCommand = { p_command:command,p_contact_id:command === 'UPDATE_CONTACT' ? holder?.contactId : null,p_fields:fields };
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
    } else if (command === 'APPROVE_DRAFT_TASK' || command === 'REJECT_DRAFT_TASK') {
      const holder = suppliedPayload as { taskId?: unknown; reason?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || !exactKeys(holder as Record<string,unknown>, ['taskId','reason'])
          || typeof holder.taskId !== 'string' || !UUID.test(holder.taskId)
          || (holder.reason !== undefined && (typeof holder.reason !== 'string' || holder.reason.length > 1000))) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { taskId:holder.taskId,decision:command,reason:(holder.reason || '').trim() };
      functionName = 'orkto_decide_approval_task_command';
      eventType = command === 'APPROVE_DRAFT_TASK' ? 'approval.approved' : 'approval.rejected';
      argumentsForCommand = { p_task_id:holder.taskId,
        p_decision:command === 'APPROVE_DRAFT_TASK' ? 'APPROVE' : 'REJECT',p_reason:canonical.reason };
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
    } else if (command === 'PUBLISH_LIVE_QUOTE') {
      const holder = suppliedPayload as { quoteId?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || Object.keys(holder).some(key => key !== 'quoteId')
          || typeof holder.quoteId !== 'string' || !UUID.test(holder.quoteId)) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { quoteId:holder.quoteId };
      functionName = 'orkto_publish_live_quote_command';
      eventType = 'live_quote.published';
      argumentsForCommand = { p_quote_id:holder.quoteId };
    } else if (command === 'EXTEND_QUOTE_RETENTION') {
      const holder = suppliedPayload as { quoteId?: unknown; expectedExpiry?: unknown } | null;
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)
          || !exactKeys(holder as Record<string,unknown>, ['quoteId','expectedExpiry'])
          || typeof holder.quoteId !== 'string' || !UUID.test(holder.quoteId)
          || typeof holder.expectedExpiry !== 'string'
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(holder.expectedExpiry)
          || Number.isNaN(Date.parse(holder.expectedExpiry))) {
        return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
      }
      canonical = { quoteId:holder.quoteId,expectedExpiry:new Date(holder.expectedExpiry).toISOString() };
      functionName = 'orkto_extend_quote_retention_command';
      eventType = 'quote.retention_extended';
      argumentsForCommand = { p_quote_id:holder.quoteId,p_expected_expiry:canonical.expectedExpiry };
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
    } else if (command === 'PREPARE_WIA_T0' || command === 'PREPARE_WIA_REQUEST') {
      const holder=suppliedPayload as {message?:unknown}|null;
      if(!holder||typeof holder!=='object'||Array.isArray(holder)
        ||!exactKeys(holder as Record<string,unknown>,['message'])
        ||typeof holder.message!=='string'||holder.message.trim().length<1||holder.message.length>4000)
        return response(400,'VALIDATION_FAILED',requestId,undefined,origin);
      canonical={message:holder.message.trim()};
      functionName='';eventType='wia.run.started';argumentsForCommand={};
    } else {
      return response(400, 'VALIDATION_FAILED', requestId, undefined, origin);
    }

    const userClient = createClient(url, publicKey, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(bearer.slice(7));
    if (authError || !user) return response(401, 'AUTH_REQUIRED', requestId, undefined, origin);
    const pilotAccess = await verifyPilotSession(userClient);
    if (pilotAccess !== 'allowed') return response(pilotAccess === 'unavailable' ? 503 : 403,
      pilotAccess === 'unavailable' ? 'INTERNAL_ERROR' : 'PERMISSION_DENIED', requestId, undefined, origin);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: membership, error: membershipError } = await admin.from('orkto_workspace_members')
      .select('workspace_id,role,status').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (membershipError) return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
    if (!membership || membership.status !== 'active') return response(403, 'WORKSPACE_ACCESS_DENIED', requestId, undefined, origin);
    if (!['owner','admin','manager','member'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'READ_WHATSAPP_CONNECTION') {
      const [connectionResult,controlsResult]=await Promise.all([
        admin.from('orkto_channel_connections')
          .select('id,status,business_id,waba_id,phone_number_id,display_phone_number,verified_name,coexistence_state,service_mode,granted_scopes,verified_at,webhook_subscribed_at,last_error_category,updated_at')
          .eq('workspace_id',membership.workspace_id).eq('provider','meta_whatsapp_cloud').maybeSingle(),
        admin.from('orkto_whatsapp_controls')
          .select('monthly_message_limit,monthly_cost_limit_micros,currency,block_on_unpriced,block_on_cost_limit,allow_marketing,human_takeover,updated_at')
          .eq('workspace_id',membership.workspace_id).maybeSingle(),
      ]);
      if(connectionResult.error||controlsResult.error)return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      const runtime=metaRuntimeConfig(Deno.env);
      return response(200,'OK',requestId,{result:'READ',whatsapp:{
        state:connectionResult.data?.status||(runtime?'ready_to_connect':'configuration_required'),
        connected:connectionResult.data?.status==='connected',runtimeConfigured:runtime!==null,
        connection:connectionResult.data||null,controls:controlsResult.data||null,
      }},origin);
    }
    if (command === 'BEGIN_WHATSAPP_CONNECTION') {
      if(!['owner','admin'].includes(membership.role))return response(403,'PERMISSION_DENIED',requestId,undefined,origin);
      const config=metaRuntimeConfig(Deno.env);
      if(!config)return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      return response(200,'OK',requestId,{result:'READY',whatsapp:{appId:config.appId,configId:config.configId,
        graphVersion:config.graphVersion,redirectUri:config.redirectUri}},origin);
    }
    if (command === 'READ_WIA_RUNTIME') {
      const configured=geminiTestConfiguration(Deno.env,membership.workspace_id)!==null;
      return response(200,'OK',requestId,{result:'READ',wia:{provider:'gemini',model:'gemini-3.8-flash',
        state:configured?'configured_not_verified':'configuration_required',testingOnly:true}},origin);
    }
    if (command === 'READ_PLAN_CATALOG') {
      const now = new Date().toISOString();
      const { data: versions, error: catalogError } = await admin.from('orkto_plan_price_versions')
        .select('plan_key,price_cents,currency,price_is_public,entitlements,version,effective_from')
        .eq('status','approved').lte('effective_from',now)
        .or(`effective_until.is.null,effective_until.gt.${now}`)
        .order('effective_from',{ascending:false}).limit(100);
      if (catalogError) return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
      const latest = new Map<string,Record<string,unknown>>();
      const allowedPlans = new Set(['starter','pro','business','scale','enterprise','founders','legacy_standard']);
      for (const version of versions || []) {
        if (allowedPlans.has(version.plan_key) && !latest.has(version.plan_key)) latest.set(version.plan_key, version);
      }
      const catalog = [...latest.values()].map(version => ({
        plan_key:version.plan_key, currency:version.currency, version:version.version,
        entitlements:version.entitlements, price_is_public:version.price_is_public === true,
        price_cents:version.price_is_public === true && typeof version.price_cents === 'number'
          ? version.price_cents : null,
      }));
      return response(200, 'OK', requestId, { result:'READ', catalog }, origin);
    }
    if (command === 'READ_BILLING_CURRENT') {
      const access=await loadWorkspacePlanAccess(admin,membership.workspace_id);
      const {data:usage,error:usageError}=await admin.from('orkto_plan_usage')
        .select('feature_key,quantity,period_start').eq('workspace_id',membership.workspace_id)
        .order('period_start',{ascending:false}).limit(100);
      if(usageError)return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      const subscription=access.subscription;
      return response(200,'OK',requestId,{result:'READ',billing:{
        subscription:subscription?{plan_key:subscription.plan_key,status:subscription.status,trial_ends_at:subscription.trial_ends_at,current_period_start:subscription.current_period_start,current_period_end:subscription.current_period_end,cancel_at_period_end:subscription.cancel_at_period_end}:null,
        workspacePlan:access.planKey,status:access.status,trialEndsAt:access.trialEndsAt,
        readOnly:access.readOnly,configurationRequired:access.configurationRequired,
        entitlements:access.entitlements,effectivePriceVersion:access.effectivePriceVersion,
        usage:usage||[],checkout:'not_configured',pricesPublic:access.publicPriceApproved,
      }},origin);
    }
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
    if ((command === 'APPROVE_DRAFT_TASK' || command === 'REJECT_DRAFT_TASK') && !['owner','admin','manager'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if ((command === 'COMPLETE_WHATSAPP_CONNECTION' || command === 'SET_WHATSAPP_MODE')
        && !['owner','admin'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'SET_CONVERSATION_STATUS' && canonical.status === 'archived'
        && !['owner','admin'].includes(membership.role)) return response(403, 'PERMISSION_DENIED', requestId, undefined, origin);

    const plan = await loadWorkspacePlanAccess(admin, membership.workspace_id);
    // A personal display name is independent of the workspace's commercial entitlement.
    // All business commands keep the existing read-only/configuration guard.
    if ((plan.configurationRequired || plan.readOnly) && command !== 'UPDATE_SELF_PROFILE') return response(423, 'PERMISSION_DENIED', requestId, undefined, origin);
    if (command === 'COMPLETE_WHATSAPP_CONNECTION') {
      try {
        const completed=await completeMetaEmbeddedSignup(canonical as {
          code:string;businessId:string|null;wabaId:string;phoneNumberId:string;
          coexistenceState:'unknown'|'eligible'|'enabled'|'ineligible'|'not_requested';
        },Deno.env);
        const {data:connectionId,error:storeError}=await admin.rpc('orkto_store_meta_connection',{
          p_workspace_id:membership.workspace_id,p_actor_user_id:user.id,p_business_id:completed.businessId,
          p_waba_id:completed.wabaId,p_phone_number_id:completed.phoneNumberId,
          p_display_phone_number:completed.displayPhoneNumber,p_verified_name:completed.verifiedName,
          p_coexistence_state:completed.coexistenceState,p_granted_scopes:completed.grantedScopes,
          p_access_token:completed.accessToken,p_provider_metadata:completed.metadata,
        });
        if(storeError||typeof connectionId!=='string')return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
        return response(200,'OK',requestId,{result:'CONNECTED',connectionId},origin);
      } catch(error) {
        if(error instanceof MetaConnectionError)return response(error.code==='CONFIGURATION_REQUIRED'?423:502,error.code,requestId,undefined,origin);
        return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      }
    }
    if (command === 'SET_WHATSAPP_MODE') {
      const {data:changed,error:modeError}=await admin.rpc('orkto_set_whatsapp_mode',{
        p_workspace_id:membership.workspace_id,p_actor_user_id:user.id,p_mode:canonical.mode,
        p_human_takeover:canonical.humanTakeover,
      });
      if(modeError)return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if(changed!==true)return response(404,'NOT_FOUND',requestId,undefined,origin);
      return response(200,'OK',requestId,{result:'UPDATED'},origin);
    }
    if (command === 'SEND_WHATSAPP_MESSAGE') {
      const now=new Date();const nowIso=now.toISOString();
      const {data:conversation,error:conversationError}=await admin.from('orkto_conversations')
        .select('id,source_channel,contact_phone').eq('workspace_id',membership.workspace_id)
        .eq('id',canonical.conversationId).maybeSingle();
      if(conversationError)return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if(!conversation)return response(404,'NOT_FOUND',requestId,undefined,origin);
      if(conversation.source_channel!=='whatsapp')return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const recipient=String(conversation.contact_phone||'').replace(/\D/g,'');
      if(!/^\d{5,30}$/.test(recipient))return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const [connectionResult,controlsResult,lastInboundResult]=await Promise.all([
        admin.from('orkto_channel_connections').select('id,phone_number_id,status,service_mode')
          .eq('workspace_id',membership.workspace_id).eq('provider','meta_whatsapp_cloud').maybeSingle(),
        admin.from('orkto_whatsapp_controls').select('monthly_message_limit,monthly_cost_limit_micros,pricing_market,currency,block_on_unpriced,block_on_cost_limit,human_takeover')
          .eq('workspace_id',membership.workspace_id).maybeSingle(),
        admin.from('orkto_messages').select('sent_at').eq('workspace_id',membership.workspace_id)
          .eq('conversation_id',canonical.conversationId).eq('direction','incoming')
          .order('sent_at',{ascending:false}).limit(1).maybeSingle(),
      ]);
      if(connectionResult.error||controlsResult.error||lastInboundResult.error)
        return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      const connection=connectionResult.data,controls=controlsResult.data;
      if(!connection||connection.status!=='connected'||!controls)
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const lastInbound=Date.parse(lastInboundResult.data?.sent_at||'');
      if(!Number.isFinite(lastInbound)||now.getTime()-lastInbound>24*60*60*1000)
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      if(typeof controls.pricing_market!=='string'||!/^[A-Z]{2}$/.test(controls.pricing_market))
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const {data:cards,error:cardError}=await admin.from('orkto_whatsapp_rate_cards')
        .select('id,unit_price_micros,free_messages,currency').eq('provider','meta_whatsapp_cloud')
        .eq('status','approved').eq('market',controls.pricing_market).eq('category','service')
        .eq('currency',controls.currency).lte('effective_from',nowIso)
        .or(`effective_until.is.null,effective_until.gt.${nowIso}`).limit(2);
      if(cardError)return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if((cards||[]).length!==1){
        if(controls.block_on_unpriced!==false)return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      }
      const card=cards![0];const unitPrice=Number(card.unit_price_micros);const freeMessages=Number(card.free_messages);
      if(!Number.isSafeInteger(unitPrice)||unitPrice<0||!Number.isSafeInteger(freeMessages)||freeMessages<0)
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const requestFingerprint=await sha256Hex(JSON.stringify({workspaceId:membership.workspace_id,
        conversationId:canonical.conversationId,channel:'whatsapp',content:canonical.content}));
      const {data:reserved,error:reserveError}=await admin.rpc('orkto_reserve_meta_send',{
        p_workspace_id:membership.workspace_id,p_conversation_id:canonical.conversationId,
        p_idempotency_key:idempotencyKey,p_request_fingerprint:requestFingerprint,p_rate_card_id:card.id,
      });
      const reservation=Array.isArray(reserved)?reserved[0]:reserved;
      if(reserveError||!reservation)return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if(reservation.decision==='IDEMPOTENCY_CONFLICT')return response(409,'IDEMPOTENCY_CONFLICT',requestId,undefined,origin);
      if(reservation.decision==='IN_PROGRESS')return response(409,'CONFLICT',requestId,undefined,origin);
      if(reservation.decision==='RECONCILIATION_REQUIRED')return response(503,'PROVIDER_UNAVAILABLE',requestId,undefined,origin);
      if(reservation.decision==='RATE_LIMITED')return response(429,'RATE_LIMITED',requestId,undefined,origin);
      if(reservation.decision==='CONFIGURATION_REQUIRED')return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      if(reservation.decision==='REPLAY'){
        if(['REQUEST_ACCEPTED','PROVIDER_ACKNOWLEDGED','DELIVERED'].includes(reservation.send_status)
          &&typeof reservation.provider_message_id==='string')
          return response(200,'OK',requestId,{result:'REPLAY',status:reservation.send_status,
            requestId:reservation.send_request_id,externalMessageId:reservation.provider_message_id},origin);
        return response(409,'CONFLICT',requestId,undefined,origin);
      }
      const {data:accessToken,error:tokenError}=await admin.rpc('orkto_read_meta_token',{p_connection_id:connection.id});
      const config=metaRuntimeConfig(Deno.env);
      if(tokenError||typeof accessToken!=='string'||!accessToken||!config){
        await admin.rpc('orkto_mark_channel_send',{p_workspace_id:membership.workspace_id,
          p_send_request_id:reservation.send_request_id,p_target_status:'FAILED',
          p_provider_message_id:null,p_failure_category:'configuration_required',p_occurred_at:nowIso});
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      }
      let accepted:{externalMessageId:string;acceptedAt:string};
      try{
        accepted=await sendMetaText({phoneNumberId:connection.phone_number_id,recipient,
          content:String(canonical.content),accessToken,graphVersion:config.graphVersion});
      }catch(error){
        const category=error instanceof MetaSendError?error.category:'outcome_unknown';
        await admin.rpc('orkto_mark_channel_send',{p_workspace_id:membership.workspace_id,
          p_send_request_id:reservation.send_request_id,p_target_status:category==='outcome_unknown'?'UNKNOWN':'FAILED',
          p_provider_message_id:null,p_failure_category:category,p_occurred_at:new Date().toISOString()});
        return response(category==='rate_limit'?429:category==='outcome_unknown'?503:502,
          category==='rate_limit'?'RATE_LIMITED':category==='outcome_unknown'?'PROVIDER_UNAVAILABLE':'PROVIDER_REJECTED',
          requestId,undefined,origin);
      }
      const {data:acceptedState,error:acceptError}=await admin.rpc('orkto_accept_meta_send',{
        p_workspace_id:membership.workspace_id,p_send_request_id:reservation.send_request_id,p_actor_user_id:user.id,
        p_provider_message_id:accepted.externalMessageId,p_content:canonical.content,p_occurred_at:accepted.acceptedAt,
      });
      if(acceptError||!['APPLIED','REPLAY'].includes(String(acceptedState))){
        await admin.rpc('orkto_mark_channel_send',{p_workspace_id:membership.workspace_id,
          p_send_request_id:reservation.send_request_id,p_target_status:'UNKNOWN',
          p_provider_message_id:accepted.externalMessageId,p_failure_category:'acceptance_not_persisted',
          p_occurred_at:accepted.acceptedAt}).catch(()=>undefined);
        return response(503,'PROVIDER_UNAVAILABLE',requestId,undefined,origin);
      }
      return response(202,'OK',requestId,{result:'ACCEPTED',status:'REQUEST_ACCEPTED',
        requestId:reservation.send_request_id,externalMessageId:accepted.externalMessageId,
        acceptedAt:accepted.acceptedAt},origin);
    }
    if (command === 'PREPARE_WIA_REQUEST') {
      if(!hasPlanFeature(plan,'wia'))return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const limit=plan.entitlements.limits?.monthly_wia_runs;
      if(limit===undefined||(limit!==null&&(!Number.isSafeInteger(limit)||limit<0)))
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      try {
        const result=await prepareTrustedRequest(admin,{
          workspaceId:membership.workspace_id,actorId:user.id,requestId,
          traceId:await traceUuid(`wia-request-v1:${membership.workspace_id}:${user.id}:${idempotencyKey}`),
          message:String(canonical.message),monthlyLimit:limit,fingerprint:await fingerprint(canonical),
        },Deno.env);
        return response(200,'OK',requestId,result,origin);
      } catch(error) {
        if(error instanceof WiaRequestError)return response(error.status,error.code,requestId,undefined,origin);
        return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      }
    }
    if (command === 'PREPARE_WIA_T0') {
      if (!hasPlanFeature(plan,'wia')) return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const limit=plan.entitlements.limits?.monthly_wia_runs;
      if (limit === undefined || (limit !== null && (!Number.isInteger(limit)||limit<0)))
        return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const route=routeT0Request(String(canonical.message));
      if (!route) return response(423,'CONFIGURATION_REQUIRED',requestId,undefined,origin);
      const agent=t0Agent(route.name);
      const traceId=await traceUuid(`${membership.workspace_id}:${user.id}:${idempotencyKey}`);
      const common={p_actor_user_id:user.id,p_workspace_id:membership.workspace_id,p_trace_id:traceId,
        p_agent:agent,p_request_id:requestId};
      const {count:recent,error:rateError}=await admin.from('orkto_wia_events')
        .select('id',{count:'exact',head:true}).eq('workspace_id',membership.workspace_id)
        .eq('actor_user_id',user.id).eq('event_type','wia.run.started')
        .gte('occurred_at',new Date(Date.now()-60_000).toISOString());
      if(rateError) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      if((recent||0)>=30) return response(429,'RATE_LIMITED',requestId,undefined,origin);
      const {data:started,error:startError}=await admin.rpc('orkto_wia_start_command',{
        ...common,p_monthly_limit:limit,
      });
      if(startError) return response(startError.message==='ORKTO_RATE_LIMITED'?429:503,
        startError.message==='ORKTO_RATE_LIMITED'?'RATE_LIMITED':'INTERNAL_ERROR',requestId,undefined,origin);
      const usage=(latencyMs:number)=>({provider:'none',modelFamily:'deterministic',gateway:'supabase-edge',
        model:'t0-deterministic',requestedModel:'t0-deterministic',selectedModel:'t0-deterministic',
        actualModel:'t0-deterministic',taskType:'fast',fallbackUsed:false,promptTokens:0,
        cachedInputTokens:0,completionTokens:0,totalTokens:0,latencyMs,status:'succeeded'});
      if(started?.result==='REPLAY' && started?.status==='succeeded') {
        const [runResult,eventResult]=await Promise.all([
          admin.from('orkto_wia_runs').select('id,summary,context_refs').eq('workspace_id',membership.workspace_id)
            .eq('id',started.wia_run_id).eq('user_id',user.id).maybeSingle(),
          admin.from('orkto_wia_events').select('payload').eq('workspace_id',membership.workspace_id)
            .eq('run_id',started.wia_run_id).eq('event_type','wia.decision.prepared').limit(1).maybeSingle(),
        ]);
        if(runResult.error||eventResult.error||!runResult.data||!eventResult.data)
          return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
        const sourceIds=Array.isArray(runResult.data.context_refs)?runResult.data.context_refs:[];
        return response(200,'OK',requestId,{result:'REPLAY',traceId,runId:traceId,
          serviceRunId:started.wia_run_id,agent,path:'t0',mode:'live',replayed:true,
          decision:{action:eventResult.data.payload?.action||'answer',messageDraft:runResult.data.summary,
            sourceIds,confidenceSignal:'high',requiresApproval:false,
            reasonCode:eventResult.data.payload?.reason_code||`t0_${route.name}`},usage:usage(0),toolExecutions:[]},origin);
      }
      if(started?.result==='REPLAY') return response(409,'CONFLICT',requestId,undefined,origin);
      let prepared;
      try { prepared=await executeTrustedT0(admin,membership.workspace_id,route); }
      catch {
        await admin.rpc('orkto_wia_complete_command',{...common,p_status:'failed',p_payload:{errorCategory:'t0_query_failed'}});
        return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      }
      const resultUsage=usage(prepared.durationMs);
      const {data:completed,error:completeError}=await admin.rpc('orkto_wia_complete_command',{
        ...common,p_status:'succeeded',p_payload:{contextRefs:prepared.sourceIds,path:'t0',mode:'live',
          decision:prepared.decision,usage:resultUsage,toolExecutions:prepared.toolExecutions},
      });
      if(completeError||!completed) return response(503,'INTERNAL_ERROR',requestId,undefined,origin);
      return response(200,'OK',requestId,{result:completed.result,traceId,runId:traceId,
        serviceRunId:completed.wia_run_id,agent,path:'t0',mode:'live',decision:prepared.decision,
        usage:resultUsage,toolExecutions:prepared.toolExecutions},origin);
    }
    if (command === 'CREATE_QUOTE' || command === 'UPDATE_QUOTE' || command === 'ARCHIVE_QUOTE'
        || command === 'PUBLISH_LIVE_QUOTE' || command === 'EXTEND_QUOTE_RETENTION') {
      if (!hasPlanFeature(plan,'proposals')) return response(423, 'CONFIGURATION_REQUIRED', requestId, undefined, origin);
    }
    let publicToken: string | null = null;
    if (command === 'PUBLISH_LIVE_QUOTE') {
      publicToken = await deterministicPublicToken(serviceKey,membership.workspace_id,String(canonical.quoteId),idempotencyKey);
      argumentsForCommand={...argumentsForCommand,p_public_token_hash:await sha256Hex(publicToken)};
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
        ORKTO_RATE_LIMITED: [429,'RATE_LIMITED'],
      };
      const mapped = known[error.message];
      return response(mapped?.[0] || 503, mapped?.[1] || 'INTERNAL_ERROR', requestId, undefined, origin);
    }
    const resultData = publicToken && data ? { ...data, token:publicToken, publicPath:`/proposta-viva/${publicToken}` } : data;
    return response((command === 'CREATE_CLIENT' || command === 'CREATE_CONTACT' || command === 'CREATE_CATALOG_ITEM' || command === 'CREATE_DEAL' || command === 'CREATE_QUOTE' || command === 'PUBLISH_LIVE_QUOTE') && data?.result !== 'REPLAY' ? 201 : 200, 'OK', requestId, resultData, origin);
  } catch {
    return response(503, 'INTERNAL_ERROR', requestId, undefined, origin);
  }
});
