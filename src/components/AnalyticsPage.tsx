import React from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle,
  Eye, 
  PieChart as PieIcon, 
  AlertCircle,
  Calendar,
  Zap,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Quote } from '../types';
import { formatBRL } from '../utils/format';

interface AnalyticsPageProps {
  quotes: Quote[];
  plan: 'free' | 'pro' | 'business';
}

export default function AnalyticsPage({ quotes, plan }: AnalyticsPageProps) {
  if (plan === 'free') return <div className="p-8 text-zinc-900 dark:text-white">Analytics disponível no Pro e Business. No Standard, acompanhe seus orçamentos pelo painel.</div>;
  
  // Custom helper to calculate stats
  const calculateMetrics = () => {
    const totalQuotes = quotes.length;
    const approvedQuotes = quotes.filter(q => q.status === 'approved');
    const pendingQuotes = quotes.filter(q => q.status === 'pending');
    const rejectedQuotes = quotes.filter(q => q.status === 'rejected');
    
    // 1. Receita Potencial (Sum of all quotes)
    const potentialRevenue = quotes.reduce((acc, q) => acc + q.total, 0);
    
    // 2. Receita Convencida (Aprovada)
    const approvedRevenue = approvedQuotes.reduce((acc, q) => acc + q.total, 0);

    // 3. Ticket Médio (Approved quotes average)
    const averageTicket = approvedQuotes.length > 0 
      ? approvedRevenue / approvedQuotes.length 
      : (totalQuotes > 0 ? potentialRevenue / totalQuotes : 0);

    // 4. Taxa de Aprovação
    const activeQuotes = quotes.filter(q => q.status !== 'expired');
    const approvalRate = activeQuotes.length > 0 
      ? Math.round((approvedQuotes.length / activeQuotes.length) * 100) 
      : 0;

    // 5. Taxa de Abertura / Visualização
    const viewedCount = quotes.filter(q => q.viewedAt).length;
    const openRate = totalQuotes > 0 
      ? Math.round((viewedCount / totalQuotes) * 100) 
      : 0;

    // 6. Tempo Médio para Fechar
    const averageClosingTimeHours = approvedQuotes.length > 0 
      ? `${Math.round((approvedQuotes.reduce((acc, q) => {
          const diff = q.approvedAt && q.createdAt ? 
            (q.approvedAt.seconds - q.createdAt.seconds) / 3600 : 0;
          return acc + diff;
        }, 0) / approvedQuotes.length) * 10) / 10} horas`
      : "—";

    return {
      totalQuotes,
      approvedCount: approvedQuotes.length,
      pendingCount: pendingQuotes.length,
      rejectedCount: rejectedQuotes.length,
      potentialRevenue,
      approvedRevenue,
      averageTicket,
      approvalRate,
      openRate,
      averageClosingTimeHours
    };
  };

  const metrics = calculateMetrics();

  // Status Distribution Pie Data
  const statusData = [
    { name: 'Aprovados', value: metrics.approvedCount, color: '#10B981' },
    { name: 'Pendentes', value: metrics.pendingCount, color: '#FF9F1C' },
    { name: 'Recusados', value: metrics.rejectedCount, color: '#EF4444' }
  ].filter(i => i.value > 0);

  // Category analysis from actual quotes
  const categoryMap = new Map<string, { propostas: number; receita: number }>();
  quotes.forEach(q => {
    const cat = q.clientVehicleOrService || 'Geral';
    const existing = categoryMap.get(cat) || { propostas: 0, receita: 0 };
    existing.propostas += 1;
    existing.receita += q.total;
    categoryMap.set(cat, existing);
  });
  const servicesData = Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 6);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-zinc-900 dark:text-white min-h-screen">
      
      {/* Top Header */}
      <header className="mb-10 pb-6 border-b border-zinc-200 dark:border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FF9F1C]/15 text-[#FF9F1C] border border-[#FF9F1C]/20 text-[10px] uppercase font-bold tracking-widest rounded-md mb-2">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>ORKTO ENGINE ANALYTICS</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight">
            Indicadores de Conversão & Performance
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Análise em tempo real do seu funil comercial e fechamento de propostas premium.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 font-bold bg-white dark:bg-[#2B2B2B]/40 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <Calendar className="w-4 h-4 text-[#FF9F1C]" />
          <span>Últimos 30 dias</span>
        </div>
      </header>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        
        {/* Potencial Acumulado */}
        <div className="bg-white dark:bg-[#2B2B2B] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="w-16 h-16 text-zinc-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1">Receita Potencial</span>
            <span className="text-2xl font-mono font-extrabold tracking-tight block mt-1">
              {formatBRL(metrics.potentialRevenue)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            <span>Inclui todas as propostas enviadas</span>
          </div>
        </div>

        {/* Taxa de Aprovação */}
        <div className="bg-white dark:bg-[#2B2B2B] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1">Taxa de Aprovação</span>
            <span className="text-3xl font-extrabold tracking-tight block mt-1 text-emerald-400">
              {metrics.approvalRate}%
            </span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold tracking-widest uppercase rounded self-start">
            <TrendingUp className="w-3 h-3" />
            <span>Excelente desempenho</span>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white dark:bg-[#2B2B2B] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1">Ticket Médio</span>
            <span className="text-2xl font-mono font-extrabold tracking-tight block mt-1">
              {formatBRL(metrics.averageTicket)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]"></span>
            <span>Por proposta aprovada</span>
          </div>
        </div>

        {/* Tempo de Fechamento */}
        <div className="bg-white dark:bg-[#2B2B2B] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1">Tempo Médio de Fechamento</span>
            <span className="text-2xl font-extrabold tracking-tight block mt-1 text-[#FF9F1C]">
              {metrics.averageClosingTimeHours}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
            <Clock className="w-3.5 h-3.5 text-[#FF9F1C]" />
            <span>Resposta instantânea via Whatsapp</span>
          </div>
        </div>

      </div>

      {plan === 'business' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
        
        {/* Left column graphs */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white dark:bg-[#2B2B2B]/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#FF9F1C]" />
              Faturamento Distribuído por Verticais (R$)
            </h3>
            
            <div style={{ width: '100%', height: 300 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={servicesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                  <XAxis dataKey="name" stroke="#666" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis stroke="#666" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: '#2B2B2B', borderRadius: '12px' }}
                    itemStyle={{ color: '#FF9F1C' }}
                    labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                    formatter={(value) => [formatBRL(Number(value)), 'Faturamento']}
                  />
                  <Bar dataKey="receita" fill="#FF9F1C" radius={[8, 8, 0, 0]} maxBarSize={45}>
                    {servicesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 1 ? '#FF9F1C' : '#FF9F1C'} fillOpacity={index === 1 ? 1 : 0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Core Business Advice */}
          <div className="p-6 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#FF9F1C] uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Dica Orkto
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                {quotes.length > 0 
                  ? `Você já enviou ${quotes.length} proposta${quotes.length > 1 ? 's' : ''}. Continue assim para aumentar suas chances de fechamento.`
                  : 'Envie sua primeira proposta para começar a acompanhar suas métricas de conversão.'}
              </p>
            </div>
          </div>

        </div>

        {/* Right column conversion card */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-white dark:bg-[#2B2B2B]/40 border border-zinc-200 dark:border-[#2B2B2B] rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#FF9F1C]" />
              Funil de Propostas & Status
            </h3>

            <div style={{ width: '100%', height: 300 }} className="flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} propostas`, 'Volume']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-xl font-mono font-extrabold text-zinc-900 dark:text-white block leading-none">{metrics.totalQuotes}</span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">Total Enviados</span>
              </div>
            </div>

            {/* Legends list */}
            <div className="space-y-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
              <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300 font-semibold p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/10 rounded">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                  <span>Aprovados</span>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{metrics.approvedCount}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300 font-semibold p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/10 rounded">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-[#FF9F1C]"></span>
                  <span>Pendentes</span>
                </div>
                <span className="font-mono font-bold text-[#FF9F1C]">{metrics.pendingCount}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300 font-semibold p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/10 rounded">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-red-500"></span>
                  <span>Recusados</span>
                </div>
                <span className="font-mono font-bold text-red-500">{metrics.rejectedCount}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Funnel percentages */}
          <div className="bg-white dark:bg-[#2B2B2B]/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-zinc-700 dark:text-zinc-300 space-y-4 shadow-sm">
            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-400 mb-1.5 uppercase">
                <span>Taxa de Abertura</span>
                <span className="text-zinc-900 dark:text-white">{metrics.openRate}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-[#111111] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${metrics.openRate}%` }} />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Percentual de propostas visualizadas pelo cliente final.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-400 mb-1.5 uppercase">
                <span>Taxa de Conversão Real</span>
                <span className="text-zinc-900 dark:text-white">{metrics.approvalRate}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-[#111111] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF9F1C] rounded-full" style={{ width: `${metrics.approvalRate}%` }} />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Percentual de propostas fechadas/assinadas digitalmente.</p>
            </div>
          </div>

        </div>

      </div>}

    </div>
  );
}
