import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateStagingPreviewDeployment} from './staging-e2e-config.mjs';

export const GOOGLE_AB_TARGET=Object.freeze({
  sha:'a2a3651319196ffc56813992f705692d368ef967',
  preview:'https://orkto-staging-az36qohmo-peixoto-s-projects1.vercel.app',
  supabase:'https://ghrjongiodziasupakrk.supabase.co',
  actors:Object.freeze({A:'326864da-7e92-4cb6-a968-9a8411f312a8',B:'0486a0c4-3ac8-4655-9d35-24308ed85018'}),
});

const fail=()=>{throw new Error('GOOGLE_AB_BOUNDARY_REJECTED');};
const systemSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function claims(token) {
  try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{fail();}
}
function validateSession(session,actor,now) {
  if(!session||typeof session.access_token!=='string'||typeof session.refresh_token!=='string'||!session.refresh_token)fail();
  const c=claims(session.access_token);
  if(c.sub!==GOOGLE_AB_TARGET.actors[actor]||c.role!=='authenticated'||c.iss!==`${GOOGLE_AB_TARGET.supabase}/auth/v1`
    ||!Number.isFinite(c.exp)||c.exp*1000<=now||typeof c.session_id!=='string'
    ||!Array.isArray(c.amr)||!c.amr.some(v=>v.method==='oauth'))fail();
  return c;
}

/**
 * Transport engine, not a browser/session extractor. A trusted Google PKCE adapter
 * must supply two isolated, memory-only contexts from their normal OAuth flow.
 * No environment/session files, SDK storage, browser internals or raw diagnostics.
 */
