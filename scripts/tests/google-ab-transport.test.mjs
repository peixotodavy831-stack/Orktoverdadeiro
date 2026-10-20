import test from 'node:test';
import assert from 'node:assert/strict';
import {GOOGLE_AB_TARGET as T,runGoogleAbTransport} from '../readiness/google-ab-transport.mjs';

// Deliberately unsigned synthetic tokens. Never credentials or evidence of staging Auth.
const jwt=c=>`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(c)).toString('base64url')}.fixture`;
function fixture() {
  let time=Date.UTC(2026,9,16,22,0,0);const calls=[],disposed=[],revoked=new Set(),refreshes=new Map();
  const token=(actor,seconds=2)=>jwt({sub:T.actors[actor],role:'authenticated',iss:`${T.supabase}/auth/v1`,
    session_id:`session-${actor}`,amr:[{method:'oauth'}],exp:Math.floor(time/1000)+seconds});
  const contexts=['A','B'].map(actor=>({actor,contextId:`isolated-${actor}`,provenance:'google_pkce_memory',storage:'memory',autoRefresh:false,
    session:{access_token:token(actor),refresh_token:`fixture-refresh-${actor}-0`},dispose:async()=>{disposed.push(actor);}}));
  const originals=contexts.map(c=>({...c.session}));
  const decode=s=>JSON.parse(Buffer.from(s.split('.')[1],'base64url').toString());
  const config={publicKey:'sb_publishable_fixture',oidcToken:jwt({exp:Math.floor(time/1000)+3600}),
    verifyDeployment:async()=>({deployment:{projectId:'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',url:new URL(T.preview).hostname,
      target:null,readyState:'READY',meta:{githubCommitSha:T.sha}}}),
    acquireContexts:async()=>contexts,now:()=>time,sleep:async ms=>{time+=ms;},executionMode:'FIXTURE',
    fetchImpl:async(url,init)=>{
      calls.push({url,init});const u=new URL(url);
      let c=null;try{c=decode(init.headers.authorization?.slice(7));}catch{/* refresh has no bearer */}
      const actor=c?.sub===T.actors.A?'A':'B';const expired=c&&c.exp*1000<=time;
      const denied=expired||revoked.has(actor);
      if(u.pathname==='/auth/v1/token'){
        assert.equal(init.headers.authorization,undefined);
        const refresh=JSON.parse(init.body).refresh_token;const who=refresh.includes('-A-')?'A':'B';
        if(revoked.has(who))return Response.json({error_code:'refresh_token_not_found'},{status:400});
        const count=(refreshes.get(who)||0)+1;refreshes.set(who,count);
        return Response.json({access_token:token(who,60),refresh_token:`fixture-refresh-${who}-${count}`});
      }
      if(u.pathname==='/auth/v1/user')return denied?Response.json({}, {status:401}):Response.json({id:T.actors[actor],identities:[{provider:'google'}]});
      if(u.pathname==='/rest/v1/orkto_workspace_members')return Response.json(denied?[]:[{user_id:T.actors[actor],workspace_id:T.actors[actor],role:'owner',status:'active'}]);
      if(u.pathname==='/auth/v1/logout'){
        assert.equal(u.search,'?scope=local');revoked.add(actor);return new Response(null,{status:204});
      }
      if(u.pathname.endsWith('/orkto_google_pilot_session_allowed'))return Response.json(!denied);
      const workspace=init.headers['x-orkto-workspace']||u.searchParams.get('id')?.slice(3);
      const foreign=workspace!==T.actors[actor];
      if(u.pathname==='/api/operational/workspace')return denied||foreign?Response.json({category:denied?'pilot_access_denied':'workspace_access_denied'},{status:403}):Response.json({workspace:{id:workspace}});
      if(u.pathname.startsWith('/functions/'))return denied||foreign?Response.json({},{status:403}):Response.json({code:'OK',data:{result:'READ'}});
      if(u.pathname==='/rest/v1/orkto_workspaces')return Response.json(denied||foreign?[]:[{id:workspace}]);
      throw new Error('UNEXPECTED_FIXTURE_REQUEST');
    }};
  return {config,calls,contexts,originals,disposed};
}
test('no adapter means explicit blocked report and zero network, not false PASS',async()=>{
  let contacted=false;const r=await runGoogleAbTransport({fetchImpl:async()=>{contacted=true;}});
  assert.equal(contacted,false);assert.deepEqual(r.records,[{test:'GOOGLE_PKCE_TWO_CONTEXT_ADAPTER',status:'BLOCKED_EXTERNAL'}]);
  assert.equal(r.readyForProductionCandidate,'NO');
});
test('read matrix uses both identities, all three transports and both foreign directions',async()=>{
  const f=fixture();const r=await runGoogleAbTransport(f.config);
  assert.ok(!r.records.some(x=>x.status==='FAIL'));
  for(const actor of ['A','B'])for(const surface of ['API','EDGE','POSTGREST'])for(const tenant of ['OWN','FOREIGN'])
    assert.ok(r.records.some(x=>x.test===`${actor}_${surface}_${tenant}`&&x.status==='PASS'));
  assert.ok(r.records.some(x=>x.test==='NATURAL_EXPIRY'&&x.status==='NOT_TESTED'));
  assert.ok(r.records.some(x=>x.test==='CROSS_TENANT_WRITES'&&x.status==='NOT_TESTED'));
  assert.deepEqual(f.disposed,['A','B']);assert.ok(f.contexts.every(c=>c.session===null));
});
test('OIDC is origin scoped, redirects are manual and output contains no tokens or response bodies',async()=>{
  const f=fixture();const r=await runGoogleAbTransport(f.config);
  for(const {url,init} of f.calls){assert.equal(init.redirect,'manual');
    if(url.startsWith(T.supabase))assert.equal(init.headers['x-vercel-trusted-oidc-idp-token'],undefined);
    else {assert.equal(init.headers.apikey,undefined);assert.equal(init.headers['x-vercel-trusted-oidc-idp-token'],f.config.oidcToken);}}
  const output=JSON.stringify(r);for(const s of [...f.originals.flatMap(Object.values),f.config.oidcToken,T.actors.A,T.actors.B])assert.ok(!output.includes(s));
});
test('wrong deployment stops before acquiring credentials or contacting application',async()=>{
  const f=fixture();let acquired=false;f.config.verifyDeployment=async()=>({deployment:{projectId:'production',url:'wrong.example'}});
  f.config.acquireContexts=async()=>{acquired=true;return f.contexts;};
  const r=await runGoogleAbTransport(f.config);assert.equal(acquired,false);assert.equal(f.calls.length,0);assert.equal(r.records.at(-1).status,'FAIL');
});
test('same context, persistent storage, auto refresh and wrong OAuth identity fail before network',async()=>{
  for(const mutate of [f=>{f.contexts[1].contextId=f.contexts[0].contextId;},f=>{f.contexts[0].storage='disk';},
    f=>{f.contexts[0].autoRefresh=true;},f=>{f.contexts[0].session.access_token=f.contexts[1].session.access_token;}]){
    const f=fixture();mutate(f);const r=await runGoogleAbTransport(f.config);
    assert.equal(f.calls.length,0);assert.ok(r.records.some(v=>v.status==='FAIL'));assert.deepEqual(f.disposed,['A','B']);
  }
});
test('elevated/public keys from another project are rejected before session acquisition',async()=>{
  for(const key of ['sb_secret_do_not_use',jwt({role:'service_role',ref:'ghrjongiodziasupakrk'}),jwt({role:'anon',ref:'wrong'})]){
    const f=fixture();let acquired=false;f.config.publicKey=key;f.config.acquireContexts=async()=>{acquired=true;};
    const r=await runGoogleAbTransport(f.config);assert.equal(acquired,false);assert.equal(f.calls.length,0);assert.equal(r.records.at(-1).status,'FAIL');
  }
});
test('natural expiry waits without altering production time and tests original JWTs before revocation',async()=>{
  const f=fixture();const r=await runGoogleAbTransport({...f.config,naturalExpiry:true,maxNaturalWaitMs:5000,expiryLeewayMs:1000});
  assert.ok(!r.records.some(v=>v.status==='FAIL'));
  assert.equal(r.records.filter(v=>v.test.startsWith('NATURALLY_EXPIRED_')&&v.status==='PASS').length,6);
  assert.ok(!f.calls.some(v=>v.url.includes('/logout')));
});
test('natural wait limit is blocked, not certified via a fabricated expired token',async()=>{
  const f=fixture();const r=await runGoogleAbTransport({...f.config,naturalExpiry:true,maxNaturalWaitMs:1});
  assert.ok(r.records.some(v=>v.test==='NATURAL_EXPIRY_WAIT_LIMIT'&&v.status==='BLOCKED_EXTERNAL'));
  assert.ok(!r.records.some(v=>v.test.startsWith('NATURALLY_EXPIRED_')));
});
test('local logout tests unexpired revoked JWT, revoked refresh and other identity remains active',async()=>{
  const f=fixture();const r=await runGoogleAbTransport({...f.config,revokeCurrentSessions:true});
  assert.ok(!r.records.some(v=>v.status==='FAIL'));
  assert.equal(f.calls.filter(v=>v.url.includes('/logout?scope=local')).length,2);
  assert.equal(r.records.filter(v=>v.test.endsWith('_REVOKED_REFRESH')&&v.status==='PASS').length,2);
  assert.equal(r.records.filter(v=>v.test==='B_VERIFIED_GOOGLE_SUBJECT'&&v.status==='PASS').length,2);
});
test('foreign data leak is FAIL and never hidden by other passing surfaces',async()=>{
  const f=fixture();const send=f.config.fetchImpl;f.config.fetchImpl=async(url,init)=>url.startsWith(T.preview)
    ?Response.json({workspace:{id:init.headers['x-orkto-workspace']}}):send(url,init);
  const r=await runGoogleAbTransport(f.config);assert.ok(r.records.some(v=>v.test==='A_API_FOREIGN'&&v.status==='FAIL'));
});
test('untrusted errors and failed disposal never print credential-bearing diagnostics',async()=>{
  const f=fixture();f.config.fetchImpl=async()=>{throw new Error(`unsafe ${f.originals[0].access_token}`);};
  f.contexts[0].dispose=async()=>{throw new Error(`unsafe ${f.originals[0].refresh_token}`);};
  const r=await runGoogleAbTransport(f.config);const out=JSON.stringify(r);
  assert.ok(!out.includes('unsafe'));assert.ok(!out.includes(f.originals[0].access_token));
  assert.ok(r.records.some(v=>v.test==='CONTEXT_DISPOSAL'&&v.status==='FAIL'));
});
test('oversized replies and redirects cannot become PASS',async()=>{
  for(const response of [()=>new Response('x'.repeat(70_000)),()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}})]){
    const f=fixture();f.config.fetchImpl=async()=>response();const r=await runGoogleAbTransport(f.config);
    assert.ok(r.records.some(v=>v.status==='FAIL'));assert.equal(r.readyForProductionCandidate,'NO');
  }
});

