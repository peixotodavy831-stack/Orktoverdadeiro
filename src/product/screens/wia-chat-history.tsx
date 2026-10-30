import { useCallback, useEffect, useRef, useState } from 'react';
import { productApi } from '../api';

type Message = {id:string;role:'user'|'assistant';content:string;created_at:string;sourceIds?:string[];provider?:string;model?:string;runId?:string;path?:string;recovered?:boolean};
type Session = {id:string;title:string;updatedAt:string};
export function useWiaChat(accessToken: string|null) {
  const [sessionId,setSessionId] = useState<string>(() => crypto.randomUUID());
  const [sessions,setSessions] = useState<Session[]>([]);
  const [messages,setMessages] = useState<Message[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [truncated,setTruncated] = useState(false);
  const sequence = useRef(0);
  const activeScope = useRef(accessToken);
  activeScope.current = accessToken;
  const [loadedScope,setLoadedScope] = useState<string|null>(null);
  const refresh = useCallback(async (selected?:string) => {
    if (activeScope.current !== accessToken) return;
    const generation = ++sequence.current;
    setLoading(true); setError(null);
    try {
      const list = await productApi<{data:Session[];truncated:boolean}>('/api/wia/chat-sessions',accessToken);
      const id = selected || list.data[0]?.id || crypto.randomUUID();
      const history = await productApi<{data:Message[];truncated:boolean}>(`/api/wia/chat-history?sessionId=${id}`,accessToken);
      if (generation !== sequence.current || activeScope.current !== accessToken) return;
      setLoadedScope(accessToken);
      setSessions(list.data); setSessionId(id); setMessages(history.data);
      setTruncated(list.truncated || history.truncated);
    } catch (cause) {
      if (generation === sequence.current && activeScope.current === accessToken) { setLoadedScope(accessToken);setMessages([]); setError(cause instanceof Error?cause.message:'Histórico indisponível.'); }
    } finally { if (generation === sequence.current && activeScope.current === accessToken) setLoading(false); }
  },[accessToken]);
  useEffect(() => { setMessages([]);setSessions([]);void refresh(); return () => { sequence.current++; }; },[refresh]);
  const start = () => { sequence.current++;setSessionId(crypto.randomUUID());setMessages([]);setError(null);setLoading(false); };
  return {sessionId,sessions:loadedScope===accessToken?sessions:[],messages:loadedScope===accessToken?messages:[],loading:loading||loadedScope!==accessToken,error:loadedScope===accessToken?error:null,truncated,refresh,start};
}

export function WiaChatHistory({chat,busy,onSelect,onNew}:{chat:ReturnType<typeof useWiaChat>;busy:boolean;onSelect:(id:string)=>void;onNew:()=>void}) {
  return <section aria-label="Conversas persistidas da WIA" className="space-y-3 rounded-xl border p-4 orkto-product-border orkto-product-surface">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Sua conversa</h2>
      <button type="button" disabled={busy||chat.loading} onClick={onNew} className="min-h-11 rounded-full border px-4 text-xs orkto-product-border disabled:opacity-50">Nova conversa</button></div>
    <label className="block text-xs">Conversas recentes<select aria-label="Selecionar conversa WIA" value={chat.sessions.some(s=>s.id===chat.sessionId)?chat.sessionId:''} disabled={busy||chat.loading} onChange={e=>onSelect(e.target.value)} className="mt-2 min-h-11 w-full max-w-full rounded-lg border px-3 orkto-product-control orkto-product-border"><option value="" disabled>Nova conversa</option>{chat.sessions.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    {chat.loading?<p role="status" className="text-xs">Carregando conversa salva…</p>:chat.error?<div role="alert"><p className="text-xs">{chat.error}</p><button type="button" disabled={busy} onClick={()=>void chat.refresh(chat.sessionId)} className="min-h-11 text-xs underline">Tentar carregar histórico</button></div>:chat.messages.length===0?<p className="text-xs orkto-product-muted">Conversa vazia. O histórico aparecerá após a confirmação do servidor.</p>:<ol aria-label="Mensagens salvas" className="max-h-[28rem] space-y-3 overflow-y-auto">{chat.messages.map(m=><li key={m.id} className="rounded-lg p-3 orkto-product-surface-muted"><p className="text-xs font-semibold">{m.role==='user'?'Você':'WIA'}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{m.content}</p><time className="mt-2 block text-[10px] orkto-product-subtle" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('pt-BR')}</time></li>)}</ol>}
    {chat.messages.filter(m=>m.role==='assistant'&&m.runId).map(m=><details key={m.id} className="text-xs"><summary>Fontes da resposta · {new Date(m.created_at).toLocaleTimeString('pt-BR')}</summary><p className="mt-2 break-all">Execução: {m.runId}</p><p>{m.path==='t0'?'Consulta determinística, sem inferência':`${m.provider || 'Provedor não informado'} · ${m.model || 'Modelo não informado'}`}</p>{m.sourceIds?.length?<ul>{m.sourceIds.map(id=><li key={id} className="break-all">Fonte: {id}</li>)}</ul>:<p>Nenhuma fonte empresarial vinculada.</p>}</details>)}
    {chat.messages.some(m=>m.recovered)&&<p role="status" className="text-xs orkto-product-muted">Uma resposta foi recuperada da execução salva. Nenhuma nova análise foi solicitada.</p>}
    {chat.truncated&&<p className="text-xs orkto-product-muted">Exibindo uma janela recente do histórico; não representa todas as mensagens.</p>}
  </section>;
}
