import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, LoaderCircle } from 'lucide-react';
import { formatBRL } from '../utils/format';

type LiveQuoteSnapshot = {
  clientName?: string;
  company?: string | null;
  request?: string | null;
  items?: Array<{ name?: string; description?: string; quantity?: number; unitPrice?: number; discount?: number }>;
  subtotal?: number;
  discountTotal?: number;
  taxes?: number;
  total?: number;
  notes?: string | null;
  paymentInstructions?: string | null;
  validUntil?: string | null;
  signature?: { label?: string } | null;
};

type LiveQuote = { id: string; version: number; snapshot: LiveQuoteSnapshot; status: string; validUntil: string | null };

export default function LiveQuoteView({ token }: { token: string }) {
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/live-quotes/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Esta proposta não está disponível.');
        setQuote(payload as LiveQuote);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a proposta.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  const accept = async () => {
    if (!customerName.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/public/live-quotes/${encodeURIComponent(token)}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: customerName.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar o aceite.');
      setAccepted(true);
      setQuote(current => current ? { ...current, status: 'accepted' } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar o aceite.'); }
    finally { setSubmitting(false); }
  };

  const reject = async () => {
    if (submitting || !window.confirm('Registrar a recusa desta proposta?')) return;
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/public/live-quotes/${encodeURIComponent(token)}/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar a recusa.');
      setRejected(true);
      setQuote(current => current ? { ...current, status:'rejected' } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar a recusa.'); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-4 py-8 text-[#f5f5f5] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7 flex items-center justify-between border-b border-white/10 pb-5">
          <div className="text-sm font-semibold tracking-[0.2em]">ORKTO</div>
          <div className="text-xs text-white/50">Proposta digital · versão {quote?.version || '—'}</div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-white/60"><LoaderCircle className="h-5 w-5 animate-spin text-[#ff9f1c]" /> Carregando proposta…</div>
        ) : error && !quote ? (
          <section role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-red-100"><AlertCircle className="mb-3 h-5 w-5" />{error}</section>
        ) : quote ? (
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#141414] shadow-2xl">
            <div className="border-b border-white/10 p-6 sm:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ff9f1c]/30 bg-[#ff9f1c]/10 px-3 py-1 text-xs text-[#ffb54d]"><FileText className="h-3.5 w-3.5" /> Proposta comercial</div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{quote.snapshot.company || 'Proposta'}</h1>
              <p className="mt-2 text-sm text-white/60">Para {quote.snapshot.clientName || 'você'}{quote.snapshot.request ? ` · ${quote.snapshot.request}` : ''}</p>
              {quote.validUntil && <p className="mt-4 flex items-center gap-2 text-xs text-white/50"><Clock3 className="h-4 w-4" /> Válida até {new Date(quote.validUntil).toLocaleDateString('pt-BR')}</p>}
            </div>

            <div className="space-y-3 p-6 sm:p-8">
              {(quote.snapshot.items || []).map((item, index) => {
                const quantity = Number(item.quantity || 0);
                const unitPrice = Number(item.unitPrice || 0);
                const discount = Number(item.discount || 0);
                const total = quantity * unitPrice * (1 - discount / 100);
                return <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div><div className="font-medium">{item.name || 'Item'}</div>{item.description && <p className="mt-1 text-sm text-white/55">{item.description}</p>}<p className="mt-1 text-xs text-white/45">{quantity} × {formatBRL(unitPrice)}{discount > 0 ? ` · desconto ${discount}%` : ''}</p></div>
                  <div className="whitespace-nowrap font-medium">{formatBRL(total)}</div>
                </div>;
              })}
            </div>

            <div className="border-t border-white/10 px-6 py-5 sm:px-8">
              {quote.snapshot.notes && <p className="mb-5 whitespace-pre-wrap text-sm leading-6 text-white/65">{quote.snapshot.notes}</p>}
              <div className="ml-auto max-w-xs space-y-2 text-sm">
                {quote.snapshot.subtotal !== undefined && <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatBRL(Number(quote.snapshot.subtotal))}</span></div>}
                {Number(quote.snapshot.discountTotal) > 0 && <div className="flex justify-between text-white/60"><span>Descontos</span><span>−{formatBRL(Number(quote.snapshot.discountTotal))}</span></div>}
                {Number(quote.snapshot.taxes) > 0 && <div className="flex justify-between text-white/60"><span>Impostos</span><span>{formatBRL(Number(quote.snapshot.taxes))}</span></div>}
                <div className="flex justify-between border-t border-white/15 pt-3 text-lg font-semibold"><span>Total</span><span className="text-[#ff9f1c]">{formatBRL(Number(quote.snapshot.total || 0))}</span></div>
              </div>
              {quote.snapshot.paymentInstructions && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-white/[0.035] p-4 text-sm text-white/65">{quote.snapshot.paymentInstructions}</p>}
            </div>

            <div className="border-t border-white/10 bg-black/20 p-6 sm:p-8">
              {accepted || quote.status === 'accepted' ? (
                <div role="status" className="flex items-center gap-3 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Aceite registrado. A empresa responsável dará continuidade ao atendimento.</div>
              ) : rejected || quote.status === 'rejected' ? (
                <div role="status" className="flex items-center gap-3 text-sm text-white/70"><CheckCircle2 className="h-5 w-5 text-[#ff9f1c]" /> Recusa registrada. A empresa responsável foi informada no histórico da proposta.</div>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="accept-name" className="block text-sm font-medium">Seu nome para registrar o aceite</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input id="accept-name" value={customerName} onChange={event => setCustomerName(event.target.value)} maxLength={180} autoComplete="name" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-[#ff9f1c]" placeholder="Nome completo" />
                    <button type="button" onClick={accept} disabled={!customerName.trim() || submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff9f1c] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#ffb04a] disabled:cursor-not-allowed disabled:opacity-50">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Aceitar proposta</button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-white/45">Aceite ou recusa ficam no histórico. Nenhuma opção realiza pagamento ou envia mensagem.</p><button type="button" onClick={reject} disabled={submitting} className="min-h-9 self-start rounded-lg border border-white/15 px-3 text-xs font-medium text-white/65 hover:border-white/30 hover:text-white disabled:opacity-50">Recusar proposta</button></div>
                </div>
              )}
              {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            </div>
            {quote.snapshot.signature?.label && <div className="px-6 pb-5 text-center text-[11px] tracking-wide text-white/35 sm:px-8">{quote.snapshot.signature.label}</div>}
          </article>
        ) : null}
      </div>
    </main>
  );
}
