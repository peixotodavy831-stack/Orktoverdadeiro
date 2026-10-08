import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, FileText, Menu, MessageSquare, Plus, Search, Send, ShieldCheck, X } from 'lucide-react';
import WiaMark from '../wia/WiaMark';

export type PrototypeScreen = 'Hoje' | 'Inbox' | 'Clientes' | 'Negócios' | 'WIA';
export type DemoDeal = { id: string; name: string; contact: string; value: string; stage: string; owner: string; note: string; age: string; risk?: 'Alto' | 'Moderado' | 'Baixo' };

const startDeals: DemoDeal[] = [
  { id: 'nova', name: 'Nova Solutions', contact: 'João Martins', value: 'R$ 12.400', stage: 'Proposta', owner: 'Davy Silva', note: 'Proposta visualizada, sem retorno', age: '7 dias', risk: 'Alto' },
  { id: 'tech', name: 'TechBrasil', contact: 'Camila Rocha', value: 'R$ 8.400', stage: 'Negociação', owner: 'Ana Costa', note: 'Desconto de 8% pede aprovação', age: '12 min', risk: 'Moderado' },
  { id: 'fundacao', name: 'Fundação Horizonte', contact: 'Pedro Alves', value: 'R$ 6.800', stage: 'Qualificação', owner: 'Davy Silva', note: 'Escopo em revisão', age: 'Hoje' },
  { id: 'mariana', name: 'Mariana Costa', contact: 'Mariana Costa', value: 'R$ 3.200', stage: 'Novo', owner: 'Sem responsável', note: 'Pediu orçamento pelo WhatsApp', age: 'Agora' },
  { id: 'atlas', name: 'Atlas Serviços', contact: 'Rafael Lima', value: 'R$ 17.400', stage: 'Fechado', owner: 'Ana Costa', note: 'Proposta aceita', age: 'Ontem' },
];

const stages = ['Novo', 'Qualificação', 'Proposta', 'Negociação', 'Fechado'];
const surface = 'rounded-xl border border-[#E6E4E0] bg-white';
const button = 'min-h-11 rounded-lg border border-[#DDDAD4] bg-white px-3 text-xs font-semibold text-[#34332F] hover:bg-[#F7F6F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C66C00]';

export function ScreenHeading({ eyebrow, title, description, onMenu, contextVisible, onToggleContext }: { eyebrow: string; title: string; description: string; onMenu: () => void; contextVisible?: boolean; onToggleContext?: () => void }) {
  return <header className="mb-6 flex items-start justify-between gap-3"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A75B00]">{eyebrow}</p><h1 className="text-[24px] font-bold tracking-[-0.04em] sm:text-[28px]">{title}</h1><p className="mt-1 text-[13px] text-[#6D6B67]">{description}</p></div><div className="flex shrink-0 items-center gap-2">{onToggleContext && <button onClick={onToggleContext} className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#E6E4E0] bg-white px-3 text-xs font-semibold text-[#5F5D58] hover:bg-[#F7F6F3] xl:inline-flex" aria-expanded={contextVisible} aria-controls="wia-context-panel"><WiaMark size={18} accentColor="#FF9F1C"/>{contextVisible ? 'Ocultar contexto' : 'Mostrar contexto'}</button>}<button onClick={onMenu} aria-label="Abrir menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#E6E4E0] bg-white lg:hidden"><Menu size={18}/></button></div></header>;
}

const conversations = [
  { id: 'nova', initials: 'JM', name: 'João Martins', company: 'Nova Solutions', preview: 'Conseguiu ver nossa proposta?', time: '09:42', unread: 2, priority: 'Alta' },
  { id: 'tech', initials: 'CR', name: 'Camila Rocha', company: 'TechBrasil', preview: 'Podemos ajustar o valor?', time: '09:18', unread: 1, priority: 'Aprovação' },
  { id: 'mariana', initials: 'MC', name: 'Mariana Costa', company: 'Cliente novo', preview: 'Gostaria de um orçamento.', time: '08:55', unread: 1, priority: 'Novo' },
  { id: 'fundacao', initials: 'PA', name: 'Pedro Alves', company: 'Fundação Horizonte', preview: 'Enviei os detalhes do projeto.', time: 'Ontem', unread: 0, priority: 'Normal' },
];

