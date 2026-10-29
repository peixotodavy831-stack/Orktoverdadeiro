import { visualTeam } from './team-fixture';
import QuoteDetail from '../../src/components/QuoteDetail';
import {ConsolidatedArtifactsFixture} from './consolidated-artifacts';
import { buildConversationAssistance } from '../../backend/orkto-core/conversation-assistance';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu, Moon, Sun } from 'lucide-react';
import { supabase } from '../../src/lib/supabase';
import type { ProductView } from '../../src/product/types';
import type { Quote, SavedClient, UserProfile } from '../../src/types';
import { DesktopSidebar } from '../../src/product/navigation/desktop-sidebar';
import { MobileNavigation } from '../../src/product/navigation/mobile-navigation';
import TodayV2Page from '../../src/product/screens/today-v2-page';
import { buildRadarSnapshot } from '../../backend/orkto-core/radar';
import InboxWorkspace from '../../src/product/screens/inbox-workspace';
import WiaWorkspace from '../../src/product/screens/wia-workspace';
import DealsPage from '../../src/components/DealsPage';
import {
  VISUAL_CONVERSATION_ID,
  VISUAL_DEAL_ID,
  VISUAL_TOKEN,
  visualConversation,
  visualConversationDetail,
  visualDeals,
  visualWiaActions,
  visualWiaRouteResult,
} from './fixtures';
import '../../src/index.css';

import BillingPage from '../../src/components/BillingPage';
import IntegrationsPage from '../../src/product/screens/integrations-page';
import ManagementPage from '../../src/product/screens/management-page';
import ProfilePage from '../../src/product/screens/profile-page';
import ReportsPage from '../../src/components/ReportsPage';
import SettingsPage from '../../src/components/SettingsPage';
import {LaunchPlanningPanel} from '../../src/components/internal/LaunchPlanningPanel';
import {DEFAULT_FINANCE_ASSUMPTIONS} from '../../backend/finance/finance-model';
import QuotesPage from '../../src/components/QuotesPage';
import CreateQuote from '../../src/components/CreateQuote';
import ClientsPage from '../../src/components/ClientsPage';
import ServicesPage from '../../src/components/ServicesPage';

const additionalScreens = ['reports','team','audit','help','profile','settings','proposals','create_quote','clients','catalog','billing','integrations','founder_planning','public_artifacts','quote_detail'] as const;
const fixtureInvites: Array<{id:string;email:string;role:string;expires_at:string}>=[];
const fixtureRequest = async (path: string, init?: RequestInit) => {
  const scenario = new URLSearchParams(location.search).get('scenario');
  if (scenario === 'error') throw new Error('Falha de fixture');
  if (scenario === 'permission') throw Object.assign(new Error('Sem acesso no fixture'),{status:403});
  if (scenario === 'loading') await new Promise(() => {});
  if (path === '/api/team') return {...visualTeam,currentRole:new URLSearchParams(location.search).has('teamMember')?'member':'owner',members:scenario==='empty'?[]:visualTeam.members.map(member=>({...member,role:new URLSearchParams(location.search).has('teamMember')?'member':member.role})),invites:fixtureInvites};
  if(path==='/api/team/invites'&&init?.method==='POST'){
    if(scenario==='team-limit')throw new Error('Limite de pessoas ainda não configurado para este plano.');
    if(scenario!=='uxlab')return fixtureWriteBlocked();
    const body=JSON.parse(String(init.body));const row={id:'fixture-invite',email:body.email,role:body.role,expires_at:'2027-01-01T00:00:00Z'};fixtureInvites.push(row);return{data:row,invitePath:'/join-workspace?token=fixture-invitation-code-not-real-2027',delivery:'manual_link_copy_required'};
  }
  if(path==='/api/team/invites/accept'&&init?.method==='POST')throw new Error('Fixture: nenhuma permissão real é criada. Use somente o cenário aprovado.');
  return {data:[]};
};
const fixtureWriteBlocked = async (): Promise<never> => { throw new Error('Fixture visual: nenhuma gravação permitida.'); };

type ScreenName = 'today' | 'inbox' | 'deals' | 'wia' | typeof additionalScreens[number];
const screenViews: Record<ScreenName, ProductView> = {
  founder_planning:'settings',
  public_artifacts:'settings',quote_detail:'quote_detail',
  reports:'analytics',billing:'billing',integrations:'integrations',team:'team',audit:'audit',help:'help',profile:'profile',settings:'settings',proposals:'quotes',create_quote:'create_quote',clients:'clients',catalog:'services',
  today: 'dashboard',
  inbox: 'conversations',
  deals: 'deals',
  wia: 'wia',
};

