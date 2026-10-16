import { routeT0Request } from './wia-t0.ts';
import { executeTrustedT0, t0Agent } from './wia-trusted.ts';
import { geminiTestConfiguration, prepareTrustedGemini, TrustedModelError } from './wia-gemini.ts';

export class WiaRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

/** Called only after JWT, pilot, membership, role, plan and feature checks. */
export async function prepareTrustedRequest(db: any, input: {
  workspaceId:string; actorId:string; requestId:string; traceId:string;
  message:string; monthlyLimit:number|null; fingerprint:string;
}, env: {get(name:string):string|undefined}, send:typeof fetch=fetch) {
  const route=routeT0Request(input.message);
  const configuration=route?null:geminiTestConfiguration(env,input.workspaceId);
  if(!route&&!configuration)throw new WiaRequestError(423,'CONFIGURATION_REQUIRED');
  const agent=route?t0Agent(route.name):'sales_agent';
  const common={p_actor_user_id:input.actorId,p_workspace_id:input.workspaceId,p_trace_id:input.traceId,
    p_agent:agent,p_request_id:input.requestId};
  const {count,error:rateError}=await db.from('orkto_wia_events').select('id',{count:'exact',head:true})
    .eq('workspace_id',input.workspaceId).eq('actor_user_id',input.actorId)
    .eq('event_type','wia.run.started').gte('occurred_at',new Date(Date.now()-60_000).toISOString());
  if(rateError)throw new WiaRequestError(503,'INTERNAL_ERROR');
  if((count||0)>=30)throw new WiaRequestError(429,'RATE_LIMITED');
  const {data:started,error:startError}=await db.rpc('orkto_wia_claim_request',{
    ...common,p_monthly_limit:input.monthlyLimit,p_fingerprint:input.fingerprint,
  });
  if(startError) {
    if(startError.message==='ORKTO_RATE_LIMITED')throw new WiaRequestError(429,'RATE_LIMITED');
    if(startError.message==='ORKTO_IDEMPOTENCY_CONFLICT')throw new WiaRequestError(409,'IDEMPOTENCY_CONFLICT');
    throw new WiaRequestError(503,'INTERNAL_ERROR');
  }
  if(!started?.wia_run_id)throw new WiaRequestError(503,'INTERNAL_ERROR');
  const base={traceId:input.traceId,runId:input.traceId,serviceRunId:started.wia_run_id,agent};
  if(started.result==='REPLAY') {
    if(started.status!=='succeeded'||!started.runtime_response)throw new WiaRequestError(409,'CONFLICT');
    const saved=started.runtime_response;
    return {...base,result:'REPLAY',replayed:true,path:saved.path,mode:saved.mode,
      decision:saved.decision,usage:saved.usage,toolExecutions:saved.toolExecutions};
  }
  if(started.result!=='STARTED')throw new WiaRequestError(503,'INTERNAL_ERROR');
  let payload;
  try {
    if(route) {
      const prepared=await executeTrustedT0(db,input.workspaceId,route);
      payload={contextRefs:prepared.sourceIds,path:'t0',mode:'live',decision:prepared.decision,
        toolExecutions:prepared.toolExecutions,usage:{provider:'none',modelFamily:'deterministic',gateway:'supabase-edge',
          model:'t0-deterministic',requestedModel:'t0-deterministic',selectedModel:'t0-deterministic',actualModel:'t0-deterministic',
          taskType:'fast',fallbackUsed:false,promptTokens:0,cachedInputTokens:0,completionTokens:0,totalTokens:0,
          latencyMs:prepared.durationMs,status:'succeeded'}};
    } else {
      // Send aggregate counts, never full contacts, proposal details, or private chat histories.
      const [quotes,clients]=await Promise.all([
        db.from('quotes').select('id').eq('workspace_id',input.workspaceId).is('archived_at',null)
          .in('status',['pending','sent','viewed']).limit(51),
        db.from('clients').select('id',{count:'exact',head:true}).eq('workspace_id',input.workspaceId).is('archived_at',null),
      ]);
      if(quotes.error||clients.error||!Number.isInteger(clients.count))throw new Error('query_failed');
      const rows=(quotes.data||[]).slice(0,50);
      const prepared=await prepareTrustedGemini({...configuration!,message:input.message,
        context:{openQuotes:rows.length,clients:clients.count,truncated:(quotes.data||[]).length>50},
        sourceIds:[]},send);
      payload={contextRefs:prepared.sourceIds,path:'model',mode:'live',decision:prepared.decision,
        usage:prepared.usage,toolExecutions:prepared.toolExecutions};
    }
  } catch(error) {
    const category=error instanceof TrustedModelError?error.category:'trusted_context_query_failed';
    const failed=await db.rpc('orkto_wia_finish_request',{...common,p_status:'failed',p_payload:{errorCategory:category}});
    if(failed.error)throw new WiaRequestError(503,'INTERNAL_ERROR');
    throw new WiaRequestError(503,'MODEL_UNAVAILABLE');
  }
  const {data:completed,error:completeError}=await db.rpc('orkto_wia_finish_request',{
    ...common,p_status:'succeeded',p_payload:payload,
  });
  // A failed/ambiguous commit must never be rendered as success or trigger a model retry here.
  if(completeError||!completed?.wia_run_id)throw new WiaRequestError(503,'INTERNAL_ERROR');
  return {...base,result:completed.result,path:payload.path,mode:payload.mode,decision:payload.decision,
    usage:payload.usage,toolExecutions:payload.toolExecutions,replayed:false};
}
