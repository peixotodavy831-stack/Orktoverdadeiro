import {randomUUID} from 'node:crypto';
import {GOOGLE_AB_TARGET as T} from './google-ab-transport.mjs';
import {validateStagingPreviewDeployment} from './staging-e2e-config.mjs';

const launch=async options=>(await import('@playwright/test')).chromium.launch(options);
const sdk=async(...args)=>(await import('@supabase/supabase-js')).createClient(...args);
const rejected=()=>new Error('GOOGLE_PKCE_ACQUISITION_FAILED');
const hints=Object.freeze({A:'peixotodavy831@gmail.com',B:'grupocoller@gmail.com'});

/** Normal OAuth acquisition, never a session/profile extractor. The existing
 * approved Preview callback is handled by this same process/PKCE verifier.
 * No persistent context, cookies(), storageState(), traces, HAR or token logs. */
export function googlePkceContexts({publicKey,verifyDeployment,loginTimeoutMs=15*60_000,
  sdkFactory=sdk,launchBrowser=launch,executionMode='STAGING',onPhase=()=>{}}={}){
  if(!['STAGING','FIXTURE'].includes(executionMode)||typeof verifyDeployment!=='function'
    ||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey||'')
    ||!Number.isInteger(loginTimeoutMs)||loginTimeoutMs<1000||loginTimeoutMs>30*60_000
    ||executionMode==='STAGING'&&(sdkFactory!==sdk||launchBrowser!==launch)
    ||process.env.DEBUG||process.env.PWDEBUG)throw rejected();
  let browser;const owned=[];
  const phase=(actor,status)=>{try{onPhase({phase:'GOOGLE_PKCE',actor,status});}catch{/* reporter cannot expose errors */}};
  async function close(){
    for(const c of owned)await c.dispose().catch(()=>{});
    if(browser){await browser.close().catch(()=>{});browser=null;}
  }
  async function acquireContexts(){
    if(browser||owned.length)throw rejected();
    try{
      const identity=await verifyDeployment();
      if(!validateStagingPreviewDeployment(T.preview,identity?.deployment,identity?.deployments,T.sha).ok)throw rejected();
      browser=await launchBrowser({channel:'chrome',headless:false,
        env:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|temp|tmp|comspec|localappdata|programfiles|programfiles\(x86\))$/i.test(k)))});
      for(const actor of ['A','B']){
        const context=await browser.newContext({acceptDownloads:false,serviceWorkers:'block'});
        const memory=new Map();let disposed=false,consumed=false,timer;
        const client=await sdkFactory(T.supabase,publicKey,{auth:{flowType:'pkce',autoRefreshToken:false,
          detectSessionInUrl:false,persistSession:true,storageKey:`orkto-homologation-${randomUUID()}`,
          storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);},removeItem:k=>{memory.delete(k);}}},
          global:{fetch:(url,init)=>{
            const parsed=new URL(url);
            if(parsed.origin!==T.supabase||!parsed.pathname.startsWith('/auth/v1/'))throw rejected();
            return fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(30_000)});
          }}});
        const acquired={actor,contextId:randomUUID(),provenance:'google_pkce_memory',storage:'memory',autoRefresh:false,session:null,
          dispose:async()=>{if(disposed)return;disposed=true;clearTimeout(timer);memory.clear();acquired.session=null;
            try{await client.auth.stopAutoRefresh();}finally{await context.close().catch(()=>{});}}};
        owned.push(acquired);
        const page=await context.newPage();
        let resolveCallback,rejectCallback;
        const callback=new Promise((resolve,reject)=>{resolveCallback=resolve;rejectCallback=reject;});
        // Attach a rejection observer immediately, before page navigation can fail.
        callback.catch(()=>{});
        timer=setTimeout(()=>rejectCallback(rejected()),loginTimeoutMs);
        await context.route(url=>url.origin===T.preview,async route=>{
          try{
            const request=route.request(),url=new URL(request.url());
            if(!request.isNavigationRequest()||request.frame()!==page.mainFrame()||url.pathname!=='/'
              ||url.hash||url.searchParams.getAll('code').length!==1||consumed
              ||url.searchParams.has('error')||[...url.searchParams.keys()].some(k=>k!=='code'))throw rejected();
            const code=url.searchParams.get('code');if(!code||code.length>4096)throw rejected();
            consumed=true;
            // Exchange within the initiating SDK and its private in-memory verifier.
            const {data,error}=await client.auth.exchangeCodeForSession(code);
            if(disposed||error||data?.user?.id!==T.actors[actor]
              ||!data.user.identities?.some(i=>i.provider==='google')
              ||!data.session?.access_token||!data.session?.refresh_token)throw rejected();
            acquired.session={access_token:data.session.access_token,refresh_token:data.session.refresh_token};
            await route.fulfill({status:200,contentType:'text/html',headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
              body:'<!doctype html><title>ORKTO — autenticação concluída</title><p>Autenticação recebida pelo executor seguro. Nenhuma sessão foi exportada.</p>'});
            resolveCallback();
          }catch{await route.abort().catch(()=>{});rejectCallback(rejected());}
        });
        const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${T.preview}/`,
          skipBrowserRedirect:true,queryParams:{login_hint:hints[actor],prompt:'select_account'}}});
        const oauth=new URL(data?.url||T.preview);
        if(error||oauth.origin!==T.supabase||oauth.pathname!=='/auth/v1/authorize'
          ||oauth.searchParams.get('provider')!=='google'||oauth.searchParams.get('redirect_to')!==`${T.preview}/`
          ||oauth.searchParams.get('code_challenge_method')!=='s256'||!oauth.searchParams.get('code_challenge'))throw rejected();
        phase(actor,'HUMAN_GOOGLE_LOGIN_REQUIRED');
        await page.goto(oauth.href,{waitUntil:'domcontentloaded',timeout:60_000});
        await callback;clearTimeout(timer);phase(actor,'ACQUIRED');
      }
      return owned;
    }catch{await close();throw rejected();}
  }
  return {acquireContexts,close};
}

/** Local browser capability probe only. Does not open Google or touch any account. */
export async function probeGoogleBrowser(){
  let browser;
  try{
    browser=await launch({channel:'chrome',headless:true});
    const a=await browser.newContext(),b=await browser.newContext();
    const distinct=a!==b&&browser.contexts().length===2;
    await a.close();await b.close();
    return {scope:'LOCAL_BROWSER_CAPABILITY',browser:'chrome',isolatedContexts:distinct?'PASS':'FAIL',googleLogin:'NOT_TESTED',sessionExported:false};
  }catch{return {scope:'LOCAL_BROWSER_CAPABILITY',isolatedContexts:'BLOCKED_EXTERNAL',reason:'BROWSER_LAUNCH_UNAVAILABLE',googleLogin:'NOT_TESTED'};}
  finally{if(browser)await browser.close().catch(()=>{});}
}