export async function runGoogleAbTransport({verifyDeployment,acquireContexts,publicKey,oidcToken,
  fetchImpl=fetch,now=Date.now,sleep=systemSleep,fixtureClients,
  naturalExpiry=false,revokeCurrentSessions=false,maxNaturalWaitMs=65*60_000,expiryLeewayMs=5000,
  executionMode='STAGING'}={}) {
  const records=[];
  const record=(test,status,httpStatus)=>records.push({test,status,...(Number.isInteger(httpStatus)?{httpStatus}:{})});
  const report=()=>({scope:'GOOGLE_AB_TRANSPORT',executionMode,referenceRuntimeSha:GOOGLE_AB_TARGET.sha,
    readyForProductionCandidate:'NO',records});
  if(!['STAGING','FIXTURE'].includes(executionMode))fail();
  if(typeof acquireContexts!=='function'||typeof verifyDeployment!=='function') {
    record('GOOGLE_PKCE_TWO_CONTEXT_ADAPTER','BLOCKED_EXTERNAL');return report();
  }
  let contexts;
  try {
    if(executionMode==='STAGING'&&(fetchImpl!==fetch||now!==Date.now||sleep!==systemSleep))fail();
    // Verify before credentials are acquired or sent anywhere.
    const identity=await verifyDeployment();
    if(!validateStagingPreviewDeployment(GOOGLE_AB_TARGET.preview,identity?.deployment,identity?.deployments,GOOGLE_AB_TARGET.sha).ok)fail();
    if(typeof publicKey!=='string')fail();
    if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)) {
      const c=claims(publicKey);if(c.role!=='anon'||c.ref!=='ghrjongiodziasupakrk')fail();
    }
    if(oidcToken&&(!Number.isFinite(claims(oidcToken).exp)||claims(oidcToken).exp*1000<=now()))fail();
    if(!Number.isFinite(maxNaturalWaitMs)||maxNaturalWaitMs<0||maxNaturalWaitMs>90*60_000
      ||!Number.isFinite(expiryLeewayMs)||expiryLeewayMs<0||expiryLeewayMs>60_000)fail();
    if(fixtureClients&&(!/^[0-9a-f-]{36}$/i.test(fixtureClients.A)||!/^[0-9a-f-]{36}$/i.test(fixtureClients.B)
      ||fixtureClients.A===fixtureClients.B))fail();
    contexts=await acquireContexts();
    if(!Array.isArray(contexts)||contexts.length!==2)fail();
    const [a,b]=contexts;
    if(a?.actor!=='A'||b?.actor!=='B'||!a.contextId||!b.contextId||a.contextId===b.contextId||a===b
      ||a.session===b.session||a.session?.access_token===b.session?.access_token
      ||a.session?.refresh_token===b.session?.refresh_token)fail();
    for(const c of contexts) {
      if(c.provenance!=='google_pkce_memory'||c.storage!=='memory'||c.autoRefresh!==false||typeof c.dispose!=='function')fail();
      validateSession(c.session,c.actor,now());
    }
    async function request(origin,path,token,{method='GET',workspace,body}={}) {
      if(![GOOGLE_AB_TARGET.preview,GOOGLE_AB_TARGET.supabase].includes(origin))fail();
      const headers={'content-type':'application/json'};
      if(token)headers.authorization=`Bearer ${token}`;
      if(origin===GOOGLE_AB_TARGET.preview){if(oidcToken)headers['x-vercel-trusted-oidc-idp-token']=oidcToken;}
      else headers.apikey=publicKey;
      if(workspace)headers['x-orkto-workspace']=workspace;
      if(path.startsWith('/functions/'))headers['x-idempotency-key']=`google-ab-${randomUUID()}`;
      const response=await fetchImpl(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
        redirect:'manual',signal:AbortSignal.timeout(30_000)});
      // Streaming size bound; never include response text, exception or headers in output.
      const reader=response.body?.getReader();let size=0;const chunks=[];
      if(reader){try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;
        if(size>65_536){await reader.cancel();fail();}chunks.push(value);}}finally{reader.releaseLock();}}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let data=null;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{/* bounded non-JSON fails assertions */}
      return {status:response.status,data};
    }
    async function verifiedIdentity(c) {
      const r=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/user',c.session.access_token);
      const ok=r.status===200&&r.data?.id===GOOGLE_AB_TARGET.actors[c.actor]
        &&r.data?.identities?.some(i=>i.provider==='google');
      record(`${c.actor}_VERIFIED_GOOGLE_SUBJECT`,ok?'PASS':'FAIL',r.status);if(!ok)fail();
    }
    async function probe(c,other=false,token=c.session.access_token,revoked=false,prefix='') {
      const workspace=GOOGLE_AB_TARGET.actors[other?(c.actor==='A'?'B':'A'):c.actor];
      const denied=other||revoked;
      const api=await request(GOOGLE_AB_TARGET.preview,'/api/operational/workspace',token,{workspace});
      record(`${prefix}${c.actor}_API_${other?'FOREIGN':'OWN'}`,denied
        ?([401,403].includes(api.status)?'PASS':'FAIL')
        :(api.status===200&&api.data?.workspace?.id===workspace?'PASS':'FAIL'),api.status);
      const edge=await request(GOOGLE_AB_TARGET.supabase,'/functions/v1/orkto-core-mutations',token,
        {method:'POST',workspace,body:{command:'READ_PLAN_CATALOG',payload:{}}});
      record(`${prefix}${c.actor}_EDGE_${other?'FOREIGN':'OWN'}`,denied
        ?([401,403].includes(edge.status)?'PASS':'FAIL')
        :(edge.status===200&&edge.data?.code==='OK'&&edge.data?.data?.result==='READ'?'PASS':'FAIL'),edge.status);
      const rest=await request(GOOGLE_AB_TARGET.supabase,`/rest/v1/orkto_workspaces?select=id&id=eq.${workspace}`,token);
      const empty=rest.status===200&&Array.isArray(rest.data)&&rest.data.length===0;
      record(`${prefix}${c.actor}_POSTGREST_${other?'FOREIGN':'OWN'}`,denied
        ?(empty||[401,403].includes(rest.status)?'PASS':'FAIL')
        :(rest.status===200&&Array.isArray(rest.data)&&rest.data.length===1&&rest.data[0].id===workspace?'PASS':'FAIL'),rest.status);
    }
    const oldTokens=[];
    async function refresh(c) {
      const prior=c.session;
      const r=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/token?grant_type=refresh_token',undefined,
        {method:'POST',body:{refresh_token:prior.refresh_token}});
      let ok=false;
      if(r.status===200){const current=validateSession(r.data,c.actor,now());
        ok=r.data.refresh_token!==prior.refresh_token&&current.session_id===claims(prior.access_token).session_id;
        if(ok)c.session={access_token:r.data.access_token,refresh_token:r.data.refresh_token};}
      record(`${c.actor}_REFRESH_ROTATION`,ok?'PASS':'FAIL',r.status);if(!ok)fail();
    }
    for(const c of contexts){await verifiedIdentity(c);await probe(c);await probe(c,true);
      oldTokens.push({actor:c.actor,token:c.session.access_token,exp:claims(c.session.access_token).exp});await refresh(c);}
    if(fixtureClients){
      for(const c of contexts)for(const other of [false,true]){
        const resourceActor=other?(c.actor==='A'?'B':'A'):c.actor;const id=fixtureClients[resourceActor];
        const api=await request(GOOGLE_AB_TARGET.preview,`/api/clients/${id}`,c.session.access_token,{workspace:GOOGLE_AB_TARGET.actors[c.actor]});
        record(`${c.actor}_CLIENT_API_${other?'FOREIGN':'OWN'}`,other
          ?(api.status===404?'PASS':'FAIL')
          :(api.status===200&&api.data?.data?.id===id&&api.data?.data?.workspace_id===GOOGLE_AB_TARGET.actors[c.actor]?'PASS':'FAIL'),api.status);
        const rest=await request(GOOGLE_AB_TARGET.supabase,`/rest/v1/clients?select=id,workspace_id&id=eq.${id}`,c.session.access_token);
        record(`${c.actor}_CLIENT_POSTGREST_${other?'FOREIGN':'OWN'}`,other
          ?(rest.status===200&&Array.isArray(rest.data)&&rest.data.length===0?'PASS':'FAIL')
          :(rest.status===200&&Array.isArray(rest.data)&&rest.data.length===1&&rest.data[0].id===id
            &&rest.data[0].workspace_id===GOOGLE_AB_TARGET.actors[c.actor]?'PASS':'FAIL'),rest.status);
      }
    }else record('BUSINESS_RESOURCE_AB','NOT_TESTED');
    if(naturalExpiry){
      const until=Math.max(...oldTokens.map(t=>t.exp))*1000+expiryLeewayMs;
      if(until-now()>maxNaturalWaitMs){record('NATURAL_EXPIRY_WAIT_LIMIT','BLOCKED_EXTERNAL');}
      else {while(now()<until)await sleep(Math.min(30_000,until-now()));
        for(const c of contexts){const old=oldTokens.find(t=>t.actor===c.actor);
          if(now()<=old.exp*1000)fail();await probe(c,false,old.token,true,'NATURALLY_EXPIRED_');await refresh(c);}
      }
    }else record('NATURAL_EXPIRY','NOT_TESTED');
    record('REFRESH_REUSE_OUTSIDE_EXCEPTIONS','NOT_TESTED');
    record('CROSS_TENANT_WRITES','NOT_TESTED');
    if(revokeCurrentSessions){
      for(const c of contexts){
        // Refreshed JWT must still be unexpired: distinguish revocation from natural expiry.
        validateSession(c.session,c.actor,now());
        const old=c.session;
        const r=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/logout?scope=local',old.access_token,{method:'POST'});
        record(`${c.actor}_LOGOUT_LOCAL_SESSION`,r.status===204?'PASS':'FAIL',r.status);if(r.status!==204)fail();
        await probe(c,false,old.access_token,true,'REVOKED_');
        const sensitive=await request(GOOGLE_AB_TARGET.supabase,'/rest/v1/rpc/orkto_google_pilot_session_allowed',old.access_token,{method:'POST',body:{}});
        record(`${c.actor}_REVOKED_SESSION_GUARD`,sensitive.status===200&&sensitive.data===false?'PASS':'FAIL',sensitive.status);
        const retry=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/token?grant_type=refresh_token',undefined,
          {method:'POST',body:{refresh_token:old.refresh_token}});
        const code=retry.data?.error_code||retry.data?.code;
        record(`${c.actor}_REVOKED_REFRESH`,[400,401].includes(retry.status)
          &&['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired'].includes(code)?'PASS':'FAIL',retry.status);
        if(c.actor==='A')await verifiedIdentity(contexts[1]);
      }
    }else record('LOGOUT_REVOCATION_REPLAY','NOT_TESTED');
  }catch{record('EXECUTOR_BOUNDARY_OR_TRANSPORT','FAIL');}
  finally{
    for(const c of Array.isArray(contexts)?contexts:[]){
      if(c&&typeof c==='object'){
        try{c.session=null;}catch{record('CONTEXT_DISPOSAL','FAIL');}
        try{if(typeof c.dispose==='function')await c.dispose();}catch{record('CONTEXT_DISPOSAL','FAIL');}
      }
    }
  }
  return report();
}

// Safe direct invocation: no session arguments, environment credentials or implicit login.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  process.stdout.write(JSON.stringify(await runGoogleAbTransport())+'\n');process.exitCode=2;
}