const visualClient = {
  id: 'visual-client-1',
  userId: 'visual-user',
  name: 'Marina Costa',
  phone: '+55 11 99999-1234',
  company: 'Costa Serviços',
  createdAt: new Date() as never,
  updatedAt: new Date() as never,
} as SavedClient;

const visualQuote = {
  id: 'visual-proposal-1',
  userId: 'visual-user',
  quoteNumber: 'QA-204',
  clientName: 'Marina Costa',
  clientPhone: '+55 11 99999-1234',
  customerId: visualClient.id,
  clientCompany: 'Costa Serviços',
  clientVehicleOrService: 'Plano de manutenção anual',
  items: [],
  subtotal: 4200,
  discountTotal: 0,
  total: 4200,
  validValueDays: 15,
  status: 'pending',
  createdAt: new Date() as never,
  updatedAt: new Date() as never,
} as Quote;

const visualProfile = { companyName: 'Costa Serviços', displayName:'Pessoa de demonstração', profession:'Consultor', brandTone:'comercial' } as UserProfile;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function installVisualApiFixtures() {
  const scenario = new URLSearchParams(window.location.search).get('scenario');
  const privateInstructions=scenario?.startsWith('sussurro')?[{id:'visual-private-1',content:'Confirmar o prazo internamente antes de responder.',source_role:'manager',from_user_id:'visual-manager',to_user_id:null,read_at:null,expires_at:new Date(Date.now()+86_400_000).toISOString(),created_at:new Date().toISOString()}]:[];
  const session = { access_token: VISUAL_TOKEN, user: { id: 'visual-user' } } as unknown as NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>;
  Object.defineProperty(supabase.auth, 'getSession', {
    configurable: true,
    value: async () => ({ data: { session }, error: null }),
  });
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url, window.location.origin);
    const path = url.pathname;
    const method = (init?.method || 'GET').toUpperCase();
    if (path === '/api/wia-efficiency/plan' && method === 'POST') {
      if (scenario === 'loading') await new Promise(() => {});
      if (scenario === 'error') return json({error:'Prévia indisponível na fixture.'},503);
      if (scenario === 'permission') return json({error:'Sessão necessária.'},401);
      const message = JSON.parse(String(init?.body || '{}')).message || '';
      return json({data:{tier:/propostas|vendas|aprovações/i.test(message)?1:2,blocked:scenario==='configuration',usage_basis:'zero_inference',block_reasons:[],read_only:true,execution_available:false}});
    }
    if (path === '/api/playbooks/proposal_recovery/preview') {
      if (scenario === 'loading') await new Promise(() => {});
      if (scenario === 'error' || scenario === 'permission') return json({error:'Prévia indisponível na fixture.'},scenario==='permission'?403:503);
      return json({data:{title:'Recuperação de proposta sem resposta',when_to_use:'Exemplo fictício: acompanhar uma proposta enviada sem decisão registrada.',read_only:true,execution_available:false,steps:[
        {id:'read_context',title:'Consultar contexto da proposta',description:'Histórico, negócio e mensagens relacionados.',requires_approval:false},
        {id:'check_window',title:'Verificar janela de acompanhamento',description:'Mesma regra conservadora de leitura do Radar.',requires_approval:false},
        {id:'request_approval',title:'Aprovar tarefa de acompanhamento',description:'Decisão humana antes de qualquer criação futura.',requires_approval:true},
      ]}});
    }
    const statefulRead = (path === '/api/priority/inbox' || path === '/api/deals' || path === '/api/wia/actions' || path === '/api/radar') && method === 'GET';
    const statefulAction = path === '/api/wia/route-agent' || path.startsWith('/api/conversations/') && path.endsWith('/send');
    if (scenario === 'loading' && path === '/api/radar') await new Promise(() => {}); // Stable fixture only: observe loading without a timing race.
    if (scenario === 'loading' && statefulRead) await new Promise(resolve => window.setTimeout(resolve, 800));
    if (['empty', 'error', 'permission', 'configuration', 'backend_pending'].includes(scenario || '') && statefulRead) {
      if (scenario === 'empty' && path !== '/api/radar') return json({ data: [] });
      if (scenario === 'error') return json({ error: 'Falha controlada pelo teste visual.' }, 500);
      if (scenario === 'permission') return json({ error: 'Acesso negado no cenário de teste.', category: 'permission_denied' }, 403);
      if (scenario === 'configuration') return json({ error: 'A configuração do canal é necessária para continuar.', category: 'configuration_required' }, 503);
      if (scenario === 'backend_pending') return json({ error: 'Contrato ausente no cenário de teste.' }, 501);
    }
    if (scenario === 'configuration' && statefulAction) return json({ error: 'Conecte o canal para enviar.', category: 'configuration_required' }, 503);
    if (scenario === 'error' && statefulAction) return json({ error: 'Falha controlada pelo teste visual.' }, 502);
    if (path === '/api/integrations/status') {
      const demo=scenario?.startsWith('meta-');
      const state=scenario==='meta-auth-error'?'authentication_error':scenario==='meta-revoked'?'disconnected':demo?'connected':'configuration_required';
      return json({data:{wia:{provider:'gemini',model:'fixture-only',testingOnly:true,state:'configuration_required'},
        whatsapp:{state,connected:state==='connected',runtimeConfigured:!!demo,
          connection:demo?{status:scenario==='meta-revoked'?'revoked':'connected',display_phone_number:'Número fictício · +55 11 00000-0000',verified_name:'Empresa de demonstração',coexistence_state:'unknown',service_mode:'manual',verified_at:scenario==='meta-verified'?new Date().toISOString():'2020-01-01T00:00:00Z'}:null,controls:demo?{human_takeover:true}:null},
        billing:{state:'configuration_required',checkoutEnabled:false},canManage:!!demo}});
    }
    if(scenario==='uxlab'){
      if(path==='/api/contacts')return json({data:[]});
      if(/^\/api\/customers\/[^/]+\/(mood|memories|repurchase)$/.test(path))return path.endsWith('/mood')?json({error:'Sinais opcionais não cobertos nesta fixture.'},503):json({data:[]});
      if(path.startsWith('/api/conversations/')&&path.endsWith('/read'))return json({data:{}});
      if(path.startsWith('/api/conversations/')&&path.endsWith('/send')){
        document.documentElement.dataset.uxlabSendAttempts=String(Number(document.documentElement.dataset.uxlabSendAttempts||0)+1);
        return json({error:'Canal de teste sem envio externo; rascunho preservado.',category:'configuration_required'},503);
      }
      const second='22222222-2222-4222-8222-222222222222';
      if(path===`/api/conversations/${second}`)return json({...visualConversationDetail,id:second,contactName:'Caio — fixture',contactPhone:'+55 11 00000-0001'});
      if(path===`/api/conversations/${second}/assistance`)return json({data:{customer:null,deals:[],sourceIds:[]}});
      if(path===`/api/conversations/${second}/sussurros`)return json({data:[]});
      if(path==='/api/priority/inbox')return json({data:[visualConversation,{...visualConversation,id:second,contact_name:'Caio — fixture',contact_phone:'+55 11 00000-0001'}]});
    }
    if(new URLSearchParams(location.search).has('approvalBacklog')){
      if(path==='/api/priority/inbox'||path==='/api/deals')return json({data:[]});
      if(path==='/api/wia/actions'){
        const rows=[...Array.from({length:5},(_,i)=>({...visualWiaActions[0],id:`fixture-done-${i}`,status:'executed',created_at:new Date(Date.now()-i*60_000).toISOString()})),{...visualWiaActions[0],id:'fixture-old-pending',status:'awaiting_approval',created_at:'2026-01-01T12:00:00Z'}];
        const filter=url.searchParams.get('status');return json({data:rows.filter(row=>!filter||row.status===filter)});
      }
    }
    if(['/api/reports','/api/replay','/api/wrapped','/api/case-studies'].includes(path)&&method==='GET')return json({data:[]});
    if (path === '/api/plan/catalog') return json({data:[['starter',7990],['pro',14990],['business',29990],['scale',59990],['enterprise',null]].map(([plan_key,price_cents])=>({plan_key,price_cents,currency:'BRL',price_is_public:price_cents!==null,entitlements:{features:{},limits:{}},version:1}))});
    if (path === '/api/billing/current') return json({subscription:null,workspacePlan:null,status:'configuration_required',trialEndsAt:null,readOnly:true,configurationRequired:true,entitlements:{features:{},limits:{}},usage:[],checkout:'not_configured',pulso:scenario === 'quota-demo' ? {state:'configured',allowance:1000,used:742,remaining:258} : scenario === 'quota-zero' ? {state:'configured',allowance:0,used:0,remaining:0} : {state:'configuration_required',allowance:null,used:null,remaining:null}});
    if (path === '/api/radar') {
      const now = Date.parse('2026-10-21T12:00:00.000Z');
      const data = buildRadarSnapshot(scenario === 'empty' ? {} : {
        quotes: [{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',quote_number:'001',client_name:'Cliente de demonstração',total:100,status:'sent',sent_at:'2026-10-18T12:00:00.000Z',viewed_at:null,approved_at:null,rejected_at:null,deal_id:null}],
        conversations: [{id:VISUAL_CONVERSATION_ID,contact_name:'Contato de demonstração',contact_phone:null,status:'open',created_at:'2026-10-20T12:00:00.000Z',messages:[{direction:'incoming',sent_at:'2026-10-21T08:00:00.000Z',read_at:null}]}],
        tasks: [{id:'fixture-task',title:'Revisar prazo de acompanhamento',status:'open',due_at:'2026-10-19T12:00:00.000Z',deal_id:null,customer_ref:null}],
        deals: [{id:VISUAL_DEAL_ID,title:'Negócio de demonstração',stage:'new',status:'open',expected_close_on:'2026-10-15',customer_ref:null}],
      }, now);
      if(new URLSearchParams(location.search).has('radarMany'))data.signals=Array.from({length:9},(_,i)=>({...data.signals[0],id:`fixture-signal-${i}`,title:`Prioridade fictícia ${i+1}`}));
      return json({data:{...data,version:'R1',read_only:true,coverage:{partial:scenario==='partial',limited_sources:scenario==='partial'?['quotes']:[],leads_evaluated:true}}});
    }
    if (path === '/api/priority/inbox') return json({ data: [visualConversation] });
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}`) return json(scenario==='meta-messages'?{...visualConversationDetail,messages:[
      {id:'synthetic-audio',conversation_id:VISUAL_CONVERSATION_ID,sender_role:'contact',direction:'incoming',message_type:'audio',content:'Áudio recebido no WhatsApp. O conteúdo não foi processado pela ORKTO. Solicite uma descrição em texto.',sent_at:'2026-10-27T10:00:00Z',metadata:{provider:'meta_whatsapp_cloud',content_state:'unsupported',content_processed:false}},
      {id:'synthetic-reply',conversation_id:VISUAL_CONVERSATION_ID,sender_role:'operator',direction:'outgoing',message_type:'text',content:'Demonstração fictícia: pode nos enviar uma descrição em texto?',sent_at:'2026-10-27T10:01:00Z',metadata:{provider:'meta_whatsapp_cloud',provider_receipt_status:'read',provider_receipt_at:'2026-10-27T10:02:00Z'}},
    ]}:visualConversationDetail);
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/assistance`) { if (scenario === 'assistance_loading') await new Promise(() => {}); if (scenario === 'assistance_error') return json({error:'Contexto indisponível'},503); if (scenario === 'assistance_permission') return json({error:'Sem acesso'},403); return json(buildConversationAssistance({conversation:{id:VISUAL_CONVERSATION_ID,contact_phone:visualConversation.contact_phone},clients:scenario==='assistance_empty'?[]:[{id:'fixture-client',name:'Marina — demonstração',phone:visualConversation.contact_phone}],clientsComplete:true,messages:scenario==='assistance_empty'?[]:[{id:'fixture-message',direction:'incoming',content:'Dado fictício'}],deals:[]})); }
      if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/messages`) return json({ data: visualConversationDetail.messages });
    if(path.startsWith('/api/public/live-quotes/')||path.startsWith('/api/public/wrapped/')){
      if(path.includes('fixture-unavailable'))return json({error:'Link fictício indisponível.'},404);
      const letter=path.includes('fixture-b')?'B':'A';
      if(path.endsWith('/accept')||path.endsWith('/reject'))return json({data:{status:path.endsWith('/accept')?'accepted':'rejected'}});
      if(path.includes('/wrapped/'))return json({period_start:'2026-10-01',period_end:'2026-10-27',shared_at:'2026-10-27T12:00:00Z',metrics:{quotes:{count:letter==='A'?4:7},deals:{won:1},conversations:{total:3},response:{medianMinutes:null,samples:0}}});
      return json({id:`visual-quote-${letter}`,version:1,status:'sent',validUntil:'2027-01-01T00:00:00Z',snapshot:{clientName:`Cliente fictício ${letter}`,company:'Empresa fictícia',items:[],total:letter==='A'?100:200,signature:{label:'Powered by ORKTO'}}});
    }
    if(path===`/api/conversations/${VISUAL_CONVERSATION_ID}/sussurros/visual-private-1/read`){
      if(scenario==='sussurro-error')return json({error:'Falha fictícia na confirmação de leitura.'},500);
      const read_at=new Date().toISOString();
      Object.assign(privateInstructions[0],{read_at});
      return json({data:{id:'visual-private-1',read_at}});
    }
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/sussurros`&&method==='GET') return json({ data: privateInstructions });
    if (path === '/api/operational/workspace') return json({ members: [{ user_id: 'visual-user', role: 'owner' }] });
    if (path === '/api/deals' && (!init?.method || init.method === 'GET')) return json({ data: visualDeals });
    if (path.startsWith('/api/deals/') && method === 'PATCH') {
      const dealId = decodeURIComponent(path.split('/').at(-1) || '');
      const deal = visualDeals.find(item => item.id === dealId);
      if (!deal) return json({ error: 'Negócio não encontrado no fixture.' }, 404);
      Object.assign(deal, JSON.parse(String(init?.body || '{}')), { updated_at: new Date().toISOString() });
      return json({ data: deal });
    }
    if (path.startsWith('/api/wia/actions/') && init?.method === 'POST') {
      const actionId = path.split('/').at(-2);
      const action = visualWiaActions.find(item => item.id === actionId);
      return action ? json({ data: { ...action, status: path.endsWith('/approve') ? 'executed' : 'rejected', result: {} }, externalDelivery: 'not_sent_channel_not_configured' }) : json({ error: 'Ação não encontrada no fixture.' }, 404);
    }
    if (path === '/api/wia/route-agent' && init?.method === 'POST') return json(scenario==='uxlab'?{...visualWiaRouteResult,decision:{...visualWiaRouteResult.decision,requiresApproval:true}}:visualWiaRouteResult);
    if (path === '/api/wia/actions') {
      const status = url.searchParams.get('status');
      return json({ data: visualWiaActions.filter(action => !status || action.status === status) });
    }
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/send` && init?.method === 'POST') return json({ data: { accepted: true } });
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/sussurros` && init?.method === 'POST') return json({ data: { id: 'visual-sussurro-1', content: '', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86_400_000).toISOString() } });
    if (path.startsWith('/api/approval-tasks/')) return json({ data: {} });
    if (url.origin === location.origin && !path.startsWith('/api/')) return originalFetch(input, init);
    return json({error:'Contrato não coberto pelo fixture visual.'},501);
  };
}

