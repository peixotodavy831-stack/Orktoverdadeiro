import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Send, 
  Copy, 
  Printer, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  CopyCheck, 
  Pencil, 
  Calendar, 
  Phone, 
  ArrowLeft,
  DollarSign,
  Briefcase,
  Clock,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import { Quote, UserProfile, Timestamp } from '../types';
import { formatBRL, formatPhone, formatCurrency, getCleanPhoneForWhatsApp } from '../utils/format';

interface QuoteDetailProps {
  quote: Quote;
  userProfile: UserProfile | null;
  onBack: () => void;
  onEdit: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onQuoteUpdated: (updatedQuote: Quote) => void;
  onQuoteDeleted: (quoteId: string) => void;
}

export default function QuoteDetail({
  quote,
  userProfile,
  onBack,
  onEdit,
  onDuplicate,
  onQuoteUpdated,
  onQuoteDeleted
}: QuoteDetailProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-md text-xs font-bold font-display uppercase tracking-wider">Aprovado</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/25 rounded-md text-xs font-bold font-display uppercase tracking-wider">Recusado</span>;
      case 'expired':
        return <span className="px-3 py-1 bg-zinc-500/10 text-zinc-400 border border-zinc-500/25 rounded-md text-xs font-bold font-display uppercase tracking-wider">Expirado</span>;
      default:
        return <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/25 rounded-md text-xs font-bold font-display uppercase tracking-wider">Pendente</span>;
    }
  };

  const updateStatus = async (newStatus: 'approved' | 'rejected' | 'pending') => {
    setIsUpdating(true);
    try {
      const updates: any = { status: newStatus, updatedAt: Timestamp.now() };
      if (newStatus === 'approved') updates.approvedAt = Timestamp.now();
      if (newStatus === 'rejected') updates.rejectedAt = Timestamp.now();
      
      onQuoteUpdated({ ...quote, ...updates });
    } catch (err) {
      console.error("Error updating quote status:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que quer remover este orçamento permanentemente? Esta ação não pode ser desfeita.')) return;
    setIsDeleting(true);
    try {
      onQuoteDeleted(quote.id);
    } catch (err) {
      console.error("Error deleting quote:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getWhatsAppLink = () => {
    const origin = window.location.origin;
    const viewLink = `${origin}?quoteId=${quote.id}`;
    
    // Check if the user has a custom template, if they chose to use the default, we inject summary
    let itemsSummary = quote.items.map((item, idx) => `• ${item.quantity}x ${item.name} (${formatBRL((item.quantity * item.unitPrice) * (1 - item.discount / 100))})`).join('\n');
    
    let defaultMsg = `Olá *[CLIENT_NAME]*, aqui está o seu orçamento detalhado.\n\n*Resumo dos Itens:*\n${itemsSummary}\n\n*Total: [TOTAL]*\n\nClique no link abaixo para visualizar, salvar em PDF ou aprovar o orçamento:\n*[LINK]*`;
    
    let text = userProfile?.whatsappTemplate || defaultMsg;
    
    text = text.replace('[CLIENT_NAME]', quote.clientName);
    text = text.replace('[SERVICE_TYPE]', quote.clientVehicleOrService || 'serviços');
    text = text.replace('[TOTAL]', formatBRL(quote.total));
    text = text.replace('[LINK]', viewLink);

    return `https://wa.me/${getCleanPhoneForWhatsApp(quote.clientPhone)}?text=${encodeURIComponent(text)}`;
  };

  // Safe Timestamp parser
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'n/a';
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString('pt-BR');
    }
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  const getJSDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    return new Date(timestamp);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back button & quick bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar a Lista
        </button>
        
        <div className="flex flex-wrap items-center gap-2">
          {quote.status === 'pending' && (
            <>
              <button
                onClick={() => updateStatus('approved')}
                disabled={isUpdating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Marcar Aprovado
              </button>
              <button
                onClick={() => updateStatus('rejected')}
                disabled={isUpdating}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Recusar
              </button>
            </>
          )}

          {quote.status !== 'pending' && (
            <button
              onClick={() => updateStatus('pending')}
              disabled={isUpdating}
              className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-xs rounded-xl transition-all"
            >
              Reabrir Orçamento
            </button>
          )}

          <button
            onClick={() => onDuplicate(quote)}
            className="px-3.5 py-2 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 font-bold text-xs rounded-xl transition-all"
            title="Duplicar Orçamento como rascunho"
          >
            Duplicar
          </button>

          <button
            onClick={() => onEdit(quote)}
            className="px-3.5 py-2 bg-zinc-150 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-250 hover:bg-zinc-200 dark:hover:bg-zinc-800 font-bold text-xs rounded-xl transition-colors"
          >
            Editar
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
            title="Excluir Orçamento"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Core Invoice Card Detail View (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: userProfile?.quoteColor || '#f97316' }} />
            
            {/* Header branding */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
              <div className="space-y-3">
                {userProfile?.companyLogo && (
                  <div className="h-10 max-w-[180px] flex items-center justify-start overflow-hidden">
                    <img src={userProfile.companyLogo} alt={userProfile.companyName} className="max-h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-display font-extrabold uppercase tracking-tight text-zinc-900 dark:text-white">
                    {userProfile?.companyName || 'Sua Empresa'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">{userProfile?.address || 'Seu endereço comercial'}</p>
                  <p className="text-xs text-zinc-400">WhatsApp: {formatPhone(userProfile?.whatsappNumber || '11999999999')}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="flex sm:justify-end items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">Orçamento</span>
                  {getStatusBadge(quote.status)}
                </div>
                <p className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-300">#{quote.quoteNumber}</p>
                <p className="text-xs text-zinc-400 font-mono">Gerado em: {formatDate(quote.createdAt)}</p>
              </div>
            </div>

            {/* Client data box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 mb-8">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cliente</span>
                <p className="font-extrabold text-base text-zinc-900 dark:text-white mt-1">{quote.clientName}</p>
                <div className="flex items-center gap-1.5 text-zinc-550 dark:text-zinc-400 text-sm mt-1.5 font-medium">
                  <Phone className="w-4 h-4 text-orange-500" />
                  <span>{formatPhone(quote.clientPhone)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Projeto / Escopo</span>
                <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-1">{quote.clientVehicleOrService || 'Não especificado'}</p>
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs mt-1.5">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <span>{quote.validValueDays} dias de validade (até {formatDate(getJSDate(quote.createdAt).getTime() + quote.validValueDays * 24 * 60 * 60 * 1000)})</span>
                </div>
              </div>
            </div>

            {/* Quote details and itemizations */}
            <div className="space-y-4 mb-8">
              <h3 className="text-xs font-bold uppercase text-zinc-400 border-b pb-2 dark:border-zinc-800 tracking-widest">Detalhamento dos Itens & Escopos</h3>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {quote.items.map((item, index) => {
                  const itemSub = item.quantity * item.unitPrice;
                  const itemDisc = itemSub * (item.discount / 100);
                  const itemTotal = itemSub - itemDisc;
                  
                  return (
                    <div key={item.id || index} className="py-3 flex justify-between items-start gap-4">
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</p>
                        {item.description && <p className="text-xs text-zinc-400 mt-0.5">{item.description}</p>}
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {item.quantity}un x {formatBRL(item.unitPrice)}
                        </span>
                        {item.discount > 0 && (
                          <span className="text-[10px] font-bold text-emerald-500 ml-2 bg-emerald-500/10 px-1 py-0.5 rounded">
                            -{item.discount}%
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap align-bottom pt-1">
                        {formatBRL(itemTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note text box */}
            {quote.notes && (
              <div className="p-4 bg-orange-500/5 rounded-2xl text-xs text-zinc-500 dark:text-zinc-400 border border-orange-500/10 mb-8 leading-relaxed">
                <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1 leading-none">Observações / Compromisso:</p>
                {quote.notes}
              </div>
            )}

            {/* Bill Pix instructions */}
            {quote.paymentInstructions && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-150 dark:border-zinc-850 mb-8 leading-relaxed">
                <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-orange-500" />
                  Termos e Pagamento:
                </p>
                <p className="whitespace-pre-line">{quote.paymentInstructions}</p>
              </div>
            )}

            {/* Subtotal list sum */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400 text-xs">
                <span>Subtotal de Serviços & Itens</span>
                <span className="font-mono">{formatBRL(quote.subtotal)}</span>
              </div>

              {quote.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-500 font-bold text-xs">
                  <span>Descontos Aplicados</span>
                  <span className="font-mono">-{formatBRL(quote.discountTotal)}</span>
                </div>
              )}

              {quote.taxes !== undefined && quote.taxes > 0 && (
                <div className="flex justify-between text-zinc-450 text-xs">
                  <span>Ajustes / Taxa Extra</span>
                  <span className="font-mono">+{formatBRL(quote.taxes)}</span>
                </div>
              )}

              <div className="flex justify-between items-center font-display font-extrabold text-base border-t border-zinc-200 dark:border-zinc-800 pt-3" style={{ color: userProfile?.quoteColor || '#f97316' }}>
                <span>Valor Final Estimado</span>
                <span className="font-display font-bold font-mono text-lg bg-zinc-50 dark:bg-zinc-950 border rounded-xl py-1 px-4">{formatBRL(quote.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sending & Progress Tracking (1 col) */}
        <div className="space-y-6">
          {/* Quick Sharing panel */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl text-white space-y-4">
            <h3 className="text-sm font-bold font-display uppercase tracking-widest text-zinc-400">Enviar para o Cliente</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              O WhatsApp é o canal mais rápido! Prefiram enviar o link interativo para o celular do cliente.
            </p>
            
            <a
              href={getWhatsAppLink()}
              target="_blank"
              referrerPolicy="no-referrer"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Send className="w-4 h-4" />
              Enviar pelo WhatsApp
            </a>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <a
                href={`${window.location.origin}?quoteId=${quote.id}`}
                target="_blank"
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors text-center text-[10px] sm:text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tela Cheia</span>
                <span className="sm:hidden">Abrir</span>
              </a>
              <button
                onClick={() => {
                  const link = `${window.location.origin}?quoteId=${quote.id}`;
                  navigator.clipboard.writeText(link);
                  alert('Link copiado!');
                }}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors text-center text-[10px] sm:text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copiar Link</span>
                <span className="sm:hidden">Copiar</span>
              </button>
              <button
                onClick={() => window.print()}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors text-center text-[10px] sm:text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Customer approval dynamic tracking timeline */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-md">
            <h3 className="text-xs font-bold uppercase text-zinc-400 mb-6 tracking-widest">Timeline de Acompanhamento</h3>

            <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 pl-4 py-1 space-y-6">
              {/* Step 1: Created */}
              <div className="relative">
                <span className="w-4 h-4 bg-orange-500 rounded-full border-4 border-white dark:border-zinc-900 absolute -left-[23px] top-1" />
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Orçamento Criado</p>
                <p className="text-[10px] text-zinc-400 font-mono">{formatDate(quote.createdAt)}</p>
              </div>

              {/* Step 2: Sent */}
              <div className="relative">
                <span className="w-4 h-4 bg-orange-500 rounded-full border-4 border-white dark:border-zinc-900 absolute -left-[23px] top-1" />
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Enviado por Link</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{quote.sentAt ? formatDate(quote.sentAt) : 'Enviado hoje'}</p>
              </div>

              {/* Step 3: Viewed */}
              <div className="relative">
                <span className="w-4 h-4 bg-emerald-500 rounded-full border-4 border-white dark:border-zinc-900 absolute -left-[23px] top-1" />
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Visualizado pelo Cliente</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Visualizado na web</p>
              </div>

              {/* Step 4: Approved / Rejected */}
              <div className="relative">
                <span className={`w-4 h-4 rounded-full border-4 border-white dark:border-zinc-900 absolute -left-[23px] top-1 ${quote.status === 'approved' ? 'bg-emerald-500' : quote.status === 'rejected' ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Retorno do Cliente</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  {quote.status === 'approved' 
                    ? `Aprovado em ${formatDate(quote.approvedAt || quote.updatedAt)}` 
                    : quote.status === 'rejected' 
                      ? `Recusado em ${formatDate(quote.rejectedAt || quote.updatedAt)}` 
                      : 'Aguardando Aprovação do Cliente'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
