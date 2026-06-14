import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  Receipt, 
  ArrowRight,
  Plus,
  Clock,
  Send,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  FileText,
  Table as TableIcon,
  Bell,
  Search,
  Zap,
  Info,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Quote, SavedClient, UserProfile } from '../types';
import { formatBRL, formatPhone, getCleanPhoneForWhatsApp } from '../utils/format';
import OrktoLogo from './OrktoLogo';
import { getAccessToken, googleSignIn } from '../lib/firebaseAuth';
import { exportQuotesToSheets } from '../lib/workspaceApi';

interface DashboardProps {
  userProfile: UserProfile | null;
  quotes: Quote[];
  clients: SavedClient[];
  onSelectQuote: (id: string) => void;
  onCreateQuoteClick: () => void;
  onLoadMocksClick?: () => void;
  onNavigateToTab?: (tab: 'landing' | 'auth' | 'dashboard' | 'create_quote' | 'quote_detail' | 'clients' | 'services' | 'settings' | 'analytics') => void;
}

import { MagnetizeButton } from './ui/magnetize-button';

export default function Dashboard({ 
  userProfile, 
  quotes, 
  clients, 
  onSelectQuote, 
  onCreateQuoteClick,
  onLoadMocksClick,
  onNavigateToTab
}: DashboardProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(false);

  // Convert timestamps or dates safely to Date objects
  const convertToDateValue = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
  };

  const handleExportToSheets = async () => {
    try {
      setIsExporting(true);
      setSheetUrl(null);
      
      let token = await getAccessToken();
      if (!token) {
        // Authenticate with Google on-demand if no cached token exists
        const loginRes = await googleSignIn();
        if (loginRes?.accessToken) {
          token = loginRes.accessToken;
        } else {
          throw new Error('Conta Google não está conectada. Por favor, conecte-a para prosseguir.');
        }
      }

      const url = await exportQuotesToSheets(token, quotes);
      setSheetUrl(url);
      alert('Seus orçamentos foram sincronizados e exportados com sucesso para o Google Sheets!');
    } catch (err: any) {
      console.error(err);
      alert('Falha na sincronização com o Google Sheets: ' + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  // Get trend data for the chart (approved quotes)
  const getTrendData = () => {
    const trendData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' });
      const sanitizedLabel = label.replace('.', '');
      const capitalizedLabel = sanitizedLabel.charAt(0).toUpperCase() + sanitizedLabel.slice(1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendData.push({
        monthKey,
        label: capitalizedLabel,
        revenue: 0,
        count: 0
      });
    }

    quotes.forEach(quote => {
      if (quote.status !== 'approved') return;
      const qDate = convertToDateValue(quote.createdAt);
      const qMonthKey = `${qDate.getFullYear()}-${String(qDate.getMonth() + 1).padStart(2, '0')}`;
      const found = trendData.find(pt => pt.monthKey === qMonthKey);
      if (found) {
        found.revenue += quote.total;
        found.count += 1;
      }
    });

    return trendData;
  };

  const chartData = getTrendData();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111111]/95 border border-[#2B2B2B] p-3 rounded-xl shadow-xl text-xs space-y-1 font-sans text-white">
          <p className="font-bold text-zinc-400 capitalize">{label}</p>
          <p className="text-sm font-extrabold text-[#FF9F1C] font-mono">
            {formatBRL(payload[0].value)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {payload[0].payload.count} aprovados
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate 5 specified stats: Receita potencial, Enviados, Aprovados, Pendentes, Taxa de conversão
  const calculateStats = () => {
    const totalPotential = quotes.reduce((sum, q) => sum + q.total, 0);
    const sentCount = quotes.length;
    
    const approvedQuotes = quotes.filter(q => q.status === 'approved');
    const approvedTotal = approvedQuotes.reduce((sum, q) => sum + q.total, 0);

    const pendingQuotes = quotes.filter(q => q.status === 'pending');
    const pendingTotal = pendingQuotes.reduce((sum, q) => sum + q.total, 0);

    const typedQuotes = quotes.filter(q => q.status !== 'expired');
    const conversionRate = typedQuotes.length > 0 
      ? Math.round((approvedQuotes.length / typedQuotes.length) * 100) 
      : 0;

    return {
      totalPotential,
      sentCount,
      approvedTotal,
      approvedCount: approvedQuotes.length,
      pendingTotal,
      pendingCount: pendingQuotes.length,
      conversionRate
    };
  };

  const getExpirationAlerts = () => {
    const alerts: { quote: Quote; daysLeft: number; isExpired: boolean }[] = [];
    const now = new Date();
    
    quotes.forEach(q => {
      if (q.status !== 'pending') return;
      
      const qDate = convertToDateValue(q.createdAt);
      const expirationDate = new Date(qDate);
      expirationDate.setDate(expirationDate.getDate() + (q.validValueDays || 7));
      
      const diffTime = expirationDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        alerts.push({ quote: q, daysLeft: diffDays, isExpired: true });
      } else if (diffDays <= 3) {
        alerts.push({ quote: q, daysLeft: diffDays, isExpired: false });
      }
    });
    
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  };

  const expirationAlerts = getExpirationAlerts();
  const stats = calculateStats();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] uppercase font-bold tracking-wider">Aprovado</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] uppercase font-bold tracking-wider">Recusado</span>;
      default:
        return <span className="px-2 py-0.5 bg-orange-500/10 text-[#FF9F1C] border border-[#FF9F1C]/20 rounded text-[10px] uppercase font-bold tracking-wider">Pendente</span>;
    }
  };

  const getWhatsAppReminderLink = (quote: Quote) => {
    const origin = window.location.origin;
    const viewLink = `${origin}?quoteId=${quote.id}`;
    const text = `Olá *${quote.clientName}*! Seu orçamento #${quote.quoteNumber} para *${quote.clientVehicleOrService || 'serviços'}* ainda está pendente de aprovação. Dê uma olhada no link do orçamento digital para conferir os itens e confirmar por lá: ${viewLink}`;
    return `https://wa.me/${getCleanPhoneForWhatsApp(quote.clientPhone)}?text=${encodeURIComponent(text)}`;
  };

  // Commercial alerts trigger (pending quotes that are older than 24h or high value)
  const getCommercialAlerts = () => {
    const alerts = [];
    quotes.forEach(q => {
      if (q.status === 'pending' && q.total > 5000) {
        alerts.push({
          id: `alert_high_${q.id}`,
          type: 'high_value',
          message: `Proposta de alto valor (${formatBRL(q.total)}) pendente com ${q.clientName}! Entre em contato para acelerar o fechamento.`,
          quote: q
        });
      }
    });
    return alerts;
  };

  const commercialAlerts = getCommercialAlerts();

  const filteredQuotes = quotes.filter(quote => {
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    const matchesSearch = quote.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          quote.quoteNumber.includes(searchQuery) ||
                          (quote.clientVehicleOrService && quote.clientVehicleOrService.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getFollowUpQuotes = () => {
    return quotes.filter(q => q.status === 'pending');
  };

  const followUps = getFollowUpQuotes();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 bg-transparent text-zinc-900 dark:text-zinc-50 min-h-screen">
      
      {/* Top action header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-850">
        <div className="flex items-center gap-4">
          <OrktoLogo size="md" showSlogan={false} />
          <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight leading-none">
                Painel Geral • <span className="text-zinc-500 dark:text-zinc-400 font-medium">{userProfile?.companyName || 'Meu Negócio'}</span>
              </h1>
              {userProfile?.activePlan === 'pro' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/10 border border-sky-400/30 text-sky-400 text-[10px] font-extrabold uppercase rounded-full animate-pulse tracking-wide shadow-sm shadow-sky-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  Premium Pro
                </span>
              )}
              {userProfile?.activePlan === 'business' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-500/10 border border-purple-400/30 text-purple-400 text-[10px] font-extrabold uppercase rounded-full animate-pulse tracking-wide shadow-sm shadow-purple-500/10">
                  <Sparkles className="w-3 h-3 text-purple-400 animate-spin-slow" />
                  Business Corp
                </span>
              )}
              {(!userProfile?.activePlan || userProfile?.activePlan === 'starter') && (
                <button
                  onClick={() => onNavigateToTab?.('settings')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FF9F1C]/10 border border-[#FF9F1C]/30 text-[#FF9F1C] hover:bg-[#FF9F1C]/25 text-[9px] font-extrabold uppercase rounded-full tracking-wide transition-all select-none hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C] animate-ping" />
                  Testar Pro • Upgrade ↗
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-1.5">
              Reforçando sua velocidade comercial com estilo premium.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar orçamento..."
              className="pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:border-[#FF9F1C] w-48 text-zinc-900 dark:text-white transition-colors"
            />
          </div>

          <MagnetizeButton 
            onClick={onCreateQuoteClick}
            particleCount={10}
            attractRadius={30}
            className="flex items-center justify-center gap-2 px-5 py-3 min-w-0 h-auto bg-[#FF9F1C] border-none text-black font-extrabold rounded-xl text-xs hover:bg-[#FF9F1C] hover:opacity-90 dark:bg-[#FF9F1C] dark:hover:bg-[#FF9F1C] dark:text-black transition-all shadow-lg shadow-orange-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova proposta
          </MagnetizeButton>
        </div>
      </header>

      {/* Primary showcase banner: "Seu orçamento virou sua vitrine." */}
      <div className="mb-10 bg-gradient-to-r from-zinc-100 to-white dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl dark:shadow-2xl transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF9F1C]/5 rounded-full -mr-16 -mt-16 pointer-events-none blur-xl" />
        
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FF9F1C]/10 border border-[#FF9F1C]/25 text-[#FF9F1C] text-[9px] uppercase font-bold tracking-widest rounded-md">
            <Zap className="w-3 h-3" />
            <span>Foco Comercial</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Seu orçamento virou sua <span className="text-[#FF9F1C]">vitrine</span>.
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl">
            Apresentações de alto impacto visual encantam mais e fecham propostas com velocidade recorde. Responda antes da concorrência comercial.
          </p>
        </div>

        <MagnetizeButton
          onClick={onCreateQuoteClick}
          particleCount={8}
          className="px-5 py-3 min-w-0 h-auto bg-[#FF9F1C]/10 hover:bg-[#FF9F1C]/25 border border-[#FF9F1C]/30 text-[#FF9F1C] dark:bg-[#FF9F1C]/10 dark:hover:bg-[#FF9F1C]/25 dark:text-[#FF9F1C] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 self-start sm:self-auto shrink-0 cursor-pointer"
        >
          Criar em 60 segundos
          <ArrowRight className="w-4 h-4" />
        </MagnetizeButton>
      </div>

      {/* Onboarding Checklist & Usage Quotas (Goal Gradient Effect / Loss Aversion / Endowment Effect) */}
      {(() => {
        const checklistSteps = [
          {
            id: 'step_auth',
            title: 'Criar conta e ativar ambiente comercíal',
            desc: 'Acesso seguro ativado e inicializado com sucesso.',
            completed: true,
          },
          {
            id: 'step_profile',
            title: 'Personalizar dados de Cobrança & Pix',
            desc: 'Insira o nome da sua empresa, telefone e Pix padrão nas Configurações.',
            completed: !!userProfile?.companyName && userProfile?.companyName !== 'Orkto Premium Design Studio' && userProfile?.companyName !== 'Meu Negócio',
            actionLabel: 'Ajustar Perfil',
            onClick: () => onNavigateToTab?.('settings'),
          },
          {
            id: 'step_client',
            title: 'Cadastrar primeiro cliente no catálogo',
            desc: 'Adicione um novo cliente para usar o preenchimento automático das propostas.',
            completed: clients.length > 3,
            actionLabel: 'Cadastrar Cliente',
            onClick: () => onNavigateToTab?.('clients'),
          },
          {
            id: 'step_quote',
            title: 'Emitir primeiro orçamento com Copy por IA',
            desc: 'Crie uma proposta única e use nosso Polidor de Escopo por Inteligência Artificial.',
            completed: quotes.length > 2,
            actionLabel: 'Disparar Orçamento',
            onClick: () => onCreateQuoteClick(),
          }
        ];

        const completedCount = checklistSteps.filter(s => s.completed).length;
        const progressPercentage = Math.round((completedCount / checklistSteps.length) * 100);
        const checklistComplete = completedCount === checklistSteps.length;

        // Check Starter Quota warning (Loss Aversion trigger)
        const isStarter = !userProfile?.activePlan || userProfile?.activePlan === 'starter';
        const usedQuotes = quotes.length;
        const maxStarterQuotes = 5;
        const isQuotaWarning = isStarter && usedQuotes >= 3;

        return (
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Onboarding progress card */}
            <div className={`col-span-1 lg:col-span-2 bg-white dark:bg-zinc-900 border ${checklistComplete ? 'border-emerald-500/20' : 'border-zinc-200 dark:border-zinc-800'} rounded-3xl p-6 shadow-md dark:shadow-xl relative overflow-hidden transition-all duration-300`}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-orange-500/15 text-orange-400 rounded-lg text-xs">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider font-display">
                      Ativação do Funil de Conversão
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {checklistComplete 
                      ? 'Sua máquina de vendas está 100% otimizada! Conversão projetada em +34%.' 
                      : 'Complete estes passos para calibrar seu SaaS comercial e fechar propostas velozes.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsChecklistCollapsed(!isChecklistCollapsed)}
                  className="text-xs text-[#FF9F1C] hover:underline font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg select-none cursor-pointer"
                >
                  {isChecklistCollapsed ? 'Ver Tarefas' : 'Recolher'}
                </button>
              </div>

              {/* Progress bar (Goal Gradient) */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  <span>Progresso do Setup comercial</span>
                  <span className={`${checklistComplete ? 'text-emerald-500 dark:text-emerald-400' : 'text-[#FF9F1C]'}`}>{progressPercentage}% Concluído</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-550 ${checklistComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-600 to-[#FF9F1C]'}`} 
                    style={{ width: `${progressPercentage}%` }} 
                  />
                </div>
              </div>

              {!isChecklistCollapsed && (
                <div className="space-y-3 pt-2">
                  {checklistSteps.map((step, idx) => (
                    <div 
                      key={step.id} 
                      className={`p-3 rounded-2xl border ${step.completed ? 'bg-emerald-500/5 border-emerald-500/10 text-zinc-600 dark:text-zinc-300' : 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {step.completed ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className={`text-xs font-bold ${step.completed ? 'text-zinc-400 dark:text-zinc-550 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>
                            {step.title}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>

                      {!step.completed && step.onClick && (
                        <button
                          type="button"
                          onClick={step.onClick}
                          className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-[10px] uppercase rounded-lg transition-all cursor-pointer"
                        >
                          {step.actionLabel}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quota & Retention card (Loss Aversion & Trust triggers) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-md dark:shadow-xl flex flex-col justify-between relative overflow-hidden transition-all duration-300">
              {/* Background abstract texture */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-[#FF9F1C]/15 text-[#FF9F1C] rounded-lg">
                    <Clock className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider font-display">
                    Estatísticas da Conta
                  </h3>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">Plano Comercial:</span>
                    <span className="font-bold text-[#FF9F1C] uppercase font-mono tracking-wide">
                      {userProfile?.activePlan || 'Starter (Grátis)'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs border-t border-zinc-100 dark:border-zinc-900 pt-2">
                    <span className="text-zinc-500 dark:text-zinc-400">Total de Orçamentos:</span>
                    <span className="font-bold text-zinc-850 dark:text-white font-mono">{usedQuotes} enviados</span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-zinc-105 dark:border-zinc-900 pt-2">
                    <span className="text-zinc-550 dark:text-zinc-400">Conversão Média:</span>
                    <span className="font-bold text-emerald-500 dark:text-emerald-400 font-mono">
                      {quotes.length > 0 
                        ? `${Math.round((quotes.filter(q => q.status === 'approved').length / quotes.length) * 100)}%` 
                        : '0%'}
                    </span>
                  </div>
                </div>

                {isStarter && (
                  <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
                      O plano <strong className="text-orange-500 dark:text-orange-400">Starter</strong> limita sua empresa a <strong className="text-zinc-900 dark:text-white">5 propostas ativas</strong>. Evite bloqueios comerciais.
                    </p>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div 
                        className={`h-full ${usedQuotes >= 4 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} 
                        style={{ width: `${Math.min(100, (usedQuotes / maxStarterQuotes) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-right text-zinc-450 dark:text-zinc-500 font-mono mt-1">{usedQuotes} de 5 utilizados</p>
                  </div>
                )}

                {!isStarter && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <p className="text-[10px] text-emerald-400 font-bold">
                      Limites Comerciais Estendidos • Propostas Ilimitadas
                    </p>
                  </div>
                )}
              </div>

              {isStarter && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('settings')}
                  className="w-full mt-4 py-3 bg-[#FF9F1C] hover:opacity-90 text-black font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 select-none cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  Liberar Propostas Ilimitadas
                </button>
              )}
            </div>
          </div>
        );
      })()}
      {commercialAlerts.length > 0 && (
        <div className="mb-4 space-y-2 select-none">
          {commercialAlerts.map(alert => (
            <div key={alert.id} className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-bold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{alert.message}</span>
                <button 
                  type="button"
                  onClick={() => onSelectQuote(alert.quote.id)}
                  className="ml-2.5 underline hover:text-zinc-800 dark:hover:text-white transition-colors text-[11px] cursor-pointer"
                >
                  Abrir Proposta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {expirationAlerts.length > 0 && (
        <div className="mb-8 space-y-2 select-none">
          {expirationAlerts.map((alert) => (
            <div key={`expir_${alert.quote.id}`} 
              className={`p-3 border rounded-xl text-xs font-bold flex items-start gap-2.5 ${
                alert.isExpired 
                  ? 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400' 
                  : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  {alert.isExpired ? 'Vencido: ' : 'Expira em breve: '}
                  A proposta de <strong className="font-extrabold">{alert.quote.clientName}</strong> ({formatBRL(alert.quote.total)}) {alert.isExpired ? 'passou da validade' : `vence em ${alert.daysLeft} dia${alert.daysLeft === 1 ? '' : 's'}`}.
                </span>
                <div className="flex items-center gap-2">
                  <a 
                    href={getWhatsAppReminderLink(alert.quote)} 
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5 transition-colors cursor-pointer ${
                      alert.isExpired ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                    }`}
                  >
                    <Send className="w-3 h-3" /> Cobrar Cliente
                  </a>
                  <button 
                    type="button"
                    onClick={() => onSelectQuote(alert.quote.id)}
                    className="underline hover:opacity-80 transition-opacity text-[11px] cursor-pointer"
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid of 5 requested premium metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        
        {/* Receita potencial */}
        <div className="bg-white dark:bg-zinc-905 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-md relative overflow-hidden flex flex-col justify-between transition-all duration-300">
          <div>
            <p className="text-[9px] font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-widest mb-1">Receita Potencial</p>
            <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white tracking-tight mt-1">{formatBRL(stats.totalPotential)}</p>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 self-end mt-4">Todos os envios</span>
        </div>

        {/* Enviados */}
        <div className="bg-white/80 dark:bg-zinc-900/60 p-5 rounded-2xl border border-zinc-195 dark:border-zinc-800/80 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300">
          <div>
            <p className="text-[9px] font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-widest mb-1 font-sans">Enviados</p>
            <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white mt-1">{stats.sentCount} propostas</p>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 self-end mt-4">Digital pipeline</span>
        </div>

        {/* Aprovados */}
        <div className="bg-emerald-500/10 dark:bg-emerald-600/10 p-5 rounded-2xl border border-emerald-500/20 shadow-sm dark:shadow-md relative overflow-hidden flex flex-col justify-between transition-all duration-300">
          <div>
            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Aprovados</p>
            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{formatBRL(stats.approvedTotal)}</p>
          </div>
          <span className="text-[10px] text-emerald-500/80 dark:text-emerald-450 self-end mt-4">{stats.approvedCount} fechados</span>
        </div>

        {/* Pendentes */}
        <div className="bg-orange-500/10 p-5 rounded-2xl border border-orange-500/20 shadow-sm dark:shadow-md relative overflow-hidden flex flex-col justify-between transition-all duration-300">
          <div>
            <p className="text-[9px] font-bold text-[#FF9F1C] uppercase tracking-widest mb-1">Pendentes</p>
            <p className="text-lg font-bold font-mono text-[#FF9F1C] mt-1">{formatBRL(stats.pendingTotal)}</p>
          </div>
          <span className="text-[10px] text-[#FF9F1C]/80 self-end mt-4">{stats.pendingCount} pendentes</span>
        </div>

        {/* Taxa de Conversão */}
        <div className="bg-white/60 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300">
          <div>
            <p className="text-[9px] font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-widest mb-1">Conversão</p>
            <p className="text-2xl font-black mt-1 text-zinc-900 dark:text-white">{stats.conversionRate}%</p>
          </div>
          <span className="text-[10px] text-zinc-500 self-end mt-4">Propostas aceitas</span>
        </div>

      </div>

      {/* Seção Fechamento Rápido */}
      <div className="mb-10 p-6 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <Zap className="w-4 h-4 text-[#FF9F1C] animate-pulse" />
              Fechamento Rápido Orko
            </h3>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-1">Gargalos comerciais e oportunidades de fechamento imediato</p>
          </div>
          <span className="text-[9px] uppercase tracking-widest font-extrabold bg-[#FF9F1C]/15 text-[#FF9F1C] border border-[#FF9F1C]/25 px-2 py-0.5 rounded">
            Foco Conversão
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Cliente visualizou */}
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between hover:border-cyan-500/35 transition-all group shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[8px] font-extrabold uppercase tracking-widest rounded">
                  Cliente Visualizou
                </span>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-bold">Hoje, 14:32</span>
              </div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">Juliana Albuquerque</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">Visualizou "Landing Page Premium". Retorno imediato aumenta conversão em até 82%.</p>
            </div>
            <button
              onClick={() => onSelectQuote('mq_1')}
              className="mt-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/40 text-cyan-750 dark:text-cyan-400 dark:hover:bg-cyan-900/30 border border-cyan-250 dark:border-cyan-800/35 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Ver Detalhes</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Card 2: Follow-up sugerido */}
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between hover:border-[#FF9F1C]/35 transition-all group shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-orange-500/10 text-[#FF9F1C] text-[8px] font-extrabold uppercase tracking-widest rounded">
                  Follow-up Sugerido
                </span>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-bold">Há 1 dia</span>
              </div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-[#FF9F1C] transition-colors">Henrique Silveira</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">Vortex Tech visualizou mas não assinou a proposta de UX Audit.</p>
            </div>
            {quotes.find(q => q.id === 'mq_2') ? (
              <a
                href={getWhatsAppReminderLink(quotes.find(q => q.id === 'mq_2')!)}
                target="_blank"
                referrerPolicy="no-referrer"
                className="mt-3 py-1.5 bg-[#FF9F1C]/10 text-[#FF9F1C] hover:bg-[#FF9F1C]/20 border border-[#FF9F1C]/25 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1 text-center cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Enviar Cobrança</span>
              </a>
            ) : (
              <button
                onClick={onCreateQuoteClick}
                className="mt-3 py-1.5 bg-[#FF9F1C]/10 text-[#FF9F1C] text-[9px] font-bold uppercase tracking-widest rounded-lg cursor-pointer"
              >
                <span>Criar Proposta</span>
              </button>
            )}
          </div>

          {/* Card 3: Proposta aprovada */}
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between hover:border-emerald-500/35 transition-all group shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold uppercase tracking-widest rounded">
                  Proposta Aprovada
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-[#10B981] font-bold">Aceite Ativo</span>
              </div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Juliana Albuquerque</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">Assinatura digital efetuada com sucesso: "Marinho Negócios Digitais".</p>
            </div>
            <button
              onClick={() => onSelectQuote('mq_1')}
              className="mt-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/40 text-emerald-750 dark:text-emerald-400 dark:hover:bg-emerald-900/30 border border-emerald-250 dark:border-emerald-800/35 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Ver Assinatura</span>
              <CheckCircle className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
            </button>
          </div>

          {/* Card 4: Pagamento pendente */}
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between hover:border-yellow-500/35 transition-all group shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[8px] font-extrabold uppercase tracking-widest rounded">
                  Pagamento Pendente
                </span>
                <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-bold">R$ 7.500</span>
              </div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">Marinho Negócios</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">Pix de R$ 7.500 gerado de forma automática. Aguardando liberação bancária.</p>
            </div>
            <button
              onClick={() => onSelectQuote('mq_1')}
              className="mt-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/40 text-yellow-750 dark:text-yellow-450 dark:hover:bg-yellow-905/30 border border-yellow-250 dark:border-yellow-800/35 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Ver Pix / QR Code</span>
              <TrendingUp className="w-3 h-3 text-yellow-500 dark:text-yellow-450" />
            </button>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Graph and Proposals List */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Revenue chart */}
          <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm transition-colors">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-150 dark:border-zinc-850">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#FF9F1C]" />
                  Faturamento Comercial Realizado
                </h3>
                <p className="text-[10px] text-zinc-500 mt-1">Evolução do caixa consolidado</p>
              </div>
            </div>

            <div className="h-60 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF9F1C" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#FF9F1C" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                  <XAxis dataKey="label" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#555" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#FF9F1C" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Proposals List Card */}
          <section className="bg-[#2B2B2B]/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-850 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">Propostas Recentes</h3>
                
                {/* Status tabs */}
                <div className="flex bg-[#111111] p-1 rounded-lg text-[10px] font-bold gap-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded transition-colors ${statusFilter === 'all' ? 'bg-[#FF9F1C] text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded transition-colors ${statusFilter === 'pending' ? 'bg-[#FF9F1C] text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Pendentes ({quotes.filter(q => q.status === 'pending').length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('approved')}
                    className={`px-2.5 py-1 rounded transition-colors ${statusFilter === 'approved' ? 'bg-[#FF9F1C] text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Aprovados
                  </button>
                </div>
              </div>

              {/* Quick Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por nome, escopo ou número..."
                  className="w-full pl-9 pr-4 py-2 bg-[#111111] border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {filteredQuotes.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 space-y-2">
                <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">Nenhum registro encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-850">
                {filteredQuotes.map(quote => (
                  <div key={quote.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#2B2B2B]/60 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#111111] rounded-xl flex items-center justify-center text-zinc-400 border border-zinc-800 shrink-0">
                        <Receipt className="w-4.5 h-4.5 text-[#FF9F1C]" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="font-extrabold text-sm text-white truncate">{quote.clientName}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                          <span className="font-mono bg-[#111111] text-zinc-400 px-1.5 py-0.5 rounded font-bold">#{quote.quoteNumber}</span>
                          {quote.clientVehicleOrService && (
                            <span className="bg-[#FF9F1C]/10 text-[#FF9F1C] px-1.5 py-0.5 rounded font-bold">{quote.clientVehicleOrService}</span>
                          )}
                          <span>•</span>
                          <span>WhatsApp: {formatPhone(quote.clientPhone)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-zinc-850 sm:border-0 pt-3 sm:pt-0 shrink-0">
                      <div className="text-left sm:text-right">
                        <p className="text-base font-bold font-mono text-white">{formatBRL(quote.total)}</p>
                        <div className="mt-1">{getStatusBadge(quote.status)}</div>
                      </div>

                      <button
                        onClick={() => onSelectQuote(quote.id)}
                        className="p-2 BG-[#111111] hover:bg-[#2B2B2B] border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Right Columns: Alerts and Sheets integration */}
        <div className="lg:col-span-4 space-y-6">

          {/* Pending Alerts cobra */}
          <div className="bg-[#2B2B2B]/40 border border-zinc-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#FF9F1C]" />
              Notificar / Cobrar Pendentes ({followUps.length})
            </h3>

            {followUps.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-xs">
                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-bold text-zinc-400">Tudo sob controle!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {followUps.slice(0, 3).map(q => (
                  <div key={q.id} className="p-3 bg-[#111111]/40 border border-zinc-850 rounded-xl flex flex-col gap-2.5 text-xs text-zinc-300">
                    <div>
                      <p className="font-extrabold text-white truncate">{q.clientName}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">#{q.quoteNumber} • {formatBRL(q.total)}</p>
                    </div>
                    <a
                      href={getWhatsAppReminderLink(q)}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg text-center transition-all flex items-center justify-center gap-1 shrink-0"
                    >
                      <Send className="w-3 h-3" />
                      Cobrar no WhatsApp
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Premium Advice */}
          <div className="bg-[#2B2B2B]/20 p-5 rounded-2xl border border-zinc-800 text-zinc-300">
            <p className="text-[10px] font-bold text-[#FF9F1C] uppercase tracking-widest mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Upgrade Comercial
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Propostas qualificadas que apresentam Termos de Garantia, termos de propriedade e detalhes de prazos claros geram menor objeção de venda e aceleram o fechamento em até 3,5x.
            </p>
          </div>

          {/* Google Sheets Integration */}
          <div className="bg-[#112a1f] p-5 rounded-2xl border border-emerald-900 text-[#c8e6d9]">
            <h4 className="text-xs font-bold font-sans flex items-center gap-2 mb-2 text-white">
              <TableIcon className="w-4 h-4 text-emerald-400" />
              Sincronização Google Sheets
            </h4>
            <p className="text-[11px] opacity-80 leading-relaxed mb-4">
              Consolide todos os dados e histórico de orçamentos diretamente em uma nova planilha online.
            </p>
            {sheetUrl ? (
              <a 
                href={sheetUrl}
                target="_blank"
                referrerPolicy="no-referrer"
                className="w-full flex items-center justify-center py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all"
              >
                Planilha Pronta para Visualização
              </a>
            ) : (
              <button
                onClick={handleExportToSheets}
                disabled={isExporting}
                className="w-full flex items-center justify-center py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-40 cursor-pointer"
              >
                {isExporting ? 'Sincronizando...' : 'Exportar p/ Google Sheets'}
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