test('approved business resource reads verify nonempty own rows and empty foreign rows in both directions',async()=>{
 const f=fixture();const ids={A:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
 const send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>{
  const u=new URL(url);if(!u.pathname.startsWith('/api/clients/')&&u.pathname!=='/rest/v1/clients')return send(url,init);
  const subject=JSON.parse(Buffer.from(init.headers.authorization.split('.')[1],'base64url').toString()).sub;
  const actor=subject===T.actors.A?'A':'B';const id=u.pathname.startsWith('/api/')?u.pathname.split('/').at(-1):u.searchParams.get('id').slice(3);
  const own=id===ids[actor];const row={id,workspace_id:subject};
  return u.pathname.startsWith('/api/')?(own?Response.json({data:row}):Response.json({},{status:404})):Response.json(own?[row]:[]);
 };
 const r=await runGoogleAbTransport({...f.config,fixtureClients:ids});
 assert.ok(!r.records.some(v=>v.status==='FAIL'));
 assert.equal(r.records.filter(v=>v.test.includes('_CLIENT_')&&v.status==='PASS').length,8);
});
test('malformed fixture IDs and staging clock/transport overrides fail before credential acquisition',async()=>{
 for(const patch of [{fixtureClients:{A:'../escape',B:'valid'}},{executionMode:'STAGING'}]){
  const f=fixture();let acquired=false;f.config.acquireContexts=async()=>{acquired=true;return f.contexts;};
  const r=await runGoogleAbTransport({...f.config,...patch});assert.equal(acquired,false);assert.equal(f.calls.length,0);
  assert.ok(r.records.some(v=>v.status==='FAIL'));
 }
});

test('Vercel denial cannot masquerade as revoked user authentication',async()=>{
 const f=fixture();const send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>url.startsWith(T.preview)?new Response('Vercel login',{status:403}):send(url,init);
 const r=await runGoogleAbTransport(f.config);
 assert.ok(r.records.some(v=>v.test==='A_API_FOREIGN'&&v.status==='FAIL'));
});
test('natural-expiry phase requires valid Preview protection beyond the wait or an OIDC renewal adapter',async()=>{
 const f=fixture();f.config.oidcToken=jwt({exp:Math.floor(f.config.now()/1000)+2});
 const r=await runGoogleAbTransport({...f.config,naturalExpiry:true});
 assert.ok(r.records.some(v=>v.test==='NATURAL_EXPIRY_PREVIEW_ACCESS_RENEWAL_REQUIRED'&&v.status==='BLOCKED_EXTERNAL'));
 assert.ok(!r.records.some(v=>v.test.startsWith('NATURALLY_EXPIRED_')));
});
test('missing existing membership stops before any workspace API could provision a role',async()=>{
 const f=fixture();const send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>url.includes('/rest/v1/orkto_workspace_members')?Response.json([]):send(url,init);
 const r=await runGoogleAbTransport(f.config);
 assert.ok(r.records.some(v=>v.test==='A_EXISTING_APPROVED_MEMBERSHIP'&&v.status==='FAIL'));
 assert.ok(!f.calls.some(v=>v.url.startsWith(T.preview)||v.url.includes('/functions/')));
});

function writeFixture({leak=false,timeout=false,concurrent=false}={}){
 const f=fixture(),send=f.config.fetchImpl;
 const rows=['A','B'].map((actor,i)=>({id:`${i?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}`,
   workspace_id:T.actors[actor],name:`ORKTO-G06-${actor}`,archived_at:null,updated_at:'baseline',notes:null}));
 const initial=structuredClone(rows);let inspections=0,writes=0;
 f.config.crossTenantWrites={...Object.fromEntries(['A','B'].map((actor,i)=>[actor,{id:rows[i].id,ownerApproved:true,exclusivelySynthetic:true}])),
   inspect:async({project,ids})=>{assert.equal(project,'ghrjongiodziasupakrk');assert.deepEqual(ids,rows.map(v=>v.id));inspections++;return structuredClone(rows);}};
 f.config.fetchImpl=async(url,init)=>{
  const u=new URL(url),edge=u.pathname.startsWith('/functions/');
  const body=init.body?JSON.parse(init.body):{};
  const mutation=init.method==='PATCH'||edge&&body.command==='UPDATE_CLIENT';
  if(!u.pathname.startsWith('/api/clients/')&&u.pathname!=='/rest/v1/clients'&&!(edge&&mutation))return send(url,init);
  const subject=JSON.parse(Buffer.from(init.headers.authorization.split('.')[1],'base64url').toString()).sub;
  const id=edge?body.payload.clientId:u.pathname.startsWith('/api/')?u.pathname.split('/').at(-1):u.searchParams.get('id').slice(3);
  const row=rows.find(v=>v.id===id);assert.ok(row);
  if(!mutation)return Response.json({data:structuredClone(row)});
  writes++;
  if(row.workspace_id===subject){row.name=body.name;row.updated_at='restored';return Response.json({data:row});}
  if(leak){row.name=edge?body.payload.changes.name:body.name;row.updated_at='tampered';}
  if(concurrent)row.notes='concurrent-change';
  if(timeout)throw new Error('ambiguous timeout');
  if(u.pathname==='/rest/v1/clients'){assert.equal(init.headers.prefer,'return=representation');return Response.json([]);}
  if(init.headers['x-orkto-workspace']!==subject)return Response.json(edge?{code:'WORKSPACE_ACCESS_DENIED'}:{category:'workspace_access_denied'},{status:403});
  return Response.json(edge?{code:'NOT_FOUND'}:{category:'NOT_FOUND'},{status:404});
 };
 return {...f,rows,initial,counts:()=>({inspections,writes})};
}

test('G06 attempts API, Edge, forged workspace and PostgREST writes in both directions, independently observes every result',async()=>{
 const f=writeFixture();const r=await runGoogleAbTransport(f.config);
 assert.ok(!r.records.some(v=>v.status==='FAIL'));
 assert.equal(r.records.filter(v=>v.test.includes('_G06_')&&!v.test.endsWith('_UNCHANGED')&&!v.test.endsWith('_LIVE_SESSION')&&v.status==='PASS').length,10);
 assert.equal(r.records.filter(v=>v.test.endsWith('_UNCHANGED')&&v.status==='PASS').length,10);
 assert.deepEqual(f.rows,f.initial);assert.deepEqual(f.counts(),{inspections:11,writes:10});
 assert.ok(!JSON.stringify(r).includes('ORKTO-G06-'));
});

test('G06 refuses unapproved, nonsynthetic, duplicate or unobserved fixtures before acquiring credentials',async()=>{
 for(const mutate of [f=>{f.config.crossTenantWrites.A.ownerApproved=false;},f=>{f.config.crossTenantWrites.B.exclusivelySynthetic=false;},
  f=>{f.config.crossTenantWrites.B.id=f.config.crossTenantWrites.A.id;},f=>{delete f.config.crossTenantWrites.inspect;}]){
  const f=writeFixture();mutate(f);let acquired=false;f.config.acquireContexts=async()=>{acquired=true;return f.contexts;};
  const r=await runGoogleAbTransport(f.config);assert.equal(acquired,false);assert.equal(f.counts().writes,0);assert.ok(r.records.some(v=>v.status==='FAIL'));
 }
});

test('G06 persisted leakage fails despite denial response, restores only the approved field and stops writes',async()=>{
 const f=writeFixture({leak:true});const r=await runGoogleAbTransport(f.config);
 assert.ok(r.records.some(v=>v.test==='A_G06_API_OWN_HEADER_UNCHANGED'&&v.status==='FAIL'));
 assert.ok(r.records.some(v=>v.test==='G06_AUTHORIZED_FIELD_RESTORATION'&&v.status==='PASS'));
 assert.equal(f.rows[1].name,f.initial[1].name);assert.equal(f.counts().writes,2);
});

test('G06 checks persistence after ambiguous transport errors and never overwrites unrelated changes',async()=>{
 for(const concurrent of [false,true]){
  const f=writeFixture({leak:true,timeout:true,concurrent});const r=await runGoogleAbTransport(f.config);
  assert.ok(r.records.some(v=>v.test==='A_G06_API_OWN_HEADER_UNCHANGED'&&v.status==='FAIL'));
  if(concurrent){assert.ok(r.records.some(v=>v.test==='G06_MANUAL_RECOVERY_REQUIRED'));assert.equal(f.counts().writes,1);}
  else assert.ok(r.records.some(v=>v.test==='G06_AUTHORIZED_FIELD_RESTORATION'));
 }
});

test('G06 missing baseline, unknown denial and observer outage never become PASS',async()=>{
 for(const mode of ['baseline','denial','observer']){
  const f=writeFixture();const send=f.config.fetchImpl;const inspect=f.config.crossTenantWrites.inspect;
  if(mode==='baseline')f.rows[0].name='real-business';
  if(mode==='observer')f.config.crossTenantWrites.inspect=async arg=>{if(f.counts().writes)throw new Error('unavailable');return inspect(arg);};
  if(mode==='denial')f.config.fetchImpl=async(url,init)=>init.method==='PATCH'?Response.json({},{status:404}):send(url,init);
  const r=await runGoogleAbTransport(f.config);assert.ok(r.records.some(v=>v.status==='FAIL'));
  assert.ok(!r.records.some(v=>v.test==='A_G06_API_OWN_HEADER'&&v.status==='PASS'));
 }
});

function reuseFixture({allowAncestor=false,parentDenied=false,keepFamily=false,interval=10}={}){
 const f=fixture(),send=f.config.fetchImpl,revoked=new Set(),active={A:0,B:0},used=new Map(),events=[];
 const rt=(a,n)=>`fixture-refresh-${a}-${n}`;
 const session=actor=>({access_token:jwt({sub:T.actors[actor],role:'authenticated',iss:`${T.supabase}/auth/v1`,
   session_id:`session-${actor}`,amr:[{method:'oauth'}],exp:Math.floor(f.config.now()/1000)+300}),refresh_token:rt(actor,active[actor])});
 f.config.refreshReuse=true;f.config.verifyRefreshPolicy=async()=>({project:'ghrjongiodziasupakrk',rotationEnabled:true,reuseIntervalSeconds:interval});
 f.config.fetchImpl=async(url,init)=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/token'){
   assert.equal(init.headers.authorization,undefined);const supplied=JSON.parse(init.body).refresh_token;
   const actor=supplied.includes('-A-')?'A':'B',generation=Number(supplied.split('-').at(-1));
   events.push({actor,generation,active:active[actor],at:f.config.now()});
   if(revoked.has(actor))return Response.json({error_code:'refresh_token_not_found'},{status:400});
   if(generation===active[actor]){used.set(supplied,f.config.now());active[actor]++;return Response.json(session(actor));}
   const within=f.config.now()-(used.get(supplied)??-Infinity)<=interval*1000;
   if(within||generation===active[actor]-1&&!parentDenied||allowAncestor)return Response.json(session(actor));
   if(!keepFamily)revoked.add(actor);
   return Response.json({error_code:'refresh_token_already_used'},{status:400});
  }
  let subject;try{subject=JSON.parse(Buffer.from(init.headers.authorization.split('.')[1],'base64url').toString()).sub;}catch{/* no bearer */}
  const actor=subject===T.actors.A?'A':'B';
  if(revoked.has(actor)){
   if(u.pathname.endsWith('/orkto_google_pilot_session_allowed'))return Response.json(false);
   if(u.pathname.startsWith('/rest/'))return Response.json([]);
   if(u.pathname.startsWith('/api/'))return Response.json({category:'pilot_access_denied'},{status:403});
   return Response.json({},{status:401});
  }
  return send(url,init);
 };
 return {...f,events};
}

