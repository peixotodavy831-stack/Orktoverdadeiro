import {useEffect,useState}from'react';
import {ArrowRight,BrainCircuit,CreditCard,MessageCircle,RefreshCw,ShieldCheck}from'lucide-react';
import{ErrorState,LoadingState,PageHeader,StatusBadge}from'../ui/shared-states';
import type{ProductView}from'../types';

type Connection={status:string;display_phone_number:string|null;verified_name:string|null;coexistence_state:string;service_mode:'manual'|'assisted'|'controlled';verified_at:string|null};
type Controls={human_takeover:boolean;monthly_message_limit:number|null;monthly_cost_limit_micros:number|null;currency:string;block_on_unpriced:boolean};
interface WhatsAppStatus{state:string;connected:boolean;runtimeConfigured:boolean;connection:Connection|null;controls:Controls|null}
interface Status{wia:{provider:string;model:string;state:string;testingOnly:boolean};whatsapp:WhatsAppStatus;billing:{state:string;checkoutEnabled:boolean};canManage:boolean}
interface StartConfig{appId:string;configId:string;graphVersion:string;redirectUri:string|null}
type ApiRequest=(path:string,init?:RequestInit)=>Promise<any>;
type MetaSdk={init:(config:{appId:string;cookie:boolean;xfbml:boolean;version:string})=>void;login:(callback:(value:{authResponse?:{code?:string}})=>void,options:Record<string,unknown>)=>void};

async function loadMetaSdk(config:StartConfig):Promise<MetaSdk>{
 const host=window as typeof window&{FB?:MetaSdk};
 if(host.FB){host.FB.init({appId:config.appId,cookie:true,xfbml:false,version:config.graphVersion});return host.FB}
 await new Promise<void>((resolve,reject)=>{
  const existing=document.getElementById('meta-jssdk') as HTMLScriptElement|null;
  const ready=()=>host.FB?resolve():reject(new Error('META_SDK_UNAVAILABLE'));
  if(existing){existing.addEventListener('load',ready,{once:true});setTimeout(ready,1000);return}
  const script=document.createElement('script');script.id='meta-jssdk';script.async=true;script.defer=true;
  script.src='https://connect.facebook.net/pt_BR/sdk.js';script.onload=ready;script.onerror=()=>reject(new Error('META_SDK_UNAVAILABLE'));
  document.head.appendChild(script);
 });
 if(!host.FB)throw new Error('META_SDK_UNAVAILABLE');
 host.FB.init({appId:config.appId,cookie:true,xfbml:false,version:config.graphVersion});return host.FB;
}

async function embeddedSignup(config:StartConfig){
 const sdk=await loadMetaSdk(config);let session:{businessId:string|null;wabaId:string;phoneNumberId:string}|null=null;
 const receive=(event:MessageEvent)=>{
  if(event.origin!=='https://www.facebook.com'&&event.origin!=='https://web.facebook.com')return;
  let value:unknown=event.data;try{if(typeof value==='string')value=JSON.parse(value)}catch{return}
  const body=value as {type?:unknown;event?:unknown;data?:Record<string,unknown>};
  if(body?.type!=='WA_EMBEDDED_SIGNUP'||body.event!=='FINISH'||!body.data)return;
  const wabaId=body.data.waba_id,phoneNumberId=body.data.phone_number_id,businessId=body.data.business_id;
  if(typeof wabaId==='string'&&typeof phoneNumberId==='string'&&(businessId==null||typeof businessId==='string'))
    session={businessId:typeof businessId==='string'?businessId:null,wabaId,phoneNumberId};
 };
 window.addEventListener('message',receive);
 try{
  const code=await new Promise<string>((resolve,reject)=>sdk.login(value=>{
   const result=value.authResponse?.code;result?resolve(result):reject(new Error('META_SIGNUP_CANCELLED'));
  },{config_id:config.configId,response_type:'code',override_default_response_type:true,extras:{setup:{}}}));
  for(let attempt=0;attempt<50&&!session;attempt++)await new Promise(resolve=>setTimeout(resolve,100));
  if(!session)throw new Error('META_SESSION_INCOMPLETE');
  return{code,...session,coexistenceState:'not_requested' as const};
 }finally{window.removeEventListener('message',receive)}
}

