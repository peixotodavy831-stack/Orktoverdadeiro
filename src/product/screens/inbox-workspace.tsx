import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import ConversationView from '../../components/inbox/ConversationView';
import type { ProductView } from '../types';
import type { InboxConversationView, ProductRequestState } from '../types';
import { BackendPending, EmptyState, ErrorState, LoadingState, PermissionState, ConfigurationRequired, StatusBadge } from '../ui/shared-states';
import { inboxDataSource, InboxDataSourceError } from '../adapters/inbox-data-source';

interface InboxWorkspaceProps {
  currentView: ProductView;
  accessToken: string | null;
  selectedConversationId: string | null;
  onOpenConversation: (conversationId: string) => void;
  onBackToInbox: () => void;
  onOpenDeal: (dealId: string) => void;
  onOpenSettings: () => void;
  onRefresh?: () => Promise<void>;
}

type PriorityFilter = 'all' | 'unread' | 'priority';

function formatRelativeTime(value?: string | null) {
  if (!value) return 'Horário não informado';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Horário não informado';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `há ${days} d` : new Date(timestamp).toLocaleDateString('pt-BR');
}

function reasonsOf(item: InboxConversationView) {
  if (Array.isArray(item.priority_reason)) return item.priority_reason.filter(Boolean);
  return item.priority_reason ? [item.priority_reason] : [];
}

function priorityTone(priority?: string | null) {
  const value = String(priority || '').toLowerCase();
  if (value === 'urgent' || value === 'high') return 'critical' as const;
  if (value === 'normal') return 'neutral' as const;
  return 'info' as const;
}

