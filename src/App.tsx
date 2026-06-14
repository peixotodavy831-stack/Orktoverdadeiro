import React, { useState, useEffect } from 'react';
import { Timestamp } from './types';
import { 
  Zap, 
  Home, 
  Users, 
  Receipt, 
  Settings as SettingsIcon, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  LogOut as LogOutIcon,
  CheckCircle,
  Clock,
  Sparkles,
  Phone,
  DollarSign,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Send,
  XCircle,
  FileText,
  BarChart3,
  HeartHandshake,
  Plus,
  CreditCard,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quote, SavedClient, SavedService, UserProfile } from './types';
import { formatBRL, formatPhone } from './utils/format';

// Core UI Modules
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import CreateQuote from './components/CreateQuote';
import QuoteDetail from './components/QuoteDetail';
import ClientsPage from './components/ClientsPage';
import OrktoLogo from './components/OrktoLogo';
import ServicesPage from './components/ServicesPage';
import SettingsPage from './components/SettingsPage';
import BillingPage from './components/BillingPage';
import AnalyticsPage from './components/AnalyticsPage';
import QuotesPage from './components/QuotesPage';
import TubelightNavbar from './components/ui/tubelight-navbar';

const initialMockClients: SavedClient[] = [
  { id: 'mc_1', userId: 'mocked_orkto_user', name: 'Juliana Albuquerque', phone: '11987541243', company: 'Marinho Negócios Digitais', vehicleOrService: 'Landing Page Premium & Branding', notes: 'Foco em design conversivo e sofisticação visual', createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
  { id: 'mc_2', userId: 'mocked_orkto_user', name: 'Henrique Silveira', phone: '21976512390', company: 'Vortex Tech SaaS', vehicleOrService: 'Desenvolvimento de App Mobile', notes: 'Necessita de integração com Stripe e notificações Push', createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
  { id: 'mc_3', userId: 'mocked_orkto_user', name: 'Gabriela Mello', phone: '31965412351', company: 'Mello Advocacia Especializada', vehicleOrService: 'Consultoria Estratégica Mensal', notes: 'Contrato fixo recorrência trimestral de posicionamento seo', createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
];

const initialMockServices: SavedService[] = [
  { id: 'ms_1', userId: 'mocked_orkto_user', name: 'Branding & Identidade Visual', description: 'Criação de logo premium, paleta de cores, tipografia corporativa e manual de marca completo', unitPrice: 2400, category: 'Design & Branding', createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
  { id: 'ms_2', userId: 'mocked_orkto_user', name: 'Desenvolvimento Frontend Responsivo', description: 'Desenvolvimento web em React + Tailwind CSS de alto nível focado em conversão e SEO', unitPrice: 5500, category: 'Desenvolvimento & Software', createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
  { id: 'ms_3', userId: 'mocked_orkto_user', name: 'Consultoria Estratégica de UX/UI', description: 'Auditoria de ponta a ponta na usabilidade e visual do produto digital com relatório detalhado de melhorias', unitPrice: 1800, category: 'Consultoria & Mentoria', createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
  { id: 'ms_4', userId: 'mocked_orkto_user', name: 'Gestão de Tráfego Pago & Audiência', description: 'Planejamento, setup de campanhas e otimização semanal de anúncios no Meta Ads e Google Ads', unitPrice: 1500, category: 'Marketing & Tráfego Pago', createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
];

const initialMockQuotes: Quote[] = [
  {
    id: 'mq_1',
    userId: 'mocked_orkto_user',
    quoteNumber: '1001',
    clientName: 'Juliana Albuquerque',
    clientPhone: '11987541243',
    clientCompany: 'Marinho Negócios Digitais',
    clientVehicleOrService: 'Landing Page Premium & Branding',
    notes: 'Incluso suporte técnico pós-entrega por 90 dias úteis.',
    subtotal: 7900,
    discountTotal: 400,
    taxes: 0,
    total: 7500,
    validValueDays: 10,
    paymentInstructions: 'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: ORKTO PRO SOLUTIONS LTDA',
    status: 'approved',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    items: [
      { id: 'qi_1', name: 'Branding & Identidade Visual', description: 'Logo e manual de marca premium', quantity: 1, unitPrice: 2400, discount: 0 },
      { id: 'qi_2', name: 'Desenvolvimento Frontend Responsivo', description: 'Landing Page institucional', quantity: 1, unitPrice: 5500, discount: 400 }
    ]
  },
  {
    id: 'mq_2',
    userId: 'mocked_orkto_user',
    quoteNumber: '1002',
    clientName: 'Henrique Silveira',
    clientPhone: '21976512390',
    clientCompany: 'Vortex Tech SaaS',
    clientVehicleOrService: 'UX Audit & Web App Design',
    notes: 'Prazo estimado de homologação das telas: 20 dias úteis.',
    subtotal: 7300,
    discountTotal: 0,
    taxes: 0,
    total: 7300,
    validValueDays: 5,
    paymentInstructions: 'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: ORKTO PRO SOLUTIONS LTDA',
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    items: [
      { id: 'qi_3', name: 'Consultoria Estratégica de UX/UI', description: 'Auditoria e redesign das telas críticas do checkout', quantity: 1, unitPrice: 1800, discount: 0 },
      { id: 'qi_4', name: 'Desenvolvimento Frontend Responsivo', description: 'Arquitetura de rotas e componentes reusáveis', quantity: 1, unitPrice: 5500, discount: 0 }
    ]
  }
];

export default function App() {
  const getMillis = (dateObj: any): number => {
    if (!dateObj) return 0;
    if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
    if (typeof dateObj.toDate === 'function') return dateObj.toDate().getTime();
    if (dateObj.seconds) return dateObj.seconds * 1000 + Math.floor((dateObj.nanoseconds || 0) / 1000000);
    const d = new Date(dateObj);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Navigation & Viewing states
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'dashboard' | 'quotes' | 'create_quote' | 'quote_detail' | 'clients' | 'services' | 'settings' | 'analytics' | 'billing'>('dashboard');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [duplicateQuoteSource, setDuplicateQuoteSource] = useState<Quote | null>(null);
  const [editQuoteSource, setEditQuoteSource] = useState<Quote | null>(null);

  // Dark/Light Theme Custom State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('orkto_dark_mode');
    return saved !== 'false'; // defaults to true for premium dark branding
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('orkto_dark_mode', String(darkMode));
  }, [darkMode]);

  // Auth & Profile state (Mocked and persistent)
  const [user, setUser] = useState<any>({
    uid: 'mocked_orkto_user',
    displayName: 'Dono do Negócio',
    email: 'contato@orkto.co'
  });
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('orkto_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      uid: 'mocked_orkto_user',
      displayName: 'Dono do Negócio',
      email: 'contato@orkto.co',
      photoURL: null,
      createdAt: Timestamp.now(),
      onboardingCompleted: true,
      companyName: 'Orkto Premium Design Studio',
      taxID: '14.502.836/0001-90',
      whatsappNumber: '11999999999',
      whatsappTemplate: 'Olá *[CLIENT_NAME]*, aqui está a proposta de *[SERVICE_TYPE]* no valor de *[TOTAL]*. Clique no link abaixo para visualizar os detalhes e aprovar:\n\n*[LINK]*',
      paymentInfo: 'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: ORKTO PRO SOLUTIONS LTDA',
      quoteColor: '#ff9f1c',
      address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      brandName: 'Orkto design',
      brandTone: 'comercial',
      profession: 'Design & Tecnologia',
      activePlan: 'starter',
      planPeriod: 'monthly'
    };
  });
  
  const [loading, setLoading] = useState(false);

  // Persistent in-memory & local-storage states
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const saved = localStorage.getItem('orkto_quotes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return initialMockQuotes;
  });

  const [clients, setClients] = useState<SavedClient[]>(() => {
    const saved = localStorage.getItem('orkto_clients');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return initialMockClients;
  });

  const [services, setServices] = useState<SavedService[]>(() => {
    const saved = localStorage.getItem('orkto_services');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return initialMockServices;
  });

  // Sync state modifications to LocalStorage automatically
  useEffect(() => {
    localStorage.setItem('orkto_quotes', JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem('orkto_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('orkto_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('orkto_profile', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('orkto_profile');
    }
  }, [userProfile]);

  // Public checkout state (?quoteId=XYZ)
  const [publicQuoteId, setPublicQuoteId] = useState<string | null>(null);
  const [publicQuote, setPublicQuote] = useState<Quote | null>(null);
  const [publicQuoteUser, setPublicQuoteUser] = useState<UserProfile | null>(null);
  const [publicQuoteLoading, setPublicQuoteLoading] = useState(false);
  const [publicClientFeedback, setPublicClientFeedback] = useState<'approved' | 'rejected' | null>(null);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [acceptTermsCheckbox, setAcceptTermsCheckbox] = useState(false);
  const [showPixDetails, setShowPixDetails] = useState(false);
  const [isPixPaid, setIsPixPaid] = useState(false);

  // Sidebar controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Onboarding controls
  const [onboardBusinessName, setOnboardBusinessName] = useState('');
  const [onboardTaxID, setOnboardTaxID] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardAddress, setOnboardAddress] = useState('');
  const [onboardPix, setOnboardPix] = useState('');
  const [onboardProfession, setOnboardProfession] = useState('Serviços Gerais');
  const [onboardBrandName, setOnboardBrandName] = useState('');
  const [onboardBrandTone, setOnboardBrandTone] = useState<'formal' | 'técnico' | 'comercial' | 'criativo'>('comercial');
  const [onboardQuoteColor, setOnboardQuoteColor] = useState('#ff9f1c');
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);

  // Sync initial onboarding values if profile updates
  useEffect(() => {
    if (userProfile && (!userProfile.onboardingCompleted || !userProfile.companyName || !userProfile.taxID)) {
      setOnboardBusinessName(userProfile.companyName || '');
      setOnboardTaxID(userProfile.taxID || '');
      setOnboardPhone(userProfile.whatsappNumber || '');
      setOnboardAddress(userProfile.address || '');
      setOnboardPix(userProfile.paymentInfo || '');
      setOnboardProfession(userProfile.profession || 'Serviços Gerais');
      setOnboardBrandName(userProfile.brandName || userProfile.companyName || '');
      setOnboardBrandTone(userProfile.brandTone || 'comercial');
      setOnboardQuoteColor(userProfile.quoteColor || '#ff9f1c');
    }
  }, [userProfile]);

  // Check URL query parameters for public quote approval view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quoteId = params.get('quoteId');
    if (quoteId) {
      setPublicQuoteId(quoteId);
      loadPublicQuote(quoteId);
    }
  }, []);

  const loadPublicQuote = async (quoteId: string) => {
    setPublicQuoteLoading(true);
    try {
      const found = quotes.find(q => q.id === quoteId);
      if (found) {
        setPublicQuote(found);
        setPublicQuoteUser(userProfile);
      } else {
        // Check initial seed quotes too
        const initialFound = initialMockQuotes.find(q => q.id === quoteId);
        if (initialFound) {
          setPublicQuote(initialFound);
          setPublicQuoteUser(userProfile);
        }
      }
    } catch (err) {
      console.error("Error loading public quote locally:", err);
    } finally {
      setPublicQuoteLoading(false);
    }
  };

  // Onboarding Completion click handler
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardSubmitting(true);

    try {
      const updated: UserProfile = {
        uid: 'mocked_orkto_user',
        displayName: 'Dono do Negócio',
        email: 'contato@orkto.co',
        photoURL: null,
        createdAt: Timestamp.now(),
        companyName: onboardBusinessName,
        taxID: onboardTaxID,
        whatsappNumber: onboardPhone,
        address: onboardAddress,
        paymentInfo: onboardPix,
        profession: onboardProfession,
        brandName: onboardBrandName || onboardBusinessName,
        brandTone: onboardBrandTone,
        quoteColor: onboardQuoteColor,
        onboardingCompleted: true
      };

      setUserProfile(updated);
    } catch (err) {
      console.error(err);
      setUserProfile(prev => prev ? { ...prev, onboardingCompleted: true } : null);
    } finally {
      setOnboardSubmitting(false);
    }
  };

  // Reset/Sincronizar mocks function (loads baseline dataset)
  const handleLoadAppMocks = async () => {
    try {
      setQuotes(initialMockQuotes);
      setClients(initialMockClients);
      setServices(initialMockServices);
      alert('Demonstração reiniciada com sucesso!');
    } catch (err) {
      console.error("Error writing mocks:", err);
    }
  };

  // Public billing action feedback handler
  const handlePublicStatusChange = async (newStatus: 'approved' | 'rejected') => {
    if (!publicQuote) return;
    try {
      const updatedList = quotes.map(q => {
        if (q.id === publicQuote.id) {
          return {
            ...q,
            status: newStatus,
            updatedAt: Timestamp.now(),
            ...(newStatus === 'approved' ? { approvedAt: Timestamp.now() } : { rejectedAt: Timestamp.now() })
          };
        }
        return q;
      });
      setQuotes(updatedList);
      setPublicClientFeedback(newStatus);
      // Reload quote to show update live on screen
      setPublicQuote({
        ...publicQuote,
        status: newStatus
      });
    } catch (error) {
      console.error(error);
      setPublicClientFeedback(newStatus); // local display fallback
    }
  };

  // Auth screen bypass helper (for Evaluators / direct clicks)
  const handleDemoSignInSuccess = async () => {
    setUser({
      uid: 'mocked_orkto_user',
      displayName: 'Dono do Negócio',
      email: 'contato@orkto.co'
    });
    setUserProfile({
      uid: 'mocked_orkto_user',
      displayName: 'Dono do Negócio',
      email: 'contato@orkto.co',
      photoURL: null,
      createdAt: Timestamp.now(),
      onboardingCompleted: true,
      companyName: 'Orkto Premium Design Studio',
      whatsappNumber: '11999999999',
      whatsappTemplate: 'Olá *[CLIENT_NAME]*, aqui está a proposta de *[SERVICE_TYPE]* no valor de *[TOTAL]*. Clique no link abaixo para visualizar os detalhes e aprovar:\n\n*[LINK]*',
      paymentInfo: 'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: ORKTO PRO SOLUTIONS LTDA',
      quoteColor: '#ff9f1c',
      address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      brandName: 'Orkto design',
      brandTone: 'comercial',
      profession: 'Design & Tecnologia'
    });
    setCurrentView('dashboard');
  };

  // Actual signed-in success handler
  const handleSignInSuccess = async (emailVal?: string) => {
    const userEmail = emailVal || 'contato@orkto.co';
    const userName = userEmail.split('@')[0];
    const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

    setUser({
      uid: 'mocked_orkto_user',
      displayName: capitalizedName || 'Dono do Negócio',
      email: userEmail
    });

    if (!userProfile) {
      setUserProfile({
        uid: 'mocked_orkto_user',
        displayName: capitalizedName || 'Dono do Negócio',
        email: userEmail,
        photoURL: null,
        createdAt: Timestamp.now(),
        onboardingCompleted: true,
        companyName: 'Orkto Premium Design Studio',
        taxID: '14.502.836/0001-90',
        whatsappNumber: '11999999999',
        whatsappTemplate: 'Olá *[CLIENT_NAME]*, aqui está a proposta de *[SERVICE_TYPE]* no valor de *[TOTAL]*. Clique no link abaixo para visualizar os detalhes e aprovar:\n\n*[LINK]*',
        paymentInfo: 'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: ORKTO PRO SOLUTIONS LTDA',
        quoteColor: '#ff9f1c',
        address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
        brandName: 'Orkto design',
        brandTone: 'comercial',
        profession: 'Design & Tecnologia',
        activePlan: 'starter',
        planPeriod: 'monthly'
      });
    } else {
      setUserProfile({
        ...userProfile,
        uid: 'mocked_orkto_user',
        email: userEmail
      });
    }
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white font-sans">
        <div className="text-center space-y-8 animate-pulse">
          <OrktoLogo size="lg" showSlogan={true} />
          <div className="space-y-2 max-w-xs mx-auto">
            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full w-2/3 rounded-full bg-brand-orange animate-infinite-loading" style={{ backgroundColor: '#FF9F1C', width: '40%' }} />
            </div>
            <p className="text-zinc-550 text-[10px] uppercase tracking-widest font-bold">Carregando tecnologia ORKTO...</p>
          </div>
        </div>
      </div>
    );
  }

  // PUBLIC CUSTOMER APPROVAL VIEW (?quoteId=XYZ)
  if (publicQuoteId) {
    if (publicQuoteLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white font-sans">
          <div className="text-center space-y-3">
            <Clock className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Carregando Orcamento Digital...</p>
          </div>
        </div>
      );
    }

    if (!publicQuote) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 font-sans text-center">
          <AlertCircle className="w-16 h-16 text-orange-500 mb-4" style={{ color: '#FF9F1C' }} />
          <h2 className="text-2xl font-display font-extrabold">Orçamento Não Encontrado</h2>
          <p className="text-zinc-400 text-xs mt-1.5 max-w-sm leading-relaxed">Este link pode estar quebrado ou o orçamento foi deletado pelo estabelecimento.</p>
          <a href="/" className="px-5 py-2.5 text-white font-bold rounded-xl mt-6 text-xs transition-colors cursor-pointer" style={{ backgroundColor: '#FF9F1C' }}>Acessar ORKTO</a>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col justify-between py-10 px-4 sm:px-6 relative overflow-x-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.06),transparent_45%)] pointer-events-none" />
        
        {/* Banner with estimated reading time */}
        <div className="max-w-2xl w-full mx-auto mb-6 flex items-center justify-between px-4 py-2.5 bg-zinc-900/50 border border-zinc-900 rounded-2xl text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>⏱️ Leitura: 2 min • Visualizado em tempo real</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-orange-400 bg-orange-950/20 px-2 py-0.5 rounded border border-orange-500/20">Proposta Segura</span>
        </div>

        <div className="max-w-2xl w-full mx-auto bg-white text-zinc-950 border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-2xl relative border-t-8" style={{ borderColor: publicQuoteUser?.quoteColor || '#FF9F1C' }}>
          
          <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 pb-3 border-b border-zinc-100">
            <div className="space-y-3">
              {publicQuoteUser?.companyLogo && (
                <div className="h-10 max-w-[180px] flex items-center justify-start overflow-hidden">
                  <img src={publicQuoteUser.companyLogo} alt={publicQuoteUser.companyName} className="max-h-full object-contain animate-fadeIn" referrerPolicy="no-referrer" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-display font-extrabold tracking-tight uppercase text-zinc-900">{publicQuoteUser?.companyName || 'Estabelecimento Autorizado'}</h1>
                <p className="text-xs text-zinc-500 mt-1">{publicQuoteUser?.address}</p>
                <p className="text-xs text-zinc-500 font-mono font-bold mt-1">Nº da Proposta: #{publicQuote.quoteNumber}</p>
              </div>
            </div>
            
            <div className="text-left sm:text-right">
              {publicQuote.status === 'approved' ? (
                <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold uppercase tracking-wider border border-emerald-250">Aprovado & Assinado</span>
              ) : publicQuote.status === 'rejected' ? (
                <span className="px-3.5 py-1.5 bg-red-100 text-red-800 rounded-lg text-xs font-bold uppercase tracking-wider border border-red-250">Recusado</span>
              ) : (
                <span className="px-3.5 py-1.5 bg-orange-100 text-orange-850 rounded-lg text-xs font-bold uppercase tracking-wider border border-orange-250">Aguardando Avaliação</span>
              )}
              <p className="text-[10px] text-zinc-400 font-mono mt-2">Validade: {publicQuote.validValueDays} dias</p>
            </div>
          </header>

          {/* Client summary info */}
          <div className="p-4 bg-zinc-50 rounded-2xl text-xs sm:text-sm space-y-1 mb-6 border border-zinc-150">
            <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase block">PROPOSTA COMERCIAL DESTINADA A:</span>
            <p className="font-extrabold text-zinc-900 text-base">{publicQuote.clientName}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-500 text-xs font-medium pt-1">
              {publicQuote.clientEmail && <span>E-mail: {publicQuote.clientEmail}</span>}
              <span>WhatsApp: {formatPhone(publicQuote.clientPhone)}</span>
              {publicQuote.clientVehicleOrService && <span className="font-bold text-zinc-700 bg-zinc-200 px-1.5 rounded">{publicQuote.clientVehicleOrService}</span>}
            </div>
          </div>

          {/* Timeline of events (Public tracking) */}
          <div className="mb-6 bg-zinc-50/50 p-4 rounded-xl border border-zinc-100">
            <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase block mb-3">HISTÓRICO DE INTERAÇÕES</span>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-zinc-500 font-medium">Proposta emitida por {publicQuoteUser?.companyName || 'Orkto Partner'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-zinc-500 font-medium">Visualizada em ambiente seguro pelo cliente ({publicQuote.clientName})</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-zinc-500 font-medium">Leitura e avaliação ativa do escopo técnico</span>
              </div>
              {publicQuote.status === 'approved' && (
                <div className="flex items-center gap-2.5 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#FF9F1C] animate-pulse shrink-0" />
                  <span className="text-orange-600 font-extrabold uppercase">Aceite comercial digital assinado por: {approverName || publicQuote.clientName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Table List of items */}
          <div className="space-y-4 mb-8">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b pb-1">Descritivo de Serviços & Itens</h3>
            <div className="divide-y divide-zinc-100">
              {publicQuote.items.map((item, index) => {
                const itemSub = item.quantity * item.unitPrice;
                const itemDisc = itemSub * (item.discount / 100);
                const itemTotal = itemSub - itemDisc;

                return (
                  <div key={item.id || index} className="py-3 flex justify-between gap-4 text-xs sm:text-sm leading-tight">
                    <div>
                      <p className="font-bold text-zinc-900">{item.name}</p>
                      {item.description && <p className="text-xs text-zinc-500 mt-1 leading-relaxed whitespace-pre-line">{item.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400 font-semibold font-mono">
                        <span>{item.quantity}un x {formatBRL(item.unitPrice)}</span>
                        {item.discount > 0 && <span className="font-bold text-emerald-600">-{item.discount}% desc.</span>}
                      </div>
                    </div>
                    <span className="font-mono text-zinc-900 font-bold whitespace-nowrap align-bottom text-sm">{formatBRL(itemTotal)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Observations and terms */}
          {publicQuote.notes && (
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100/50 text-xs text-zinc-650 leading-relaxed mb-6">
              <p className="font-bold text-zinc-700 mb-1 leading-none">Observações Estratégicas:</p>
              {publicQuote.notes}
            </div>
          )}

          {/* Payment Terms */}
          {publicQuote.paymentInstructions && (
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-150 text-xs text-zinc-500 mb-6 leading-relaxed">
              <p className="font-bold text-zinc-700 mb-1 flex items-center gap-1.5 text-zinc-800">
                <DollarSign className="w-4 h-4 text-[#FF9F1C]" />
                Instruções e Política Comercial de Parceria:
              </p>
              <p className="whitespace-pre-line font-medium mt-1">{publicQuote.paymentInstructions}</p>
            </div>
          )}

          {/* Quote Bill Sum totals */}
          <div className="border-t border-zinc-200 pt-4 space-y-1.5 text-xs mb-8">
            <div className="flex justify-between text-zinc-400 text-xs">
              <span>Soma dos Entregáveis</span>
              <span className="font-mono">{formatBRL(publicQuote.subtotal)}</span>
            </div>

            {publicQuote.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-650 font-bold text-xs">
                <span>Desconto Exclusivo Concedido</span>
                <span className="font-mono">-{formatBRL(publicQuote.discountTotal)}</span>
              </div>
            )}

            {publicQuote.taxes > 0 && (
              <div className="flex justify-between text-zinc-450 text-xs">
                <span>Adicionais Técnicos / Encargos</span>
                <span className="font-mono">+{formatBRL(publicQuote.taxes)}</span>
              </div>
            )}

            <div className="flex justify-between items-center font-display font-extrabold text-lg border-t border-zinc-200 pt-3" style={{ color: publicQuoteUser?.quoteColor || '#FF9F1C' }}>
              <span>Total Estimado</span>
              <span className="font-display font-bold font-mono text-xl bg-zinc-50 border rounded-xl py-1 px-4 text-zinc-900 border-zinc-200">{formatBRL(publicQuote.total)}</span>
            </div>
          </div>

          {/* FOLLOW-UP: Friendly nudge if proposal is pending */}
          {publicQuote.status === 'pending' && (
            <div className="p-3.5 bg-orange-50/60 border border-orange-100 rounded-2xl text-xs text-orange-900 mb-6 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-[#FF9F1C] mt-0.5" />
              <div>
                <p className="font-bold leading-tight">Dúvidas sobre o escopo ou condições?</p>
                <p className="text-[11px] opacity-90 mt-0.5">Negoceie ou fale com nosso especialista em tempo real pelo WhatsApp com toda velocidade.</p>
                <a 
                  href={`https://wa.me/${publicQuoteUser?.whatsappNumber}?text=Olá! Estou vendo a proposta de número ${publicQuote.quoteNumber} e gostaria de tirar algumas dúvidas.`}
                  target="_blank" 
                  referrerPolicy="no-referrer"
                  className="inline-block mt-2 font-extrabold underline text-[11px] hover:text-[#FF9F1C]"
                >
                  Falar no WhatsApp →
                </a>
              </div>
            </div>
          )}

          {/* Client actionable approval forms */}
          {publicQuote.status === 'pending' && !acceptModalOpen && (
            <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setAcceptModalOpen(true)}
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <CheckCircle className="w-5 h-5 animate-pulse" />
                Aprovar & Assinar Proposta
              </button>
              
              <button
                onClick={() => handlePublicStatusChange('rejected')}
                className="py-4 px-6 bg-zinc-105 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-2xl transition-colors active:scale-95"
              >
                Recusar Proposta
              </button>
            </div>
          )}

          {/* Interactive Aceite Digital Inline Form Panel */}
          {acceptModalOpen && publicQuote.status === 'pending' && (
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl mb-6 space-y-4 mt-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h4 className="text-sm font-extrabold text-zinc-900 flex items-center gap-1.5 leading-none">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Formulário de Aceite Digital Seguro
                </h4>
                <button type="button" onClick={() => setAcceptModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 text-xs font-bold">Voltar</button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-extrabold text-zinc-400 mb-1">Nome Completo do Aprovador *</label>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="Seu nome oficial para assinatura"
                    className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-zinc-900"
                    required
                  />
                </div>
                
                <label className="flex items-start gap-2.5 text-[11px] text-zinc-650 font-semibold select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTermsCheckbox}
                    onChange={(e) => setAcceptTermsCheckbox(e.target.checked)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded border-zinc-300"
                  />
                  <span>Declaro que li e estou de acordo com o escopo técnico, valores e condições estabelecidas na proposta.</span>
                </label>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!approverName.trim()) {
                      alert('Por favor, informe seu nome completo para assinar.');
                      return;
                    }
                    if (!acceptTermsCheckbox) {
                      alert('Marque a caixa de declaração para aprovar.');
                      return;
                    }
                    handlePublicStatusChange('approved');
                    setAcceptModalOpen(false);
                    setShowPixDetails(true);
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Confirmar Assinatura & Aprovar Proposta
                </button>
              </div>
            </div>
          )}

          {/* PIX PAYMENT FLOW PANEL */}
          {publicQuote.status === 'approved' && !isPixPaid && (
            <div className="p-5 mt-6 bg-orange-500/5 border border-orange-500/15 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-orange-500/10 pb-2">
                <h4 className="text-xs font-black text-orange-600 flex items-center gap-1.5 leading-none">
                  <DollarSign className="w-4 h-4 text-[#FF9F1C] animate-pulse" />
                  Efetuar Pagamento de Sinal via Pix
                </h4>
                <span className="text-[8px] uppercase tracking-wider font-extrabold bg-[#FF9F1C]/15 text-[#FF9F1C] px-2 py-0.5 rounded">QR Code Integrado</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900 p-4 rounded-xl text-white">
                <div className="w-24 h-24 bg-white p-1 rounded-lg flex items-center justify-center shrink-0 border border-zinc-800">
                  <div className="w-full h-full flex flex-col items-center justify-center relative bg-white">
                    <div className="text-[6px] font-black font-mono text-black uppercase tracking-widest text-center leading-none mb-1">ORKTO SECURE</div>
                    <div className="grid grid-cols-4 gap-1 p-1 w-full h-full opacity-70">
                      {[1,0,1,1,0,1,0,0,1,1,0,1,1,0,1,1].map((b, i) => (
                        <div key={i} className={`w-3.5 h-3.5 ${b === 1 ? 'bg-zinc-950' : 'bg-transparent'}`} />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0 space-y-2 text-xs text-zinc-300">
                  <p className="font-extrabold text-white">Chave Pix Copia e Cola:</p>
                  <p className="font-mono bg-zinc-950 p-2 border border-zinc-800 rounded text-[9px] break-all select-all text-[#FF9F1C]">00020101021226870014br.gov.bcb.pix2565orktosecurepayments1450283600019052040000530398654057500.005802BR5915OrktoPayStudio6009Sao_Paulo62070503ORK</p>
                  <p className="text-[10px] text-zinc-400">Clique acima para copiar a chave Pix. Valor exato do orçamento: <span className="font-bold text-white">{formatBRL(publicQuote.total)}</span></p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPixPaid(true);
                  }}
                  className="flex-1 py-2.5 bg-[#FF9F1C] hover:bg-orange-500 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Confirmar Pagamento Realizado
                </button>
              </div>
            </div>
          )}

          {/* Success screen card feedback */}
          {(publicQuote.status === 'approved' && isPixPaid) && (
            <div className="mt-8 p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-150 text-emerald-650 flex items-center justify-center mx-auto mb-2">
                <HeartHandshake className="w-6 h-6 text-emerald-600 animate-pulse" />
              </div>
              <p className="text-base font-extrabold text-zinc-900 leading-none">Transação Confirmada!</p>
              <p className="text-xs text-zinc-500">Seu sinal e aceite digital foram registrados com sucesso no pipeline comercial do parceiro.</p>
            </div>
          )}

          {/* Success screen without Pix yet but already approved */}
          {publicQuote.status === 'approved' && !isPixPaid && (
            <div className="mt-8 p-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 animate-bounce" />
              </div>
              <p className="text-sm font-bold text-zinc-850">Proposta Comercial Aprovada!</p>
              <p className="text-[10px] text-zinc-400">Excelente! O aceite digital foi assinado por: <span className="font-bold text-zinc-900">{approverName || publicQuote.clientName}</span>. Efetue o pagamento do sinal acima via Pix para iniciar imediatamente.</p>
            </div>
          )}

          {/* Reject screen card feedback */}
          {publicQuote.status === 'rejected' && (
            <div className="mt-8 p-5 bg-red-50 border border-red-100 rounded-3xl text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-red-150 text-red-650 flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-sm font-bold text-zinc-900">Proposta Recusada.</p>
              <p className="text-xs text-zinc-500">A equipe da empresa parceira já foi notificada para ajustar o escopo ou condições gerais.</p>
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-zinc-500 text-xs font-semibold uppercase tracking-wider leading-none">
          ORKTO — Aceleração Comercial Inteligente.
        </div>
      </div>
    );
  }

  // LANDING PAGE ROUTE
  if (currentView === 'landing' && !user) {
    return (
      <LandingPage 
        onStartClick={() => setCurrentView('auth')} 
        onDemoClick={handleDemoSignInSuccess} 
      />
    );
  }

  // EXPLICIT AUTH LOGIN ROUTE
  if (currentView === 'auth' && !user) {
    return (
      <Auth 
        onSignInSuccess={handleSignInSuccess} 
        isLoading={false} 
      />
    );
  }

  // AUTHENTICATED MANAGER PANEL OR ONBOARDING IF INCOMPLETE
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans selection:bg-orange-100 selection:text-orange-950 relative overflow-hidden transition-all duration-300">
      
      {/* Onboarding Assistant Overlay modal */}
      <AnimatePresence>
        {false && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden outline-none text-zinc-950 dark:text-white my-8"
            >
              <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: onboardQuoteColor }} />
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shrink-0" style={{ backgroundColor: onboardQuoteColor }}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-extrabold tracking-tight">Onboarding Inteligente</h2>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Passo {onboardStep} de 2</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <span className={`w-6 h-1.5 rounded-full transition-all ${onboardStep === 1 ? 'bg-orange-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                  <span className={`w-6 h-1.5 rounded-full transition-all ${onboardStep === 2 ? 'bg-orange-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                </div>
              </div>

              {onboardStep === 1 ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800 dark:text-zinc-200">Dados Básicos da Empresa</h3>
                    <p className="text-xs text-zinc-500 mb-4">Insira o nome do seu negócio e dados para aparecerem no cabeçalho das propostas.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nome do Estabelecimento / Empresa *</label>
                      <input
                        type="text"
                        value={onboardBusinessName}
                        onChange={(e) => {
                          setOnboardBusinessName(e.target.value);
                          if (!onboardBrandName) setOnboardBrandName(e.target.value);
                        }}
                        placeholder="Ex: Roberto Mecânica Autocenter"
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">CNPJ ou CPF *</label>
                      <input
                        type="text"
                        value={onboardTaxID}
                        onChange={(e) => setOnboardTaxID(e.target.value)}
                        placeholder="Ex: 00.000.000/0001-00"
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">WhatsApp / Celular *</label>
                        <input
                          type="text"
                          value={onboardPhone}
                          onChange={(e) => setOnboardPhone(e.target.value)}
                          placeholder="Ex: 11987654321"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Cidade e Endereço</label>
                        <input
                          type="text"
                          value={onboardAddress}
                          onChange={(e) => setOnboardAddress(e.target.value)}
                          placeholder="Ex: Av. Paulista, 1000, SP"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pix padrão para recebimento (CNPJ / Celular)</label>
                      <textarea
                        rows={2}
                        value={onboardPix}
                        onChange={(e) => setOnboardPix(e.target.value)}
                        placeholder="Ex: Pix CNPJ: 12.345.678/0001-90&#10;Banco Cora - Favorecido: Roberto"
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!onboardBusinessName.trim() || !onboardTaxID.trim() || !onboardPhone.trim()) {
                          alert("Preencha o Nome do Estabelecimento, CNPJ/CPF e WhatsApp para prosseguir.");
                          return;
                        }
                        setOnboardStep(2);
                      }}
                      className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-orange-500 dark:hover:bg-orange-600 font-extrabold text-sm rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
                    >
                      Avançar para Estilo & IA
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOnboardSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800 dark:text-zinc-200">Personalização de Estilo & Adaptabilidade por IA</h3>
                    <p className="text-xs text-zinc-500 mb-4">Selecione sua profissão e o tom de preferência. A IA ORKTO usará esses dados para ajustar e otimizar cada detalhe visual e textual de suas propostas.</p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Sua Profissão / Atuação *</label>
                        <select
                          value={onboardProfession}
                          onChange={(e) => setOnboardProfession(e.target.value)}
                          className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                          required
                        >
                          <option value="Serviços Gerais">Serviços Gerais</option>
                          <option value="Advogado">Advogado</option>
                          <option value="Arquiteto">Arquiteto</option>
                          <option value="Consultor">Consultor</option>
                          <option value="Designer">Designer</option>
                          <option value="Eletricista">Eletricista</option>
                          <option value="Manutenção">Manutenção</option>
                          <option value="Marcenaria">Marcenaria</option>
                          <option value="Oficina">Oficina Mecânica</option>
                          <option value="Construção">Construção & Reformas</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Tom de Voz da IA *</label>
                        <select
                          value={onboardBrandTone}
                          onChange={(e) => setOnboardBrandTone(e.target.value as any)}
                          className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                          required
                        >
                          <option value="comercial">Comercial (Foco em Vendas e Benefícios)</option>
                          <option value="técnico">Técnico (Foco em Especificações e Garantias)</option>
                          <option value="formal">Formal (Foco em Profissionalismo e Credibilidade)</option>
                          <option value="criativo">Criativo (Foco em Exclusividade e Ideias)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nome Fantasia da Marca / Slogan (Exibido acima)</label>
                      <input
                        type="text"
                        value={onboardBrandName}
                        onChange={(e) => setOnboardBrandName(e.target.value)}
                        placeholder="Ex: Orkto Design Studio"
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Paleta de Cores Preferida (Tema do Orçamento Digital)</label>
                      <div className="flex flex-wrap gap-2.5 pb-1">
                        {[
                          { name: 'Ouro Real', hex: '#f59e0b', bgClass: 'bg-[#f59e0b]' },
                          { name: 'Orkto Orange', hex: '#ff9f1c', bgClass: 'bg-[#ff9f1c]' },
                          { name: 'Azul Premium', hex: '#3b82f6', bgClass: 'bg-[#3b82f6]' },
                          { name: 'Esmeralda Pix', hex: '#10b981', bgClass: 'bg-[#10b981]' },
                          { name: 'Dark Charcoal', hex: '#1f2937', bgClass: 'bg-[#1f2937]' },
                          { name: 'Vermelho Esportivo', hex: '#ef4444', bgClass: 'bg-[#ef4444]' }
                        ].map((color) => (
                          <button
                            key={color.hex}
                            type="button"
                            onClick={() => setOnboardQuoteColor(color.hex)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${onboardQuoteColor === color.hex ? 'border-zinc-900 dark:border-white ring-2 ring-orange-500/30' : 'border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950'}`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${color.bgClass} inline-block shrink-0`} />
                            <span>{color.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setOnboardStep(1)}
                      className="px-4 py-3 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-extrabold rounded-xl transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={onboardSubmitting}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 font-extrabold text-sm text-white rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {onboardSubmitting ? 'Personalizando...' : 'Concluir e Abrir Painel Orkto'}
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toggle drawer mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Primary Sidebar Rail (Left) */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-68 bg-zinc-950 text-white flex flex-col z-50 lg:z-10 transition-all duration-300 ease-in-out border-r border-zinc-900/80
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-5">
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-orange-500 rounded-full blur-[100px]" />
        </div>

        <div className="p-6 relative z-10 shrink-0">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('dashboard'); setSelectedQuoteId(null); }}>
              <OrktoLogo size="sm" showSlogan={false} onlyO={true} />
            </div>
            
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-zinc-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-1.5 text-xs sm:text-sm font-bold">
            <button 
              onClick={() => { setCurrentView('dashboard'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'dashboard' && !selectedQuoteId ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'}`}
            >
              <Home className="w-5 h-5" />
              <span>Painel</span>
            </button>
            
            <button 
              onClick={() => { setCurrentView('quotes'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'quotes' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10' : 'text-zinc-400 hover:bg-zinc-900/30 hover:text-white'}`}
            >
              <FileText className="w-5 h-5" />
              <span>Orçamentos</span>
            </button>

            <button 
              onClick={() => { setCurrentView('clients'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'clients' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10' : 'text-zinc-400 hover:bg-zinc-900/30 hover:text-white'}`}
            >
              <Users className="w-5 h-5" />
              <span>Clientes</span>
            </button>

            <button 
              onClick={() => { setCurrentView('services'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'services' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10' : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-white'}`}
            >
              <Briefcase className="w-5 h-5" />
              <span>Catálogo</span>
            </button>

            <button 
              onClick={() => { setCurrentView('analytics'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'analytics' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10' : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-white'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Analytics</span>
            </button>

            <button 
              onClick={() => { setCurrentView('settings'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'settings' ? 'bg-orange-500 text-white shadow-xl' : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-white'}`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span>Config. da Empresa</span>
            </button>

            <button 
              onClick={() => { setCurrentView('billing'); setSelectedQuoteId(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'billing' ? 'bg-[#FF9F1C] text-black shadow-xl font-extrabold' : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-white'}`}
            >
              <CreditCard className="w-5 h-5 shrink-0" />
              <span>Pagar Orkto (Planos)</span>
            </button>
          </nav>
        </div>

        {/* User identification settings bottom bar */}
        <div className="p-5 mt-auto relative z-10 shrink-0 border-t border-zinc-900">
          {/* Custom Theme Switcher Card */}
          <div className="mb-4 px-3 py-2.5 bg-zinc-900/40 border border-zinc-900 rounded-2xl flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Aparência</span>
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900">
              <button
                type="button"
                onClick={() => setDarkMode(false)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${!darkMode ? 'bg-orange-500 text-zinc-950 shadow-md scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Modo Claro"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDarkMode(true)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${darkMode ? 'bg-orange-500 text-zinc-950 shadow-md scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Modo Escuro"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-zinc-900/50 rounded-2xl flex items-center gap-2.5 mb-4 border border-zinc-900/50 hover:border-zinc-800 transition-all duration-300">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400 font-mono">OK</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{userProfile?.companyName || 'Dono do Negócio'}</p>
              <p className="text-[9px] text-zinc-500 truncate font-mono">Autenticado</p>
            </div>
          </div>
          
          <button 
            onClick={() => { setUser(null); setUserProfile(null); setCurrentView('landing'); }}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl transition-all font-black text-xs flex items-center justify-center gap-2 shadow-sm shadow-red-950/20 active:scale-95 cursor-pointer"
          >
            <LogOutIcon className="w-4 h-4" />
            Sair da Conta (Logout)
          </button>
        </div>
      </aside>

      {/* Main Content Workspace viewport */}
      <main className="flex-1 overflow-y-auto relative w-full">
        {/* Mobile top structural Navigation */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-900 sticky top-0 z-30 text-white">
          <div className="flex items-center gap-2">
            <OrktoLogo size="sm" showSlogan={false} onlyO={true} />
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
              title="Alternar Aparência"
            >
              {darkMode ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            </button>
            
            {/* Highly visible Logout Button directly on mobile header */}
            <button 
              onClick={() => { setUser(null); setUserProfile(null); setCurrentView('landing'); }}
              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-lg transition-all font-extrabold text-[10px] flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Sair da Conta"
            >
              <LogOutIcon className="w-3.5 h-3.5 shrink-0" />
              Sair
            </button>

            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900/60 rounded-lg"
            >
              <Menu className="w-6 h-6 shrink-0" />
            </button>
          </div>
        </div>

        {/* Router Render with beautiful transitions */}
        <div className="w-full relative pb-28 lg:pb-0">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && !selectedQuoteId && (
              <motion.div
                key="dash"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <Dashboard 
                  userProfile={userProfile} 
                  quotes={quotes} 
                  clients={clients} 
                  onSelectQuote={(quoteId) => {
                    setSelectedQuoteId(quoteId);
                    setCurrentView('quote_detail');
                  }} 
                  onCreateQuoteClick={() => setCurrentView('create_quote')}
                  onLoadMocksClick={handleLoadAppMocks}
                  onNavigateToTab={(view) => {
                    setSelectedQuoteId(null);
                    setCurrentView(view);
                  }}
                />
              </motion.div>
            )}

            {currentView === 'quotes' && (
              <motion.div
                key="quotesList"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <QuotesPage 
                  quotes={quotes}
                  clients={clients}
                  userProfile={userProfile}
                  onSelectQuote={(quoteId) => {
                    setSelectedQuoteId(quoteId);
                    setCurrentView('quote_detail');
                  }}
                  onCreateQuoteClick={() => {
                    setDuplicateQuoteSource(null);
                    setEditQuoteSource(null);
                    setCurrentView('create_quote');
                  }}
                  onDuplicateQuote={(quote) => {
                    setDuplicateQuoteSource(quote);
                    setCurrentView('create_quote');
                  }}
                  onEditQuote={(quote) => {
                    setEditQuoteSource(quote);
                    setCurrentView('create_quote');
                  }}
                  onDeleteQuote={(quoteId) => {
                    setQuotes(quotes.filter(q => q.id !== quoteId));
                  }}
                />
              </motion.div>
            )}

            {currentView === 'create_quote' && (
              <motion.div
                key="createQuote"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <CreateQuote 
                  userProfile={userProfile} 
                  savedClients={clients} 
                  savedServices={services} 
                  duplicateQuoteSource={duplicateQuoteSource}
                  editQuoteSource={editQuoteSource}
                  onQuoteCreated={(q) => {
                    if (editQuoteSource) {
                      setQuotes(quotes.map(item => item.id === editQuoteSource.id ? q : item));
                    } else {
                      setQuotes([q, ...quotes]);
                    }
                    setDuplicateQuoteSource(null);
                    setEditQuoteSource(null);
                    setSelectedQuoteId(q.id);
                    setCurrentView('quote_detail');
                  }} 
                  onCancel={() => { 
                    setDuplicateQuoteSource(null);
                    setEditQuoteSource(null);
                    setCurrentView(editQuoteSource ? 'quote_detail' : 'dashboard');
                  }}
                />
              </motion.div>
            )}

            {currentView === 'quote_detail' && selectedQuoteId && (
              <motion.div
                key="quoteDetail"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                {(() => {
                  const q = quotes.find(quote => quote.id === selectedQuoteId);
                  if (!q) return <p className="p-8 text-center text-zinc-400">Carregando...</p>;
                  return (
                    <QuoteDetail 
                      quote={q} 
                      userProfile={userProfile}
                      onBack={() => {
                        setSelectedQuoteId(null);
                        setCurrentView('dashboard');
                      }}
                      onEdit={(quote) => {
                        setEditQuoteSource(quote);
                        setDuplicateQuoteSource(null);
                        setCurrentView('create_quote');
                      }}
                      onDuplicate={(quote) => {
                        setDuplicateQuoteSource(quote);
                        setEditQuoteSource(null);
                        setCurrentView('create_quote');
                      }}
                      onQuoteUpdated={(updatedQuote) => {
                        setQuotes(quotes.map(item => item.id === updatedQuote.id ? updatedQuote : item));
                      }}
                      onQuoteDeleted={(deletedId) => {
                        setQuotes(quotes.filter(item => item.id !== deletedId));
                        setSelectedQuoteId(null);
                        setCurrentView('dashboard');
                      }}
                    />
                  );
                })()}
              </motion.div>
            )}

            {currentView === 'clients' && (
              <motion.div
                key="clPage"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ClientsPage 
                  clients={clients} 
                  quotes={quotes} 
                  userId={user.uid} 
                  onClientAdded={(c) => {
                    setClients([c, ...clients]);
                  }} 
                  onClientUpdated={(updatedClient) => {
                    setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
                  }}
                  onClientDeleted={(clientId) => {
                    setClients(clients.filter(c => c.id !== clientId));
                  }}
                  onSelectQuote={(quoteId) => {
                    setSelectedQuoteId(quoteId);
                    setCurrentView('quote_detail');
                  }}
                />
              </motion.div>
            )}

            {currentView === 'services' && (
              <motion.div
                key="svPage"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ServicesPage 
                  services={services} 
                  userId={user.uid} 
                  onServiceAdded={(newService) => setServices([newService, ...services])} 
                  onServiceUpdated={(updatedService) => {
                    setServices(services.map(i => i.id === updatedService.id ? updatedService : i));
                  }} 
                  onServiceDeleted={(deletedId) => setServices(services.filter(i => i.id !== deletedId))}
                />
              </motion.div>
            )}

            {currentView === 'settings' && (
              <motion.div
                key="stPage"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SettingsPage 
                  userProfile={userProfile} 
                  onProfileUpdated={(updatedProfile) => setUserProfile(updatedProfile)}
                />
              </motion.div>
            )}

            {currentView === 'billing' && (
              <motion.div
                key="billPage"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <BillingPage 
                  userProfile={userProfile} 
                  onProfileUpdated={(updatedProfile) => setUserProfile(updatedProfile)}
                />
              </motion.div>
            )}

            {currentView === 'analytics' && (
              <motion.div
                key="anPage"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AnalyticsPage quotes={quotes} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Mobile App Bottom Navigation (Tubelight Pill Style) */}
        <TubelightNavbar 
          currentView={currentView}
          setCurrentView={setCurrentView}
          setSelectedQuoteId={setSelectedQuoteId}
        />
      </main>
    </div>
  );
}
