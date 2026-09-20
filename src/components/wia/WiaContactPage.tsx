import { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type { Quote, SavedClient, UserProfile } from '../../types';
import { formatBRL } from '../../utils/format';
import { PromptInput, type WiaPromptMeta } from '../ui/ai-chat-input';
import WiaMark from './WiaMark';

interface WiaContactPageProps {
  quotes: Quote[];
  clients: SavedClient[];
  userProfile: UserProfile | null;
}

interface ChatMessage {
  id: number;
  role: 'wia' | 'user';
  content: string;
}

const suggestions = [
  'Como estão as vendas?',
  'O que exige minha decisão?',
  'Prepare os follow-ups',
  'Compare com a semana passada',
];

export default function WiaContactPage({ quotes, clients, userProfile }: WiaContactPageProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  const pendingQuotes = useMemo(() => quotes.filter(quote => quote.status === 'pending'), [quotes]);
  const pendingValue = useMemo(
    () => pendingQuotes.reduce((total, quote) => total + Number(quote.total || 0), 0),
    [pendingQuotes],
  );
  const firstName = userProfile?.displayName?.split(' ')[0] || userProfile?.companyName || 'você';

  const sendMessage = (content = message, _meta?: WiaPromptMeta) => {
    const cleanMessage = content.trim();
    if (!cleanMessage || sending) return;

    setMessages(current => [...current, { id: Date.now(), role: 'user', content: cleanMessage }]);
    setMessage('');
    setSending(true);

    window.setTimeout(() => {
      setMessages(current => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'wia',
          content: pendingQuotes.length
            ? `Encontrei ${pendingQuotes.length} orçamento${pendingQuotes.length === 1 ? '' : 's'} aguardando decisão, somando ${formatBRL(pendingValue)}. Posso organizar a prioridade e preparar os próximos contatos para sua revisão.`
            : 'A operação está sem orçamentos pendentes nos dados disponíveis. Posso ajudar a revisar clientes, oportunidades ou preparar uma próxima ação.',
        },
      ]);
      setSending(false);
    }, 650);
  };

  return (
    <main className="min-h-[calc(100vh-7rem)] overflow-hidden rounded-[28px] border border-zinc-800 bg-[#0b0c0d] text-zinc-100 shadow-2xl shadow-black/20">
      <header className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-7">
        <div className="flex items-center gap-3">
          <WiaMark size={48} className="h-12 w-12" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-white">WIA</h1>
              <span className="rounded-full border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#FF8A00]">Contato</span>
            </div>
            <p className="text-xs text-zinc-500">Converse com sua camada operacional</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Contexto da operação disponível
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-13.5rem)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[640px] flex-col border-zinc-800 xl:border-r">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="flex items-start gap-3">
                <WiaMark size={42} className="h-10 w-10" />
                <div className="max-w-2xl rounded-2xl rounded-tl-md border border-zinc-800 bg-[#141517] px-4 py-3.5">
                  <p className="text-sm leading-6 text-zinc-200">
                    Olá, {firstName}. Estou pronta para conversar sobre sua operação, explicar o que merece atenção e preparar ações para você revisar.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-[#121315] p-4">
                  <MessageSquareText className="mb-3 h-5 w-5 text-[#FF8A00]" />
                  <strong className="block text-lg text-white">{pendingQuotes.length}</strong>
                  <span className="text-xs text-zinc-500">orçamentos aguardando</span>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-[#121315] p-4">
                  <BarChart3 className="mb-3 h-5 w-5 text-[#FF8A00]" />
                  <strong className="block text-lg text-white">{formatBRL(pendingValue)}</strong>
                  <span className="text-xs text-zinc-500">em propostas abertas</span>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-[#121315] p-4">
                  <Target className="mb-3 h-5 w-5 text-[#FF8A00]" />
                  <strong className="block text-lg text-white">{clients.length}</strong>
                  <span className="text-xs text-zinc-500">clientes no contexto</span>
                </div>
              </div>

              {messages.map(chatMessage => (
                <div key={chatMessage.id} className={`flex items-start gap-3 ${chatMessage.role === 'user' ? 'justify-end' : ''}`}>
                  {chatMessage.role === 'wia' && <WiaMark size={38} className="h-9 w-9" />}
                  <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-6 ${chatMessage.role === 'user' ? 'rounded-tr-md bg-zinc-800 text-white' : 'rounded-tl-md border border-zinc-800 bg-[#141517] text-zinc-200'}`}>
                    {chatMessage.content}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-3">
                  <WiaMark size={38} className="h-9 w-9" />
                  <div className="flex gap-1 rounded-2xl rounded-tl-md border border-zinc-800 bg-[#141517] px-4 py-4">
                    {[0, 1, 2].map(item => <span key={item} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF8A00]" style={{ animationDelay: `${item * 120}ms` }} />)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800 bg-[#0e0f10] px-4 pb-5 pt-3 sm:px-7">
            <div className="mx-auto max-w-4xl">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {suggestions.map(suggestion => (
                  <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} className="whitespace-nowrap rounded-full border border-zinc-800 bg-[#151618] px-3 py-2 text-[11px] text-zinc-400 transition-colors hover:border-[#FF8A00]/40 hover:text-white">
                    {suggestion}
                  </button>
                ))}
              </div>
              <PromptInput
                value={message}
                onChange={setMessage}
                onSubmit={(value, meta) => sendMessage(value, meta)}
                disabled={sending}
                status={sending ? 'sending' : 'idle'}
                placeholder="Pergunte sobre a operação ou peça uma ação..."
                agents={['WIA', 'Vendas', 'Recuperação', 'Cobrança']}
                efforts={['Rápido', 'Equilibrado', 'Profundo']}
                className="max-w-none"
              />
              <p className="mt-2 text-center text-[10px] text-zinc-600">A WIA prepara recomendações. Ações sensíveis continuam sob seu controle.</p>
            </div>
          </div>
        </section>

        <aside className="hidden bg-[#0e0f10] p-5 xl:block">
          <h2 className="text-sm font-semibold text-white">Contexto desta conversa</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-600">Informações usadas para responder com mais precisão.</p>
          <div className="mt-5 space-y-3">
            <ContextCard icon={Target} title="Objetivo atual" value="Entender e avançar a operação" />
            <ContextCard icon={Clock3} title="Período analisado" value="Dados disponíveis agora" />
            <ContextCard icon={Sparkles} title="Fontes consideradas" value="Orçamentos e clientes" />
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
