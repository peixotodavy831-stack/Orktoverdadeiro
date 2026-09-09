import React, { useState } from 'react';
import { ArrowLeft, FileText, CheckCircle2, TrendingUp, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DEMO_REVENUE = [
  { label: 'Abr', revenue: 1200 },
  { label: 'Mai', revenue: 2450 },
  { label: 'Jun', revenue: 2100 },
  { label: 'Jul', revenue: 3900 },
  { label: 'Ago', revenue: 4750 },
  { label: 'Set', revenue: 6150 },
];

const COPY = {
  Formal: 'Apresentamos nossa proposta para revisão preventiva, com inspeção dos componentes, troca de filtros e testes de funcionamento.',
  Técnico: 'Escopo da revisão preventiva: inspeção dos componentes, substituição de filtros e testes funcionais. Valor total: R$ 450,00.',
  Criativo: 'Um novo fôlego para seu veículo: vamos conferir os componentes, renovar os filtros e testar tudo com cuidado.',
  Comercial: 'Mantenha seu veículo em boas condições com uma revisão completa: inspeção, troca de filtros e testes, por R$ 450,00.',
};

export default function DemoExperience({ initialView, onClose, onStart }: {
  initialView: 'dashboard' | 'proposal'; onClose: () => void; onStart: () => void;
}) {
  const [view, setView] = useState(initialView);
  const [tone, setTone] = useState<keyof typeof COPY>('Formal');
  const [approved, setApproved] = useState(false);
  return <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6 sm:p-10">
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <button onClick={onClose} className="inline-flex items-center gap-2 min-h-11 text-zinc-300"><ArrowLeft size={20} /> Voltar</button>
        <span className="rounded-full bg-orange-500/15 text-orange-400 px-4 py-2 text-sm font-bold">Demonstração — dados fictícios</span>
      </header>
      <h1 className="text-3xl font-bold">{view === 'dashboard' ? 'Conheça o painel ORKTO' : 'Proposta modelo'}</h1>
      <p className="text-zinc-400">Explore sem conta. Nenhum dado é salvo, enviado ou cobrado nesta demonstração.</p>
      {view === 'dashboard' ? <>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800"><p className="text-zinc-400 text-sm">Propostas de exemplo</p><p className="text-3xl font-bold mt-2">1</p></div>
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800"><p className="text-zinc-400 text-sm">Valor de exemplo</p><p className="text-2xl font-bold mt-2">R$ 450,00</p></div>
        </div>
        <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6" aria-label="Demonstração do Analytics">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-orange-400" /> Faturamento Comercial Realizado</h2>
              <p className="text-sm text-zinc-400 mt-1">Evolução fictícia do caixa consolidado</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-300"><BarChart3 className="w-4 h-4" /> Prévia Pro</span>
          </div>
          <div className="h-64 w-full mt-5">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={DEMO_REVENUE} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value / 1000} mil`} />
                <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Faturamento']} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#fb923c" strokeWidth={3} fill="#fb923c" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-zinc-500 mt-3">Dados ilustrativos. O Analytics completo está disponível nos planos Pro e Business.</p>
        </section>
        <button onClick={() => setView('proposal')} className="w-full text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-700 hover:border-orange-500 flex items-center gap-4">
          <FileText className="text-orange-400 shrink-0" /><span><strong className="block">Marina — cliente fictícia</strong><span className="text-sm text-zinc-400">Revisão preventiva · Abrir proposta →</span></span>
        </button>
      </> : <article className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 sm:p-8 space-y-6">
        <div><p className="text-orange-400 text-sm font-bold">OFICINA MODELO · #DEMO-001</p><h2 className="text-2xl font-bold mt-2">Revisão preventiva</h2><p className="text-zinc-400 mt-1">Para Marina — cliente fictícia</p></div>
        <fieldset><legend className="text-sm text-zinc-400 mb-3">Experimente os tons de comunicação — sem IA</legend><div className="flex flex-wrap gap-2">{(Object.keys(COPY) as (keyof typeof COPY)[]).map(item => <button key={item} aria-pressed={tone === item} onClick={() => setTone(item)} className={`min-h-11 px-3 rounded-xl text-sm ${tone === item ? 'bg-orange-400 text-zinc-950' : 'bg-zinc-800 text-zinc-200'}`}>{item}</button>)}</div></fieldset>
        <p aria-live="polite" className="leading-relaxed text-zinc-200">{COPY[tone]}</p>
        <dl className="space-y-3 border-y border-zinc-700 py-4"><div className="flex justify-between gap-4"><dt>Inspeção e testes</dt><dd>R$ 250,00</dd></div><div className="flex justify-between gap-4"><dt>Troca de filtros</dt><dd>R$ 200,00</dd></div><div className="flex justify-between gap-4 text-xl font-bold"><dt>Total</dt><dd>R$ 450,00</dd></div></dl>
        <p className="text-sm text-zinc-400">Condições ilustrativas: pagamento na conclusão. Prazo: 1 dia útil. Validade: 7 dias.</p>
        <button onClick={() => setApproved(value => !value)} className="w-full min-h-12 px-4 py-3 rounded-xl bg-emerald-500 text-zinc-950 font-bold">{approved ? 'Desfazer simulação' : 'Simular aprovação'}</button>
        {approved && <p role="status" className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={20} /> Aprovação simulada. Nenhuma proposta real foi alterada.</p>}
      </article>}
      <button onClick={onStart} className="w-full rounded-xl bg-orange-400 text-zinc-950 font-bold min-h-12 px-5 py-3">Criar minha conta grátis</button>
    </div>
  </main>;
}
