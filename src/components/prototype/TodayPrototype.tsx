import { FormEvent, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, BriefcaseBusiness,
  CalendarClock, Check, CheckCheck, ChevronRight, CircleAlert, Clock3, FileText,
  Inbox, Menu, MoreHorizontal, Plus, Search, Send, Settings2,
  ShieldCheck, Users, X,
} from 'lucide-react';
import OrktoLogo from '../OrktoLogo';
import WiaMark from '../wia/WiaMark';
import { ContextPanel, defaultDeal, InboxScreen, PipelineScreen, RecordScreen, WiaScreen, type DemoDeal, type PrototypeScreen } from './PrototypeScreens';

type Priority = {
  id: string;
  title: string;
  company: string;
  detail: string;
  age: string;
  amount?: string;
  action: string;
  tone: 'red' | 'orange' | 'neutral';
};

const initialPriorities: Priority[] = [
  { id: 'approval', title: 'Proposta aguardando sua aprovação', company: 'TechBrasil', detail: 'Desconto solicitado · 8%', age: '12 min', amount: 'R$ 8.400', action: 'Revisar', tone: 'orange' },
  { id: 'risk', title: 'Negócio sem resposta', company: 'Nova Solutions', detail: 'Proposta visualizada · sem retorno', age: '2 dias', amount: 'R$ 12.400', action: 'Preparar follow-up', tone: 'red' },
  { id: 'wia', title: 'WIA preparou uma proposta', company: 'Fundação Horizonte', detail: 'Pronta para revisar antes de enviar', age: 'Hoje', amount: 'R$ 6.800', action: 'Revisar', tone: 'orange' },
  { id: 'owner', title: 'Lead sem responsável', company: 'Mariana Costa', detail: 'Pediu orçamento pelo WhatsApp', age: 'Agora', action: 'Atribuir', tone: 'neutral' },
];

const navItems = [
  { label: 'Hoje', icon: Activity },
  { label: 'WIA', icon: null },
  { label: 'Inbox', icon: Inbox, count: '5' },
  { label: 'Clientes', icon: Users },
  { label: 'Negócios', icon: BriefcaseBusiness },
  { label: 'Tarefas', icon: CheckCheck },
  { label: 'Automações', icon: Settings2 },
  { label: 'Análises', icon: Activity },
];

function WiaSymbol({ size = 25 }: { size?: number; surface?: 'dark' | 'light' }) {
  return <WiaMark size={size} accentColor="#FF9F1C" />;
}

function PrototypeBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF9F1C]/35 bg-[#FF9F1C]/10 px-2.5 py-1 text-[10px] font-semibold text-[#9A5200]"><span className="h-1.5 w-1.5 rounded-full bg-[#FF9F1C]" />Protótipo · dados ilustrativos</span>;
}

function SectionTitle({ id, title, trailing }: { id: string; title: string; trailing?: string }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 id={id} className="text-[15px] font-bold tracking-[-0.02em] text-[#171717]">{title}</h2>{trailing && <span className="text-xs text-[#777777]">{trailing}</span>}</div>;
}

