// ORKTO Inbox Page - Painel operacional principal (Onda 1 - primeira fatia vertical)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Inbox, 
  Sparkles, 
  ArrowLeft,
  Send,
  Bot,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  Megaphone,
  CornerDownRight,
  Shield,
  MessageCircle,
  Search,
  Loader2,
  User,
  AlertTriangle,
} from 'lucide-react';
import { 
  MoodRing,
  PriorityBadge,
  MessageBubble,
  ConversationItem,
  ApprovalCard,
  EmptyState,
  ConversationListSkeleton,
} from './InboxComponents';
import { useInboxConversations, useConversation, useApprovals } from '../../hooks/useInbox';
import { supabase } from '../../lib/supabase';
import { Timestamp, type Conversation, type ApprovalTask, type ConversationMessage } from '../../types';
import { PromptInput, type WiaPromptMeta } from '../ui/ai-chat-input';

// ===== Sandbox Simulator =====
// Interface separada para simular recebimento de mensagens do WhatsApp (sem WhatsApp real)
function SandboxSimulator({ onMessageReceived }: { onMessageReceived: (phone: string, content: string) => void }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sentHistory, setSentHistory] = useState<Array<{phone: string; message: string; time: Date}>>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = () => {
    if (!phone.trim() || !message.trim()) return;
    onMessageReceived(phone.trim(), message.trim());
    setSentHistory(prev => [...prev, { phone: phone.trim(), message: message.trim(), time: new Date() }]);
    setMessage('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 w-80 max-h-[60vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[#FF9F1C]" />
                <span className="text-sm font-semibold text-white">Sandbox WhatsApp</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <XCircle size={16} />
              </button>
            </div>
            
            <p className="text-xs text-zinc-400 mb-3">
              Simule recebimento de mensagens do WhatsApp para testar o processamento do ORKTO sem enviar mensagens reais.
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Número do cliente (ex: +5511999999999)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+5511999999999"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C]/50"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Mensagem do cliente</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Olá, gostaria de mais informações sobre..."
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C]/50 resize-none"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!phone.trim() || !message.trim()}
                className="w-full py-2 bg-[#FF9F1C] hover:bg-[#e68f1a] disabled:bg-zinc-700 disabled:text-zinc-500 text-black text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Send size={14} /> Simular Mensagem
              </button>
            </div>

            {sentHistory.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-700/50">
                <div className="text-xs text-zinc-500 mb-2">Histórico de simulações:</div>
                {sentHistory.slice(-5).map((item, i) => (
                  <div key={i} className="text-xs text-zinc-400 mb-1 p-2 bg-zinc-800/50 rounded-md">
                    <span className="text-zinc-500">{item.phone}</span>
                    <span className="text-zinc-600 mx-1">•</span>
                    <span className="text-zinc-300">{item.message}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-xs hover:bg-zinc-700 transition-colors shadow-lg"
      >
        <Sparkles size={14} className="text-[#FF9F1C]" />
        Sandbox
      </button>
    </div>
  );
}

// ===== Inbox Page =====
interface InboxPageProps {
  conversations?: Conversation[];
  approvalTasks?: ApprovalTask[];
  onSelectConversation?: (convId: string) => void;
  onBack?: () => void;
  onRefresh?: () => Promise<void>;
}

export default function InboxPage(props: InboxPageProps) {
  const { conversations: propConversations, approvalTasks: propApprovalTasks, onSelectConversation: propOnSelect, onBack: propOnBack, onRefresh: propOnRefresh } = props;
  const [user, setUser] = useState<{ email?: string; uid?: string } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Auth check via Supabase client (sem @supabase/auth-helpers-react)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingUser(false);
    }).catch(() => setLoadingUser(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sendingSim, setSendingSim] = useState(false);
  const [activeView, setActiveView] = useState<'inbox' | 'approvals'>('inbox');
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent' | 'riscos'>('all');

  // Hooks (preferred source of truth)
  const { conversations, loading: inboxLoading, refetch: refetchInbox } = useInboxConversations();
  const { conversation: selectedConversation, loading: convLoading, refetch: refetchConversation } = useConversation(selectedConversationId);
  const { approvalTasks: hookApprovalTasks, loading: approvalsLoading, approveAction, rejectAction, refetch: refetchApprovals } = useApprovals();

  // Use prop data when parent passes it (App.tsx passes server-fetched data), else hooks
  const sourceConversations: any[] = (propConversations && propConversations.length ? propConversations : conversations) as any[];
  const sourceApprovalTasks: any[] = (propApprovalTasks && propApprovalTasks.length ? propApprovalTasks : hookApprovalTasks) as any[];
  const handleSelectConversation = propOnSelect || ((id: string) => setSelectedConversationId(id));
  const handleBack = propOnBack || (() => setSelectedConversationId(null));
  const handleRefresh = propOnRefresh || (async () => { await refetchInbox(); await refetchApprovals(); });

  // Filtros — usando os campos esperados pelo UI (vidro_server retorna esses campos em producao)
  interface InboxConvView {
    id: string; phone: string; name?: string | null;
    messages_24h: number; last_message_by?: string; risk_score?: number | null;
    priority_score?: number | null; mood_state?: string; mood_confidence?: number;
    priority_reason?: string | null; recent_messages?: Array<{ content?: string }>;
    last_message_at?: string; messages?: ConversationMessage[];
  }
  const decorate = (c: Conversation): InboxConvView => ({
    id: c.id,
    phone: c.phone || c.contact_phone || c.contactPhone || '',
    name: c.name || c.contact_name || c.contactName || null,
    messages_24h: c.messages_24h || c.unread_count || c.unreadCount || 0,
    last_message_by: (c as any).last_message_by,
    risk_score: (c as any).risk_score ?? null,
    priority_score: (c as any).priority_score ?? 0,
    mood_state: (c as any).mood_state,
    mood_confidence: (c as any).mood_confidence || 0,
    priority_reason: (c as any).priority_reason,
    recent_messages: (c as any).recent_messages,
    last_message_at: c.last_message_at,
    messages: c.messages as ConversationMessage[] | undefined,
  });
  const filteredConversations = sourceConversations.map((conversation) => decorate(conversation as Conversation)).filter(c => {
    if (filter === 'unread') return c.messages_24h > 0 && c.last_message_by === 'customer';
    if (filter === 'urgent') return (c.priority_score || 0) >= 30;
    if (filter === 'riscos') return c.risk_score !== null && c.risk_score > 0;
    return true;
  });

  const pendingApprovals = propApprovalTasks || hookApprovalTasks || [];

  // Handlers
  const handleConversationClick = (id: string) => {
    setSelectedConversationId(id);
    setActiveView('inbox');
    handleSelectConversation(id);
    refetchConversation();
  };

  const handleMessageReceived = useCallback(async (phone: string, content: string, wia?: WiaPromptMeta) => {
    setSendingSim(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch('/api/orkto/whatsapp/webhook-sim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          workspaceId: user?.uid || user?.email || 'sandbox',
          contactPhone: phone,
          contactName: phone,
          message: content,
          senderType: wia ? 'human' : 'customer',
          wia: wia ? {
            agent: wia.agent,
            effort: wia.effort,
            inputMode: wia.inputMode,
            attachmentCount: wia.attachments.length,
          } : undefined,
        }),
      });
      if (!response.ok) throw new Error(`Falha na simulação: HTTP ${response.status}`);
      await Promise.all([refetchInbox(), refetchConversation()]);
    } finally {
      setSendingSim(false);
    }
  }, [user, refetchInbox, refetchConversation]);

  const handleApprove = async (actionId: string) => {
    const success = await approveAction(actionId);
    if (success) {
      refetchApprovals();
      refetchInbox();
      if (selectedConversationId) refetchConversation();
      await handleRefresh();
    }
  };

  const handleReject = async (actionId: string) => {
    const success = await rejectAction(actionId);
    if (success) {
      refetchApprovals();
      refetchInbox();
      await handleRefresh();
    }
  };

  const handleSendReply = async (contentOverride?: string, wia?: WiaPromptMeta): Promise<boolean> => {
    const content = (contentOverride ?? replyContent).trim();
    if (!selectedConversation?.contactPhone || !content || sendingReply) return false;
    setSendingReply(true);
    setReplyError(null);
    try {
      await handleMessageReceived(selectedConversation.contactPhone, content, wia);
      setReplyContent('');
      return true;
    } catch (error) {
      console.error('[InboxPage] reply send error:', error);
      setReplyError('Não foi possível enviar. Sua mensagem foi preservada para tentar novamente.');
      return false;
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    setReplyContent('');
    setReplyError(null);
  }, [selectedConversationId]);

  // Auto-scroll para novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#FF9F1C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex">
      {/* Sidebar - Filtros e Aprovações */}
      <div className="w-72 bg-zinc-900/50 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9F1C] to-black flex items-center justify-center">
              <span className="text-black font-bold text-lg">O</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">ORKTO Inbox</h1>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Hermes Online
              </p>
            </div>
          </div>
        </div>

        {/* Navegação */}
        <div className="p-3 border-b border-zinc-800 flex">
          {[
            { id: 'inbox', label: 'Inbox', icon: Inbox },
            { id: 'approvals', label: 'Aprovações', icon: Sparkles, badge: pendingApprovals.length },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as 'inbox' | 'approvals')}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors text-xs font-medium
                ${activeView === item.id 
                  ? 'bg-[#FF9F1C]/10 text-[#FF9F1C] border border-[#FF9F1C]/20' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
              `}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeView === item.id ? 'bg-[#FF9F1C] text-black' : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filtros quando view = inbox */}
        {activeView === 'inbox' && (
          <div className="p-3 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 mb-2 font-medium">Filtros</div>
            <div className="space-y-1">
              {[
                {id: 'all', label: 'Todas', count: sourceConversations.length},
                  { id: 'unread', label: 'Sem resposta', count: sourceConversations.filter(c => c.messages_24h > 0 && c.last_message_by === 'customer').length},
                  { id: 'urgent', label: 'Urgentes (P≥30)', count: sourceConversations.filter(c => (c.priority_score || 0) >= 30).length},
                  { id: 'riscos', label: 'Com risco', count: sourceConversations.filter(c => c.risk_score !== null && c.risk_score > 0).length},
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as 'all' | 'unread' | 'urgent' | 'riscos')}
                  className={`
                    w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-colors
                    ${filter === f.id 
                      ? 'bg-[#FF9F1C]/10 text-[#FF9F1C] font-medium' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
                  `}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === f.id ? 'bg-[#FF9F1C]/20 text-[#FF9F1C]' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Aprovações na sidebar */}
        {activeView === 'approvals' && (
          <div className="flex-1 overflow-y-auto">
            {approvalsLoading ? (
              <div className="p-4">
                <ConversationListSkeleton />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <EmptyState
                icon={<CheckCircle size={32} className="text-green-500/50" />}
                title="Sem aprovações pendentes"
                description="Todas as ações dos bots já foram revisadas."
              />
            ) : (
              <div className="p-2 space-y-2">
                {pendingApprovals.map(task => (
                  <div key={task.id} className="bg-zinc-800/30 rounded-lg p-2 border border-zinc-700/30">
                    <ApprovalCard
                      id={task.id}
                      title={task.title}
                      description={task.description}
                      priority={task.priority}
                      suggestedReply={task.suggested_reply}
                      onApprove={() => handleApprove(task.id)}
                      onReject={() => handleReject(task.id)}
                      isLoading={sendingSim}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status do Hermes */}
        <div className="p-3 border-t border-zinc-800 mt-auto">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Shield size={12} className="text-green-500/50" />
            <span>Modo sandbox • Sem mensagens reais</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
            <Bot size={12} className="text-[#FF9F1C]/50" />
            <span>HermesAdapter: Mock v1.0.0</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeView === 'inbox' && (
          <>
            {/* Conversation List */}
            <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30">
              {/* Search */}
              <div className="p-3 border-b border-zinc-800">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar conversas..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C]/50"
                  />
                </div>
              </div>

              {/* Conversas */}
              <div className="flex-1 overflow-y-auto">
                {inboxLoading ? (
                  <ConversationListSkeleton />
                ) : filteredConversations.length === 0 ? (
                  <EmptyState
                    icon={<MessageCircle size={32} className="text-zinc-600" />}
                    title={filter === 'all' ? 'Sem conversas' : 'Sem conversas filtradas'}
                    description="Mensagens recebidas aparecerão aqui para você responder."
                  />
                ) : (
                  filteredConversations.map(c => (
                    <ConversationItem
                      key={c.id}
                      id={c.id}
                      phone={c.phone}
                      name={c.name}
                      lastMessage={c.recent_messages?.[0]?.content || null}
                      lastMessageBy={c.last_message_by as 'customer' | 'business' | undefined}
                      lastMessageAt={c.last_message_at}
                      mood={c.mood_state as 'green' | 'yellow' | 'red' | 'blue' | 'neutral' | undefined}
                      moodConfidence={c.mood_confidence || 0}
                      priorityScore={c.priority_score}
                      priorityReason={c.priority_reason}
                      unread={c.messages_24h > 0 && c.last_message_by === 'customer'}
                      onClick={() => handleConversationClick(c.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Conversation Detail */}
            <div className="flex-1 flex flex-col min-w-0">
              {!selectedConversationId ? (
                <EmptyState
                  icon={<MessageCircle size={48} className="text-zinc-700" />}
                  title="Selecione uma conversa"
                  description="Clique em uma conversa na lista ao lado para visualizar o histórico e responder."
                />
              ) : convLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#FF9F1C] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedConversation ? (
                <>
                  {/* Header da conversa */}
                  <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                    <button
                      onClick={() => { setSelectedConversationId(null); setActiveView('inbox'); }}
                      className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-3 text-sm"
                    >
                      <ArrowLeft size={16} /> Voltar para inbox
                    </button>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF9F1C] to-black flex items-center justify-center text-black font-bold text-lg shrink-0">
                        {selectedConversation.contactName?.[0]?.toUpperCase() || selectedConversation.contactPhone?.replace(/^\+?(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') || '?'}
                        </div>
                        <div>
                        <h2 className="text-lg font-bold text-white">
                          {selectedConversation.contactName || selectedConversation.contactPhone?.replace(/^\+?(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')}
                        </h2>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          {selectedConversation.contactPhone}
                            {selectedConversation.last_message_at && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-500">{formatLastMessageTime(selectedConversation.last_message_at)}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MoodRing 
                          mood={(selectedConversation.mood || 'neutral') as 'green' | 'yellow' | 'red' | 'blue' | 'neutral'}
                          confidence={0}
                          size="lg"
                        />
                        <PriorityBadge 
                          score={selectedConversation.priorityScore}
                          reason={undefined}
                          size="md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mensagens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-zinc-950">
                    {selectedConversation.messages.map((msg: any) => (
                      <MessageBubble
                        key={msg.id}
                        content={msg.content}
                        direction={msg.direction}
                        sender={(msg.senderRole || msg.sender_role) as 'contact' | 'operator' | 'bot' | 'system'}
                        sender_name={msg.senderName || msg.sender_name}
                        sent_at={msg.sentAt instanceof Date ? msg.sentAt.toISOString() : msg.sentAt instanceof Timestamp ? msg.sentAt.toDate().toISOString() : String(msg.sentAt || msg.sent_at)}
                        processed_by_agent={!!msg.metadata?.processed_by_agent}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                    <PromptInput
                      value={replyContent}
                      onChange={setReplyContent}
                      onSubmit={(message, meta) => handleSendReply(message, meta)}
                      disabled={sendingReply}
                      status={sendingReply ? 'sending' : 'idle'}
                      placeholder="Mensagem ou instrução para a WIA..."
                      className="mx-auto max-w-2xl"
                    />
                    {replyError && (
                      <p className="mt-2 text-center text-xs text-rose-400" role="alert">
                        {replyError}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-2 text-center">
                      Modo sandbox: as mensagens são processadas pelo ORKTO (HermesAdapter mock + Policy Engine) sem envio real via WhatsApp.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-zinc-500">Conversa não encontrada</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeView === 'approvals' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-[#FF9F1C]" />
                Aprovações Pendentes
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Revise e aprove/rejeite as sugestões dos bots/ORKTO antes que sejam executadas.
              </p>
            </div>

            {approvalsLoading ? (
              <ConversationListSkeleton />
            ) : pendingApprovals.length === 0 ? (
              <EmptyState
                icon={<CheckCircle size={32} className="text-green-500/50" />}
                title="Tudo alinhado!"
                description="Não há aprovações pendentes. Os bots estão operando dentro dos limites ou aguardando novas mensagens."
              />
            ) : (
              <div className="grid gap-4">
                {pendingApprovals.map(task => (
                  <ApprovalCard
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    description={task.description}
                    priority={task.priority}
                    suggestedReply={task.suggested_reply}
                    onApprove={() => handleApprove(task.id)}
                    onReject={() => handleReject(task.id)}
                    isLoading={sendingSim}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sandbox Simulator */}
      <SandboxSimulator onMessageReceived={handleMessageReceived} />
    </div>
  );
}

function formatLastMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  return date.toLocaleDateString('pt-BR');
}
