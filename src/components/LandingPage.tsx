import React from 'react';
import { ArrowRight, BarChart3, Check, Clock3, FileText, MessageSquare, ShieldCheck, Users, Zap } from 'lucide-react';
import OrktoLogo from './OrktoLogo';

interface LandingPageProps {
  onStartClick: () => void;
  onDemoClick: () => void;
}

const summary = [
  { label: 'Conversas', value: '24', note: '+20% hoje', icon: MessageSquare },
  { label: 'Orçamentos', value: '12', note: 'em andamento', icon: FileText },
  { label: 'Novos clientes', value: '8', note: '+14% hoje', icon: Users },
  { label: 'Oportunidades', value: 'R$ 12.400', note: '+28% hoje', icon: BarChart3 },
];

const conversations = [
  { name: 'Mariana Costa', text: 'Gostaria de receber um orçamento.', status: 'Novo', time: '10:24' },
  { name: 'Carlos Mendes', text: 'Vocês fazem instalação?', status: 'Em atendimento', time: '09:41' },
  { name: 'Fernanda Lima', text: 'Pode me enviar os valores?', status: 'Orçamento', time: 'Ontem' },
];

const principles = [
  { title: 'Simples', text: 'Direto ao ponto, sem mais uma ferramenta para operar.', icon: Zap },
  { title: 'Inteligente', text: 'Entende cada conversa e transforma intenção em próxima ação.', icon: BarChart3 },
  { title: 'Rápida', text: 'Do atendimento ao orçamento enquanto a oportunidade está quente.', icon: Clock3 },
  { title: 'Sob controle', text: 'Decisões sensíveis continuam com você.', icon: ShieldCheck },
];

export default function LandingPage({ onStartClick, onDemoClick }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F5] selection:bg-[#FF8A00] selection:text-black">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0D]/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <OrktoLogo size="md" showSlogan={false} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={onStartClick} className="hidden px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:block">
              Entrar
            </button>
            <button type="button" onClick={onStartClick} className="rounded-lg bg-[#FF8A00] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#ff9d2e]">
              Começar agora
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-white/10">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-28">
            <div className="max-w-xl">
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#FF8A00]">Operação com inteligência</p>
              <h1 className="text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                Conversas viram <span className="text-[#FF8A00]">resultados.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-zinc-400 sm:text-lg">
                A ORKTO organiza o atendimento no WhatsApp, prepara orçamentos e mostra as oportunidades que precisam da sua atenção.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onStartClick} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#FF8A00] px-6 text-sm font-semibold text-black transition-colors hover:bg-[#ff9d2e]">
                  Organizar minha operação <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={onDemoClick} className="min-h-12 rounded-lg border border-white/15 px-6 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5">
                  Ver a experiência
                </button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
                {['Sem cartão', 'Configuração simples', 'Controle humano'].map(item => (
                  <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#FF8A00]" /> {item}</span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111214] p-3 shadow-2xl shadow-black/40">
              <div className="rounded-xl border border-white/8 bg-[#0E0F11] p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/8 pb-5">
                  <div>
                    <p className="text-lg font-semibold">Olá, João.</p>
                    <p className="mt-1 text-xs text-zinc-500">Aqui está o resumo do seu negócio hoje.</p>
                  </div>
                  <span className="hidden rounded-md border border-white/10 px-3 py-2 text-[11px] text-zinc-500 sm:block">Hoje</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {summary.map(({ label, value, note, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-[#151618] p-4">
                      <Icon className="h-4 w-4 text-[#FF8A00]" />
                      <p className="mt-4 text-lg font-semibold tracking-tight">{value}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">{label}</p>
                      <p className="mt-2 text-[10px] text-zinc-600">{note}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-xl border border-white/8 bg-[#131416] p-4">
                    <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">Conversas recentes</p><span className="text-[10px] text-zinc-600">Ver todas</span></div>
                    <div className="divide-y divide-white/6">
                      {conversations.map(item => (
                        <div key={item.name} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                          <div className="min-w-0"><p className="truncate text-xs font-medium text-zinc-200">{item.name}</p><p className="mt-1 truncate text-[10px] text-zinc-600">{item.text}</p></div>
                          <div className="text-right"><p className="text-[9px] text-zinc-600">{item.time}</p><span className="mt-1 inline-block rounded bg-[#FF8A00]/10 px-1.5 py-0.5 text-[9px] text-[#FF8A00]">{item.status}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#131416] p-4">
                    <p className="text-xs font-semibold">Próximas ações</p>
                    <div className="mt-4 space-y-4">
                      {[
                        ['Enviar orçamento', 'Mariana Costa'],
                        ['Retomar contato', 'Carlos Mendes'],
                        ['Acompanhar proposta', 'Fernanda Lima'],
                      ].map(([action, person], index) => (
                        <div key={action} className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 text-[10px] text-[#FF8A00]">{index + 1}</span>
                          <div><p className="text-[11px] font-medium text-zinc-300">{action}</p><p className="mt-0.5 text-[10px] text-zinc-600">{person}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
              <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">Como deve ser</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Menos telas. Mais operação acontecendo.</h2></div>
              <div className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">
                {principles.map(({ title, text, icon: Icon }) => (
                  <article key={title} className="bg-[#0E0F11] p-6"><Icon className="h-5 w-5 text-[#FF8A00]" /><h3 className="mt-5 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#FF8A00]">Da conversa ao fechamento</p><h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">A ORKTO cuida do fluxo e chama você quando uma decisão importa.</h2></div>
            <div className="space-y-0 border-l border-white/10">
              {[
                ['01', 'Entende', 'Interpreta intenção, urgência e oportunidade.'],
                ['02', 'Age', 'Responde, prepara orçamento e organiza o próximo passo.'],
                ['03', 'Escala', 'Preço, desconto e exceções chegam para sua aprovação.'],
              ].map(([number, title, text]) => (
                <div key={number} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-white/10 py-5 pl-5 first:border-t"><span className="text-xs font-semibold text-[#FF8A00]">{number}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm text-zinc-500">{text}</p></div></div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#101113]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-center">
            <div><p className="text-2xl font-semibold tracking-tight">Mais conversas hoje. Mais negócios amanhã.</p><p className="mt-2 text-sm text-zinc-500">Comece com o essencial e deixe a operação ganhar inteligência com o tempo.</p></div>
            <button type="button" onClick={onStartClick} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A00] px-6 text-sm font-semibold text-black transition-colors hover:bg-[#ff9d2e]">Começar gratuitamente <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <OrktoLogo size="sm" showSlogan={false} />
        <div className="flex gap-5"><a href="/termos.html" className="transition-colors hover:text-zinc-300">Termos</a><a href="/privacidade.html" className="transition-colors hover:text-zinc-300">Privacidade</a><a href="mailto:ola@orkto.co" className="transition-colors hover:text-zinc-300">ola@orkto.co</a></div>
      </footer>
    </div>
  );
}