function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const validScreen = (value: string | null): value is ScreenName => value === 'today' || value === 'inbox' || value === 'deals' || value === 'wia' || additionalScreens.some(screen => screen === value);
  const initialScreen = validScreen(params.get('screen')) ? params.get('screen') as ScreenName : 'today';
  const [wiaInitialMessage, setWiaInitialMessage] = useState('');
  const [wiaInitialActionId, setWiaInitialActionId] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenName>(initialScreen);
  const [darkMode, setDarkMode] = useState(params.get('theme') !== 'light');
  const [menuOpen, setMenuOpen] = useState(params.get('menu')==='1');
  const [fixtureClients,setFixtureClients]=useState<SavedClient[]>([visualClient]);
  const [fixtureServices,setFixtureServices]=useState<import('../../src/types').SavedService[]>([]);
  const [fixtureQuotes,setFixtureQuotes]=useState<Quote[]>([visualQuote]);
  const [quoteInDetail,setQuoteInDetail]=useState<Quote|null>(null);
  const [selectedConversation,setSelectedConversation]=useState(VISUAL_CONVERSATION_ID);
  const openFixtureQuote=(id:string)=>{const quote=fixtureQuotes.find(row=>row.id===id);if(quote){setQuoteInDetail(quote);setScreen('quote_detail');}};
  const addFixtureClient=async(client:SavedClient)=>{if(params.get('scenario')!=='uxlab')return fixtureWriteBlocked();setFixtureClients(current=>[client,...current]);};
  const saveFixtureQuote=async(quote:Quote)=>{if(params.get('scenario')!=='uxlab')return fixtureWriteBlocked();const saved={...quote,id:`fixture-quote-${crypto.randomUUID()}`,quoteNumber:'LAB-2027'};setFixtureQuotes(current=>[saved,...current]);setQuoteInDetail(saved);setScreen('quote_detail');return saved;};
  const [mobileThread, setMobileThread] = useState(params.get('thread') === '1');
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [draftCustomerId, setDraftCustomerId] = useState<string | null>(null);
  const [createDeal, setCreateDeal] = useState(false);
  const currentView = screen === 'inbox' && mobileThread && window.matchMedia('(max-width: 1023px)').matches ? 'conversation' : screenViews[screen];
  const accessToken = VISUAL_TOKEN;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.dataset.visualTheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const navigate = (view: ProductView) => {
    if (view === 'deals') { setScreen('deals'); setMobileThread(false); return; }
    if (view === 'wia') { setScreen('wia'); setMobileThread(false); return; }
    if (view === 'conversations' || view === 'conversation') { setScreen('inbox'); setMobileThread(view === 'conversation'); return; }
    if (view === 'dashboard') { setScreen('today'); setMobileThread(false); return; }
    if (view === 'analytics') {setScreen('reports');return;}
    if (view === 'quotes') { setScreen('proposals'); return; }
    if (view === 'services') { setScreen('catalog'); return; }
    if (additionalScreens.some(screen => screen === view)) { setScreen(view as ScreenName); setMobileThread(false); return; }
  };

  return <div className="orkto-product-shell orkto-glass-shell flex h-dvh min-h-0 overflow-hidden" data-visual-screen={screen} data-visual-theme={darkMode ? 'dark' : 'light'}>
    <div className="pointer-events-none fixed left-1/2 top-1 z-[200] -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-wide orkto-product-border orkto-product-surface shadow-sm lg:left-[260px] lg:translate-x-0">VISUAL QA · FIXTURES DE TESTE</div>
    <DesktopSidebar currentView={currentView} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} onNavigate={navigate} darkMode={darkMode} onThemeChange={setDarkMode} companyName="Ambiente de revisão" userName="QA" isInternalAdmin={false} onSignOut={() => undefined} />
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b px-3 orkto-product-border orkto-product-surface lg:hidden">
        <button type="button" onClick={() => navigate('dashboard')} aria-label="ORKTO, ir para Hoje" className="min-h-11 rounded-lg px-1 text-sm font-semibold tracking-wide">ORKTO</button>
        <div className="flex items-center gap-1"><button type="button" onClick={() => setDarkMode(value => !value)} aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'} className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen} className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted"><Menu size={19} /></button></div>
      </header>
      <div id="visual-main" className={`orkto-workspace-content relative min-h-0 min-w-0 flex-1 ${screen === 'inbox' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {screen === 'today' && <TodayV2Page user={{ displayName: 'Marina' }} userProfile={visualProfile} quotes={params.get('scenario') === 'empty'||params.has('approvalBacklog') ? [] : fixtureQuotes} clients={params.get('scenario') === 'empty' ? [] : fixtureClients} accessToken={accessToken} dataLoading={false} onSelectQuote={openFixtureQuote} onCreateQuote={() => setScreen('create_quote')} onOpenDeal={() => setScreen('deals')} onOpenConversation={() => { setScreen('inbox'); setMobileThread(true); }} onReviewWia={id => {setWiaInitialActionId(id);setWiaInitialMessage('');setScreen('wia');}} onOpenWia={message => { setWiaInitialActionId(null);setWiaInitialMessage(message || ''); setScreen('wia'); }} onOpenBilling={() => setScreen('billing')} onOpenSettings={() => undefined} />}
        {screen==='public_artifacts'&&<ConsolidatedArtifactsFixture/>}
        {screen==='quote_detail'&&quoteInDetail&&<QuoteDetail quote={quoteInDetail} userProfile={visualProfile} onBack={()=>setScreen('proposals')} onEdit={()=>setScreen('create_quote')} onDuplicate={()=>setScreen('create_quote')} onQuoteUpdated={fixtureWriteBlocked} onQuoteDeleted={fixtureWriteBlocked}/>}

        {screen === 'inbox' && <InboxWorkspace onOpenWia={message=>{setWiaInitialMessage(message);setScreen('wia');}} currentView={currentView} accessToken={accessToken} selectedConversationId={mobileThread || window.matchMedia('(min-width: 1024px)').matches ? selectedConversation : null} onOpenConversation={id => {setSelectedConversation(id);setMobileThread(true);}} onBackToInbox={() => setMobileThread(false)} onOpenDeal={() => setScreen('deals')} onOpenSettings={() => undefined} />}
        {screen === 'deals' && <DealsPage clients={fixtureClients} accessToken={accessToken} initialCreate={createDeal} initialCustomerId={draftCustomerId} onInitialCreateOpened={() => setCreateDeal(false)} />}
        {['team','audit','help'].includes(screen) && <ManagementPage view={screen as 'team'|'audit'|'help'} request={fixtureRequest} onNavigate={navigate} accountName="Pessoa de demonstração" />}
        {screen === 'reports' && <ReportsPage accessToken={accessToken} />}
        {screen === 'billing' && <BillingPage userProfile={visualProfile} />}
        {screen === 'integrations' && <IntegrationsPage request={async (path,init) => { if (init?.method && init.method !== 'GET') return fixtureWriteBlocked(); const response=await fetch(path); return response.json(); }} onNavigate={navigate} />}
        {screen === 'profile' && <ProfilePage profile={visualProfile} account={{displayName:'Pessoa de demonstração',email:'fixture@example.invalid'}} onSave={fixtureWriteBlocked} onOpenSettings={() => setScreen('settings')} onSignOut={() => undefined} />}
        {screen === 'settings' && <SettingsPage onOpenWia={() => {setWiaInitialMessage('Prepare um rascunho de mensagem para um cliente usando os registros autorizados. Pergunte qual cliente e objetivo antes de propor uma ação.');setScreen('wia');}} onOpenIntegrations={() => setScreen('integrations')} userProfile={visualProfile} onProfileUpdated={fixtureWriteBlocked} />}
        {screen === 'proposals' && <QuotesPage quotes={fixtureQuotes} clients={fixtureClients} userProfile={visualProfile} onSelectQuote={openFixtureQuote} onCreateQuoteClick={() => setScreen('create_quote')} />}
        {screen === 'create_quote' && <CreateQuote userProfile={visualProfile} savedClients={fixtureClients} savedServices={fixtureServices} onQuoteCreated={saveFixtureQuote} onCancel={() => setScreen('proposals')} />}
        {screen === 'clients' && <ClientsPage clients={fixtureClients} quotes={fixtureQuotes} userId="visual-user" onCreateDeal={id=>{setDraftCustomerId(id);setCreateDeal(true);setScreen('deals');}} onClientAdded={addFixtureClient} onClientUpdated={async client=>{if(params.get('scenario')!=='uxlab')return fixtureWriteBlocked();setFixtureClients(current=>current.map(row=>row.id===client.id?client:row));}} onSelectQuote={openFixtureQuote} />}
        {screen === 'catalog' && <ServicesPage onPrepareWithWia={message => { setWiaInitialMessage(message); setScreen('wia'); }} services={fixtureServices} userId="visual-user" onServiceAdded={async service=>{if(params.get('scenario')!=='uxlab')return fixtureWriteBlocked();setFixtureServices(rows=>[service,...rows]);}} onServiceUpdated={async service=>{if(params.get('scenario')!=='uxlab')return fixtureWriteBlocked();setFixtureServices(rows=>rows.map(row=>row.id===service.id?service:row));}} onServiceDeleted={fixtureWriteBlocked} />}
        {screen === 'founder_planning' && <div className="orkto-product mx-auto max-w-6xl p-5"><p className="text-sm">Fixture administrativa · nenhuma informação privada do fundador</p><LaunchPlanningPanel assumptions={{...DEFAULT_FINANCE_ASSUMPTIONS,monthlyFixedPlatformCostCents:10000,openingCashCents:100000}} scenario="base"/></div>}
        {screen === 'wia' && <WiaWorkspace initialActionId={wiaInitialActionId} onInitialActionOpened={() => setWiaInitialActionId(null)} initialMessage={wiaInitialMessage} accessToken={accessToken} onOpenSettings={() => undefined} />}
      </div>
      <MobileNavigation currentView={currentView} onNavigate={navigate} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} onSignOut={() => undefined} onQuickCreate={(id) => { if (id === 'deal') setCreateDeal(true); }} />
    </div>
  </div>;
}

installVisualApiFixtures();
createRoot(document.getElementById('visual-root')!).render(<App />);

void VISUAL_DEAL_ID;