test('G08 accepts legitimate parent outside the interval, rejects older ancestor and proves family revocation for A/B',async()=>{
 const f=reuseFixture();const r=await runGoogleAbTransport(f.config);
 assert.ok(!r.records.some(v=>v.status==='FAIL'));
 for(const actor of ['A','B'])for(const phase of ['PARENT_EXCEPTION','ANCESTOR_REJECTED','FAMILY_REVOKED','SESSION_GUARD'])
  assert.ok(r.records.some(v=>v.test===`${actor}_G08_${phase}`&&v.status==='PASS'));
 for(const actor of ['A','B']){
  const requests=f.events.filter(v=>v.actor===actor);
  assert.deepEqual(requests.map(v=>v.generation),[0,1,1,0,2]);
  assert.ok(requests[2].at-requests[1].at>10_000);
  assert.ok(requests[3].at-requests[2].at>10_000);
 }
 assert.ok(!JSON.stringify(r).includes('fixture-refresh'));
 assert.ok(!f.calls.some(v=>v.url.includes('/logout')));
});

test('G08 wrong or unknown policy is blocked; it never assumes the default reuse interval',async()=>{
 for(const policy of [null,{project:'wrong',rotationEnabled:true,reuseIntervalSeconds:10},
  {project:'ghrjongiodziasupakrk',rotationEnabled:false,reuseIntervalSeconds:10},
  {project:'ghrjongiodziasupakrk',rotationEnabled:true,reuseIntervalSeconds:121}]){
  const f=reuseFixture();f.config.verifyRefreshPolicy=async()=>policy;
  const r=await runGoogleAbTransport(f.config);
  assert.ok(r.records.some(v=>v.test==='REFRESH_REUSE_VERIFIED_POLICY_REQUIRED'&&v.status==='BLOCKED_EXTERNAL'));
  assert.deepEqual(f.events.map(v=>v.generation),[0,0]);
 }
});

