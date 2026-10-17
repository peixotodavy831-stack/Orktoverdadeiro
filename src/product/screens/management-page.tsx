import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import type { ProductView } from '../types';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../ui/shared-states';

interface Member { user_id:string; role:string; status:string; joined_at:string|null }
interface Invite { id:string; email:string; role:string; expires_at:string }
interface Team { members:Member[]; invites:Invite[]; currentRole:string; currentUserId:string }
interface AuditEvent { id:string; eventType:string; source:string; entityType:string|null; entityRef:string|null; actorId:string|null; occurredAt:string }
interface Props { view:'team'|'audit'|'help'; request:(path:string)=>Promise<unknown>; onNavigate:(view:ProductView)=>void; accountName?:string|null }
const roles:Record<string,string>={owner:'Proprietário',admin:'Administrador',manager:'Gestor',member:'Membro'};
const statuses:Record<string,string>={active:'Ativo',suspended:'Suspenso',invited:'Convidado',removed:'Removido',inactive:'Inativo'};
const sources:Record<string,string>={user:'Pessoa',human:'Pessoa',system:'Sistema',bot:'WIA',wia:'WIA'};
function date(value:string|null) { if(!value) return 'Não registrado';const time=new Date(value);return Number.isFinite(time.getTime()) ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(time) : 'Data indisponível'; }
const guides:Array<{title:string;body:string;view?:ProductView;action?:string}>= [
  {title:'Comece pela sua empresa',body:'Em Configurações, revise os dados comerciais, a profissão e a identidade usada nas propostas. As alterações dependem das permissões da sua conta.',view:'settings',action:'Abrir configurações'},
  {title:'Organize clientes e serviços',body:'Cadastre clientes em Clientes e seus serviços no Catálogo. Revise os dados antes de usá-los em uma proposta.',view:'clients',action:'Abrir clientes'},
  {title:'Crie e acompanhe uma proposta',body:'Use Propostas para criar seu orçamento, revisar os valores e acompanhar seu estado. Criar uma proposta não significa que ela foi enviada ou entregue ao cliente.',view:'quotes',action:'Abrir propostas'},
  {title:'Acompanhe a operação de hoje',body:'Hoje reúne os itens que precisam de atenção. Inbox organiza conversas e prioridades. A disponibilidade de canais externos depende de configuração e validação da integração.',view:'dashboard',action:'Abrir Hoje'},
  {title:'Trabalhe com a WIA',body:'A WIA consulta dados autorizados e prepara ações dentro do seu workspace. Revise as ações que exigem aprovação; uma recomendação não é confirmação de execução.',view:'wia',action:'Abrir WIA'},
  {title:'Entenda papéis e acesso',body:'Equipe mostra os vínculos e papéis da empresa atual. O acesso ao piloto exige uma conta Google autorizada. Não compartilhe sua conta ou senha.',view:'team',action:'Ver equipe'},
  {title:'Consulte o histórico da empresa',body:'Proprietário e administrador podem consultar os metadados dos eventos persistidos em Auditoria. A lista apresenta até 100 eventos recentes; ela não é um certificado de conformidade nem registra ações que o sistema não persistiu.',view:'audit',action:'Abrir auditoria'},
  {title:'Não consigo entrar ou minha sessão expirou',body:'Entre novamente usando a conta Google aprovada no piloto. Confirme que está no endereço atual do staging. Se aparecer acesso negado, a autorização da conta precisa ser revista pelo responsável pelo piloto. Nunca envie senha, token ou chave de API para pedir ajuda.'},
  {title:'Uma operação falhou. Posso repetir?',body:'Confira se a alteração apareceu na tela antes de tentar novamente. Em caso de erro, use Tentar novamente quando disponível. Ao relatar um problema, informe a tela, o horário e a mensagem exibida, sem dados de clientes ou credenciais.'},
];