export function InboxScreen({ onMenu, onOpenWia, onOpenRecord, contextVisible, onToggleContext }: { onMenu: () => void; onOpenWia: () => void; onOpenRecord: (deal: DemoDeal) => void; contextVisible?: boolean; onToggleContext?: () => void }) {
  const [selectedId, setSelectedId] = useState('nova');
  const [mobileThread, setMobileThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const selected = conversations.find(item => item.id === selectedId)!;
  function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!draft.trim()) return; setSent(current => [...current, draft.trim()]); setDraft(''); }
  return <>
    <ScreenHeading eyebrow="Caixa de entrada" title="Inbox" description="Converse com contexto e resolva o que está pendente." onMenu={onMenu} contextVisible={contextVisible} onToggleContext={onToggleContext} />
    <div className={`${surface} grid min-h-[590px] overflow-hidden md:grid-cols-[250px_minmax(0,1fr)]`}>
      <section className={`${mobileThread ? 'hidden md:block' : 'block'} border-r border-[#ECEAE6]`} aria-label="Conversas">
        <div className="flex items-center justify-between border-b border-[#ECEAE6] p-4"><div><h2 className="text-sm font-bold">Conversas</h2><p className="mt-0.5 text-[11px] text-[#777570]">4 abertas · 2 prioritárias</p></div><span className="rounded-md bg-[#FFF2DF] px-2 py-1 text-[10px] font-semibold text-[#A75B00]">Hoje</span></div>
        {conversations.map(item => <button key={item.id} onClick={() => { setSelectedId(item.id); setMobileThread(true); setSent([]); setDraft(''); }} className={`w-full border-b border-[#F0EEEA] p-3.5 text-left hover:bg-[#FAF9F7] ${selectedId === item.id ? 'bg-[#FFF9F0]' : ''}`} aria-current={selectedId === item.id ? 'true' : undefined}><div className="flex items-start gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDEAE4] text-[10px] font-bold">{item.initials}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-1"><strong className="truncate text-xs">{item.name}</strong><span className="shrink-0 text-[10px] text-[#85827D]">{item.time}</span></div><p className="mt-0.5 truncate text-[10px] text-[#7A7772]">{item.company}</p><p className="mt-1 truncate text-[11px] text-[#514F4B]">{item.preview}</p></div>{item.unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF9F1C] px-1 text-[9px] font-bold">{item.unread}</span>}</div></button>)}
      </section>
      <section className={`${mobileThread ? 'flex' : 'hidden md:flex'} min-w-0 flex-col`} aria-label={`Conversa com ${selected.name}`}>
        <div className="flex min-h-[66px] items-center gap-3 border-b border-[#ECEAE6] px-4"><button onClick={() => setMobileThread(false)} aria-label="Voltar às conversas" className="-ml-2 flex h-11 w-8 items-center justify-center md:hidden"><ArrowLeft size={18}/></button><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDEAE4] text-[10px] font-bold">{selected.initials}</span><div className="min-w-0 flex-1"><h2 className="truncate text-[13px] font-bold">{selected.name}</h2><p className="truncate text-[10px] text-[#777570]">{selected.company} · WhatsApp Business</p></div><span className="hidden rounded-full bg-[#FFF2DF] px-2 py-1 text-[10px] font-semibold text-[#9A5200] sm:block">{selected.priority}</span></div>
        <div className="flex min-h-[355px] flex-1 flex-col gap-3 bg-[#FCFBF9] p-4 sm:p-5"><p className="text-center text-[10px] text-[#9A9791]">Hoje · conversa demonstrativa</p><div className="max-w-[85%] self-start rounded-xl rounded-tl-sm border border-[#E9E6E1] bg-white p-3 text-xs leading-5">Olá, gostaria de entender o andamento da proposta.</div><div className="max-w-[85%] self-end rounded-xl rounded-tr-sm bg-[#F3E8D7] p-3 text-xs leading-5">Claro. Estou verificando os detalhes e já retorno.</div><div className="max-w-[85%] self-start rounded-xl rounded-tl-sm border border-[#E9E6E1] bg-white p-3 text-xs leading-5">{selected.preview}</div>{sent.map((message, index) => <div key={index} className="max-w-[85%] self-end rounded-xl rounded-tr-sm bg-[#F3E8D7] p-3 text-xs leading-5">{message}<span className="mt-1 block text-[9px] text-[#8A714F]">Simulação · não enviado</span></div>)}</div>
        <div className="border-t border-[#ECEAE6] p-3 sm:p-4"><div className="mb-3 flex flex-wrap gap-2"><button onClick={() => setDraft('Olá! Vou conferir sua proposta e retorno ainda hoje.')} className={button}>Usar rascunho</button><button onClick={() => setShowSuggestion(value => !value)} aria-expanded={showSuggestion} className={button}>Ver sugestão da WIA</button><button onClick={() => onOpenRecord(startDeals.find(deal => deal.id === selectedId) || startDeals[0])} className={button}>Ver registro <ChevronRight size={13} className="inline"/></button></div>{showSuggestion && <section className="mb-3 rounded-lg border border-[#F1D7B0] bg-[#FFF9F0] p-3" aria-label="Sugestão de resposta da WIA"><div className="flex items-center justify-between"><p className="text-[11px] font-bold text-[#8C5007]">Rascunho sugerido pela WIA</p><button aria-label="Descartar sugestão" onClick={() => setShowSuggestion(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6D6B67] hover:bg-white"><X size={14}/></button></div><p className="mt-2 text-xs leading-5 text-[#514F4B]">Olá, {selected.name.split(' ')[0]}! Vi que você conseguiu analisar a proposta. Ficou alguma dúvida ou ponto que gostaria de ajustar? Estou à disposição para ajudar.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { setDraft(`Olá, ${selected.name.split(' ')[0]}! Vi que você conseguiu analisar a proposta. Ficou alguma dúvida ou ponto que gostaria de ajustar? Estou à disposição para ajudar.`); setShowSuggestion(false); }} className="min-h-9 rounded-lg bg-[#FF9F1C] px-3 text-[11px] font-bold">Inserir na resposta</button><button onClick={() => { setShowSuggestion(false); onOpenWia(); }} className="min-h-9 rounded-lg border border-[#E2DFD9] bg-white px-3 text-[11px] font-semibold">Ajustar com a WIA</button></div><p className="mt-2 text-[10px] text-[#777570]">Rascunho apenas. Você revisa e envia manualmente.</p></section>}<form onSubmit={send} className="flex gap-2"><input value={draft} onChange={event => setDraft(event.target.value)} aria-label="Mensagem demonstrativa" placeholder="Escreva uma resposta..." className="min-w-0 flex-1 rounded-lg border border-[#E2DFD9] px-3 text-xs outline-none focus:border-[#C66C00]"/><button disabled={!draft.trim()} className="flex h-11 items-center gap-1 rounded-lg bg-[#FF9F1C] px-3 text-xs font-semibold disabled:bg-[#E7E4DE] disabled:text-[#AAA6A0]"><Send size={14}/>Simular</button></form><p className="mt-2 text-[10px] text-[#918E88]">Nenhuma mensagem é enviada neste protótipo.</p></div>
      </section>
    </div>
  </>;
}

export function PipelineScreen({ onMenu, onOpenRecord, contextVisible, onToggleContext }: { onMenu: () => void; onOpenRecord: (deal: DemoDeal) => void; contextVisible?: boolean; onToggleContext?: () => void }) {
  const [deals, setDeals] = useState(startDeals);
  const [changed, setChanged] = useState('');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('Todos');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newValue, setNewValue] = useState('');
  function move(id: string, stage: string) { setDeals(current => current.map(deal => deal.id === id ? { ...deal, stage } : deal)); setChanged('Etapa alterada apenas nesta demonstração.'); }
  const visibleDeals = deals.filter(deal => `${deal.name} ${deal.contact} ${deal.owner}`.toLowerCase().includes(search.toLowerCase()) && (owner === 'Todos' || deal.owner === owner));
  function createDeal(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!newName.trim() || !newContact.trim() || !newValue.trim()) return; const deal: DemoDeal = { id: `demo-${Date.now()}`, name: newName.trim(), contact: newContact.trim(), value: newValue.trim().startsWith('R$') ? newValue.trim() : `R$ ${newValue.trim()}`, stage: 'Novo', owner: 'Sem responsável', note: 'Negócio criado nesta demonstração', age: 'Agora', risk: 'Baixo' }; setDeals(current => [deal, ...current]); setNewName(''); setNewContact(''); setNewValue(''); setShowCreate(false); setChanged('Negócio adicionado somente a esta demonstração.'); }
  return <><ScreenHeading eyebrow="Visão comercial" title="Negócios" description="Um pipeline simples, com o próximo passo claro em cada negociação." onMenu={onMenu} contextVisible={contextVisible} onToggleContext={onToggleContext}/><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-[#6D6B67]">{visibleDeals.length} negócios exibidos · {deals.length} no protótipo</span><button onClick={() => setShowCreate(value => !value)} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold"><Plus size={15}/>{showCreate ? 'Fechar' : 'Novo negócio'}</button></div>{showCreate && <form onSubmit={createDeal} className={`${surface} mb-4 grid gap-3 p-4 sm:grid-cols-4`}><label className="text-[11px] font-semibold">Empresa<input required value={newName} onChange={event => setNewName(event.target.value)} placeholder="Nome da empresa" className="mt-1 min-h-10 w-full rounded-lg border border-[#E2DFD9] px-3 text-xs"/></label><label className="text-[11px] font-semibold">Contato<input required value={newContact} onChange={event => setNewContact(event.target.value)} placeholder="Nome do contato" className="mt-1 min-h-10 w-full rounded-lg border border-[#E2DFD9] px-3 text-xs"/></label><label className="text-[11px] font-semibold">Valor<input required value={newValue} onChange={event => setNewValue(event.target.value)} placeholder="Ex.: 2500" className="mt-1 min-h-10 w-full rounded-lg border border-[#E2DFD9] px-3 text-xs"/></label><button className="mt-auto min-h-10 rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold">Criar no protótipo</button></form>}<div className="mb-3 flex flex-wrap gap-2"><label className="relative min-w-[190px] flex-1"><Search size={14} className="absolute left-3 top-3 text-[#777570]"/><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar negócio" placeholder="Buscar empresa, contato ou responsável" className="min-h-10 w-full rounded-lg border border-[#E2DFD9] bg-white pl-9 pr-3 text-xs"/></label><select value={owner} onChange={event => setOwner(event.target.value)} aria-label="Filtrar por responsável" className="min-h-10 rounded-lg border border-[#E2DFD9] bg-white px-3 text-xs"><option>Todos</option>{Array.from(new Set(deals.map(deal => deal.owner))).map(name => <option key={name}>{name}</option>)}</select></div>{changed && <p role="status" className="mb-3 rounded-lg bg-[#FFF2DF] p-3 text-xs text-[#8C5007]">{changed}</p>}<div className="max-w-full min-w-0 overflow-x-auto pb-4"><div className="grid min-w-[940px] grid-cols-5 gap-3">{stages.map(stage => { const columnDeals = visibleDeals.filter(deal => deal.stage === stage); return <section key={stage} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (id) move(id, stage); }} className="min-h-[460px] rounded-xl bg-[#EBE9E5] p-2.5"><div className="mb-3 flex justify-between px-1"><h2 className="text-[12px] font-bold">{stage}</h2><span className="text-[11px] text-[#777570]">{columnDeals.length}</span></div><div className="space-y-2">{columnDeals.map(deal => <article key={deal.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', deal.id)} className="rounded-lg border border-[#E4E1DB] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold">{deal.name}</p>{deal.risk && <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${deal.risk === 'Alto' ? 'bg-[#FDE9E7] text-[#A4382D]' : deal.risk === 'Moderado' ? 'bg-[#FFF2DF] text-[#8C5007]' : 'bg-[#E8F3EC] text-[#266943]'}`}>Risco {deal.risk.toLowerCase()}</span>}</div><p className="mt-1 text-[10px] text-[#777570]">{deal.contact} · {deal.owner}</p><p className="mt-3 text-[15px] font-bold tabular-nums">{deal.value}</p><p className="mt-1 text-[10px] leading-4 text-[#6D6B67]">{deal.note}</p><div className="mt-3 flex items-center gap-1 text-[10px] text-[#938F89]"><Clock3 size={11}/>{deal.age} sem atualização</div><label className="mt-3 block text-[10px] font-semibold text-[#777570]">Etapa<select aria-label={`Etapa de ${deal.name}`} value={deal.stage} onChange={event => move(deal.id, event.target.value)} className="mt-1 min-h-9 w-full rounded-md border border-[#E3E0DA] bg-white px-1 text-[11px] text-[#34332F]">{stages.map(value => <option key={value}>{value}</option>)}</select></label><button onClick={() => onOpenRecord(deal)} className="mt-2 flex min-h-9 w-full items-center justify-between border-t border-[#EEECE8] pt-2 text-[11px] font-semibold text-[#A75B00]">Ver registro<ArrowRight size={13}/></button></article>)}</div>{!columnDeals.length && <p className="rounded-lg border border-dashed border-[#D0CDC6] p-3 text-[10px] text-[#777570]">Nenhum negócio nesta etapa.</p>}</section>; })}</div></div><p className="text-[10px] text-[#918E88]">Arraste cartões ou use o seletor de etapa. Alterações ficam apenas na sessão de demonstração.</p></>;
}

export function RecordScreen({ onMenu, deal, onOpenWia }: { onMenu: () => void; deal: DemoDeal; onOpenWia: () => void }) {
  const [tab, setTab] = useState('Visão geral');
  const [feedback, setFeedback] = useState('');
  return <><ScreenHeading eyebrow="Registro comercial" title={deal.name} description={`${deal.contact} · ${deal.stage} · ${deal.owner}`} onMenu={onMenu}/><div className={`${surface} mb-5 grid gap-3 p-4 sm:grid-cols-4`}><div><p className="text-[10px] text-[#777570]">Valor</p><strong className="mt-1 block text-lg">{deal.value}</strong></div><div><p className="text-[10px] text-[#777570]">Etapa</p><strong className="mt-1 block text-sm">{deal.stage}</strong></div><div><p className="text-[10px] text-[#777570]">Responsável</p><strong className="mt-1 block text-sm">{deal.owner}</strong></div><div><p className="text-[10px] text-[#777570]">Última atividade</p><strong className="mt-1 block text-sm">{deal.age}</strong></div></div><div className="mb-4 flex gap-1 overflow-x-auto border-b border-[#E2DFD9]">{['Visão geral','Histórico','Propostas','Documentos'].map(value => <button key={value} onClick={() => setTab(value)} aria-current={tab === value ? 'page' : undefined} className={`min-h-11 shrink-0 border-b-2 px-3 text-xs font-semibold ${tab === value ? 'border-[#FF9F1C] text-[#171717]' : 'border-transparent text-[#777570]'}`}>{value}</button>)}</div>{tab === 'Visão geral' ? <div className="grid gap-4 md:grid-cols-2"><section className={`${surface} p-4`}><h2 className="text-sm font-bold">Resumo da negociação</h2><p className="mt-3 text-xs leading-6 text-[#5F5D58]">{deal.note}. Este registro reúne a conversa, o andamento e as próximas ações sem exigir preenchimento duplicado.</p><button onClick={onOpenWia} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#A75B00]">Pedir análise à WIA<ArrowRight size={14}/></button></section><section className={`${surface} p-4`}><h2 className="text-sm font-bold">Próximo passo</h2><p className="mt-3 text-xs leading-6 text-[#5F5D58]">Revisar a conversa e preparar um retorno contextual antes de qualquer envio.</p><button onClick={() => setFeedback('Follow-up preparado apenas para demonstração. Nada foi enviado.')} className="mt-4 min-h-11 rounded-lg bg-[#FF9F1C] px-4 text-xs font-bold">Preparar follow-up</button>{feedback && <p role="status" className="mt-3 text-xs text-[#6B500B]">{feedback}</p>}</section></div> : <div className={`${surface} p-5`}><div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F2F0EB] text-[#777570]">{tab === 'Histórico' ? <MessageSquare size={17}/> : <FileText size={17}/>}</span><div><h2 className="text-sm font-bold">{tab}</h2><p className="mt-1 text-xs leading-6 text-[#6D6B67]">{tab === 'Histórico' ? 'Conversa recebida, proposta preparada e próxima ação pendente. Eventos apresentados apenas como exemplo.' : tab === 'Propostas' ? `Proposta demonstrativa de ${deal.value}, aguardando validação da equipe.` : 'Nenhum documento anexado neste registro demonstrativo.'}</p></div></div></div>}</>;
}

type DemoChatTurn = { role: 'user' | 'wia'; content: string; record?: boolean };

function demoWiaReply(question: string): DemoChatTurn {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/nova|joao|propostas?|follow/.test(normalized)) {
    return { role: 'wia', content: 'Na demonstração, a proposta da Nova Solutions foi visualizada e está sem retorno há 7 dias. Eu prepararia um follow-up para sua revisão antes de qualquer envio.', record: true };
  }
  if (/techbrasil|desconto|aprov/.test(normalized)) {
    return { role: 'wia', content: 'Na demonstração, a TechBrasil pediu 8% de desconto. Essa mudança precisa da aprovação de uma pessoa da equipe antes de avançar.' };
  }
  if (/vendas?|opera[cç][aã]o|aten[cç][aã]o|decis/.test(normalized)) {
    return { role: 'wia', content: 'Neste exemplo, há uma proposta sem retorno, uma aprovação pendente e um lead sem responsável. Eu começaria pela proposta parada, depois revisaria o desconto.' };
  }
  return { role: 'wia', content: 'Esta prévia mostra como seria conversar comigo. No produto, posso usar os dados autorizados da operação para responder com contexto. Aqui não consultei dados reais nem executei ações.' };
}

export function WiaScreen({ onMenu, onOpenRecord }: { onMenu: () => void; onOpenRecord: (deal: DemoDeal) => void }) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<DemoChatTurn[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [turns]);
  function ask(value: string) {
    const question = value.trim();
    if (!question) return;
    setTurns(current => [...current, { role: 'user', content: question }, demoWiaReply(question)]);
    setInput('');
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(input); }

  return <>
    <ScreenHeading eyebrow="Inteligência operacional" title="Fale com a WIA" description="Um lugar para perguntar, pedir contexto e preparar ações da operação." onMenu={onMenu}/>
    <div className="mx-auto max-w-[780px]">
      <div className={`${surface} overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-[#ECEAE6] p-4">
          <WiaMark size={36} accentColor="#FF9F1C"/>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">WIA</h2><p className="text-[11px] text-[#777570]">Contato com a inteligência da sua operação</p></div>
          <button onClick={() => { setTurns([]); setInput(''); }} disabled={!turns.length} className="min-h-10 rounded-lg border border-[#E2DFD9] px-2.5 text-[10px] font-semibold text-[#5F5D58] hover:bg-[#F7F6F3] disabled:opacity-40">Nova conversa</button>
        </div>
        <div ref={chatRef} role="log" aria-live="polite" aria-label="Conversa com a WIA" className="h-[min(44dvh,440px)] min-h-[220px] space-y-4 overflow-y-auto bg-[#FCFBF9] p-4 sm:p-6">
          <div className="flex items-start gap-2.5">
            <WiaMark size={28} accentColor="#FF9F1C"/>
            <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-[#ECE9E3] bg-white p-3 text-xs leading-6">Olá! Pergunte sobre a operação ou peça ajuda para preparar um próximo passo. Esta prévia usa respostas demonstrativas.</div>
          </div>
          {turns.map((turn, index) => turn.role === 'user'
            ? <div key={index} className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-[#F3E8D7] p-3 text-xs leading-6">{turn.content}</div>
            : <div key={index} className="flex items-start gap-2.5">
                <WiaMark size={28} accentColor="#FF9F1C"/>
                <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-[#ECE9E3] bg-white p-3 text-xs leading-6">
                  <p>{turn.content}</p>
                  {turn.record && <button onClick={() => onOpenRecord(startDeals[0])} className="mt-2 inline-flex min-h-9 items-center gap-1 font-semibold text-[#A75B00]">Ver Nova Solutions<ChevronRight size={13}/></button>}
                </div>
              </div>)}
        </div>
        <div className="border-t border-[#ECEAE6] p-4">
          <form onSubmit={submit} className="flex gap-2">
            <input value={input} onChange={event => setInput(event.target.value)} aria-label="Pergunte à WIA" placeholder="Pergunte sobre a sua operação..." maxLength={4000} className="min-w-0 flex-1 rounded-lg border border-[#E2DFD9] px-3 text-xs outline-none focus:border-[#C66C00]"/>
            <button disabled={!input.trim()} aria-label="Perguntar" className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF9F1C] disabled:bg-[#E7E4DE]"><Send size={16}/></button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">{['O que precisa de atenção?', 'Quais propostas estão paradas?', 'E a TechBrasil?'].map(value => <button key={value} onClick={() => ask(value)} className={button}>{value}</button>)}</div>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-[#918E88]"><ShieldCheck size={12}/>Prévia demonstrativa. Sem IA conectada ou ações reais.</p>
        </div>
      </div>
    </div>
  </>;
}

export function ContextPanel({ screen, onOpenWia, deal }: { screen: PrototypeScreen; onOpenWia: () => void; deal?: DemoDeal }) {
  const map: Record<Exclude<PrototypeScreen, 'Hoje' | 'WIA'>, { eyebrow: string; title: string; body: string; evidence: string; action: string }> = {
    Inbox: { eyebrow: 'CONTEXTO DA CONVERSA', title: 'Prioridade: Nova Solutions', body: 'A proposta foi visualizada, mas o cliente não recebeu retorno recente. A WIA pode preparar uma resposta para revisão.', evidence: 'Proposta visualizada · 7 dias sem resposta', action: 'Preparar resposta' },
    Negócios: { eyebrow: 'LEITURA DO PIPELINE', title: 'R$ 12.400 em risco', body: 'O negócio da Nova Solutions concentra a maior oportunidade sem próximo passo confirmado.', evidence: '1 proposta parada · 1 aprovação pendente', action: 'Explorar com a WIA' },
    Clientes: { eyebrow: 'CONTEXTO DO REGISTRO', title: 'Próximo passo sugerido', body: 'Revise a conversa e prepare um acompanhamento personalizado. Nenhum contato será feito sem sua aprovação.', evidence: 'Conversa + proposta + histórico', action: 'Perguntar à WIA' },
  };
  if (screen === 'Hoje' || screen === 'WIA') return null;
  const data = screen === 'Negócios' && deal ? { eyebrow: 'NEGÓCIO SELECIONADO', title: deal.name, body: `${deal.note}. A WIA considera o valor de ${deal.value}, a etapa ${deal.stage} e o responsável ${deal.owner} antes de sugerir o próximo passo.`, evidence: `${deal.value} · ${deal.stage} · ${deal.age}`, action: 'Analisar com a WIA' } : map[screen];
  return <div className="space-y-5 text-white"><div className="flex items-center gap-2.5"><WiaMark size={28} accentColor="#FF9F1C"/><div><h2 className="text-sm font-semibold">WIA</h2><p className="text-[10px] text-[#A6A6A6]">Contexto da operação</p></div></div><div className="border-t border-white/10 pt-5"><p className="text-[10px] font-semibold tracking-[0.14em] text-[#FFB14A]">{data.eyebrow}</p><h3 className="mt-2 text-lg font-semibold">{data.title}</h3><p className="mt-3 text-xs leading-6 text-[#C8C8C8]">{data.body}</p><div className="mt-4 rounded-lg bg-white/[0.06] p-3"><p className="text-[10px] text-[#A6A6A6]">Evidência demonstrativa</p><p className="mt-1 text-xs">{data.evidence}</p></div><button onClick={onOpenWia} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold text-[#171717]">{data.action}<ArrowRight size={14}/></button></div><p className="flex items-start gap-2 border-t border-white/10 pt-4 text-[10px] leading-5 text-[#A6A6A6]"><Check size={13} className="mt-0.5 shrink-0"/>A equipe mantém o controle. Nenhuma ação é executada neste protótipo.</p></div>;
}

export const defaultDeal = startDeals[0];
