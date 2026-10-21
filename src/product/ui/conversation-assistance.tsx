import { useEffect, useState } from 'react';
import { productApi, ProductApiError } from '../api';
import type { buildConversationAssistance } from '../../../backend/orkto-core/conversation-assistance';
type Brief = ReturnType<typeof buildConversationAssistance>;

export function ConversationAssistance({ conversationId, accessToken }: { conversationId: string; accessToken: string | null }) {
  const [result, setResult] = useState<{ id: string; data?: Brief; error?: string; loading?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (!attempt) return;
    let active = true;
    const controller = new AbortController();
    setResult({ id: conversationId, loading: true });
    void productApi<Brief>(`/api/conversations/${encodeURIComponent(conversationId)}/assistance`, accessToken, { signal: controller.signal })
      .then(data => { if (active) { setResult({ id: conversationId, data }); setDraft(previous => previous || data.draft || ''); } })
      .catch(error => { if (active) setResult({ id: conversationId, error: error instanceof ProductApiError && error.status === 403 ? 'Você não tem acesso a este contexto.' : error instanceof ProductApiError && error.status === 401 ? 'Sessão expirada. Entre novamente.' : 'Não foi possível preparar o contexto. Tente novamente.' }); });
    return () => { active = false; controller.abort(); };
  }, [conversationId, accessToken, attempt]);
  const current = result?.id === conversationId ? result : null;
  const brief = current?.data;
  return <div className="mt-3 space-y-3 text-xs leading-5">
    <p className="orkto-product-muted">Use os registros desta conversa para revisar o próximo passo. Sem IA paga, criação de registros ou envio.</p>
    <button type="button" disabled={current?.loading} onClick={() => setAttempt(value => value + 1)} className="min-h-11 w-full rounded-lg border px-3 font-semibold orkto-product-border">{current?.loading ? 'Preparando contexto…' : brief ? 'Atualizar contexto' : 'Preparar contexto'}</button>
    <div aria-live="polite">{current?.error && <p role="alert">{current.error}</p>}{brief && <>
      <p className="font-semibold">{brief.customerState === 'matched' ? `Cliente encontrado: ${brief.customer?.name}` : brief.customerState === 'ambiguous' ? 'Mais de um cliente corresponde ao telefone' : brief.customerState === 'incomplete' ? 'Catálogo amplo: correspondência não confirmada' : 'Cliente ainda não identificado'}</p>
      <p>{brief.nextStep}</p>
      <p className="mt-2">{brief.deals.length ? `${brief.deals.length} negócio(s) vinculado(s) retornado(s).` : 'Nenhum negócio aberto vinculado retornado.'}</p>
      {brief.draft ? <label className="mt-3 block">Rascunho para revisão — não enviado<textarea value={draft} onChange={event => setDraft(event.target.value)} className="mt-1 min-h-40 w-full resize-y rounded-lg border p-3 orkto-product-border orkto-product-surface" /></label> : <p>Sem mensagem recebida no recorte consultado. Nenhum rascunho preparado.</p>}
      <details className="mt-3"><summary className="cursor-pointer">Fontes e limites</summary><ul className="space-y-1">{brief.sources.map(source => <li key={`${source.type}-${source.id}`} className="break-all font-mono">{source.type}: {source.id}</li>)}{brief.limitations.map(text => <li key={text}>{text}</li>)}</ul></details>
    </>}</div>
  </div>;
}
