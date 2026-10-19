import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiTestConfiguration,guardGeminiDecision,prepareTrustedGemini,TrustedModelError} from '../supabase/functions/orkto-core-mutations/_shared/wia-gemini.ts';
import {prepareTrustedRequest,WiaRequestError} from '../supabase/functions/orkto-core-mutations/_shared/wia-request.ts';

const workspace='96000000-0000-4000-8000-000000000001';
const actor='96000000-0000-4000-8000-000000000002';
const values={SUPABASE_URL:'https://ghrjongiodziasupakrk.supabase.co',WIA_STAGING_GEMINI_TESTS:'ON',WIA_GEMINI_TEST_WORKSPACES:workspace,GEMINI_API_KEY:'fixture-only-key'};
const env={get:(key:string)=>values[key]};
const decision={action:'answer',messageDraft:'Podemos organizar o atendimento.',sourceIds:['foreign:injected'],confidenceSignal:'medium',requiresApproval:false,reasonCode:'operational_help'};
const input={apiKey:'fixture-only-key',model:'gemini-3.8-flash',message:'Como organizar meu dia?',context:{openQuotes:2,clients:3,truncated:false},sourceIds:[]};
const result=()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(decision)}]}}],usageMetadata:{promptTokenCount:30,candidatesTokenCount:20,totalTokenCount:55},modelVersion:'gemini-3.8-flash'});
const noSend=async()=>{throw new Error('Provider must not be called');};

test('Gemini Edge requires staging identity, explicit flag, workspace and secret',()=>{
  assert.equal(geminiTestConfiguration(env,workspace)?.model,'gemini-3.8-flash');
  for(const override of [{SUPABASE_URL:'https://qneqljlphgkptebsaonb.supabase.co'},{WIA_STAGING_GEMINI_TESTS:'OFF'},{WIA_GEMINI_TEST_WORKSPACES:'other'},{GEMINI_API_KEY:''}]) {
    const config={...values,...override};assert.equal(geminiTestConfiguration({get:key=>config[key]},workspace),null);
  }
});
test('Gemini output is an approval draft and cannot cite foreign sources',()=>{
  const guarded=guardGeminiDecision(input.message,decision,[]);
  assert.equal(guarded.action,'create_draft');assert.equal(guarded.requiresApproval,true);
  assert.deepEqual(guarded.sourceIds,[]);assert.match(guarded.messageDraft,/nenhuma ação foi executada/);
});
test('commercial terms require verified commercial sources; optout/handoff remain pending',()=>{
  assert.equal(guardGeminiDecision('Qual preço e prazo?',decision,[]).action,'ask_clarification');
  const optout=guardGeminiDecision('Pare de me contatar',decision,[]);
  assert.equal(optout.action,'record_optout');assert.match(optout.messageDraft,/Nenhum contato foi alterado/);
  assert.equal(guardGeminiDecision('Quero um atendente',decision,[]).requiresApproval,true);
  assert.throws(()=>guardGeminiDecision('Oi',{...decision,action:'send_message'},[]));
});
test('Gemini request has no tools, no arbitrary endpoint, bounded output and validated token usage',async()=>{
  let calls=0;
  const send=async(url:any,options:any)=>{
    calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'],'fixture-only-key');assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);assert.equal(body.generationConfig.maxOutputTokens,700);
    assert.equal(body.tools,undefined);assert.equal(body.contents.length,1);
    return Response.json(result());
  };
  const prepared=await prepareTrustedGemini(input,send as typeof fetch);
  assert.equal(calls,1);assert.equal(prepared.usage.totalTokens,55);assert.equal(prepared.decision.requiresApproval,true);
});
test('provider errors never expose credentials, raw responses or retry automatically',async()=>{
  for(const send of [async()=>new Response('private provider error fixture-only-key',{status:403}),
    async()=>Response.json({...result(),candidates:[{finishReason:'MAX_TOKENS'}]}),
    async()=>Response.json({...result(),usageMetadata:{promptTokenCount:-1}}),
    async()=>new Response('x'.repeat(70_000))]) {
    await assert.rejects(prepareTrustedGemini(input,send as typeof fetch),(error:any)=>{
      assert.ok(error instanceof TrustedModelError);assert.doesNotMatch(error.message,/fixture-only-key|private/);return true;
    });
  }
});

