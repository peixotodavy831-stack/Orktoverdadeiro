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
