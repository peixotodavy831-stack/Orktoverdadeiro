import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle, XCircle, Loader2, Shield, DollarSign, AlertTriangle } from 'lucide-react';

interface ProposalQuote {
  id: string;
  quote_number: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_vehicle_or_service: string;
  notes: string;
  items: Array<{ id: string; name: string; description: string; quantity: number; unitPrice: number; discount: number }>;
  subtotal: number;
  discount_total: number;
  taxes: number;
  total: number;
  valid_value_days: number;
  payment_instructions: string;
  status: string;
  profiles: { company_name: string; company_logo: string; address: string; whatsapp_number: string; quote_color: string; brand_name: string };
}

interface ProposalData {
  proposal: { id: string; slug: string; expires_at: string; viewed_at: string; approved_at: string; created_at: string };
  quote: ProposalQuote;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface ClientProposalViewProps {
  slug: string;
}

export default function ClientProposalView({ slug }: ClientProposalViewProps) {
  const [data, setData] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState('00:00');
  const [actionLoading, setActionLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [showPix, setShowPix] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string | null; key: string | null } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadProposal(); }, [slug]);

  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      const r = getTimeRemaining(data.proposal.expires_at);
      setTimeLeft(r);
      if (r === '00:00') { setExpired(true); clearInterval(timer); }
    }, 1000);
    return () => clearInterval(timer);
  }, [data]);

  useEffect(() => {
    if (data?.quote.status === 'approved') setApproved(true);
    if (data?.quote.status === 'rejected') setRejected(true);
  }, [data]);

  const loadProposal = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/proposal/${slug}`);
      const json = await res.json();
      if (!res.ok) { if (json.expired) setExpired(true); setError(json.error || 'Proposta nao encontrada'); return; }
      setData(json);
      fetch(`/api/proposal/${slug}/viewed`, { method: 'POST' });
    } catch { setError('Erro ao carregar proposta'); } finally { setLoading(false); }
  };

  const handleApprove = async () => {
    if (!approverName.trim()) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/quote/${data!.quote.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: approverName }),
      });
      if (!res.ok) throw new Error();
      setApproved(true);
    } catch { alert('Erro ao aprovar'); } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/quote/${data!.quote.id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setRejected(true);
    } catch { alert('Erro ao recusar'); } finally { setActionLoading(false); }
  };

  const handlePix = async () => {
    try {
      setPixLoading(true);
      const res = await fetch(`/api/quote/${data!.quote.id}/pix`, { method: 'POST' });
      const json = await res.json();
      if (json.success) { setPixData(json.pix); setShowPix(true); }
    } catch { alert('Erro ao gerar PIX'); } finally { setPixLoading(false); }
  };

  const copyPixKey = () => {
    if (pixData?.key) { navigator.clipboard.writeText(pixData.key); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  if (loading) return (<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>);

  if (error || expired) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full text-center">
        <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">{expired ? 'Proposta Expirada' : 'Proposta Nao Encontrada'}</h1>
        <p className="text-zinc-400 text-sm">{expired ? 'Esta proposta expirou. Solicite um novo link ao profissional.' : error}</p>
      </div>
    </div>
  );

  if (!data) return null;
  const { quote } = data;
  const brand = quote.profiles;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {brand.company_logo ? (
            <img src={brand.company_logo} alt="" className="h-8 object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold" style={{ backgroundColor: brand.quote_color || '#f97316', color: '#000' }}>
              {(brand.company_name || 'O')[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white">{brand.company_name || 'Profissional'}</p>
            {brand.address && <p className="text-[10px] text-zinc-500">{brand.address}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-zinc-400">Proposta valida por</span>
          </div>
          <span className={`font-mono text-sm font-bold ${parseInt(timeLeft.split(':')[0]) < 5 ? 'text-red-500' : 'text-orange-500'}`}>{timeLeft}</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="h-2" style={{ backgroundColor: brand.quote_color || '#f97316' }} />
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Proposta</p>
                <p className="text-lg font-mono font-bold text-white">#{quote.quote_number}</p>
              </div>
              {approved && <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-md text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Aprovada</span>}
              {rejected && <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/25 rounded-md text-xs font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Recusada</span>}
              {!approved && !rejected && quote.status === 'approved' && <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-md text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Paga</span>}
            </div>

            {quote.client_vehicle_or_service && (
              <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Servico / Escopo</p>
                <p className="text-sm font-bold text-white">{quote.client_vehicle_or_service}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Detalhamento</p>
              <div className="divide-y divide-zinc-800">
                {quote.items.map((item, idx) => {
                  const itemTotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
                  return (
                    <div key={idx} className="py-3 flex justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{item.name}</p>
                        {item.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{item.description}</p>}
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {item.quantity}un x {formatBRL(item.unitPrice)}
                          {item.discount > 0 && <span className="text-emerald-500 ml-1 font-bold">-{item.discount}%</span>}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-white shrink-0">{formatBRL(itemTotal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {quote.notes && (
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Observacoes</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{quote.notes}</p>
              </div>
            )}

            <div className="border-t border-zinc-800 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-zinc-500"><span>Subtotal</span><span className="font-mono">{formatBRL(quote.subtotal)}</span></div>
              {quote.discount_total > 0 && <div className="flex justify-between text-xs text-emerald-500 font-bold"><span>Desconto</span><span className="font-mono">-{formatBRL(quote.discount_total)}</span></div>}
              {quote.taxes > 0 && <div className="flex justify-between text-xs text-zinc-500"><span>Taxas</span><span className="font-mono">+{formatBRL(quote.taxes)}</span></div>}
              <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                <span className="text-sm font-bold text-white">Total</span>
                <span className="text-lg font-bold font-mono" style={{ color: brand.quote_color || '#f97316' }}>{formatBRL(quote.total)}</span>
              </div>
            </div>

            {quote.payment_instructions && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-orange-500" /> Pagamento
                </p>
                <p className="text-xs text-zinc-400 whitespace-pre-line">{quote.payment_instructions}</p>
              </div>
            )}
          </div>
        </div>

        {!approved && !rejected && quote.status !== 'approved' && quote.status !== 'rejected' && (
          <div className="space-y-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-zinc-400 font-bold">Para aprovar, informe seu nome:</p>
              <input type="text" value={approverName} onChange={(e) => setApproverName(e.target.value)} placeholder="Seu nome completo"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <button onClick={handleApprove} disabled={actionLoading || !approverName.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {actionLoading ? 'Processando...' : 'Aprovar Proposta'}
              </button>
            </div>
            <button onClick={handleReject} disabled={actionLoading}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold text-sm rounded-xl transition-colors">
              Recusar
            </button>
          </div>
        )}

        {(approved || quote.status === 'approved') && !showPix && (
          <div className="space-y-3">
            <button onClick={handlePix} disabled={pixLoading}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
              <DollarSign className="w-4 h-4" />
              {pixLoading ? 'Gerando...' : 'Pagar com PIX'}
            </button>
          </div>
        )}

        {showPix && pixData && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 text-center">
            <p className="text-xs text-zinc-400 font-bold">Escaneie o QR Code ou copie a chave PIX:</p>
            {pixData.qrCode && <img src={`data:image/png;base64,${pixData.qrCode}`} alt="QR Code PIX" className="mx-auto w-48 h-48 rounded-xl" />}
            {pixData.key && (
              <div className="flex items-center gap-2">
                <input readOnly value={pixData.key} className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono" />
                <button onClick={copyPixKey} className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg">
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-4 pb-8">
          <Shield className="w-3.5 h-3.5 text-zinc-600" />
          <p className="text-[10px] text-zinc-600">Proposta segura e verificada via ORKTO</p>
        </div>
      </div>
    </div>
  );
}