function database(start:any={result:'STARTED',wia_run_id:'run-1',status:'running'},tariff:any={version:1,provider:'gemini',model:input.model,
 effective_from:'2026-01-01T00:00:00Z',effective_until:null,input_microusd_per_million:1,output_microusd_per_million:1,cached_microusd_per_million:0}) {
  const calls:any[]=[];const queries:any[]=[];
  return {calls,queries,rpc:async(name:string,args:any)=>{
    calls.push({name,args});if(name==='orkto_reserve_pulso')return {data:{allowed:true},error:null};if(name==='orkto_finish_pulso')return {data:true,error:null};if(name==='orkto_wia_claim_request')return {data:start,error:null};
    return {data:{result:'COMPLETED',wia_run_id:'run-1'},error:null};
  },from:(table:string)=>{
    const filters:any[]=[];queries.push({table,filters});
    const data=table==='quotes'?[{id:'private-quote-id'}]:table==='orkto_model_tariffs'?tariff:null;
    const query:any={select:()=>query,eq:(...v:any[])=>{filters.push(v);return query;},is:()=>query,in:()=>query,limit:()=>query,gte:()=>query,lte:()=>query,order:()=>query,maybeSingle:()=>query,
      then:(done:any)=>Promise.resolve({data,error:null,count:table==='clients'?3:0}).then(done)};
    return query;
  }};
}
const request={workspaceId:workspace,actorId:actor,requestId:actor,traceId:workspace,message:input.message,monthlyLimit:10,fingerprint:'a'.repeat(64)};
test('trusted request scopes all reads and persists before returning success',async()=>{
  const db=database();let providerCalls=0;
  const response=await prepareTrustedRequest(db,request,env,(async(_url:any,options:any)=>{
    providerCalls++;assert.doesNotMatch(options.body,/private-quote-id/);return Response.json(result());
  }) as typeof fetch);
  assert.equal(providerCalls,1);assert.equal(response.path,'model');
  assert.equal(db.calls[0].args.p_fingerprint,request.fingerprint);
  assert.equal(db.calls[1].name,'orkto_reserve_pulso');assert.equal(db.calls[2].name,'orkto_finish_pulso');assert.equal(db.calls[3].name,'orkto_wia_finish_request');assert.equal(db.calls[3].args.p_status,'succeeded');
  for(const query of db.queries.filter(q=>q.table!=='orkto_model_tariffs'))assert.ok(query.filters.some(([key,value])=>key==='workspace_id'&&value===workspace));
});
test('running, failed and completed replays never call Gemini',async()=>{
  for(const status of ['running','failed']) {
    await assert.rejects(prepareTrustedRequest(database({result:'REPLAY',wia_run_id:'run-1',status}),request,env,noSend),
      (error:any)=>error instanceof WiaRequestError&&error.status===409);
  }
  const saved={path:'model',mode:'live',decision,usage:{provider:'gemini'},toolExecutions:[]};
  const replay=await prepareTrustedRequest(database({result:'REPLAY',wia_run_id:'run-1',status:'succeeded',runtime_response:saved}),request,env,noSend);
  assert.equal(replay.replayed,true);assert.deepEqual(replay.decision,decision);
});
test('no key denies model before quota claim; deterministic T0 still works without key',async()=>{
  const db=database();
  await assert.rejects(prepareTrustedRequest(db,request,{get:()=>undefined},noSend),(error:any)=>error.code==='CONFIGURATION_REQUIRED');
  assert.equal(db.calls.length,0);
  const t0=await prepareTrustedRequest(database(),{...request,message:'Quais aprovações estão pendentes?'},{get:()=>undefined},noSend);
  assert.equal(t0.path,'t0');assert.equal(t0.usage.provider,'none');
});
test('failed model run is audited and never represented as successful',async()=>{
  const db=database();
  await assert.rejects(prepareTrustedRequest(db,request,env,(async()=>new Response('',{status:429})) as typeof fetch),
    (error:any)=>error.code==='MODEL_UNAVAILABLE');
  assert.equal(db.calls[3].args.p_status,'failed');
  assert.equal(db.calls[3].args.p_payload.errorCategory,'provider_unavailable');
});

test('unapproved Pulso allocation blocks generative calls and records the failed run',async()=>{
  const db=database();const rpc=db.rpc;
  db.rpc=async(name,args)=>name==='orkto_reserve_pulso'?{data:{allowed:false,reason:'configuration_required'},error:null}:rpc(name,args);
  await assert.rejects(prepareTrustedRequest(db,request,env,noSend),(error:any)=>error.code==='PULSO_CONFIGURATION_OR_LIMIT');
  assert.ok(db.calls.some(call=>call.name==='orkto_wia_finish_request'&&call.args.p_status==='failed'));
});

test('missing, expired, foreign-model or malformed tariff blocks inference even with an approved Pulso allocation',async()=>{
 for(const tariff of [null,{version:1,provider:'gemini',model:input.model,effective_from:'2020-01-01',effective_until:'2021-01-01',input_microusd_per_million:1,output_microusd_per_million:1,cached_microusd_per_million:0},
  {version:1,provider:'gemini',model:'other',effective_from:'2020-01-01',effective_until:null,input_microusd_per_million:1,output_microusd_per_million:1,cached_microusd_per_million:0},
  {version:1,provider:'gemini',model:input.model,effective_from:'2020-01-01',effective_until:null,input_microusd_per_million:-1,output_microusd_per_million:1,cached_microusd_per_million:0}]){
  const db=database(undefined,tariff);
  await assert.rejects(prepareTrustedRequest(db,request,env,noSend),(error:any)=>error.code==='MODEL_TARIFF_REQUIRED');
  assert.ok(db.calls.some(call=>call.name==='orkto_wia_finish_request'&&call.args.p_status==='failed'));
  assert.ok(!db.queries.some(query=>query.table==='clients'||query.table==='quotes'));
 }
});
