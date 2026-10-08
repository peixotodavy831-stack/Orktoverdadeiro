import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { supabase } from '../../lib/supabase';
import { PromptInput, type WiaPromptMeta } from '../ui/ai-chat-input';
import WiaMark from './WiaMark';

interface WiaContactPageProps {
  userProfile: UserProfile | null;
}

interface ChatMessage {
  id: string;
  role: 'wia' | 'user';
  content: string;
  mode?: 'live' | 'simulated';
  provider?: string;
  requiresApproval?: boolean;
  sourceCount?: number;
  reasonCode?: string;
  isError?: boolean;
  persistenceWarning?: boolean;
}

interface WiaApiResponse {
  success: boolean;
  mode: 'live' | 'simulated';
  usage: { provider: string; model: string };
  decision: {
    messageDraft: string;
    sourceIds: string[];
    requiresApproval: boolean;
    reasonCode: string;
  };
  chatPersistence?: 'persisted' | 'partial' | 'not_requested';
  error?: string;
}

const suggestions = [
  'Como estão as vendas?',
  'O que exige minha decisão?',
  'Prepare os follow-ups',
  'Compare com a semana passada',
];

export default function WiaContactPage({ userProfile }: WiaContactPageProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('orkto_wia_session_id');
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const created = crypto.randomUUID();
    localStorage.setItem('orkto_wia_session_id', created);
    return created;
  });
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const firstName = userProfile?.displayName?.split(' ')[0] || userProfile?.companyName || 'você';

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  useEffect(() => {
    let active = true;
    localStorage.setItem('orkto_wia_session_id',sessionId);
    setLoadingHistory(true);
    setHistoryError('');
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para recuperar a conversa.');
        const response = await fetch(`/api/wia/chat-history?sessionId=${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível recuperar a conversa salva.');
        if (active) setMessages((payload.data || []).map((item: { id: string; role: 'user' | 'assistant'; content: string }) => ({ id:item.id, role:item.role === 'user' ? 'user' : 'wia', content:item.content })));
      } catch (error) {
        if (active) setHistoryError(error instanceof Error ? error.message : 'Não foi possível recuperar a conversa salva.');
      } finally { if (active) setLoadingHistory(false); }
    })();
    return () => { active = false; };
  }, [sessionId]);

  const sendMessage = async (content = message, _meta?: WiaPromptMeta) => {
    const cleanMessage = content.trim();
    if (!cleanMessage || sending || loadingHistory || historyError) return;

    const clientMessageId = crypto.randomUUID();
    setMessages(current => [...current, { id: clientMessageId, role: 'user', content: cleanMessage }]);
    setMessage('');
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para falar com a WIA.');
      const response = await fetch('/api/wia/decide', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: cleanMessage, sessionId, clientMessageId }),
      });
      const payload = await response.json().catch(() => null) as WiaApiResponse | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'A WIA não conseguiu responder agora.');
      setMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'wia',
          content: payload.decision.messageDraft,
          mode: payload.mode,
          provider: payload.usage?.provider,
          requiresApproval: payload.decision.requiresApproval,
          sourceCount: payload.decision.sourceIds.length,
          reasonCode: payload.decision.reasonCode,
          persistenceWarning: payload.chatPersistence === 'partial',
        },
      ]);
    } catch (error) {
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: 'wia',
        content: error instanceof Error && error.message.startsWith('Sua sessão expirou')
          ? error.message
          : 'Não consegui responder agora. Tente novamente. Nenhuma ação foi executada.',
        isError: true,
        reasonCode: 'request_failed',
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex w-full min-w-0 min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0c0d] text-zinc-100 shadow-2xl shadow-black/20 sm:rounded-3xl lg:h-[calc(100dvh-2rem)] lg:min-h-0">
      <header className="flex shrink-0 flex-col gap-3 border-b border-zinc-800 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-7">
        <div className="flex items-center gap-3">
          <WiaMark size={40} className="h-10 w-10" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-white">WIA</h1>
              <span className="rounded-full border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#FF8A00]">Contato direto</span>
            </div>
            <p className="text-xs text-zinc-400">Converse com sua operação. A WIA prepara; você decide.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-[11px] text-zinc-500 sm:flex"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />Contexto da operação disponível</span>
          <button type="button" onClick={() => { const next = crypto.randomUUID(); setMessages([]); setMessage(''); setSessionId(next); }} disabled={sending || loadingHistory || messages.length === 0} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Iniciar nova conversa com a WIA"><RotateCcw size={13} />Nova conversa</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-5 lg:px-7" role="log" aria-live="polite" aria-label="Conversa com a WIA" aria-busy={sending}>
            <div className="mx-auto w-full max-w-3xl space-y-4">
              {historyError && <div role="alert" className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-100">{historyError} A WIA não enviará mensagens enquanto o histórico não puder ser recuperado.</div>}
              {loadingHistory && <div role="status" className="flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="h-4 w-4 animate-spin text-[#FF8A00]" /> Recuperando conversa salva…</div>}
              <div className="flex items-start gap-3">
                <WiaMark size={36} className="h-9 w-9" />
                <div className="min-w-0 max-w-2xl rounded-2xl rounded-tl-md border border-zinc-800 bg-[#141517] px-3.5 py-3 sm:px-4">
                  <p className="text-[14px] leading-6 text-zinc-200">
                    Olá, {firstName}. Estou pronta para conversar sobre sua operação, explicar o que merece atenção e preparar ações para você revisar.
                  </p>
                </div>
              </div>

              {messages.map(chatMessage => (
                <div key={chatMessage.id} className={`flex min-w-0 items-start gap-2.5 sm:gap-3 ${chatMessage.role === 'user' ? 'justify-end' : ''}`}>
                  {chatMessage.role === 'wia' && <WiaMark size={34} className="h-[34px] w-[34px]" />}
                  <div className={`min-w-0 max-w-[88%] rounded-2xl px-3.5 py-3 text-[14px] leading-6 sm:max-w-2xl sm:px-4 ${chatMessage.role === 'user' ? 'rounded-tr-md bg-zinc-800 text-white' : chatMessage.isError ? 'rounded-tl-md border border-amber-700/40 bg-amber-950/20 text-amber-100' : 'rounded-tl-md border border-zinc-800 bg-[#141517] text-zinc-200'}`}>
                    <p>{chatMessage.content}</p>
                    {chatMessage.role === 'wia' && chatMessage.mode && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3 text-[10px] leading-none">
                        <span className={`rounded-full border px-2 py-1 ${chatMessage.mode === 'live' ? 'border-emerald-500/25 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
                          {chatMessage.mode !== 'live'
                            ? 'Modo seguro simulado'
                            : chatMessage.provider === 'gemini'
                              ? 'Gemini ativo'
                              : chatMessage.provider === 'deepseek'
                                ? 'DeepSeek ativo'
                                : chatMessage.provider === 'none'
                                  ? 'Consulta operacional'
                                  : 'IA ativa'}
                        </span>
                        <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-500">
                          {chatMessage.sourceCount || 0} fonte{chatMessage.sourceCount === 1 ? '' : 's'} verificada{chatMessage.sourceCount === 1 ? '' : 's'}
                        </span>
                        {chatMessage.requiresApproval && <span className="rounded-full border border-[#FF8A00]/25 px-2 py-1 text-[#FF8A00]">Requer aprovação</span>}
                      </div>
                    )}
                    {chatMessage.persistenceWarning && <p className="mt-2 border-t border-amber-700/30 pt-2 text-[11px] text-amber-300">Resposta não salva no histórico. Recarregar pode perder esta mensagem.</p>}
                  </div>
                </div>
              ))}
              <div ref={conversationEndRef} aria-hidden="true" />

              {sending && (
                <div className="flex items-center gap-3" role="status" aria-label="WIA está preparando uma resposta">
                  <WiaMark size={38} className="h-9 w-9" />
                  <div className="flex gap-1 rounded-2xl rounded-tl-md border border-zinc-800 bg-[#141517] px-4 py-4">
                    {[0, 1, 2].map(item => <span key={item} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF8A00]" style={{ animationDelay: `${item * 120}ms` }} />)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-zinc-800 bg-[#0e0f10] px-3 pb-3 pt-3 sm:px-6 sm:pb-4 lg:px-7">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {suggestions.map(suggestion => (
                  <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} disabled={sending || loadingHistory || Boolean(historyError)} className="min-h-10 shrink-0 whitespace-nowrap rounded-full border border-zinc-800 bg-[#151618] px-3 text-[11px] text-zinc-400 transition-colors hover:border-[#FF8A00]/40 hover:text-white disabled:opacity-50">
                    {suggestion}
                  </button>
                ))}
              </div>
              <PromptInput
                value={message}
                onChange={setMessage}
                onSubmit={(value, meta) => sendMessage(value, meta)}
                disabled={sending || loadingHistory || Boolean(historyError)}
                status={sending ? 'sending' : 'idle'}
                placeholder="Pergunte sobre a operação ou peça uma ação..."
                agents={['WIA']}
                efforts={['Equilibrado']}
                className="max-w-none"
              />
              <p className="mt-2 text-center text-[10px] text-zinc-500">Esta conversa lembra as mensagens anteriores até você iniciar uma nova. Ações sensíveis continuam sob seu controle.</p>
            </div>
          </div>
        </section>

        <aside className="hidden min-w-0 flex-col border-l border-zinc-800 bg-[#0e0f10] p-5 lg:flex">
          <h2 className="text-sm font-semibold text-white">Contexto desta conversa</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-600">Informações usadas para responder com mais precisão.</p>
          <div className="mt-5 space-y-3">
            <ContextCard icon={Target} title="Objetivo atual" value="Entender e avançar a operação" />
            <ContextCard icon={Clock3} title="Período analisado" value="Dados disponíveis agora" />
            <ContextCard icon={Sparkles} title="Fontes consideradas" value="Orçamentos disponíveis" />
            <ContextCard icon={ShieldCheck} title="Autonomia da WIA" value="Sugerindo · controle humano" accent />
          </div>
          <div className="mt-5 rounded-2xl border border-[#FF8A00]/25 bg-[#FF8A00]/5 p-4">
            <div className="flex items-center gap-3">
              <WiaMark size={38} className="h-9 w-9" />
              <div>
                <p className="text-xs font-semibold text-white">Canal direto com a WIA</p>
                <p className="mt-1 text-[10px] leading-4 text-zinc-500">Este é o único espaço dedicado para conversar diretamente com ela.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ContextCard({ icon: Icon, title, value, accent = false }: { icon: typeof Target; title: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#141517] p-4">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accent ? 'text-[#FF8A00]' : 'text-zinc-400'}`} />
        <div>
          <p className="text-xs font-medium text-zinc-200">{title}</p>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">{value}</p>
        </div>
      </div>
      {accent && <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Dentro das regras ativas</div>}
    </div>
  );
}
