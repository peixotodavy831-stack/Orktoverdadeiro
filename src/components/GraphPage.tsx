import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, GitBranch, RefreshCw, Search } from 'lucide-react';

type NodeType = 'customer' | 'conversation' | 'deal';
interface GraphNode { id: string; type: NodeType; entityRef: string; label: string; company?: string | null; status?: string; valueCents?: number; clusterId?: string }
interface GraphEdge { id: string; source: string; target: string; type: string; provenance?: { table?: string; recordId?: string; field?: string; match?: string; value?: string }; confidence?: number }
interface GraphCluster { id: string; label: string; members: string[] }
interface GraphPageProps {
  accessToken: string | null;
  onOpenCustomer: (customerId: string) => void;
  onOpenDeal: (dealId: string) => void;
  onOpenConversation: (conversationId: string) => void;
}

const typeLabel: Record<NodeType, string> = { customer: 'Cliente', conversation: 'Conversa', deal: 'Negócio' };
const typeColor: Record<NodeType, string> = { customer: '#FF9F1C', conversation: '#60A5FA', deal: '#A78BFA' };
const columnX: Record<NodeType, number> = { customer: 30, conversation: 370, deal: 710 };
const amount = (cents = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default function GraphPage({ accessToken, onOpenCustomer, onOpenDeal, onOpenConversation }: GraphPageProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [clusters, setClusters] = useState<GraphCluster[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const headers = useMemo(() => accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, [accessToken]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/graph', { headers });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar as relações comerciais.');
      setNodes(payload.nodes || []); setEdges(payload.edges || []); setClusters(payload.clusters || []);
      setSelected(current => current ? (payload.nodes || []).find((node: GraphNode) => node.id === current.id) || null : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as relações comerciais.'); }
    finally { setLoading(false); }
  }, [headers]);
  useEffect(() => { void load(); }, [load]);

  const filteredNodes = nodes.filter(node => `${node.label} ${node.company || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).slice(0, 120);
  const positions = useMemo(() => {
    const indexes: Record<NodeType, number> = { customer: 0, conversation: 0, deal: 0 };
    return new Map(filteredNodes.map(node => {
      const position = { x: columnX[node.type], y: 34 + indexes[node.type]++ * 78 };
      return [node.id, position] as const;
    }));
  }, [filteredNodes]);
  const visibleEdges = edges.filter(edge => positions.has(edge.source) && positions.has(edge.target));
  const maxColumnCount = Math.max(...(['customer', 'conversation', 'deal'] as NodeType[]).map(type => filteredNodes.filter(node => node.type === type).length), 0);
  const canvasHeight = Math.max(360, 68 + maxColumnCount * 78);

  const openContext = () => {
    if (!selected) return;
    if (selected.type === 'customer') onOpenCustomer(selected.entityRef);
    if (selected.type === 'deal') onOpenDeal(selected.entityRef);
    if (selected.type === 'conversation') onOpenConversation(selected.entityRef);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF9F1C]">Memória comercial · relações</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">Mapa comercial</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Explore ligações persistidas entre clientes, conversas e negócios. Os agrupamentos atuais usam correspondência exata de empresa; não inferem parentesco nem fazem merge.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Atualizar</button></header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:flex-row sm:items-center sm:justify-between"><label className="relative block w-full max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input aria-label="Buscar no mapa" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente, conversa ou negócio" className="min-h-10 w-full rounded-lg border border-zinc-300 bg-transparent pl-9 pr-3 text-xs dark:border-zinc-700" /></label><div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">{(['customer', 'conversation', 'deal'] as NodeType[]).map(type => <span key={type} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: typeColor[type] }} />{typeLabel[type]} · {nodes.filter(node => node.type === type).length}</span>)}<span>{clusters.length} grupo(s) por empresa</span></div></section>
      {loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-zinc-500"><RefreshCw size={16} className="animate-spin text-[#FF9F1C]" />Carregando relações…</div>
        : filteredNodes.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-14 text-center dark:border-zinc-800"><GitBranch className="mx-auto h-7 w-7 text-zinc-400" /><h2 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Ainda não há relações para mostrar</h2><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">Cadastre clientes e negócios ou conecte conversas aos clientes para formar o mapa do workspace.</p></div>
          : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="overflow-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/70" aria-label="Grafo de relações comerciais">
              <svg role="group" aria-label="Relações entre clientes, conversas e negócios" viewBox={`0 0 920 ${canvasHeight}`} width="920" height={canvasHeight} className="max-w-none">
                <text x="130" y="20" textAnchor="middle" className="fill-zinc-500" fontSize="10" fontWeight="700">CLIENTES</text><text x="470" y="20" textAnchor="middle" className="fill-zinc-500" fontSize="10" fontWeight="700">CONVERSAS</text><text x="810" y="20" textAnchor="middle" className="fill-zinc-500" fontSize="10" fontWeight="700">NEGÓCIOS</text>
                {visibleEdges.map(edge => { const from = positions.get(edge.source)!; const to = positions.get(edge.target)!; return <line key={edge.id} x1={from.x + 200} y1={from.y + 27} x2={to.x} y2={to.y + 27} stroke="#71717a" strokeOpacity="0.35" strokeWidth="1.5" />; })}
                {filteredNodes.map(node => { const position = positions.get(node.id)!; const active = selected?.id === node.id; const cluster = node.clusterId ? clusters.find(item => item.id === node.clusterId) : undefined; const detail = node.type === 'deal' ? amount(Number(node.valueCents || 0)) : node.type === 'customer' ? node.company || cluster?.label || 'Empresa não informada' : node.status || 'Atendimento'; return <g key={node.id} role="button" tabIndex={0} aria-label={`${typeLabel[node.type]}: ${node.label}. ${detail}`} onClick={() => setSelected(node)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(node); } }} className="cursor-pointer focus:outline-none">
                  <rect x={position.x} y={position.y} width="200" height="54" rx="10" fill={active ? '#27272a' : '#18181b'} stroke={active ? '#FF9F1C' : '#3f3f46'} strokeWidth={active ? 2 : 1} />
                  <circle cx={position.x + 13} cy={position.y + 15} r="4" fill={typeColor[node.type]} />
                  <text x={position.x + 25} y={position.y + 18} fill="#a1a1aa" fontSize="9" fontWeight="600">{typeLabel[node.type].toUpperCase()}</text>
                  <text x={position.x + 12} y={position.y + 37} fill="#fafafa" fontSize="11" fontWeight="600">{node.label.slice(0, 27)}{node.label.length > 27 ? '…' : ''}</text>
                  <text x={position.x + 188} y={position.y + 37} textAnchor="end" fill="#a1a1aa" fontSize="9">{detail.slice(0, 20)}</text>
                </g>; })}
              </svg>
            </div>
            <aside className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Contexto selecionado</h2>
              {!selected ? <p className="mt-2 text-xs leading-5 text-zinc-500">Selecione um nó do mapa para abrir o contexto real.</p> : <><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">{typeLabel[selected.type]}</p><p className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selected.label}</p>{selected.company && <p className="mt-1 text-xs text-zinc-500">{selected.company}</p>}<p className="mt-3 text-[10px] leading-4 text-zinc-500">Identificador do registro<br /><code className="break-all">{selected.entityRef}</code></p><button type="button" onClick={openContext} className="mt-4 min-h-10 w-full rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold text-zinc-950 hover:bg-orange-400">Abrir no módulo</button><div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Relações e origem</p>{edges.filter(edge => edge.source === selected.id || edge.target === selected.id).length ? <ul className="mt-2 space-y-2">{edges.filter(edge => edge.source === selected.id || edge.target === selected.id).slice(0,12).map(edge => { const relatedId = edge.source === selected.id ? edge.target : edge.source; const related = nodes.find(node => node.id === relatedId); return <li key={edge.id} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"><p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">{edge.type.replaceAll('_',' ')} · {related?.label || typeLabel[(relatedId.split(':')[0] as NodeType)] || 'Registro'}</p><p className="mt-1 break-words text-[9px] leading-4 text-zinc-500">Origem: {edge.provenance?.table || 'registro'}{edge.provenance?.recordId ? ` · ${edge.provenance.recordId}` : ''}{edge.provenance?.field ? ` · campo ${edge.provenance.field}` : ''}{edge.provenance?.match ? ` · regra ${edge.provenance.match}` : ''}{edge.confidence == null ? '' : ` · confiança ${Math.round(edge.confidence * 100)}%`}</p></li>; })}</ul> : <p className="mt-2 text-[10px] leading-4 text-zinc-500">Nenhuma relação comprovada ainda. O mapa não cria ligações por similaridade sem evidência.</p>}</div></>}
              <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Grupos identificados</p>{clusters.length ? <ul className="mt-2 space-y-2">{clusters.slice(0, 8).map(cluster => <li key={cluster.id} className="rounded-lg bg-zinc-100 p-2 text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"><strong className="block font-semibold text-zinc-800 dark:text-zinc-100">{cluster.label}</strong>{cluster.members.length} clientes com nome de empresa idêntico</li>)}</ul> : <p className="mt-2 text-[10px] leading-4 text-zinc-500">Sem grupos com correspondência exata ainda.</p>}</div>
              {filteredNodes.length < nodes.length && <p className="mt-4 text-[10px] text-zinc-500">Mostrando até 120 registros por busca para manter a tela responsiva.</p>}
            </aside>
          </div>}
    </div>
  );
}
