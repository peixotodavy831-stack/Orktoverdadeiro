import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Plus, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  XOctagon, 
  ChevronRight, 
  Trash2, 
  Copy, 
  Send, 
  Filter, 
  DollarSign, 
  ArrowUpRight,
  MoreVertical,
  Layers,
  ArrowRight,
  Mail,
  Loader2,
  Lock
} from 'lucide-react';
import { Quote, SavedClient, UserProfile } from '../types';
import { formatBRL, formatPhone, getCleanPhoneForWhatsApp } from '../utils/format';
import { getAccessToken, googleSignIn } from '../lib/firebaseAuth';
import { sendQuoteEmailViaGmail } from '../lib/workspaceApi';

interface QuotesPageProps {
  quotes: Quote[];
  clients: SavedClient[];
  userProfile: UserProfile | null;
  onSelectQuote: (id: string) => void;
  onCreateQuoteClick: () => void;
  onDuplicateQuote?: (quote: Quote) => void;
  onEditQuote?: (quote: Quote) => void;
  onDeleteQuote?: (id: string) => void;
}

export default function QuotesPage({
  quotes,
  clients,
  userProfile,
  onSelectQuote,
  onCreateQuoteClick,
  onDuplicateQuote,
  onEditQuote,
  onDeleteQuote,
}: QuotesPageProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Gmail states
  const [activeEmailQuote, setActiveEmailQuote] = useState<Quote | null>(null);
  const [clientEmailInput, setClientEmailInput] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessageText, setEmailMessageText] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Filter calculations
  const filteredQuotes = quotes.filter(quote => {
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    const matchesSearch = 
      quote.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quote.clientVehicleOrService && quote.clientVehicleOrService.toLowerCase().includes(searchQuery.toLowerCase())) ||
      quote.quoteNumber.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const totalCount = quotes.length;
  const pendingCount = quotes.filter(q => q.status === 'pending').length;
  const approvedCount = quotes.filter(q => q.status === 'approved').length;
  const rejectedCount = quotes.filter(q => q.status === 'rejected').length;

  const totalValue = quotes.reduce((sum, q) => sum + q.total, 0);
  const approvedValue = quotes.filter(q => q.status === 'approved').reduce((sum, q) => sum + q.total, 0);
  const conversionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  const ticketMedio = approvedCount > 0 ? approvedValue / approvedCount : (totalCount > 0 ? totalValue / totalCount : 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Aprovado
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 border border-red-500/20 text-red-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Recusado
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-zinc-800 border border-zinc-700 text-zinc-400 uppercase tracking-wider">
            Expirado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/10 border border-orange-500/20 text-orange-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Pendente
          </span>
        );
    }
  };

  const handleShareWhatsApp = (e: React.MouseEvent, quote: Quote) => {
    e.stopPropagation();
    const cleanPhone = getCleanPhoneForWhatsApp(quote.clientPhone);
    const viewPath = `/q/${quote.id}`;
    const viewLink = `${window.location.origin}${viewPath}`;
    
    // Custom WhatsApp message
    const defaultTemplate = userProfile?.whatsappTemplate || 
      `Olá *[CLIENT_NAME]*, aqui está o seu orçamento para *[SERVICE_TYPE]*.\n\n*Total: [TOTAL]*\n\nClique no link para aprovar seu orçamento digital de forma rápida:\n*[LINK]*`;
    
    const formattedMsg = defaultTemplate
      .replace(/\[CLIENT_NAME\]/g, quote.clientName)
      .replace(/\[SERVICE_TYPE\]/g, quote.clientVehicleOrService || 'Serviços Especializados')
      .replace(/\[TOTAL\]/g, formatBRL(quote.total))
      .replace(/\[LINK\]/g, viewLink);

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedMsg)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyLink = (e: React.MouseEvent, quote: Quote) => {
    e.stopPropagation();
    const link = `${window.location.origin}/q/${quote.id}`;
    navigator.clipboard.writeText(link);
    alert('Link interativo copiado com sucesso!');
  };

  const handleGmailButtonClick = (e: React.MouseEvent, quote: Quote) => {
    e.stopPropagation();
    setClientEmailInput(quote.clientEmail || '');
    
    const subject = `Proposta Comercial #${quote.quoteNumber} - ${userProfile?.companyName || 'Orkto Solutions'}`;
    setEmailSubject(subject);
    
    // Fill default email body template message
    const message = `Olá [CLIENT_NAME],\n\nAqui está a nossa proposta comercial para o projeto/serviço "[SERVICE_TYPE]".\n\nPor favor, visualize todos os detalhes, valores e efetue o aceite digital seguro acessando o link:\n[LINK]\n\nAtenciosamente,\n${userProfile?.companyName || 'Nossa Empresa'}`;
    
    // Auto replace placeholders with details
    const viewPath = `/q/${quote.id}`;
    const viewLink = `${window.location.origin}${viewPath}`;
    const filledMessage = message
      .replace(/\[CLIENT_NAME\]/g, quote.clientName)
      .replace(/\[SERVICE_TYPE\]/g, quote.clientVehicleOrService || 'Serviços Especializados')
      .replace(/\[LINK\]/g, viewLink);

    setEmailMessageText(filledMessage);
    setActiveEmailQuote(quote);
  };

  const handleSendGmailEmail = async () => {
    if (!activeEmailQuote) return;
    if (!clientEmailInput) {
      alert('Por favor, digite o e-mail do cliente.');
      return;
    }
    
    const confirmSend = window.confirm(`Deseja realmente enviar esta proposta via Gmail para ${clientEmailInput}?`);
    if (!confirmSend) return;

    setIsSendingEmail(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        if (loginRes?.accessToken) {
          token = loginRes.accessToken;
        } else {
          throw new Error('Conta Google não está conectada. Por favor, conecte para prosseguir.');
        }
      }

      const viewLink = `${window.location.origin}/q/${activeEmailQuote.id}`;
      // Replace [LINK] if still in message or render safe br tags
      const formattedText = emailMessageText
        .replace(/\[LINK\]/g, `<a href="${viewLink}" style="color:#FF9F1C; font-weight:bold; text-decoration:underline;">${viewLink}</a>`)
        .replace(/\n/g, '<br/>');

      // Create rich HTML email layout
      const itemsHtml = activeEmailQuote.items.map(item => {
        const itemSub = item.quantity * item.unitPrice;
        const itemDisc = itemSub * (item.discount / 100);
        const itemTotal = itemSub - itemDisc;
        return `
          <tr style="border-bottom: 1px solid #e1e1e1;">
            <td style="padding: 10px 8px; font-size: 13px; color: #333333;"><strong>${item.name}</strong><br/><span style="font-size:11px;color:#777777">${item.description || ''}</span></td>
            <td style="padding: 10px 8px; font-size: 13px; color: #555555; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px 8px; font-size: 13px; color: #555555; text-align: right;">${formatBRL(item.unitPrice)}</td>
            <td style="padding: 10px 8px; font-size: 13px; color: #111111; text-align: right; font-weight: bold;">${formatBRL(itemTotal)}</td>
          </tr>
        `;
      }).join('');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; background-color: #f7f7f9; padding: 30px 15px; color: #222222;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="height: 6px; background-color: ${userProfile?.quoteColor || '#FF9F1C'};"></div>
            
            <div style="padding: 24px;">
              <div style="margin-bottom: 24px; text-align: center;">
                ${userProfile?.companyLogo ? `<img src="${userProfile.companyLogo}" alt="Logo" style="max-height: 44px; margin-bottom: 12px; object-fit: contain;" />` : ''}
                <h1 style="font-size: 18px; font-weight: bold; color: #111111; margin: 0;">${userProfile?.companyName || 'Estabelecimento Comercial'}</h1>
              </div>

              <div style="font-size: 14px; color: #444444; line-height: 1.6; margin-bottom: 24px; padding: 16px; background-color: #f9f9fb; border-radius: 8px; border-left: 3px solid ${userProfile?.quoteColor || '#FF9F1C'};">
                ${formattedText}
              </div>

              <h2 style="font-size: 11px; font-weight: bold; color: #999999; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; border-bottom: 1px solid #eeeeee; padding-bottom: 4px;">Detalhamento da Proposta</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="border-bottom: 2px solid #eeeeee;">
                    <th style="padding: 6px; text-align: left; font-size: 11px; text-transform: uppercase; color: #999999;">Item</th>
                    <th style="padding: 6px; text-align: center; font-size: 11px; text-transform: uppercase; color: #999999;">Qtd</th>
                    <th style="padding: 6px; text-align: right; font-size: 11px; text-transform: uppercase; color: #999999;">Unitário</th>
                    <th style="padding: 6px; text-align: right; font-size: 11px; text-transform: uppercase; color: #999999;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="border-top: 1px solid #eeeeee; padding-top: 12px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; color: #666666; margin-bottom: 4px;">
                  <span>Subtotal:</span>
                  <span style="font-family: monospace;">${formatBRL(activeEmailQuote.subtotal)}</span>
                </div>
                ${activeEmailQuote.discountTotal > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #2e7d32; font-weight: bold; margin-bottom: 4px;">
                  <span>Desconto:</span>
                  <span style="font-family: monospace;">-${formatBRL(activeEmailQuote.discountTotal)}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; color: #111111; border-top: 1px solid #f0f0f0; margin-top: 4px; padding-top: 6px;">
                  <span>Valor Total:</span>
                  <span style="font-family: monospace; color: #111111;">${formatBRL(activeEmailQuote.total)}</span>
                </div>
              </div>

              <div style="text-align: center; margin-top: 32px; margin-bottom: 16px;">
                <a href="${viewLink}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px rgba(16,185,129,0.15);">Visualizar e Aprovar Online</a>
              </div>

              <div style="font-size: 10px; color: #aaaaaa; text-align: center; line-height: 1.4; margin-top: 24px; border-top: 1px solid #eeeeee; padding-top: 16px;">
                Este e-mail foi gerado e enviado de forma automática e integrada através do sistema ORKTO.
              </div>
            </div>
          </div>
        </div>
      `;

      await sendQuoteEmailViaGmail(token, clientEmailInput, emailSubject, htmlBody);
      alert('E-mail com proposta comercial enviado com sucesso via Gmail!');
      setActiveEmailQuote(null);
    } catch (err: any) {
      console.error(err);
      alert('Falha ao disparar e-mail via Gmail: ' + (err.message || err));
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleTriggerAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    setActiveDropdownId(null);
    action();
  };

  return (
    <div className="space-y-8 select-none">
      {/* Header section with top stats and new button */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-850/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase font-display">
              Gestão de Orçamentos
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Acompanhe o funil comercial de suas propostas, links digitais enviados e as taxas de fechamento em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCreateQuoteClick}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 bg-[#FF9F1C] text-black font-extrabold rounded-xl text-xs hover:opacity-90 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Adicionar Orçamento
          </button>
        </div>
      </header>

      {/* Strategic Statistics cards in minimalist dark glass style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total & values */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            <span>Todos Enviados</span>
            <span className="p-1 bg-zinc-100 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 rounded-lg"><FileText className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{totalCount}</span>
            <div className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <span>Faturamento Potencial de</span>
              <strong className="text-orange-500 dark:text-orange-400 font-bold">{formatBRL(totalValue)}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Approved revenue */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            <span>Volume Aprovado</span>
            <span className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg"><CheckCircle className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatBRL(approvedValue)}</span>
            <div className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <span>Do total de</span>
              <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{approvedCount} de {totalCount}</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Pending & follow ups */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-[#FF9F1C] uppercase tracking-widest">
            <span>Pendentes</span>
            <span className="p-1 bg-orange-500/10 text-orange-400 rounded-lg"><Clock className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{pendingCount}</span>
            <div className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <span>Pendente de retorno comercial</span>
            </div>
          </div>
        </div>

        {/* Card 4: Average ticket / conversion */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            <span>Ticket & Conversão</span>
            <span className="p-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg"><TrendingUp className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{conversionRate}%</span>
            <div className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-1">
              <span>Ticket Médio: </span>
              <strong className="text-zinc-700 dark:text-zinc-200 font-mono">{formatBRL(ticketMedio)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Structured visual search, sorting and list area */}
      <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 transition-colors shadow-sm dark:shadow-none">
        
        {/* Controls: Search input & Status Filtering pills */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-550 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar orçamento por cliente, escopo ou número..."
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center bg-zinc-100 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800/80 p-1 rounded-xl text-[11px] font-bold gap-1 self-start select-none transition-colors">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-[#FF9F1C] text-black shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-[#FF9F1C] text-black shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'approved' ? 'bg-[#FF9F1C] text-black shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}`}
            >
              Aprovados ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'rejected' ? 'bg-[#FF9F1C] text-black shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}`}
            >
              Recusados ({rejectedCount})
            </button>
          </div>
        </div>

        {/* Display filtered quotes loop */}
        {filteredQuotes.length === 0 ? (
          <div className="py-20 border border-dashed border-zinc-800/40 rounded-2xl text-center text-zinc-500 space-y-3">
            <div className="p-4 bg-zinc-900/40 border border-zinc-850/50 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-zinc-400">
              <FileText className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-zinc-400">Nenhum orçamento encontrado</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1">Refine seus filtros de status ou digite outro termo na pesquisa.</p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {/* Mobile-oriented user cards (only visible on small screens < md) */}
            <div className="block md:hidden space-y-3">
              {filteredQuotes.map((quote) => (
                <div 
                  key={`mob_${quote.id}`}
                  onClick={() => onSelectQuote(quote.id)}
                  className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl hover:border-zinc-800 transition-all cursor-pointer relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#FF9F1C] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-850/80 rounded">
                      #{quote.quoteNumber}
                    </span>
                    <div>{getStatusBadge(quote.status)}</div>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    <h4 className="text-sm font-bold text-white transition-colors">{quote.clientName}</h4>
                    <p className="text-[10px] text-zinc-550 font-mono">{formatPhone(quote.clientPhone)}</p>
                    <p className="text-xs text-zinc-300 font-medium truncate">
                      {quote.clientVehicleOrService || 'Serviços Personalizados'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900/60">
                    <div>
                      <p className="text-xs font-black font-mono text-zinc-100">{formatBRL(quote.total)}</p>
                      <p className="text-[9px] text-zinc-500">{quote.items.length} {quote.items.length === 1 ? 'item' : 'itens'}</p>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleShareWhatsApp(e, quote)}
                        title="Enviar no WhatsApp"
                        className="p-2 bg-zinc-900 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/20 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleGmailButtonClick(e, quote)}
                        title="Enviar por Gmail"
                        className="p-2 bg-zinc-900 hover:bg-red-500/15 border border-zinc-800 hover:border-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-all"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(e, quote)}
                        title="Copiar Link Digital"
                        className="p-2 bg-zinc-900 hover:bg-orange-500/15 border border-zinc-800 hover:border-[#FF9F1C]/20 text-zinc-400 hover:text-orange-400 rounded-lg transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveDropdownId(activeDropdownId === quote.id ? null : quote.id)}
                          className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        <AnimatePresence>
                          {activeDropdownId === quote.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setActiveDropdownId(null)}
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 bottom-full mb-2 w-40 bg-zinc-950 border border-zinc-850 rounded-xl shadow-2xl z-20 py-1.5 text-left text-xs text-zinc-300 font-bold overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => handleTriggerAction(e, () => onSelectQuote(quote.id))}
                                  className="w-full px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center justify-between"
                                >
                                  <span>Visualizar</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                                
                                {onEditQuote && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleTriggerAction(e, () => onEditQuote(quote))}
                                    className="w-full px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center justify-between"
                                  >
                                    <span>Editar</span>
                                  </button>
                                )}

                                {onDuplicateQuote && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleTriggerAction(e, () => onDuplicateQuote(quote))}
                                    className="w-full px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-[#FF9F1C] flex items-center justify-between"
                                  >
                                    <span>Duplicar</span>
                                  </button>
                                )}

                                {onDeleteQuote && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleTriggerAction(e, () => {
                                      if (window.confirm(`Tem certeza que quer remover permanentemente o orçamento #${quote.quoteNumber}?`)) {
                                        onDeleteQuote(quote.id);
                                      }
                                      setActiveDropdownId(null);
                                    })}
                                    className="w-full px-3 py-2 text-red-500 hover:bg-red-500/10 flex items-center justify-between border-t border-zinc-900/60"
                                  >
                                    <span>Excluir</span>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop and Tablet table (only visible on md screens & above) */}
            <div className="hidden md:block overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <th className="pb-3.5 font-bold">Nº / Cliente</th>
                    <th className="pb-3.5 font-bold">Serviço/Escopo</th>
                    <th className="pb-3.5 font-bold">Valor Est.</th>
                    <th className="pb-3.5 font-bold">Aprovação</th>
                    <th className="pb-3.5 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60">
                  {filteredQuotes.map((quote) => (
                    <tr 
                      key={quote.id} 
                      onClick={() => onSelectQuote(quote.id)}
                      className="group hover:bg-[#1A1A1A]/50 transition-colors cursor-pointer"
                    >
                      {/* Column 1: Client & Quote number */}
                      <td className="py-4 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:border-[#FF9F1C]/40 transition-colors shrink-0">
                            <span className="text-[10px] font-bold text-[#FF9F1C] font-mono">#{quote.quoteNumber}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors truncate">{quote.clientName}</p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{formatPhone(quote.clientPhone)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Scope / Service description */}
                      <td className="py-4 pr-3 max-w-[200px]">
                        <div className="truncate text-xs font-semibold text-zinc-300">
                          {quote.clientVehicleOrService || 'Serviços Personalizados'}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                          {quote.items.length} {quote.items.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                        </div>
                      </td>

                      {/* Column 3: Total estimated Price */}
                      <td className="py-4 pr-3">
                        <p className="text-xs font-black font-mono text-zinc-100">{formatBRL(quote.total)}</p>
                        {quote.taxes > 0 && (
                          <p className="text-[9px] text-zinc-500 font-mono mt-0.5">+ {formatBRL(quote.taxes)} taxas</p>
                        )}
                      </td>

                      {/* Column 4: Expiration/Approval state */}
                      <td className="py-4 pr-3">
                        <div>{getStatusBadge(quote.status)}</div>
                      </td>

                      {/* Column 5: Right actions and dropdown dropdown */}
                      <td className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          {/* Quick WhatsApp Share Button */}
                          <button
                            type="button"
                            onClick={(e) => handleShareWhatsApp(e, quote)}
                            title="Enviar no WhatsApp"
                            className="p-1.5 bg-zinc-900 hover:bg-emerald-500/15 border border-zinc-800 hover:border-emerald-500/20 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Gmail Send Email Button */}
                          <button
                            type="button"
                            onClick={(e) => handleGmailButtonClick(e, quote)}
                            title="Enviar por Gmail"
                            className="p-1.5 bg-zinc-900 hover:bg-red-500/15 border border-zinc-800 hover:border-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-all"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Quick Copy Link Button */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyLink(e, quote)}
                            title="Copiar Link Digital"
                            className="p-1.5 bg-zinc-900 hover:bg-orange-500/15 border border-zinc-800 hover:border-[#FF9F1C]/20 text-zinc-400 hover:text-orange-400 rounded-lg transition-all"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Interactive Dropdown Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveDropdownId(activeDropdownId === quote.id ? null : quote.id)}
                              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            <AnimatePresence>
                              {activeDropdownId === quote.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setActiveDropdownId(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 mt-2 w-40 bg-zinc-950 border border-zinc-850 rounded-xl shadow-2xl z-20 py-1.5 text-left text-xs text-zinc-300 font-bold overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => handleTriggerAction(e, () => onSelectQuote(quote.id))}
                                      className="w-full px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center justify-between"
                                    >
                                      <span>Visualizar</span>
                                      <ChevronRight className="w-3 h-3 text-zinc-550" />
                                    </button>
                                    
                                    {onEditQuote && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleTriggerAction(e, () => onEditQuote(quote))}
                                        className="w-full px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center justify-between"
                                      >
                                        <span>Editar</span>
                                      </button>
                                    )}

                                    {onDuplicateQuote && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleTriggerAction(e, () => onDuplicateQuote(quote))}
                                        className="w-full px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-[#FF9F1C] flex items-center justify-between"
                                      >
                                        <span>Duplicar</span>
                                      </button>
                                    )}

                                    {onDeleteQuote && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleTriggerAction(e, () => {
                                          if (window.confirm(`Tem certeza que quer remover permanentemente o orçamento #${quote.quoteNumber} para ${quote.clientName}?`)) {
                                            onDeleteQuote(quote.id);
                                          }
                                        })}
                                        className="w-full px-3 py-2 text-red-500 hover:bg-red-500/10 flex items-center justify-between border-t border-zinc-900/60"
                                      >
                                        <span>Excluir</span>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Gmail Email Composer Dialog Modal Overlay */}
      <AnimatePresence>
        {activeEmailQuote && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-none">Enviar Proposta por Gmail</h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Orçamento #{activeEmailQuote.quoteNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmailQuote(null)}
                  className="p-1 px-2.5 rounded-lg text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 transition-colors font-bold"
                >
                  Fechar
                </button>
              </div>

              {/* Composer Body */}
              <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Destinatário (E-mail do Cliente)</label>
                  <input
                    type="email"
                    value={clientEmailInput}
                    onChange={(e) => setClientEmailInput(e.target.value)}
                    placeholder="Ex: cliente@empresa.com"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-zinc-100"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">Certifique-se de digitar o e-mail correto para recebimento.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Assunto do E-mail</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Assunto da proposta..."
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-zinc-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Mensagem do E-mail</label>
                  <textarea
                    rows={6}
                    value={emailMessageText}
                    onChange={(e) => setEmailMessageText(e.target.value)}
                    placeholder="Escreva a mensagem personalizada..."
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-zinc-100 leading-relaxed font-sans"
                  />
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 font-bold">
                    💡 O sistema anexa de forma automática um elegante detalhamento comercial e o link para aprovação digital do cliente na parte inferior.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950/30 border-t border-zinc-100 dark:border-zinc-800 flex justify-between gap-3 items-center">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  Conexão Google Criptografada
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveEmailQuote(null)}
                    className="px-4 py-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSendGmailEmail}
                    disabled={isSendingEmail}
                    className="px-5 py-2.5 bg-[#FF9F1C] hover:opacity-95 text-black font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg disabled:opacity-45 cursor-pointer"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Enviar Proposta
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