export default function IntegrationsPage({request,onNavigate}:{request:ApiRequest;onNavigate:(view:ProductView)=>void}){
 const[data,setData]=useState<Status|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState(false);const[revision,setRevision]=useState(0);
 const[working,setWorking]=useState(false);const[actionError,setActionError]=useState('');
 useEffect(()=>{let alive=true;setLoading(true);setError(false);request('/api/integrations/status').then(value=>{const result=value as {data:Status};if(!result.data?.wia||!result.data.whatsapp||!result.data.billing)throw new Error('INVALID_RESPONSE');if(alive)setData(result.data);}).catch(()=>{if(alive)setError(true);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[request,revision]);
 const connect=async()=>{setWorking(true);setActionError('');try{
  const start=await request('/api/integrations/whatsapp/start',{method:'POST',headers:{'x-idempotency-key':crypto.randomUUID()},body:'{}'}) as {data:StartConfig};
  const completed=await embeddedSignup(start.data);
  await request('/api/integrations/whatsapp/complete',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':crypto.randomUUID()},body:JSON.stringify(completed)});
  setRevision(value=>value+1);
 }catch{setActionError('A conexão não foi concluída. Nenhum número foi ativado; revise a configuração da Meta e tente novamente.')}finally{setWorking(false)}};
 const setMode=async(mode:'manual'|'assisted'|'controlled',humanTakeover:boolean)=>{setWorking(true);setActionError('');try{
  await request('/api/integrations/whatsapp/mode',{method:'PATCH',headers:{'content-type':'application/json','x-idempotency-key':crypto.randomUUID()},body:JSON.stringify({mode,humanTakeover})});setRevision(value=>value+1);
 }catch{setActionError('Não foi possível confirmar o modo de atendimento.')}finally{setWorking(false)}};
 const action='mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold';const whatsapp=data?.whatsapp;
 return <div className="orkto-product mx-auto max-w-[1100px] space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8"><PageHeader title="Integrações" description="Conecte serviços oficiais e mantenha o controle humano da operação." actions={<button type="button" disabled={loading||working} onClick={()=>setRevision(value=>value+1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm orkto-product-control"><RefreshCw size={16} aria-hidden="true" />Atualizar</button>} />
 {loading?<LoadingState rows={3} label="Consultando integrações" />:error?<ErrorState message="Não foi possível consultar os serviços. Confira sua sessão e tente novamente." onRetry={()=>setRevision(value=>value+1)} />:data&&<div className="grid gap-5 lg:grid-cols-2">
 <section className="rounded-2xl border p-6 orkto-product-border orkto-product-surface"><MessageCircle size={24} className="mb-5" aria-hidden="true" /><h2 className="mb-3 text-lg font-semibold">Seu WhatsApp Business</h2><StatusBadge tone={whatsapp?.connected?'success':'attention'}>{whatsapp?.connected?'Conectado oficialmente':whatsapp?.runtimeConfigured?'Pronto para conectar':'Configuração externa pendente'}</StatusBadge>
 {whatsapp?.connected&&whatsapp.connection?<><p className="mt-4 font-semibold">{whatsapp.connection.verified_name||'Empresa verificada'}</p><p className="mt-1 text-sm orkto-product-muted">{whatsapp.connection.display_phone_number||'Número protegido'} · coexistência: {whatsapp.connection.coexistence_state}</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{(['manual','assisted','controlled']as const).map(mode=><button key={mode} type="button" disabled={working||!data.canManage} onClick={()=>setMode(mode,whatsapp.controls?.human_takeover||false)} className={`min-h-11 rounded-xl border px-3 text-sm ${whatsapp.connection?.service_mode===mode?'orkto-product-accent':'orkto-product-control'}`}>{mode==='manual'?'Manual':mode==='assisted'?'Assistido':'Controlado'}</button>)}</div><label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={whatsapp.controls?.human_takeover||false} disabled={working||!data.canManage} onChange={event=>void setMode(whatsapp.connection!.service_mode,event.target.checked)} />Pausa humana ativa</label><p className="mt-4 text-xs leading-6 orkto-product-muted">Custos não precificados permanecem bloqueados. A ORKTO não envia mensagens automaticamente durante a pausa humana.</p></>:<><p className="mt-4 text-sm leading-7 orkto-product-muted">A conexão usa o Embedded Signup oficial da Meta. O número e a conta empresarial são validados no provedor; credenciais permanecem no servidor.</p><p className="mt-3 text-sm leading-7 orkto-product-muted">A continuidade no aplicativo do celular depende da elegibilidade de coexistência confirmada pela Meta para a sua conta.</p><button type="button" disabled={working||!data.canManage||!whatsapp?.runtimeConfigured} onClick={()=>void connect()} className={`${action} px-4 orkto-product-accent`}>{working?'Conectando…':'Conectar meu WhatsApp'} <ArrowRight size={16} aria-hidden="true" /></button></>}
 {actionError&&<p role="alert" className="mt-4 text-sm text-red-400">{actionError}</p>}</section>
 <section className="rounded-2xl border p-6 orkto-product-border orkto-product-surface"><BrainCircuit size={24} className="mb-5" aria-hidden="true" /><h2 className="mb-3 text-lg font-semibold">Inteligência da WIA</h2><StatusBadge tone={data.wia.state==='configuration_required'?'attention':'info'}>{data.wia.state==='configuration_required'?'IA conversacional não configurada':'Configurada · validação pendente'}</StatusBadge><p className="mt-4 text-sm leading-7 orkto-product-muted">Consultas determinísticas seguem as ferramentas autorizadas. Gemini é provisório para testes conversacionais; cada rascunho exige revisão humana antes de qualquer ação externa.</p><p className="mt-3 text-xs orkto-product-muted">Provedor selecionado: {data.wia.provider} · {data.wia.model}</p><button type="button" onClick={()=>onNavigate('wia')} className={action} style={{color:'var(--orkto-brand-text)'}}>Abrir WIA <ArrowRight size={16} aria-hidden="true" /></button></section>
 <section className="rounded-2xl border p-6 orkto-product-border orkto-product-surface lg:col-span-2"><CreditCard size={24} className="mb-5" aria-hidden="true" /><h2 className="mb-3 text-lg font-semibold">Planos e pagamentos</h2><StatusBadge tone="attention">Checkout indisponível</StatusBadge><p className="mt-4 max-w-2xl text-sm leading-7 orkto-product-muted">Você pode consultar o plano e o uso da empresa. A contratação exige condições comerciais aprovadas e um provedor de pagamento configurado e validado. Nenhuma cobrança é criada nesta tela.</p><div className="mt-4 flex items-center gap-2 text-xs orkto-product-muted"><ShieldCheck size={15}/>Nenhuma cobrança ou mensagem real é criada durante a configuração.</div><button type="button" onClick={()=>onNavigate('billing')} className={action} style={{color:'var(--orkto-brand-text)'}}>Consultar meu plano <ArrowRight size={16} aria-hidden="true" /></button></section>
 </div>}
 </div>;
}