test('G08 detects accepted ancestor, broken parent exception and nonrevoked active family',async()=>{
 for(const options of [{allowAncestor:true},{parentDenied:true},{keepFamily:true}]){
  const f=reuseFixture(options);const r=await runGoogleAbTransport(f.config);
  assert.ok(r.records.some(v=>v.test.includes('_G08_')&&v.status==='FAIL'));
  assert.ok(r.records.some(v=>v.test==='EXECUTOR_BOUNDARY_OR_TRANSPORT'&&v.status==='FAIL'));
 }
});

test('G08 and explicit logout cannot compete for the same sessions',async()=>{
 const f=reuseFixture();let acquired=false;f.config.acquireContexts=async()=>{acquired=true;return f.contexts;};
 const r=await runGoogleAbTransport({...f.config,revokeCurrentSessions:true});
 assert.equal(acquired,false);assert.equal(f.events.length,0);assert.ok(r.records.some(v=>v.status==='FAIL'));
});

test('G08 refuses a wait longer than JWT lifetime rather than confusing expiry with reuse revocation',async()=>{
 const f=reuseFixture({interval:120}),send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>{
  const r=await send(url,init);if(!url.includes('/auth/v1/token')||r.status!==200)return r;
  const body=await r.json(),c=JSON.parse(Buffer.from(body.access_token.split('.')[1],'base64url').toString());
  body.access_token=jwt({...c,exp:Math.floor(f.config.now()/1000)+60});return Response.json(body);
 };
 const r=await runGoogleAbTransport(f.config);
 assert.equal(r.records.filter(v=>v.test.endsWith('_G08_JWT_LIFETIME_REQUIRED')&&v.status==='BLOCKED_EXTERNAL').length,2);
 assert.ok(!r.records.some(v=>v.test.endsWith('_G08_ANCESTOR_REJECTED')));
});