function ContextPanel({ conversation, onClose, onOpenDeal, modal = false }: { conversation: InboxConversationView | null; onClose?: () => void; onOpenDeal: (dealId: string) => void; modal?: boolean }) {
  const reasons = conversation ? reasonsOf(conversation) : [];
  return <aside className={`orkto-inbox-context h-full min-h-0 overflow-y-auto border-l p-4 orkto-product-border orkto-product-surface ${modal ? 'w-full max-w-[420px] shadow-[var(--orkto-shadow-panel)]' : ''}`} aria-label="Contexto da conversa">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Contexto comercial</p><h2 className="mt-1 text-base font-semibold">Conversa</h2></div>
      {onClose && <button type="button" data-context-close="true" onClick={onClose} aria-label="Fechar contexto" className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><X size={18} /></button>}
    </div>
    {!conversation ? <EmptyState title="Selecione uma conversa" description="Os dados do cliente e dos vínculos comerciais confirmados aparecem aqui." /> : <div className="space-y-5">
      <section aria-labelledby="inbox-context-contact">
        <h3 id="inbox-context-contact" className="text-[11px] font-semibold uppercase tracking-[0.1em] orkto-product-subtle">Cliente</h3>
        <p className="mt-2 text-sm font-semibold">{conversation.contact_name || 'Nome não informado'}</p>
        {conversation.contact_phone && <p className="mt-1 text-xs orkto-product-muted">{conversation.contact_phone}</p>}
        <dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="orkto-product-muted">Canal</dt><dd className="text-right">{conversation.source_channel || 'Não informado'}</dd></div><div className="flex justify-between gap-3"><dt className="orkto-product-muted">Última mensagem</dt><dd className="text-right">{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString('pt-BR') : 'Não informado'}</dd></div><div className="flex justify-between gap-3"><dt className="orkto-product-muted">Status</dt><dd className="text-right">{conversation.status || 'Não informado'}</dd></div></dl>
      </section>
      <section className="border-t pt-4 orkto-product-border" aria-labelledby="inbox-context-signal">
        <h3 id="inbox-context-signal" className="text-[11px] font-semibold uppercase tracking-[0.1em] orkto-product-subtle">Sinal prioritário</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge tone={priorityTone(conversation.priority)}>Prioridade {conversation.priority || 'não classificada'}</StatusBadge>{Number(conversation.unread_count || 0) > 0 && <StatusBadge tone="info">{conversation.unread_count} não lida{Number(conversation.unread_count) === 1 ? '' : 's'}</StatusBadge>}</div>
        {reasons.length > 0 ? <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-5 orkto-product-muted">{reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul> : <p className="mt-2 text-xs leading-5 orkto-product-muted">A fila não retornou uma explicação para esta prioridade.</p>}
        {typeof conversation.risk_score === 'number' && conversation.risk_score > 0 && <p className="mt-3 rounded-lg border p-3 text-xs orkto-product-border orkto-product-surface-muted">Há uma avaliação de risco vinculada. A lista não retornou fatores detalhados para exibi-la como recomendação.</p>}
      </section>
      <section className="border-t pt-4 orkto-product-border" aria-labelledby="inbox-context-deals">
        <h3 id="inbox-context-deals" className="text-[11px] font-semibold uppercase tracking-[0.1em] orkto-product-subtle">Negócios relacionados</h3>
        {conversation.related_deal_ids?.length ? <div className="mt-2 space-y-2">{conversation.related_deal_ids.map(dealId => <button key={dealId} type="button" onClick={() => onOpenDeal(dealId)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-xs orkto-product-border orkto-product-surface hover:orkto-product-surface-muted"><span>Negócio vinculado</span><span className="font-mono text-[10px] orkto-product-subtle">{dealId.slice(0, 8)}</span></button>)}</div> : <p className="mt-2 text-xs leading-5 orkto-product-muted">Nenhum negócio vinculado foi retornado pela Inbox.</p>}
      </section>
      <section className="border-t pt-4 orkto-product-border" aria-labelledby="inbox-context-wia">
        <h3 id="inbox-context-wia" className="text-[11px] font-semibold uppercase tracking-[0.1em] orkto-product-subtle">WIA contextual</h3>
        <p className="mt-2 text-xs leading-5 orkto-product-muted">Sugestões preparadas e instruções privadas aparecem no histórico desta conversa quando retornadas pelo servidor. Nada é enviado automaticamente.</p>
      </section>
    </div>}
  </aside>;
}

export default function InboxWorkspace({ currentView, accessToken, selectedConversationId, onOpenConversation, onBackToInbox, onOpenDeal, onOpenSettings, onRefresh }: InboxWorkspaceProps) {
  const [listState, setListState] = useState<{ status: ProductRequestState; data: InboxConversationView[]; message?: string }>({ status: 'loading', data: [] });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PriorityFilter>('all');
  const [contextOpen, setContextOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1440px)').matches);
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const contextDrawerRef = useRef<HTMLDivElement>(null);
  const mobileDetail = currentView === 'conversation';
  const conversations = listState.data;
  const selected = conversations.find(item => item.id === selectedConversationId) as InboxConversationView | undefined;

  const loadConversations = useCallback(async () => {
    setListState({ status: 'loading', data: [] });
    try {
      const data = await inboxDataSource.listConversations(accessToken);
      setListState({ status: 'success', data });
    } catch (cause) {
      setListState({
        status: cause instanceof InboxDataSourceError ? cause.state : 'error',
        data: [],
        message: cause instanceof Error ? cause.message : 'Não foi possível carregar as conversas.',
      });
    }
  }, [accessToken]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!contextDrawerOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = contextDrawerRef.current;
    panel?.querySelector<HTMLElement>('[data-context-close="true"]')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setContextDrawerOpen(false); }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus(); };
  }, [contextDrawerOpen]);

  const visible = useMemo(() => conversations.filter(item => {
    const text = `${item.contact_name || ''} ${item.last_message || ''} ${item.source_channel || ''}`.toLocaleLowerCase('pt-BR');
    if (!text.includes(query.toLocaleLowerCase('pt-BR'))) return false;
    if (filter === 'unread') return Number(item.unread_count || 0) > 0;
    if (filter === 'priority') return ['urgent', 'high'].includes(String(item.priority || '').toLowerCase());
    return true;
  }), [conversations, filter, query]);

  const refresh = async () => {
    await loadConversations();
    await onRefresh?.();
  };

  const openContext = () => {
    if (window.matchMedia('(min-width: 1440px)').matches) setContextOpen(value => !value);
    else setContextDrawerOpen(true);
  };

  return <section className="orkto-inbox-view" data-mobile-detail={mobileDetail ? 'true' : 'false'} data-nav-hidden={mobileDetail ? 'true' : 'false'} aria-label="Inbox">
    <div className="orkto-inbox-layout" data-context-open={contextOpen ? 'true' : 'false'}>
      <aside className="orkto-inbox-list min-h-0 overflow-y-auto border-r p-3 orkto-product-border orkto-product-surface" aria-label="Conversas">
        <div className="mb-3 flex items-center justify-between gap-2 px-1"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Atendimento</p><h1 className="mt-1 text-xl font-semibold">Inbox</h1></div><button type="button" onClick={() => void refresh()} aria-label="Atualizar conversas" className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><RefreshCw size={16} className={listState.status === 'loading' ? 'animate-spin' : ''} /></button></div>
        <label className="relative block"><span className="sr-only">Buscar conversas</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 orkto-product-subtle" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conversa" className="orkto-product-control min-h-11 w-full rounded-lg pl-9 pr-3 text-sm" /></label>
        <label className="mt-2 block"><span className="sr-only">Filtrar conversas</span><select value={filter} onChange={event => setFilter(event.target.value as PriorityFilter)} className="orkto-product-control min-h-11 w-full rounded-lg px-3 text-xs"><option value="all">Todas as conversas</option><option value="unread">Não lidas</option><option value="priority">Prioritárias</option></select></label>
        {listState.status === 'loading' && <div className="mt-3"><LoadingState rows={5} label="Carregando conversas" /></div>}
        {listState.status === 'permission_denied' && <div className="mt-3"><PermissionState message="Seu acesso não permite visualizar esta Inbox." /></div>}
        {listState.status === 'configuration_required' && <div className="mt-3"><ConfigurationRequired title="Inbox precisa de configuração" message={listState.message || 'Conecte a configuração necessária para carregar as conversas.'} action={<button type="button" onClick={onOpenSettings} className="orkto-product-control min-h-11 rounded-lg px-3 text-xs font-semibold">Abrir configurações</button>} /></div>}
        {listState.status === 'backend_pending' && <div className="mt-3"><BackendPending title="Fila da Inbox pendente neste ambiente" message="O contrato necessário para listar conversas ainda não está disponível aqui." /></div>}
        {(listState.status === 'error' || listState.status === 'offline') && <div className="mt-3"><ErrorState title="Não foi possível carregar as conversas" message={listState.message || 'A fila da Inbox não respondeu.'} onRetry={() => void refresh()} /></div>}
        {listState.status === 'success' && visible.length === 0 && <div className="mt-3"><EmptyState title={query || filter !== 'all' ? 'Nenhuma conversa neste filtro' : 'Nenhuma conversa na Inbox'} description={query || filter !== 'all' ? 'Limpe a busca ou escolha outro filtro para ver a fila.' : 'Quando o servidor retornar conversas, elas serão organizadas nesta fila.'} action={(query || filter !== 'all') ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="min-h-11 rounded-lg border px-3 text-xs font-medium orkto-product-border">Limpar filtros</button> : undefined} /></div>}
        {listState.status === 'success' && visible.length > 0 && <ul className="mt-3 divide-y orkto-product-border">
          {visible.map(item => {
            const active = item.id === selectedConversationId;
            const urgent = ['urgent', 'high'].includes(String(item.priority || '').toLowerCase());
            return <li key={item.id}><button type="button" onClick={() => onOpenConversation(item.id)} aria-current={active ? 'true' : undefined} aria-label={`${item.contact_name || 'Conversa sem nome'}, ${item.source_channel || 'canal não informado'}${Number(item.unread_count || 0) ? `, ${item.unread_count} não lida` : ''}, prioridade ${item.priority || 'não classificada'}, ${formatRelativeTime(item.last_message_at)}`} className={`flex min-h-[76px] w-full gap-3 rounded-lg px-2.5 py-3 text-left transition-colors ${active ? 'orkto-product-nav-active' : 'hover:orkto-product-surface-muted'}`}>
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold orkto-product-border orkto-product-surface-muted">{(item.contact_name || 'C').trim().slice(0, 1).toUpperCase()}{Number(item.unread_count || 0) > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 orkto-product-border" style={{ background: 'var(--orkto-brand)' }} aria-label="Tem mensagem não lida" />}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold">{item.contact_name || 'Conversa sem nome'}</span><span className="shrink-0 text-[10px] orkto-product-subtle" title={item.last_message_at ? new Date(item.last_message_at).toLocaleString('pt-BR') : undefined}>{formatRelativeTime(item.last_message_at)}</span></span><span className="mt-1 block truncate text-xs orkto-product-muted">{item.last_message || 'Sem mensagem recente'}</span><span className="mt-2 flex flex-wrap items-center gap-1.5"><span className="rounded-full border px-2 py-0.5 text-[10px] orkto-product-border orkto-product-muted">{item.source_channel || 'Canal não informado'}</span>{item.priority && <StatusBadge tone={priorityTone(item.priority)}>{item.priority}</StatusBadge>}{Number(item.unread_count || 0) > 0 && <span className="text-[10px] font-medium orkto-product-muted">{item.unread_count} não lida{Number(item.unread_count) === 1 ? '' : 's'}</span>}{urgent && <span className="sr-only">Prioritária: {reasonsOf(item as InboxConversationView).join(', ') || 'classificada pelo servidor'}</span>}</span></span>
            </button></li>;
          })}
        </ul>}
      </aside>

      <div className="orkto-inbox-thread min-h-0 min-w-0" aria-label="Conversa selecionada">
        {selectedConversationId ? <InboxThread conversationId={selectedConversationId} onBack={onBackToInbox} onOpenContext={openContext} onOpenConfiguration={onOpenSettings} onRefresh={refresh} /> : <div className="flex h-full min-h-[420px] items-center justify-center p-6"><EmptyState title="Escolha uma conversa" description="A conversa externa, a composição e as ações contextuais serão abertas aqui." /></div>}
      </div>

      <div className="orkto-inbox-context-slot min-h-0" aria-label="Contexto e WIA"><ContextPanel conversation={selected || null} onOpenDeal={onOpenDeal} /></div>
    </div>

    {contextDrawerOpen && <div className="fixed inset-0 z-[130] flex justify-end" onMouseDown={event => { if (event.target === event.currentTarget) setContextDrawerOpen(false); }}>
      <button type="button" className="absolute inset-0 bg-[var(--orkto-overlay)]" aria-label="Fechar contexto" onClick={() => setContextDrawerOpen(false)} />
      <div ref={contextDrawerRef} role="dialog" aria-modal="true" aria-label="Contexto da conversa" className="relative h-full w-full max-w-[420px]"><ContextPanel conversation={selected || null} onClose={() => setContextDrawerOpen(false)} onOpenDeal={onOpenDeal} modal /></div>
    </div>}
  </section>;
}

function InboxThread({ conversationId, onBack, onOpenContext, onOpenConfiguration, onRefresh }: { conversationId: string; onBack: () => void; onOpenContext: () => void; onOpenConfiguration: () => void; onRefresh: () => Promise<void> }) {
  return <ConversationView conversationId={conversationId} embedded onBack={onBack} onOpenContext={onOpenContext} onOpenConfiguration={onOpenConfiguration} onRefresh={onRefresh} />;
}