export default function TodayPrototype() {
  const priorities = initialPriorities;
  const [screen, setScreen] = useState<PrototypeScreen>('Hoje');
  const [recordDeal, setRecordDeal] = useState<DemoDeal>(defaultDeal);
  const [command, setCommand] = useState('');
  const [result, setResult] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [contextVisible, setContextVisible] = useState(true);
  const [prepared, setPrepared] = useState(true);
  const [approved, setApproved] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<Priority>(initialPriorities[1]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [assignee, setAssignee] = useState('Davy Silva');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showPrototypeNote, setShowPrototypeNote] = useState(true);

  function navigate(next: PrototypeScreen) {
    setScreen(next);
    setPanelOpen(false);
    setMobileNavOpen(false);
  }

  function openRecord(deal: DemoDeal) {
    setRecordDeal(deal);
    navigate('Clientes');
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    setSelectedPriority(value.toLowerCase().includes('follow') ? initialPriorities[1] : initialPriorities[0]);
    setPrepared(true);
    setApproved(false);
    setResult(value.toLowerCase().includes('follow')
      ? 'Encontrei 2 propostas sem retorno há mais de 48 horas. A mais urgente é a da Nova Solutions, no valor de R$ 12.400.'
      : 'Há 3 decisões aguardando revisão. A proposta da TechBrasil pede atenção primeiro por causa do desconto solicitado.');
    setPanelOpen(true);
    setCommand('');
  }

  function handlePriority(item: Priority) {
    if (item.id === 'owner') {
      setAssigned(false);
      setAssignOpen(true);
      return;
    }
    setSelectedPriority(item);
    setPrepared(true);
    setApproved(false);
    setResult('');
    setPanelOpen(true);
  }

  function simulateApproval() {
    setApproved(true);
    setPrepared(false);
  }

  return (
    <div className="orkto-prototype min-h-dvh bg-[#F5F5F3] text-[#171717] antialiased">
      {showPrototypeNote && (
        <div className="flex min-h-9 items-center justify-center gap-2 border-b border-[#F2D6B3] bg-[#FFF7EC] px-4 py-1.5 text-center text-[11px] text-[#684214]">
          <span>Ambiente de validação: nomes, valores e ações são demonstrativos; nada será enviado ou salvo.</span>
          <button onClick={() => setShowPrototypeNote(false)} aria-label="Fechar aviso do protótipo" className="rounded p-1 hover:bg-[#F5E7D4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C66C00]"><X size={13} /></button>
        </div>
      )}

      <div className="mx-auto flex min-h-[calc(100dvh-36px)] max-w-[1800px]">
        <aside className="hidden w-[228px] shrink-0 flex-col border-r border-[#E6E4E0] bg-[#FBFBFA] px-4 py-5 lg:flex">
          <div className="mb-8 flex h-10 items-center px-2">
            <div className="flex items-center gap-2.5">
              <div className="items-start"><OrktoLogo size="sm" darkMode={false} accentColor="#FF9F1C" /><p className="mt-1 text-[8px] font-medium uppercase tracking-[0.19em] text-[#737373]">Operação comercial</p></div>
            </div>
          </div>

          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8884]">Workspace</p>
          <nav className="space-y-1" aria-label="Navegação do protótipo">
            {navItems.map(({ label, icon: Icon, count }) => (
              <button key={label} onClick={() => ['Hoje', 'WIA', 'Inbox', 'Clientes', 'Negócios'].includes(label) ? navigate(label as PrototypeScreen) : setMobileNavOpen(true)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C66C00] ${screen === label ? 'bg-[#F0EEEA] font-semibold text-[#171717]' : 'text-[#5F5E5B] hover:bg-[#F2F1EE] hover:text-[#171717]'}`} aria-current={screen === label ? 'page' : undefined}>
                {Icon ? <Icon size={17} strokeWidth={1.8} className={screen === label ? 'text-[#C66C00]' : 'text-[#777570]'} /> : <WiaSymbol size={19} />}
                <span className="flex-1">{label}</span>
                {count && <span className="rounded-md bg-[#ECEAE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#55534F]">{count}</span>}
                {screen === label && <span className="h-1.5 w-1.5 rounded-full bg-[#FF9F1C]" />}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-1 border-t border-[#E6E4E0] pt-4">
            <button onClick={() => setMobileNavOpen(true)} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] text-[#5F5E5B] hover:bg-[#F2F1EE]"><Settings2 size={17} />Configurações</button>
            <button onClick={() => setMobileNavOpen(true)} className="flex min-h-12 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-[#F2F1EE]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9E6E1] text-[11px] font-bold text-[#343330]">DS</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">Davy Silva</span><span className="block truncate text-[10px] text-[#777570]">Equipe comercial</span></span>
              <MoreHorizontal size={17} className="text-[#777570]" />
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8 lg:pt-7 xl:px-10">
          <div className={`grid grid-cols-1 gap-7 xl:gap-8 ${screen === 'WIA' || !contextVisible ? '' : 'xl:grid-cols-[minmax(0,1fr)_310px]'}`}>
            <div className="min-w-0 overflow-hidden">
          {screen === 'Hoje' && <>
          <header className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 lg:hidden">
                <OrktoLogo size="sm" darkMode={false} accentColor="#FF9F1C" />
                <span className="h-4 w-px bg-[#DDDBD6]" /><PrototypeBadge />
              </div>
              <div className="hidden lg:block mb-2"><PrototypeBadge /></div>
              <h1 className="text-[23px] font-bold tracking-[-0.035em] sm:text-[27px]">Bom dia, Davy</h1>
              <p className="mt-1 text-[13px] text-[#6D6B67] sm:text-sm">Aqui está o que precisa da sua atenção hoje.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <button aria-label="Notificações demonstrativas" className="relative hidden h-11 w-11 items-center justify-center rounded-lg border border-[#E6E4E0] bg-white text-[#56544F] hover:bg-[#F8F7F5] sm:flex"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#D4483B]" /></button>
              <button onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu" className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E6E4E0] bg-white text-[#56544F] lg:hidden"><Menu size={18} /></button>
              <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#E9E6E1] text-xs font-bold lg:flex">DS</span>
            </div>
          </header>

          <form onSubmit={submitCommand} className="mb-6 flex min-h-[50px] items-center gap-3 rounded-xl border border-[#E2DFD9] bg-white px-3.5 shadow-[0_1px_2px_rgba(20,20,20,0.03)] focus-within:border-[#C66C00]/60 focus-within:ring-2 focus-within:ring-[#FF9F1C]/15 sm:px-4">
            <Search size={18} className="shrink-0 text-[#8B8984]" />
            <input value={command} onChange={event => setCommand(event.target.value)} placeholder="Pergunte ou peça algo à WIA..." aria-label="Comando para WIA" className="min-w-0 flex-1 bg-transparent py-3 text-[13px] text-[#252421] outline-none placeholder:text-[#898781] sm:text-sm" />
            <span className="hidden text-[10px] text-[#92908A] md:block">Ex.: quais negócios precisam de atenção?</span>
            <button type="submit" disabled={!command.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FF9F1C] text-[#1A1A1A] transition hover:bg-[#F3920E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A95A00] disabled:cursor-not-allowed disabled:bg-[#EEECE8] disabled:text-[#AAA7A0]" aria-label="Consultar WIA"><ArrowRight size={17} /></button>
          </form>

          <div className="space-y-7">
              <section aria-labelledby="needs-title">
                <SectionTitle id="needs-title" title="Precisa de você" trailing={`${priorities.length} ações`} />
                <div className="overflow-hidden rounded-xl border border-[#E6E4E0] bg-white">
                  {priorities.length ? priorities.map((item, index) => (
                    <div key={item.id} className={`flex flex-col gap-3 px-3.5 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4 ${index > 0 ? 'border-t border-[#EEECE8]' : ''}`}>
                      <span className={`mt-0.5 hidden h-2 w-2 shrink-0 rounded-full sm:block ${item.tone === 'red' ? 'bg-[#D4483B]' : item.tone === 'orange' ? 'bg-[#E69119]' : 'bg-[#85837E]'}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full sm:hidden ${item.tone === 'red' ? 'bg-[#D4483B]' : item.tone === 'orange' ? 'bg-[#E69119]' : 'bg-[#85837E]'}`} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold leading-5 text-[#22211F]">{item.title}</p>
                            <p className="mt-0.5 text-xs text-[#66645F]">{item.company}<span className="mx-1.5 text-[#B7B4AD]">·</span>{item.detail}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 pl-4 sm:justify-end sm:pl-0">
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-[#777570]"><Clock3 size={13} />{item.age}{item.amount && <><span className="text-[#C2BFB9">·</span><strong className="font-semibold text-[#383733]">{item.amount}</strong></>}</span>
                        <button onClick={() => handlePriority(item)} className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A95A00] ${item.id === 'risk' ? 'bg-[#FF9F1C] text-[#171717] hover:bg-[#F3920E]' : 'border border-[#E5E2DC] bg-white text-[#383733] hover:bg-[#F7F6F3]'}`}>{item.action}<ChevronRight size={14} /></button>
                      </div>
                    </div>
                  )) : (
                    <div className="flex items-center gap-3 px-4 py-6"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F3EC] text-[#2D7D4A]"><Check size={17} /></span><div><p className="text-sm font-semibold">Tudo em dia</p><p className="mt-0.5 text-xs text-[#6D6B67]">Nenhuma ação comercial precisa da sua atenção agora.</p></div></div>
                  )}
                </div>
              </section>

              <section aria-labelledby="operation-title">
                <SectionTitle id="operation-title" title="Operação" trailing="Últimos 7 dias" />
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#E6E4E0] bg-white md:grid-cols-4">
                  <div className="min-h-[98px] border-b border-r border-[#EEECE8] p-3.5 md:border-b-0 md:p-4"><p className="text-[22px] font-bold tracking-[-0.04em] tabular-nums">12</p><p className="mt-1 text-xs font-semibold text-[#34332F]">Negócios ativos</p><p className="mt-0.5 text-[10px] text-[#777570]">3 precisam de atenção</p></div>
                  <div className="min-h-[98px] border-b border-[#EEECE8] p-3.5 md:border-b-0 md:border-r md:p-4"><p className="text-[22px] font-bold tracking-[-0.04em] tabular-nums">R$ 48.200</p><p className="mt-1 text-xs font-semibold text-[#34332F]">Pipeline atual</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#B44136]"><ArrowDownRight size={12} />R$ 12.400 em risco</p></div>
                  <div className="min-h-[98px] border-r border-[#EEECE8] p-3.5 md:p-4"><p className="text-[22px] font-bold tracking-[-0.04em] tabular-nums">4</p><p className="mt-1 text-xs font-semibold text-[#34332F]">Follow-ups hoje</p><p className="mt-0.5 text-[10px] text-[#B44136]">2 atrasados</p></div>
                  <div className="min-h-[98px] p-3.5 md:p-4"><p className="text-[22px] font-bold tracking-[-0.04em] tabular-nums">3</p><p className="mt-1 text-xs font-semibold text-[#34332F]">Aguardando resposta</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#777570]"><CalendarClock size={11} />Mais antigo: 7 dias</p></div>
                </div>
              </section>

              <section aria-labelledby="wia-worked-title" className="overflow-hidden rounded-xl border border-[#E6E4E0] bg-[#F0EFEC]">
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-2.5"><WiaSymbol size={21} surface="light" /><div><h2 id="wia-worked-title" className="text-[13px] font-bold">WIA trabalhou por você</h2><p className="mt-0.5 text-[11px] text-[#777570]">Resumo demonstrativo de hoje</p></div></div>
                  <button onClick={() => { setResult('Hoje, a WIA analisou conversas, atualizou cadastros e preparou ações para sua revisão.'); setPanelOpen(true); }} className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[#5F5D58] hover:text-[#171717]">Ver detalhes<ArrowRight size={14} /></button>
                </div>
                <div className="grid grid-cols-2 border-t border-[#E2E0DB] sm:grid-cols-4">
                  {[['17', 'conversas analisadas'], ['8', 'clientes atualizados'], ['5', 'follow-ups preparados'], ['2', 'oportunidades identificadas']].map(([value, label], index) => <div key={label} className={`px-4 py-3 ${index % 2 ? 'border-l border-[#E2E0DB]' : ''} ${index > 1 ? 'border-t border-[#E2E0DB] sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}><p className="text-base font-bold tabular-nums">{value}</p><p className="mt-0.5 text-[10px] text-[#6D6B67]">{label}</p></div>)}
                </div>
              </section>
              <p className="pb-2 text-[10px] text-[#96938D] xl:hidden">Ações, valores e nomes nesta tela são dados ilustrativos do protótipo.</p>
            </div>
          </>}
          {screen === 'Inbox' && <InboxScreen onMenu={() => setMobileNavOpen(true)} onOpenWia={() => setPanelOpen(true)} onOpenRecord={openRecord} contextVisible={contextVisible} onToggleContext={() => setContextVisible(value => !value)} />}
          {screen === 'Negócios' && <PipelineScreen onMenu={() => setMobileNavOpen(true)} onOpenRecord={openRecord} contextVisible={contextVisible} onToggleContext={() => setContextVisible(value => !value)} />}
          {screen === 'Clientes' && <RecordScreen key={recordDeal.id} onMenu={() => setMobileNavOpen(true)} deal={recordDeal} onOpenWia={() => setPanelOpen(true)} />}
          {screen === 'WIA' && <WiaScreen onMenu={() => setMobileNavOpen(true)} onOpenRecord={openRecord} />}
            </div>

            {screen !== 'WIA' && contextVisible && <aside id="wia-context-panel" className="hidden min-w-0 self-start rounded-xl bg-[#111111] px-5 py-5 text-white xl:block" aria-label="Contexto da WIA">
              {screen === 'Hoje' ? <WiaPanel key={selectedPriority.id} subject={selectedPriority} result={result} prepared={prepared} approved={approved} onPrepare={() => { setPrepared(true); setApproved(false); }} onApprove={simulateApproval} onCancel={() => setPrepared(false)} /> : <ContextPanel screen={screen} deal={recordDeal} onOpenWia={() => navigate('WIA')} />}
            </aside>}
          </div>
        </main>
      </div>

      <nav aria-label="Navegação mobile" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#E4E1DB] bg-[#FBFBFA]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-sm lg:hidden">
        {[
          { label: 'Hoje', icon: Activity, action: () => navigate('Hoje') },
          { label: 'Inbox', icon: Inbox, action: () => navigate('Inbox') },
          { label: 'Criar', icon: Plus, action: () => setMobileNavOpen(true), primary: true },
          { label: 'Clientes', icon: Users, action: () => navigate('Clientes') },
          { label: 'WIA', icon: null, action: () => navigate('WIA') },
        ].map(({ label, icon: Icon, action, primary }) => <button key={label} onClick={action} className="flex min-h-[54px] flex-col items-center justify-center gap-1 text-[10px] font-medium text-[#777570] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A95A00]" aria-label={label}>{primary ? <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF9F1C] text-[#171717]"><Plus size={20} /></span> : Icon ? <Icon size={19} strokeWidth={screen === label ? 2.2 : 1.8} className={screen === label ? 'text-[#C66C00]' : ''} /> : <WiaSymbol size={22} />}<span className={screen === label ? 'font-semibold text-[#A85A00]' : ''}>{label}</span></button>)}
      </nav>

      {panelOpen && <div className="fixed inset-0 z-40 flex items-end bg-black/35 p-0 xl:hidden xl:items-center xl:justify-center xl:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setPanelOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Contexto da WIA" className="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-[#111111] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 text-white shadow-[0_-12px_50px_rgba(0,0,0,0.2)] xl:max-w-[400px] xl:rounded-2xl xl:p-5">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/25 xl:hidden" />
          <div className="mb-4 flex items-start justify-between"><div className="flex items-center gap-2.5"><WiaSymbol size={24} /><div><p className="text-sm font-semibold">WIA <span className="ml-1 text-[10px] font-medium text-[#A8A8A8]">CONTEXTO</span></p><p className="mt-0.5 text-[11px] text-[#A5A5A5]">Inteligência da operação</p></div></div><button onClick={() => setPanelOpen(false)} aria-label="Fechar contexto da WIA" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#B5B5B5] hover:bg-white/10"><X size={17} /></button></div>
          {screen === 'Hoje' ? <WiaPanel key={selectedPriority.id} subject={selectedPriority} result={result} prepared={prepared} approved={approved} onPrepare={() => { setPrepared(true); setApproved(false); }} onApprove={simulateApproval} onCancel={() => setPrepared(false)} /> : <ContextPanel screen={screen} deal={recordDeal} onOpenWia={() => navigate('WIA')} />}
        </div>
      </div>}

      {mobileNavOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3" onMouseDown={event => { if (event.target === event.currentTarget) setMobileNavOpen(false); }}><div role="dialog" aria-modal="true" aria-label="Navegação do protótipo" className="w-full rounded-2xl bg-white p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><p className="font-semibold">ORKTO · Protótipo</p><button aria-label="Fechar" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 hover:bg-[#F1F0ED]"><X size={17} /></button></div><div className="grid grid-cols-2 gap-2">{(['Hoje','Inbox','Negócios','Clientes','WIA'] as PrototypeScreen[]).map(item => <button key={item} onClick={() => navigate(item)} className={`min-h-11 rounded-lg px-3 text-left text-sm font-semibold ${screen === item ? 'bg-[#FFF0D9] text-[#9A5200]' : 'bg-[#F4F2EF]'}`}>{item}</button>)}</div><p className="mt-4 text-xs leading-5 text-[#777570]">Outras áreas do menu serão desenhadas após a validação deste fluxo.</p></div></div>}

      {assignOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget) setAssignOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Atribuir lead" className="w-full max-w-[390px] rounded-xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-bold">Atribuir lead</h2><p className="mt-1 text-xs text-[#66645F]">Mariana Costa · WhatsApp</p></div><button onClick={() => setAssignOpen(false)} aria-label="Fechar atribuição" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#F1F0ED]"><X size={17} /></button></div>
          {assigned ? <div role="status" className="mt-5 rounded-lg bg-[#E8F3EC] p-3 text-sm text-[#266943]"><strong className="block">Atribuição simulada</strong>Nenhum dado real foi alterado.</div> : <><label htmlFor="prototype-assignee" className="mt-5 block text-xs font-semibold">Responsável</label><select id="prototype-assignee" value={assignee} onChange={event => setAssignee(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#D9D6D0] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C66C00]"><option>Davy Silva</option><option>Ana Costa</option><option>Equipe comercial</option></select><button onClick={() => setAssigned(true)} className="mt-4 min-h-11 w-full rounded-lg bg-[#FF9F1C] text-sm font-semibold text-[#171717] hover:bg-[#F3920E]">Simular atribuição</button></>}
        </div>
      </div>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .orkto-prototype { font-family: 'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif; }
        .orkto-prototype button, .orkto-prototype input { font: inherit; }
        .orkto-prototype ::selection { background: #ffe0b2; color: #241300; }
        @media (prefers-reduced-motion: no-preference) {
          .orkto-prototype main > * { animation: prototype-rise 240ms cubic-bezier(.16,1,.3,1) both; }
          @keyframes prototype-rise { from { opacity: .65; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        }
      `}</style>
    </div>
  );
}

function WiaPanel({ subject, result, prepared, approved, onPrepare, onApprove, onCancel }: {
  subject: Priority;
  result: string;
  prepared: boolean;
  approved: boolean;
  onPrepare: () => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const isFollowUp = subject.id === 'risk';
  const isInternalApproval = subject.id === 'approval';
  const [editingMessage, setEditingMessage] = useState(false);
  const [message, setMessage] = useState(() => isFollowUp
    ? 'Olá, João. Conseguiu revisar a proposta? Se houver algum ponto que queira ajustar, posso ajudar.'
    : isInternalApproval
      ? 'Proposta de R$ 8.400 com desconto solicitado de 8%. Revise as condições antes de aprovar.'
      : 'Olá! Sua proposta está pronta. Posso encaminhá-la para sua revisão?');
  return (
    <div className="space-y-5 text-white">
      <div className="hidden items-center justify-between xl:flex"><div className="flex items-center gap-2.5"><WiaSymbol size={23} /><div><h2 className="text-sm font-semibold">WIA</h2><p className="text-[10px] text-[#A6A6A6]">Contexto da operação</p></div></div><span className="flex items-center gap-1.5 text-[10px] text-[#BDBDBD]"><span className="h-1.5 w-1.5 rounded-full bg-[#55B879]" />Atenta</span></div>

      <section className="border-b border-white/10 pb-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#FFB14A]">{result ? 'RESPOSTA CONTEXTUAL' : isFollowUp ? 'OPORTUNIDADE EM RISCO' : 'DECISÃO PENDENTE'}</p>
        <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{result ? 'O que merece atenção' : subject.company}</h3>
        <p className="mt-1 text-sm font-semibold text-white">{result || subject.amount}{!result && <span className="ml-1 font-normal text-[#AAAAAA]">{isFollowUp ? 'em negociação' : 'aguarda revisão'}</span>}</p>
        {!result && <div className="mt-3 space-y-2 text-[11px] text-[#BDBDBD]"><p className="flex items-start gap-2"><Clock3 size={14} className="mt-0.5 shrink-0 text-[#FFB14A]" />{isFollowUp ? 'Sem resposta há 7 dias' : subject.age === 'Hoje' ? 'Preparada hoje pela WIA' : 'Aguardando há 12 minutos'}</p><p className="flex items-start gap-2"><FileText size={14} className="mt-0.5 shrink-0 text-[#FFB14A]" />{isFollowUp ? 'Proposta visualizada há 7 dias' : subject.detail}</p></div>}
        <p className="mt-3 rounded-lg bg-white/[0.06] p-3 text-[11px] leading-5 text-[#D0D0D0]">{result ? 'Demonstração ilustrativa. Confira os dados no registro antes de agir.' : isFollowUp ? 'Por que importa: a proposta foi visualizada, mas não houve retorno nem follow-up recente.' : 'Por que importa: esta ação pode afetar a negociação e precisa da sua revisão.'}</p>
        {!result && !prepared && <button onClick={onPrepare} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#FF9F1C] px-3 text-xs font-semibold text-[#171717] hover:bg-[#F3920E]"><Send size={14} />{isFollowUp ? 'Preparar follow-up' : 'Preparar revisão'}</button>}
      </section>

      {prepared && <section className="rounded-xl border border-white/15 bg-[#1C1C1C] p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold">{isFollowUp ? 'WIA preparou um follow-up' : isInternalApproval ? 'Proposta para aprovação' : 'WIA preparou uma proposta'}</p><span className="rounded-md bg-[#F3A02C]/15 px-2 py-1 text-[9px] font-semibold text-[#FFC879]">AGUARDANDO SUA REVISÃO</span></div>
        <dl className="space-y-2 text-[11px]"><div className="flex justify-between gap-4"><dt className="text-[#A6A6A6]">Para</dt><dd className="text-right font-medium">{isFollowUp ? 'João · Nova Solutions' : subject.company}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#A6A6A6]">Canal</dt><dd className="text-right font-medium">{isInternalApproval ? 'Aprovação interna' : 'WhatsApp'}</dd></div></dl>
        {editingMessage ? <label className="mt-3 block"><span className="sr-only">Editar mensagem demonstrativa</span><textarea value={message} onChange={event => setMessage(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-white/15 bg-black/30 p-3 text-[11px] leading-5 text-[#E0E0E0] outline-none focus:border-[#FF9F1C]" /></label> : <div className="mt-3 rounded-lg bg-black/30 p-3 text-[11px] leading-5 text-[#E0E0E0]">“{message}”</div>}
        <p className="mt-2 text-[10px] leading-4 text-[#A6A6A6]">Prévia ilustrativa. Nada será enviado ou alterado neste protótipo.</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setEditingMessage(value => !value)} className="min-h-11 rounded-lg border border-white/15 px-3 text-[11px] font-semibold hover:bg-white/5">{editingMessage ? 'Salvar edição' : 'Editar texto'}</button><button onClick={onCancel} className="min-h-11 rounded-lg border border-white/15 px-3 text-[11px] font-semibold hover:bg-white/5">Cancelar</button><button onClick={onApprove} className="col-span-2 min-h-11 rounded-lg bg-[#FF9F1C] px-3 text-[11px] font-bold text-[#171717] hover:bg-[#F3920E]">Simular aprovação</button></div>
      </section>}

      {approved && <div role="status" className="flex items-start gap-2.5 rounded-lg border border-[#55B879]/25 bg-[#55B879]/10 p-3 text-[11px] leading-5 text-[#D7F2E0]"><Check size={15} className="mt-0.5 shrink-0 text-[#77D397]" /><span><strong className="block">Demonstração concluída</strong>Nenhuma ação real foi executada.</span></div>}

      <section>
        <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A6A6A6]">O QUE ESTOU CONSIDERANDO</p><ShieldCheck size={15} className="text-[#A6A6A6]" /></div>
        <div className="space-y-2 text-[11px] text-[#D0D0D0]"><p className="flex items-center justify-between gap-3"><span>Objetivo</span><strong className="text-right font-medium text-white">Recuperar vendas paradas</strong></p><p className="flex items-center justify-between gap-3"><span>Período</span><strong className="text-right font-medium text-white">Últimos 7 dias</strong></p><p className="flex items-center justify-between gap-3"><span>Fontes</span><strong className="text-right font-medium text-white">Conversas · propostas</strong></p></div>
      </section>
      <div className="flex items-start gap-2 border-t border-white/10 pt-3 text-[10px] leading-4 text-[#A6A6A6]"><CircleAlert size={14} className="mt-0.5 shrink-0" />A WIA prepara recomendações. A equipe revisa ações antes de qualquer envio.</div>
    </div>
  );
}
