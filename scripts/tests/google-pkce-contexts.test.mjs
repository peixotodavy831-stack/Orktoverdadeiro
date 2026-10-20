import test from 'node:test';
import assert from 'node:assert/strict';
import {googlePkceContexts} from '../readiness/google-pkce-contexts.mjs';
import {GOOGLE_AB_TARGET as T} from '../readiness/google-ab-transport.mjs';

function setup({wrongIdentity=false,repeated=false,wrongCallback=false,wrongOAuth=false,exchangeError=false}={}){
 const events=[],storages=[],sdkOptions=[],created=[],closed=[];let browserClosed=false;
 const verifyDeployment=async()=>({deployment:{projectId:'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',url:new URL(T.preview).hostname,
   target:null,readyState:'READY',meta:{githubCommitSha:T.sha}}});
 const launchBrowser=async options=>{
  assert.equal(options.headless,false);assert.equal(options.channel,'chrome');
  return {newContext:async()=>{
   const actor=created.length?'B':'A';let handler;const frame={};
   const context={newPage:async()=>({mainFrame:()=>frame,goto:async()=>{
    const request={url:()=>`${T.preview}/${wrongCallback?'bad':''}?code=fixture-code-${actor}`,isNavigationRequest:()=>true,frame:()=>frame};
    const route={request:()=>request,abort:async()=>{},fulfill:async value=>{assert.ok(!value.body.includes('fixture-code'));}};
    await handler(route);if(repeated)await handler(route);
   }}),route:async(matcher,fn)=>{assert.equal(matcher(new URL(T.preview)),true);handler=fn;},close:async()=>{closed.push(actor);}};
   created.push(context);return context;
  },close:async()=>{browserClosed=true;}};
 };
 const sdkFactory=(url,key,options)=>{
  assert.equal(url,T.supabase);assert.equal(key,'sb_publishable_fixture');
  sdkOptions.push(options);storages.push(options.auth.storage);const actor=sdkOptions.length===1?'A':'B';
  options.auth.storage.setItem('verifier',`private-verifier-${actor}`);
  return {auth:{stopAutoRefresh:async()=>{},signInWithOAuth:async input=>{
   assert.equal(input.provider,'google');assert.equal(input.options.skipBrowserRedirect,true);assert.equal(input.options.redirectTo,`${T.preview}/`);
   return {data:{url:`${wrongOAuth?'https://foreign.invalid':T.supabase}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(T.preview+'/')}&code_challenge_method=s256&code_challenge=fixture-challenge`}};
  },exchangeCodeForSession:async code=>{
   assert.equal(code,`fixture-code-${actor}`);assert.equal(options.auth.storage.getItem('verifier'),`private-verifier-${actor}`);
   if(exchangeError)return {error:new Error('unsafe fixture-code token diagnostic')};
   return {data:{user:{id:wrongIdentity?T.actors[actor==='A'?'B':'A']:T.actors[actor],identities:[{provider:'google'}]},
    session:{access_token:`fixture-access-${actor}`,refresh_token:`fixture-refresh-${actor}`}}};
  }}};
 };
 return {config:{publicKey:'sb_publishable_fixture',verifyDeployment,sdkFactory,launchBrowser,executionMode:'FIXTURE',onPhase:e=>events.push(e)},
  events,storages,sdkOptions,created,closed,browserClosed:()=>browserClosed};
}

test('normal Google PKCE exchange owns two separate contexts, verifiers and memory stores; no session extraction',async()=>{
 const f=setup(),executor=googlePkceContexts(f.config),contexts=await executor.acquireContexts();
 assert.equal(contexts.length,2);assert.notEqual(contexts[0].contextId,contexts[1].contextId);assert.notEqual(f.created[0],f.created[1]);
 assert.notEqual(f.storages[0],f.storages[1]);
 for(const options of f.sdkOptions){assert.equal(options.auth.autoRefreshToken,false);assert.equal(options.auth.detectSessionInUrl,false);assert.equal(options.auth.flowType,'pkce');}
 assert.deepEqual(contexts.map(c=>c.actor),['A','B']);
 assert.ok(!JSON.stringify(f.events).includes('fixture-access'));assert.ok(!JSON.stringify(f.events).includes('fixture-code'));
 await executor.close();assert.deepEqual(f.closed,['A','B']);assert.equal(f.browserClosed(),true);
 assert.ok(f.storages.every(s=>s.getItem('verifier')===null));assert.ok(contexts.every(c=>c.session===null));
});

test('wrong deployment never starts a browser or initiates OAuth',async()=>{
 const f=setup();f.config.verifyDeployment=async()=>({deployment:{projectId:'production'}});
 const executor=googlePkceContexts(f.config);await assert.rejects(executor.acquireContexts(),/^Error: GOOGLE_PKCE_ACQUISITION_FAILED$/);
 assert.equal(f.created.length,0);
});

test('callback path, identity, OAuth origin and exchange failure are closed without credential-bearing errors',async()=>{
 for(const options of [{wrongIdentity:true},{wrongCallback:true},{wrongOAuth:true},{exchangeError:true}]){
  const f=setup(options),executor=googlePkceContexts(f.config);
  await assert.rejects(executor.acquireContexts(),error=>error.message==='GOOGLE_PKCE_ACQUISITION_FAILED');
  assert.equal(f.browserClosed(),true);assert.ok(f.storages.every(s=>s.getItem('verifier')===null));
 }
});

test('elevated key, fixture dependencies in STAGING, missing inspector and unsafe timeout are refused',()=>{
 for(const patch of [{publicKey:'sb_secret_fixture'},{executionMode:'STAGING'},{verifyDeployment:null},{loginTimeoutMs:3600000}]){
  const f=setup();assert.throws(()=>googlePkceContexts({...f.config,...patch}),/GOOGLE_PKCE_ACQUISITION_FAILED/);
 }
});

test('SDK HTTP boundary cannot send credentials to another origin',async()=>{
 const f=setup(),executor=googlePkceContexts(f.config);await executor.acquireContexts();
 assert.throws(()=>f.sdkOptions[0].global.fetch('https://foreign.invalid/auth/v1/token',{}),/GOOGLE_PKCE_ACQUISITION_FAILED/);
 await executor.close();
});
