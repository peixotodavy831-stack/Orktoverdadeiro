import { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, MessageSquareText, ReceiptText, TrendingUp } from 'lucide-react';

type WrappedMetrics = {
  quotes?: { count?: number; accepted?: number; acceptanceRate?: number | null; valueCents?: number };
  deals?: { won?: number; closed?: number; wonRevenueCents?: number; open?: number };
  conversations?: { total?: number; open?: number };
  response?: { medianMinutes?: number | null; samples?: number };
};
type PublicWrapped = { period_start: string; period_end: string; metrics: WrappedMetrics; shared_at: string };

const money = (cents?: number) => Number.isFinite(cents)
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100)
  : 'Sem dados';
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

export default function WrappedPublicView({ token }: { token: string }) {
  const [wrapped, setWrapped] = useState<PublicWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/wrapped/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Este recap não está disponível.');
        setWrapped(payload as PublicWrapped);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o recap.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  return <main className="min-h-screen bg-[#0b0b0b] px-4 py-10 text-white sm:px-6 sm:py-16">
    <div className="mx-auto w-full max-w-3xl">
      <header className="border-b border-white/10 pb-6"><p className="text-lg font-bold tracking-[0.16em]">ORKT<span className="text-[#FF9F1C]">O</span></p><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF9F1C]">Recap operacional</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Conversas viram resultados.</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Indicadores calculados a partir dos registros disponíveis para o período compartilhado.</p></header>
      {loading ? <p role="status" className="py-12 text-sm text-zinc-400">Carregando recap…</p> : error ? <div role="alert" className="mt-8 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-200"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div> : wrapped ? <>
        <p className="mt-6 text-xs text-zinc-400">{date(wrapped.period_start)} — {date(wrapped.period_end)}</p>
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs text-zinc-400"><ReceiptText size={15} className="text-[#FF9F1C]" />Propostas</div><p className="mt-3 text-2xl font-semibold">{wrapped.metrics.quotes?.count ?? 'Sem dados'}</p><p className="mt-1 text-xs text-zinc-500">{wrapped.metrics.quotes?.accepted ?? '—'} aceitas</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs text-zinc-400"><TrendingUp size={15} className="text-[#FF9F1C]" />Negócios ganhos</div><p className="mt-3 text-2xl font-semibold">{wrapped.metrics.deals?.won ?? 'Sem dados'}</p><p className="mt-1 text-xs text-zinc-500">{money(wrapped.metrics.deals?.wonRevenueCents)} em negócios marcados como ganhos</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs text-zinc-400"><MessageSquareText size={15} className="text-[#FF9F1C]" />Conversas</div><p className="mt-3 text-2xl font-semibold">{wrapped.metrics.conversations?.total ?? 'Sem dados'}</p><p className="mt-1 text-xs text-zinc-500">{wrapped.metrics.conversations?.open ?? '—'} abertas no período</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs text-zinc-400"><BarChart3 size={15} className="text-[#FF9F1C]" />Aceitação de propostas</div><p className="mt-3 text-2xl font-semibold">{wrapped.metrics.quotes?.acceptanceRate == null ? 'Sem dados' : `${(wrapped.metrics.quotes.acceptanceRate * 100).toFixed(1)}%`}</p><p className="mt-1 text-xs text-zinc-500">Calculada sobre propostas registradas</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:col-span-2"><div className="flex items-center gap-2 text-xs text-zinc-400"><BarChart3 size={15} className="text-[#FF9F1C]" />Tempo mediano de resposta</div><p className="mt-3 text-2xl font-semibold">{wrapped.metrics.response?.medianMinutes == null ? 'Sem dados' : `${wrapped.metrics.response.medianMinutes} min`}</p><p className="mt-1 text-xs text-zinc-500">{wrapped.metrics.response?.samples ?? 0} amostras válidas</p></article>
        </section>
        <footer className="mt-8 border-t border-white/10 pt-4 text-[10px] leading-5 text-zinc-500">Recap ORKTO. Métricas sem benchmark externo; períodos e dados dependem dos registros da operação. Link público criado pelo workspace.</footer>
      </> : null}
    </div>
  </main>;
}