test('G06 expired/revoked actor cannot certify tenant denial even if rows stay unchanged',async()=>{
 const f=writeFixture(),send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>url.endsWith('/orkto_google_pilot_session_allowed')?Response.json(false):send(url,init);
 const r=await runGoogleAbTransport(f.config);
 assert.equal(f.counts().writes,0);assert.ok(r.records.some(v=>v.status==='FAIL'));
 assert.ok(!r.records.some(v=>v.test.endsWith('_G06_API_OWN_HEADER')&&v.status==='PASS'));
});

test('G08 uses the verified interval including zero/custom values rather than a hardcoded ten seconds',async()=>{
 for(const interval of [0,17]){
  const f=reuseFixture({interval});const r=await runGoogleAbTransport(f.config);
  assert.ok(!r.records.some(v=>v.status==='FAIL'));
  const a=f.events.filter(v=>v.actor==='A');assert.ok(a[3].at-a[2].at>interval*1000);
 }
});

test('G08 arbitrary provider error is not evidence of rejected reuse or family revocation',async()=>{
 const f=reuseFixture(),send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>{
  if(url.includes('/auth/v1/token')&&JSON.parse(init.body).refresh_token==='fixture-refresh-A-0'
    &&f.events.some(v=>v.actor==='A'&&v.active===2))return Response.json({error_code:'rate_limited'},{status:429});
  return send(url,init);
 };
 const r=await runGoogleAbTransport(f.config);
 assert.ok(r.records.some(v=>v.test==='A_G08_ANCESTOR_REJECTED'&&v.status==='FAIL'));
 assert.ok(!r.records.some(v=>v.test==='A_G08_FAMILY_REVOKED'));
});

test('G06 failed restoration remains FAIL and cannot hide a persisted unauthorized change',async()=>{
 const f=writeFixture({leak:true}),send=f.config.fetchImpl;
 f.config.fetchImpl=async(url,init)=>init.method==='PATCH'&&JSON.parse(init.body).name==='ORKTO-G06-B'
  ?Response.json({category:'unavailable'},{status:503}):send(url,init);
 const r=await runGoogleAbTransport(f.config);
 assert.ok(r.records.some(v=>v.test==='G06_AUTHORIZED_FIELD_RESTORATION'&&v.status==='FAIL'));
 assert.notEqual(f.rows[1].name,f.initial[1].name);assert.equal(r.readyForProductionCandidate,'NO');
});
