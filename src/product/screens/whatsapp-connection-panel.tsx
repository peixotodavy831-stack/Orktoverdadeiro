import {useEffect,useState} from 'react';
import {MessageCircle,RefreshCw} from 'lucide-react';
import {StatusBadge} from '../ui/shared-states.js';
import {whatsappConnectionPresentation,type WhatsAppConnectionSnapshot} from '../whatsapp-connection-state.js';

export function WhatsAppConnectionPanel({snapshot,canManage,busy,error,onConnect,onVerify,onMode,onDisconnect,continueInMeta=false}:{
 snapshot:WhatsAppConnectionSnapshot;canManage:boolean;busy:boolean;error:string;
 onConnect:()=>void;onVerify:()=>void;onMode:(mode:'manual'|'assisted'|'controlled',takeover:boolean)=>void;
 continueInMeta?:boolean;
 onDisconnect?:()=>void;
}){
 const[now,setNow]=useState(Date.now());
 const[confirmDisconnect,setConfirmDisconnect]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const view=whatsappConnectionPresentation(snapshot,Math.max(now,Date.now()));
 const connection=snapshot.connection;
 const coexistence:Record<string,string>={unknown:'Não confirmada',not_requested:'Não solicitada',eligible:'Elegível',enabled:'Confirmada pela Meta',ineligible:'Não elegível'};
 return <section aria-labelledby="whatsapp-connection-title" className="rounded-2xl border p-6 orkto-product-border orkto-product-surface">
  <MessageCircle size={24} className="mb-5" aria-hidden="true"/>
  <h2 id="whatsapp-connection-title" className="mb-3 text-lg font-semibold">Seu WhatsApp Business</h2>
  <div aria-live="polite"><StatusBadge tone={busy?'info':view.verified?'success':'attention'}>{busy?'Verificando ou conectando…':view.label}</StatusBadge></div>
  {connection&&<div className="mt-4 space-y-1"><p className="font-semibold">{connection.verified_name||'Conta empresarial'}</p><p className="text-sm orkto-product-muted">{connection.display_phone_number||'Número não confirmado'}</p><p className="text-xs orkto-product-muted">Coexistência no celular: {coexistence[connection.coexistence_state]||'Não confirmada'}</p></div>}
  <p className="mt-4 text-sm leading-6 orkto-product-muted">{view.state==='configuration_required'?'A conexão ainda não foi liberada nesta instalação. O responsável pela ORKTO precisa concluir a configuração antes de você conectar sua conta. Não informe chaves ou tokens nesta tela.':view.state==='authentication_error'?'A Meta recusou a credencial ou a permissão. Reconecte a conta para renovar o acesso.':view.verified?'A consulta confirmou a conta e o vínculo do número. Recebimento, envio e entrega precisam de validação própria.':'Uma configuração salva não confirma que o canal está disponível. Verifique o vínculo no provedor ou reconecte a conta.'}</p>
  {connection?.verified_at&&<p className="mt-2 text-xs orkto-product-muted">Última verificação retornada: {Number.isFinite(Date.parse(connection.verified_at))?new Date(connection.verified_at).toLocaleString('pt-BR'):'Data inválida'}. A indicação expira após cinco minutos.</p>}
  <details className="mt-4 rounded-xl border p-4 text-sm orkto-product-border"><summary className="min-h-11 cursor-pointer font-semibold">Como conectar meu WhatsApp?</summary><ol className="list-decimal space-y-2 pl-5 leading-6 orkto-product-muted"><li>Use uma conta com papel de proprietário ou administrador na empresa.</li><li>Com a conexão liberada, clique em Conectar meu WhatsApp e continue na Meta.</li><li>Escolha sua conta empresarial e o número, revise as permissões e volte para verificar a conexão.</li></ol><p className="mt-3 orkto-product-muted">Se o botão estiver desabilitado, a configuração da instalação ou sua permissão ainda precisa ser resolvida. Uma conta conectada não comprova envio ou entrega.</p></details><div className="mt-4 flex flex-wrap gap-2">
   <button type="button" disabled={busy||!canManage||!snapshot.runtimeConfigured} onClick={onConnect} className="min-h-11 rounded-lg px-4 text-sm font-semibold orkto-product-accent disabled:opacity-50">{continueInMeta?'Continuar na Meta':connection?'Reconectar conta':'Conectar meu WhatsApp'}</button>
   {connection&&<button type="button" disabled={busy||!canManage||!snapshot.runtimeConfigured} onClick={onVerify} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm orkto-product-border disabled:opacity-50"><RefreshCw size={15} aria-hidden="true"/>Verificar conexão</button>}
   {connection&&onDisconnect&&view.state!=='disconnected'&&<button type="button" disabled={busy||!canManage} onClick={()=>setConfirmDisconnect(true)} className="min-h-11 rounded-lg border px-3 text-sm orkto-product-border disabled:opacity-50">Desconectar da ORKTO</button>}
  </div>
  {continueInMeta&&<p className="mt-2 text-xs orkto-product-muted">Preparação concluída. Clique para abrir o login oficial da Meta; conclua a autenticação e as permissões diretamente no provedor.</p>}
  {confirmDisconnect&&<div role="group" aria-label="Confirmar desconexão" className="mt-4 space-y-3 rounded-lg border p-3 orkto-product-border"><p className="text-sm leading-6">Isso bloqueia novos envios pela ORKTO. Envios pendentes precisam ser conciliados antes. A permissão do aplicativo na Meta não será revogada por esta ação.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>{setConfirmDisconnect(false);onDisconnect?.();}} className="min-h-11 rounded-lg border px-3 font-semibold orkto-product-border">Confirmar desconexão local</button><button type="button" onClick={()=>setConfirmDisconnect(false)} className="min-h-11 px-3">Cancelar</button></div></div>}
  {!canManage&&<p className="mt-2 text-xs orkto-product-muted">Somente proprietário e administrador podem conectar ou verificar a conta.</p>}
  {connection&&<div className="mt-5 border-t pt-4 orkto-product-border"><p className="text-sm font-semibold">Atendimento</p><div className="mt-2 flex flex-wrap gap-2">{(['manual','assisted','controlled'] as const).map(mode=><button key={mode} type="button" disabled={busy||!canManage||!view.verified} onClick={()=>onMode(mode,snapshot.controls?.human_takeover||false)} className={`min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50 ${connection.service_mode===mode?'orkto-product-accent':'orkto-product-control'}`}>{mode==='manual'?'Manual':mode==='assisted'?'Assistido':'Controlado'}</button>)}</div><label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={snapshot.controls?.human_takeover||false} disabled={busy||!canManage||!view.verified} onChange={event=>onMode(connection.service_mode,event.target.checked)}/>Pausa humana ativa</label></div>}
  <p className="mt-4 text-xs leading-5 orkto-product-muted">A implementação atual processa texto. Mídias, templates e automação completa ainda não estão disponíveis. Custos sem tarifa aprovada e envios durante a pausa humana continuam bloqueados.</p>
  {error&&<p role="alert" className="mt-4 text-sm orkto-product-muted">{error}</p>}
 </section>;
}
