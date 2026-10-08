import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu, Moon, Sun } from 'lucide-react';
import { supabase } from '../../src/lib/supabase';
import type { ProductView } from '../../src/product/types';
import type { Quote, SavedClient, UserProfile } from '../../src/types';
import { DesktopSidebar } from '../../src/product/navigation/desktop-sidebar';
import { MobileNavigation } from '../../src/product/navigation/mobile-navigation';
import TodayV2Page from '../../src/product/screens/today-v2-page';
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

type ScreenName = 'today' | 'inbox' | 'deals' | 'wia';
const screenViews: Record<ScreenName, ProductView> = {
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

const visualProfile = { companyName: 'Costa Serviços' } as UserProfile;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function installVisualApiFixtures() {
  const scenario = new URLSearchParams(window.location.search).get('scenario');
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
    const statefulRead = (path === '/api/priority/inbox' || path === '/api/deals' || path === '/api/wia/actions') && method === 'GET';
    const statefulAction = path === '/api/wia/route-agent' || path.startsWith('/api/conversations/') && path.endsWith('/send');
    if (scenario === 'loading' && statefulRead) await new Promise(resolve => window.setTimeout(resolve, 800));
    if (['empty', 'error', 'permission', 'configuration', 'backend_pending'].includes(scenario || '') && statefulRead) {
      if (scenario === 'empty') return json({ data: [] });
      if (scenario === 'error') return json({ error: 'Falha controlada pelo teste visual.' }, 500);
      if (scenario === 'permission') return json({ error: 'Acesso negado no cenário de teste.', category: 'permission_denied' }, 403);
      if (scenario === 'configuration') return json({ error: 'A configuração do canal é necessária para continuar.', category: 'configuration_required' }, 503);
      if (scenario === 'backend_pending') return json({ error: 'Contrato ausente no cenário de teste.' }, 501);
    }
    if (scenario === 'configuration' && statefulAction) return json({ error: 'Conecte o canal para enviar.', category: 'configuration_required' }, 503);
    if (scenario === 'error' && statefulAction) return json({ error: 'Falha controlada pelo teste visual.' }, 502);
    if (path === '/api/priority/inbox') return json({ data: [visualConversation] });
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}`) return json(visualConversationDetail);
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/messages`) return json({ data: visualConversationDetail.messages });
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/sussurros`) return json({ data: [] });
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
    if (path === '/api/wia/route-agent' && init?.method === 'POST') return json(visualWiaRouteResult);
    if (path === '/api/wia/actions') {
      const status = url.searchParams.get('status');
      return json({ data: visualWiaActions.filter(action => !status || action.status === status) });
    }
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/send` && init?.method === 'POST') return json({ data: { accepted: true } });
    if (path === `/api/conversations/${VISUAL_CONVERSATION_ID}/sussurros` && init?.method === 'POST') return json({ data: { id: 'visual-sussurro-1', content: '', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86_400_000).toISOString() } });
    if (path.startsWith('/api/approval-tasks/')) return json({ data: {} });
    return originalFetch(input, init);
  };
}

function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const validScreen = (value: string | null): value is ScreenName => value === 'today' || value === 'inbox' || value === 'deals' || value === 'wia';
  const initialScreen = validScreen(params.get('screen')) ? params.get('screen') as ScreenName : 'today';
  const [screen, setScreen] = useState<ScreenName>(initialScreen);
  const [darkMode, setDarkMode] = useState(params.get('theme') !== 'light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileThread, setMobileThread] = useState(params.get('thread') === '1');
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
    if (view === 'create_quote') { setScreen('today'); setMobileThread(false); return; }
  };

  return <div className="orkto-product-shell flex h-dvh min-h-0 overflow-hidden" data-visual-screen={screen} data-visual-theme={darkMode ? 'dark' : 'light'}>
    <div className="fixed left-1/2 top-1 z-[200] -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-wide orkto-product-border orkto-product-surface shadow-sm lg:left-[260px] lg:translate-x-0">VISUAL QA · FIXTURES DE TESTE</div>
    <DesktopSidebar currentView={currentView} collapsed={false} onCollapsedChange={() => undefined} onNavigate={navigate} darkMode={darkMode} onThemeChange={setDarkMode} companyName="Ambiente de revisão" userName="QA" isInternalAdmin={false} onSignOut={() => undefined} />
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b px-3 orkto-product-border orkto-product-surface lg:hidden">
        <span className="text-sm font-semibold tracking-wide">ORKTO</span>
        <div className="flex items-center gap-1"><button type="button" onClick={() => setDarkMode(value => !value)} aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'} className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen} className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted"><Menu size={19} /></button></div>
      </header>
      <div id="visual-main" className={`relative min-h-0 min-w-0 flex-1 ${screen === 'inbox' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {screen === 'today' && <TodayV2Page user={{ displayName: 'Marina' }} userProfile={visualProfile} quotes={params.get('scenario') === 'empty' ? [] : [visualQuote]} clients={params.get('scenario') === 'empty' ? [] : [visualClient]} accessToken={accessToken} dataLoading={false} onSelectQuote={() => setScreen('today')} onCreateQuote={() => setScreen('today')} onOpenDeal={() => setScreen('deals')} onOpenConversation={() => { setScreen('inbox'); setMobileThread(true); }} onOpenWia={() => setScreen('wia')} onOpenSettings={() => undefined} />}
        {screen === 'inbox' && <InboxWorkspace currentView={currentView} accessToken={accessToken} selectedConversationId={mobileThread || window.matchMedia('(min-width: 1024px)').matches ? VISUAL_CONVERSATION_ID : null} onOpenConversation={() => setMobileThread(true)} onBackToInbox={() => setMobileThread(false)} onOpenDeal={() => setScreen('deals')} onOpenSettings={() => undefined} />}
        {screen === 'deals' && <DealsPage clients={[visualClient]} accessToken={accessToken} initialCreate={createDeal} onInitialCreateOpened={() => setCreateDeal(false)} />}
        {screen === 'wia' && <WiaWorkspace accessToken={accessToken} onOpenSettings={() => undefined} />}
      </div>
      <MobileNavigation currentView={currentView} onNavigate={navigate} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} onSignOut={() => undefined} onQuickCreate={(id) => { if (id === 'deal') setCreateDeal(true); }} />
    </div>
  </div>;
}

installVisualApiFixtures();
createRoot(document.getElementById('visual-root')!).render(<App />);

void VISUAL_DEAL_ID;