export default function ManagementPage({view,request,onNavigate,accountName}:Props) {
  const [team,setTeam]=useState<Team|null>(null);
  const [events,setEvents]=useState<AuditEvent[]>([]);
  const [loading,setLoading]=useState(view!=='help');
  const [error,setError]=useState(false);
  const [denied,setDenied]=useState(false);
  const [revision,setRevision]=useState(0);
  const [search,setSearch]=useState('');
  const [source,setSource]=useState('all');
  useEffect(()=>{
    let alive=true;setSearch('');setSource('all');setTeam(null);setEvents([]);setError(false);setDenied(false);
    if(view==='help'){setLoading(false);return;}
    setLoading(true);
    request(view==='team'?'/api/team':'/api/audit').then(result=>{
      if(!alive)return;
      if(view==='team'){
        const value=result as Team;
        if(!Array.isArray(value?.members)||!Array.isArray(value?.invites))throw new Error('INVALID_RESPONSE');
        setTeam(value);
      }else{
        const value=result as {data:AuditEvent[]};
        if(!Array.isArray(value?.data))throw new Error('INVALID_RESPONSE');
        setEvents(value.data);
      }
    }).catch((error:unknown)=>{if(alive){setError(true);setDenied(typeof error==='object'&&error!==null&&'status' in error&&error.status===403);}}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[view,request,revision]);
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const titles={team:'Equipe',audit:'Auditoria',help:'Como podemos ajudar?'};
  const descriptions={team:'Pessoas, vínculos e papéis da sua empresa.',audit:'Acompanhe os eventos persistidos na empresa atual.',help:'Orientações práticas para usar a ORKTO com segurança.'};
  const panel='rounded-2xl border p-5 sm:p-6 orkto-product-surface orkto-product-border';
  const button='inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm orkto-product-control';
  const matches=events.filter(event=>(source==='all'||event.source===source)&&`${event.eventType} ${event.entityType||''} ${event.entityRef||''} ${event.actorId||''}`.toLocaleLowerCase('pt-BR').includes(query));
  return <div className="orkto-product mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader title={titles[view]} description={descriptions[view]} actions={view!=='help'&&<button type="button" disabled={loading} onClick={()=>setRevision(value=>value+1)} className={button}><RefreshCw size={16} aria-hidden="true" />Atualizar</button>} />
    {view!=='help'&&loading?<LoadingState rows={4} label={view==='team'?'Carregando equipe':'Consultando auditoria'} />:error?<ErrorState title={denied?'Acesso restrito':'Não foi possível carregar'} message={denied?(view==='audit'?'Somente proprietário e administrador podem consultar a auditoria da empresa.':'Sua conta não tem acesso à equipe desta empresa.'):'Verifique sua conexão e sua sessão e tente novamente. Nenhum dado foi alterado.'} onRetry={()=>setRevision(value=>value+1)} />:null}
    {view==='team'&&team&&!loading&&!error&&<>
      <section className={panel} aria-labelledby="team-members-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="team-members-title" className="flex items-center gap-2 text-lg font-semibold"><Users size={20} aria-hidden="true" />Pessoas da empresa</h2><StatusBadge>Seu papel: {roles[team.currentRole]||'Não reconhecido'}</StatusBadge></div>
        <p className="mb-5 text-sm leading-6 orkto-product-muted">Veja quem faz parte da empresa e o papel de cada pessoa. O identificador ajuda a distinguir contas quando o nome não está disponível.</p>
        {team.members.length===0?<EmptyState title="Nenhum vínculo retornado" description="A consulta não retornou membros para esta empresa." />:<ul className="divide-y orkto-product-border">{team.members.map(member=><li key={member.user_id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="text-sm font-semibold">{member.user_id===team.currentUserId?`${accountName||'Sua conta'} (você)`:`Pessoa ${member.user_id.slice(0,8)}`}</p><p className="mt-1 break-all text-xs orkto-product-muted">ID: {member.user_id}</p><p className="mt-1 text-xs orkto-product-muted">Entrada: {date(member.joined_at)}</p></div><div className="flex flex-wrap gap-2"><StatusBadge>{roles[member.role]||'Papel não reconhecido'}</StatusBadge><StatusBadge tone={member.status==='active'?'success':'neutral'}>{statuses[member.status]||'Estado não reconhecido'}</StatusBadge></div></li>)}</ul>}
        <p className="mt-4 text-xs orkto-product-muted">Até 200 vínculos, conforme a consulta atual.</p>
      </section>
      {['owner','admin'].includes(team.currentRole)&&<section className={panel} aria-labelledby="team-invites-title"><h2 id="team-invites-title" className="text-base font-semibold">Convites registrados</h2><p className="mt-2 text-sm leading-6 orkto-product-muted">Criar convites, alterar papéis e remover acessos ainda não estão habilitados nesta tela. O piloto continua exigindo aprovação de acesso; nenhum convite representa autorização automática.</p>{team.invites.length===0?<p className="mt-5 text-sm orkto-product-muted">Nenhum convite pendente retornado.</p>:<ul className="mt-4 divide-y orkto-product-border">{team.invites.map(invite=><li key={invite.id} className="py-4 text-sm"><p className="break-all font-medium">{invite.email}</p><p className="mt-1 orkto-product-muted">{roles[invite.role]||invite.role} · {Date.parse(invite.expires_at)<Date.now()?'Expirado':'Expira em'} {date(invite.expires_at)}</p></li>)}</ul>}</section>}
      <section className="flex items-start gap-3 px-1"><ShieldCheck size={20} className="shrink-0" aria-hidden="true" /><p className="text-sm leading-6 orkto-product-muted">Esta visão consulta apenas a empresa atual. Ela não altera permissões, sessões ou o acesso de participantes.</p></section>
    </>}
    {view==='audit'&&!loading&&!error&&<>
      <div className="flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border px-3 orkto-product-control"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar eventos</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar evento, entidade ou identificador" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><label className="text-sm"><span className="sr-only">Origem do evento</span><select value={source} onChange={event=>setSource(event.target.value)} className="min-h-11 w-full rounded-xl border px-3 orkto-product-control"><option value="all">Todas as origens</option>{Array.from(new Set(events.map(event=>event.source))).sort().map(value=><option key={value} value={value}>{sources[value]||value}</option>)}</select></label></div>
      <p className="text-xs leading-5 orkto-product-muted">{matches.length} de {events.length} eventos retornados · até 100 mais recentes. Filtros se aplicam a esta lista. Esta lista não inclui o conteúdo de mensagens ou alterações.</p>
      {matches.length===0?<EmptyState title={events.length?'Nenhum evento corresponde à busca':'Nenhum evento retornado'} description={events.length?'Ajuste o texto ou a origem para ver outros registros.':'A consulta não retornou eventos persistidos visíveis para esta empresa.'} />:<ol className="space-y-3">{matches.map(event=><li key={event.id} className={panel}><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-all text-sm font-semibold">{event.eventType}</h2><time dateTime={event.occurredAt} className="text-xs orkto-product-muted">{date(event.occurredAt)}</time></div><div className="mt-3 flex flex-wrap gap-2"><StatusBadge>{sources[event.source]||event.source}</StatusBadge>{event.entityType&&<StatusBadge>{event.entityType}</StatusBadge>}</div>{event.actorId&&<p className="mt-3 break-all text-xs orkto-product-muted">Responsável: {event.actorId}</p>}{event.entityRef&&<p className="mt-1 break-all text-xs orkto-product-muted">Referência: {event.entityRef}</p>}<p className="mt-2 break-all text-[11px] orkto-product-subtle">Evento: {event.id}</p></li>)}</ol>}
    </>}
    {view==='help'&&<>
      <label className="flex items-center gap-2 rounded-xl border px-4 orkto-product-control"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar na ajuda</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="O que você precisa fazer?" className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      <section className={panel} aria-label="Guias da ORKTO">{guides.filter(guide=>`${guide.title} ${guide.body}`.toLocaleLowerCase('pt-BR').includes(query)).map(guide=><details key={guide.title} className="group border-b py-4 last:border-0 orkto-product-border"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold"><span className="flex items-center gap-3"><BookOpen size={17} className="shrink-0" aria-hidden="true" />{guide.title}</span><ChevronDown size={17} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><p className="mt-3 max-w-2xl text-sm leading-7 orkto-product-muted">{guide.body}</p>{guide.view&&<button type="button" onClick={()=>onNavigate(guide.view!)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold" style={{color:'var(--orkto-brand-text)'}}>{guide.action}<ArrowRight size={16} aria-hidden="true" /></button>}</details>)}{!guides.some(guide=>`${guide.title} ${guide.body}`.toLocaleLowerCase('pt-BR').includes(query))&&<EmptyState title="Nenhum guia encontrado" description="Tente outro termo, como proposta, acesso ou cliente." />}</section>
      <div className="flex flex-wrap gap-4 text-sm orkto-product-muted"><a href="/termos.html" className="underline underline-offset-4">Termos de uso</a><a href="/privacidade.html" className="underline underline-offset-4">Privacidade</a></div>
    </>}
  </div>;
}
