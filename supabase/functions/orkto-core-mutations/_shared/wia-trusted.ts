import { messageForTool, type T0Route } from './wia-t0.ts';

type QueryResult = { data: any; error: { message: string } | null };
function requireData(result: QueryResult) {
  if (result.error) throw new Error('WIA_QUERY_FAILED');
  return result.data;
}

function phoneCandidates(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  const area = local.length >= 10 ? local.slice(0, 2) : '';
  const subscriber = area ? local.slice(2) : local;
  const formatted = area ? `(${area}) ${subscriber.length === 9 ? `${subscriber.slice(0, 5)}-${subscriber.slice(5)}` : `${subscriber.slice(0, 4)}-${subscriber.slice(4)}`}` : '';
  return [...new Set([digits, `+${digits}`, local, formatted, formatted ? `+55 ${formatted}` : ''].filter(Boolean))];
}

export function t0Agent(name: string) {
  if (name === 'get_pending_approvals') return 'reporting_agent';
  if (name === 'get_customer' || name === 'get_customer_operational_context') return 'customer_success_agent';
  return 'sales_agent';
}

export async function executeTrustedT0(db: any, workspaceId: string, route: T0Route) {
  const began = Date.now();
  let output: Record<string,unknown>;
  if (route.clarification) {
    return { decision:{ action:'ask_clarification',messageDraft:route.clarification,sourceIds:[],confidenceSignal:'high',requiresApproval:false,
      reasonCode:'t0_customer_identifier_required' }, sourceIds:[],durationMs:0,toolExecutions:[] };
  }
  if (route.name === 'get_sales_today') {
    const start = new Date().toISOString().slice(0,10) + 'T00:00:00.000Z';
    const end = new Date(Date.parse(start) + 86_400_000).toISOString();
    const rows = requireData(await db.from('quotes').select('id,total').eq('workspace_id',workspaceId)
      .eq('status','approved').gte('approved_at',start).lt('approved_at',end).limit(100)) || [];
    output = { salesCount:rows.length,total:rows.reduce((sum:number,row:any)=>sum+Number(row.total||0),0),sourceIds:rows.map((row:any)=>`quote:${row.id}`) };
  } else if (route.name === 'get_open_quotes') {
    const rows = requireData(await db.from('quotes').select('id,total').eq('workspace_id',workspaceId)
      .in('status',['pending','sent','viewed']).order('updated_at',{ascending:false}).limit(50)) || [];
    output = { count:rows.length,total:rows.reduce((sum:number,row:any)=>sum+Number(row.total||0),0),sourceIds:rows.map((row:any)=>`quote:${row.id}`) };
  } else if (route.name === 'get_pending_approvals') {
    const rows = requireData(await db.from('orkto_approval_tasks').select('id').eq('workspace_id',workspaceId)
      .eq('status','pending').limit(50)) || [];
    output = { count:rows.length,sourceIds:rows.map((row:any)=>`approval:${row.id}`) };
  } else if (route.name === 'get_customer' || route.name === 'get_customer_operational_context') {
    const id = typeof route.input.customerId === 'string' ? route.input.customerId : null;
    const phone = typeof route.input.phone === 'string' ? route.input.phone : null;
    if (!id && !phone) throw new Error('WIA_IDENTIFIER_REQUIRED');
    let query = db.from('clients').select('id,name,phone,company,quote_count').eq('workspace_id',workspaceId).is('archived_at',null);
    query = id ? query.eq('id',id) : query.in('phone',phoneCandidates(phone!));
    const customers = requireData(await query.limit(2)) || [];
    if (customers.length > 1) {
      return { decision:{action:'ask_clarification',messageDraft:'Há mais de um cliente com esse telefone. Use o ID do cliente.',
        sourceIds:[],confidenceSignal:'low',requiresApproval:false,reasonCode:'t0_customer_ambiguous'},sourceIds:[],durationMs:Date.now()-began,toolExecutions:[] };
    }
    const customer = customers[0] || null;
    if (route.name === 'get_customer') output = {customer,sourceIds:customer?[`customer:${customer.id}`]:[]};
    else if (!customer) output = {context:null,sourceIds:[]};
    else {
      const refs=[customer.id,customer.phone].filter(Boolean);
      const [riskResult,memoryResult] = await Promise.all([
        db.from('orkto_risk_assessments').select('id,score,confidence,reasons,recommended_action')
          .eq('workspace_id',workspaceId).in('customer_ref',refs).order('assessed_at',{ascending:false}).limit(1).maybeSingle(),
        db.from('orkto_wia_memories').select('id,memory_type,content').eq('workspace_id',workspaceId)
          .in('entity_ref',refs).eq('entity_type','customer').eq('status','active')
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at',{ascending:false}).limit(3),
      ]);
      const risk=requireData(riskResult);
      const memories=requireData(memoryResult)||[];
      output={context:{customer,risk,memories},sourceIds:[`customer:${customer.id}`,
        ...(risk?[`risk:${risk.id}`]:[]),...memories.map((row:any)=>`memory:${row.id}`)]};
    }
  } else throw new Error('WIA_ROUTE_UNSUPPORTED');
  const sourceIds = output.sourceIds as string[];
  const durationMs = Date.now()-began;
  return { decision:{ action:'answer',messageDraft:messageForTool(route.name,output),sourceIds,confidenceSignal:'high',
    requiresApproval:false,reasonCode:`t0_${route.name}` }, sourceIds,durationMs,
    toolExecutions:[{toolName:route.name,status:'succeeded',sourceIds,durationMs}] };
}
