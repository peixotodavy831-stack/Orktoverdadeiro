import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateStagingPreviewDeployment} from './staging-e2e-config.mjs';

export const GOOGLE_AB_TARGET=Object.freeze({
  sha:'837b5e57ed7706aa08a039b22efaa94a0797d8af',
  preview:'https://orkto-staging-1qkrj43tb-peixoto-s-projects1.vercel.app',
  supabase:'https://ghrjongiodziasupakrk.supabase.co',
  actors:Object.freeze({A:'326864da-7e92-4cb6-a968-9a8411f312a8',B:'0486a0c4-3ac8-4655-9d35-24308ed85018'}),
});

const fail=()=>{throw new Error('GOOGLE_AB_BOUNDARY_REJECTED');};
const systemSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const refreshDenied=r=>[400,401].includes(r.status)
  &&['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired'].includes(r.data?.error_code||r.data?.code);
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
export async function runGoogleAbTransport({verifyDeployment,acquireContexts,publicKey,oidcToken,getPreviewOidc,
  fetchImpl=fetch,now=Date.now,sleep=systemSleep,fixtureClients,
  crossTenantWrites,refreshReuse=false,verifyRefreshPolicy,
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
    // Reuse detection terminates its sessions. Logout needs a separate fresh PKCE
    // round, never an implicit reacquisition or a global sign-out.
    if(refreshReuse&&revokeCurrentSessions)fail();
    if(crossTenantWrites){
      if(typeof crossTenantWrites.inspect!=='function')fail();
      for(const actor of ['A','B']){const f=crossTenantWrites[actor];
        if(!f||!uuid(f.id)||f.ownerApproved!==true||f.exclusivelySynthetic!==true)fail();}
      if(crossTenantWrites.A.id===crossTenantWrites.B.id)fail();
    }
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
    async function request(origin,path,token,{method='GET',workspace,body,representation=false}={}) {
      if(![GOOGLE_AB_TARGET.preview,GOOGLE_AB_TARGET.supabase].includes(origin))fail();
      const headers={'content-type':'application/json'};
      if(token)headers.authorization=`Bearer ${token}`;
      if(origin===GOOGLE_AB_TARGET.preview){
        const access=typeof getPreviewOidc==='function'?await getPreviewOidc():oidcToken;
        if(access){if(!Number.isFinite(claims(access).exp)||claims(access).exp*1000<=now())fail();
          headers['x-vercel-trusted-oidc-idp-token']=access;}
      }
      else headers.apikey=publicKey;
      if(representation)headers.prefer='return=representation';
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
      // Prove existing authorization first: the application workspace read has a
      // legacy provisioning fallback that must never be used to create test roles.
      const id=GOOGLE_AB_TARGET.actors[c.actor];
      const member=await request(GOOGLE_AB_TARGET.supabase,
        `/rest/v1/orkto_workspace_members?select=workspace_id,user_id,role,status&user_id=eq.${id}`,c.session.access_token);
      const rows=member.data;
      const authorized=member.status===200&&Array.isArray(rows)&&rows.length===1
        &&rows[0].user_id===id&&rows[0].workspace_id===id&&rows[0].role==='owner'&&rows[0].status==='active';
      record(`${c.actor}_EXISTING_APPROVED_MEMBERSHIP`,authorized?'PASS':'FAIL',member.status);if(!authorized)fail();
    }
    async function probe(c,other=false,token=c.session.access_token,revoked=false,prefix='') {
      const workspace=GOOGLE_AB_TARGET.actors[other?(c.actor==='A'?'B':'A'):c.actor];
      const denied=other||revoked;
      const api=await request(GOOGLE_AB_TARGET.preview,'/api/operational/workspace',token,{workspace});
      record(`${prefix}${c.actor}_API_${other?'FOREIGN':'OWN'}`,denied
        ?((api.status===401&&api.data?.error==='Sessão expirada. Faça login novamente.')
          ||(api.status===403&&['pilot_access_denied','workspace_access_denied'].includes(api.data?.category))?'PASS':'FAIL')
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
    async function writeIsolation(){
      if(!crossTenantWrites){record('CROSS_TENANT_WRITES','NOT_TESTED');return;}
      // inspect is a trusted, read-only administrative adapter. It receives only
      // approved fixture IDs, never sessions/keys. Return complete rows so a
      // changed timestamp, ownership or unrelated field cannot pass unnoticed.
      const ids=['A','B'].map(actor=>crossTenantWrites[actor].id);
      async function snapshot(){
        const rows=await crossTenantWrites.inspect({project:'ghrjongiodziasupakrk',ids:[...ids]});
        if(!Array.isArray(rows)||rows.length!==2)fail();
        return ['A','B'].map(actor=>{
          const row=rows.find(r=>r.id===crossTenantWrites[actor].id);
          if(!row||row.workspace_id!==GOOGLE_AB_TARGET.actors[actor]||row.archived_at!==null
            ||typeof row.name!=='string'||!row.name.startsWith('ORKTO-G06-'))fail();
          return structuredClone(row);
        });
      }
      const baseline=await snapshot();
      for(const c of contexts){
        const row=baseline[c.actor==='A'?0:1];
        const own=await request(GOOGLE_AB_TARGET.preview,`/api/clients/${row.id}`,c.session.access_token,
          {workspace:GOOGLE_AB_TARGET.actors[c.actor]});
        if(own.status!==200||own.data?.data?.id!==row.id||own.data?.data?.workspace_id!==row.workspace_id
          ||own.data?.data?.name!==row.name)fail();
      }
      for(const c of contexts){
        const victim=c.actor==='A'?'B':'A',id=crossTenantWrites[victim].id;
        const changes={name:`ORKTO-G06-${randomUUID()}`};
        const attempts=[];
        for(const forged of [false,true]){
          const workspace=GOOGLE_AB_TARGET.actors[forged?victim:c.actor];
          attempts.push({surface:`API_${forged?'FOREIGN_HEADER':'OWN_HEADER'}`,origin:GOOGLE_AB_TARGET.preview,
            path:`/api/clients/${id}`,options:{method:'PATCH',workspace,body:changes}});
          attempts.push({surface:`EDGE_${forged?'FOREIGN_HEADER':'OWN_HEADER'}`,origin:GOOGLE_AB_TARGET.supabase,
            path:'/functions/v1/orkto-core-mutations',options:{method:'POST',workspace,
              body:{command:'UPDATE_CLIENT',payload:{clientId:id,changes}}}});
        }
        attempts.push({surface:'POSTGREST',origin:GOOGLE_AB_TARGET.supabase,path:`/rest/v1/clients?id=eq.${id}`,
          options:{method:'PATCH',body:changes,representation:true}});
        for(const attempt of attempts){
          validateSession(c.session,c.actor,now());
          const allowed=await request(GOOGLE_AB_TARGET.supabase,'/rest/v1/rpc/orkto_google_pilot_session_allowed',c.session.access_token,
            {method:'POST',body:{}});
          if(allowed.status!==200||allowed.data!==true)fail();
          let response,transportFailed=false;
          try{response=await request(attempt.origin,attempt.path,c.session.access_token,attempt.options);}
          catch{transportFailed=true;}
          // Always check persistence, including ambiguous timeout/error results.
          let after;
          try{after=await snapshot();}catch{record(`${c.actor}_G06_OBSERVER`,'FAIL');fail();}
          const unchanged=canonical(after)===canonical(baseline);
          const denied=attempt.surface==='POSTGREST'
            ?response&&([401,403].includes(response.status)||(response.status===200&&Array.isArray(response.data)&&response.data.length===0))
            :response&&(response.status===404&&(attempt.origin===GOOGLE_AB_TARGET.supabase
              ?response.data?.code==='NOT_FOUND':response.data?.category==='NOT_FOUND')
              ||response.status===403&&(attempt.origin===GOOGLE_AB_TARGET.supabase
                ?['PERMISSION_DENIED','WORKSPACE_ACCESS_DENIED'].includes(response.data?.code)
                :['pilot_access_denied','workspace_access_denied','PERMISSION_DENIED','WORKSPACE_ACCESS_DENIED'].includes(response.data?.category)));
          record(`${c.actor}_G06_${attempt.surface}`,!transportFailed&&denied&&unchanged?'PASS':'FAIL',response?.status);
          record(`${c.actor}_G06_${attempt.surface}_UNCHANGED`,unchanged?'PASS':'FAIL');
          if(!unchanged){
            // Bounded recovery only for our marker in the one authorized field.
            // Never overwrite unrelated concurrent changes or repair permissions.
            const index=victim==='A'?0:1,changed=after[index],before=baseline[index];
            const safe=after.every((row,i)=>i===index
              ?canonical({...row,name:before.name,updated_at:before.updated_at})===canonical(before)&&row.name===changes.name
              :canonical(row)===canonical(baseline[i]));
            if(safe){
              const owner=contexts.find(v=>v.actor===victim);
              try{
                await request(GOOGLE_AB_TARGET.preview,`/api/clients/${id}`,owner.session.access_token,
                  {method:'PATCH',workspace:GOOGLE_AB_TARGET.actors[victim],body:{name:before.name}});
                const restored=await snapshot();
                const restoredFields=restored.every((row,i)=>canonical(i===index?{...row,updated_at:before.updated_at}:row)===canonical(baseline[i]));
                record('G06_AUTHORIZED_FIELD_RESTORATION',restoredFields?'PASS':'FAIL');
              }catch{record('G06_AUTHORIZED_FIELD_RESTORATION','FAIL');}
            }else record('G06_MANUAL_RECOVERY_REQUIRED','FAIL');
            fail();
          }
          validateSession(c.session,c.actor,now());
          const stillAllowed=await request(GOOGLE_AB_TARGET.supabase,'/rest/v1/rpc/orkto_google_pilot_session_allowed',c.session.access_token,
            {method:'POST',body:{}});
          record(`${c.actor}_G06_${attempt.surface}_LIVE_SESSION`,stillAllowed.status===200&&stillAllowed.data===true?'PASS':'FAIL',stillAllowed.status);
          if(stillAllowed.status!==200||stillAllowed.data!==true)fail();
          if(transportFailed||!denied)fail();
        }
      }
    }
    const reuseAncestors=new Map();
    for(const c of contexts){await verifiedIdentity(c);await probe(c);await probe(c,true);
      if(refreshReuse)reuseAncestors.set(c.actor,c.session.refresh_token);
      oldTokens.push({actor:c.actor,token:c.session.access_token,exp:claims(c.session.access_token).exp});await refresh(c);}
    await writeIsolation();
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
      if(oidcToken&&typeof getPreviewOidc!=='function'&&claims(oidcToken).exp*1000<=until+30_000){
        record('NATURAL_EXPIRY_PREVIEW_ACCESS_RENEWAL_REQUIRED','BLOCKED_EXTERNAL');
      }else if(until-now()>maxNaturalWaitMs){record('NATURAL_EXPIRY_WAIT_LIMIT','BLOCKED_EXTERNAL');}
      else {while(now()<until)await sleep(Math.min(30_000,until-now()));
        for(const c of contexts){const old=oldTokens.find(t=>t.actor===c.actor);
          if(now()<=old.exp*1000)fail();await probe(c,false,old.token,true,'NATURALLY_EXPIRED_');await refresh(c);}
      }
    }else record('NATURAL_EXPIRY','NOT_TESTED');
    if(refreshReuse){
      const policy=typeof verifyRefreshPolicy==='function'?await verifyRefreshPolicy():null;
      if(!policy||policy.project!=='ghrjongiodziasupakrk'||policy.rotationEnabled!==true
        ||!Number.isInteger(policy.reuseIntervalSeconds)||policy.reuseIntervalSeconds<0||policy.reuseIntervalSeconds>120){
        record('REFRESH_REUSE_VERIFIED_POLICY_REQUIRED','BLOCKED_EXTERNAL');
      }else for(const c of contexts){
        const ancestor=reuseAncestors.get(c.actor),parent=c.session.refresh_token;
        await refresh(c); // R0 -> R1 -> R2: R0 is no longer the active token's parent.
        const active=c.session.refresh_token;
        if(new Set([ancestor,parent,active]).size!==3)fail();
        async function outsideWindow(){
          const until=now()+policy.reuseIntervalSeconds*1000+2000;
          if(claims(c.session.access_token).exp*1000<=until+30_000){
            record(`${c.actor}_G08_JWT_LIFETIME_REQUIRED`,'BLOCKED_EXTERNAL');return false;}
          while(now()<until)await sleep(Math.min(30_000,until-now()));
          return true;
        }
        if(!await outsideWindow())continue;
        const legitimate=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/token?grant_type=refresh_token',undefined,
          {method:'POST',body:{refresh_token:parent}});
        const parentOk=legitimate.status===200&&legitimate.data?.refresh_token===active
          &&validateSession(legitimate.data,c.actor,now()).session_id===claims(c.session.access_token).session_id;
        record(`${c.actor}_G08_PARENT_EXCEPTION`,parentOk?'PASS':'FAIL',legitimate.status);if(!parentOk)fail();
        c.session={access_token:legitimate.data.access_token,refresh_token:active};
        if(!await outsideWindow())continue;
        const live=await request(GOOGLE_AB_TARGET.supabase,'/rest/v1/rpc/orkto_google_pilot_session_allowed',c.session.access_token,
          {method:'POST',body:{}});
        if(live.status!==200||live.data!==true)fail();
        const replay=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/token?grant_type=refresh_token',undefined,
          {method:'POST',body:{refresh_token:ancestor}});
        record(`${c.actor}_G08_ANCESTOR_REJECTED`,refreshDenied(replay)?'PASS':'FAIL',replay.status);
        if(!refreshDenied(replay))fail();
        const latest=await request(GOOGLE_AB_TARGET.supabase,'/auth/v1/token?grant_type=refresh_token',undefined,
          {method:'POST',body:{refresh_token:active}});
        record(`${c.actor}_G08_FAMILY_REVOKED`,refreshDenied(latest)?'PASS':'FAIL',latest.status);
        if(!refreshDenied(latest))fail();
        validateSession(c.session,c.actor,now());
        await probe(c,false,c.session.access_token,true,'REUSE_REVOKED_');
        const guard=await request(GOOGLE_AB_TARGET.supabase,'/rest/v1/rpc/orkto_google_pilot_session_allowed',c.session.access_token,
          {method:'POST',body:{}});
        record(`${c.actor}_G08_SESSION_GUARD`,guard.status===200&&guard.data===false?'PASS':'FAIL',guard.status);
        if(c.actor==='A')await verifiedIdentity(contexts[1]);
      }
    }else record('REFRESH_REUSE_OUTSIDE_EXCEPTIONS','NOT_TESTED');
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
