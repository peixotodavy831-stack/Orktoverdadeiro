import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Check, 
  HelpCircle, 
  Zap, 
  ShieldCheck, 
  Smartphone, 
  TrendingUp, 
  Search, 
  Bell, 
  MessageSquare,
  Lock,
  Sparkles,
  Layers,
  Star,
  DollarSign
} from 'lucide-react';
import OrktoLogo from './OrktoLogo';

// TextScramble microinteraction element
export function TextScramble({ phrases }: { phrases: string[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState(phrases[0]);
  const chars = '!?#@$%&*()_+-=[]{}|;:XYZABCDEF1234567890';

  useEffect(() => {
    const text = phrases[currentIdx];
    let iteration = 0;
    let interval: NodeJS.Timeout;

    interval = setInterval(() => {
      setDisplayedText((prev) => {
        return text
          .split('')
          .map((char, index) => {
            if (index < iteration) {
              return text[index];
            }
            if (char === ' ') return ' ';
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('');
      });

      if (iteration >= text.length) {
        clearInterval(interval);
        // Wait and advance
        setTimeout(() => {
          clearInterval(interval);
        }, 1500);
      }
      iteration += 1 / 3;
    }, 25);

    // Swap phrase every 4 seconds
    const phraseTimeout = setTimeout(() => {
      setCurrentIdx((prev) => (prev + 1) % phrases.length);
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(phraseTimeout);
    };
  }, [currentIdx, phrases]);

  return <span className="font-mono text-brand-orange" style={{ color: '#FF9F1C' }}>{displayedText}</span>;
}

interface LandingPageProps {
  onStartClick: () => void;
  onDemoClick: () => void;
}

export default function LandingPage({ onStartClick, onDemoClick }: LandingPageProps) {
  // Phrases for premium TextScramble
  const scramblePhrases = [
    "Responda primeiro.",
    "Feche mais rápido.",
    "Velocidade fecha contrato.",
    "Antes da concorrência."
  ];

  return (
    <div className="bg-[#111111] text-white min-h-screen font-sans selection:bg-[#FF9F1C]/20 selection:text-white relative overflow-hidden">
      
      {/* Background elegant grid/radial overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_100%)] opacity-35" />
      <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#FF9F1C]/10 via-transparent to-transparent pointer-events-none blur-3xl opacity-60" />

      {/* Header / Navigation */}
      <nav className="border-b border-[#2B2B2B] bg-[#111111]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <OrktoLogo size="md" showSlogan={false} />
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onStartClick} 
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Entrar
            </button>
            <button 
              onClick={onStartClick} 
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#FF9F1C] text-black hover:opacity-95 transition-all shadow-lg active:scale-95 cursor-pointer font-sans"
              style={{ backgroundColor: '#FF9F1C' }}
            >
              Criar Conta Grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-5xl mx-auto text-center">
          
          {/* Slogan pill heading */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2B2B2B] border border-zinc-800 rounded-full text-[10px] uppercase font-bold tracking-widest text-[#FF9F1C]/90 mb-8 select-none">
            <Zap className="w-3.5 h-3.5" style={{ color: '#FF9F1C' }} />
            <span>O orçamento antes da concorrência</span>
          </div>

          {/* Slogan logo view */}
          <div className="mb-10 flex justify-center">
            <OrktoLogo size="xl" showSlogan={true} />
          </div>

          <h1 className="text-4xl sm:text-6xl font-sans font-black tracking-tight leading-[1.1] mb-6">
            Seu orçamento virou <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#E5E5E5]">
              sua vitrine.
            </span>
          </h1>

          {/* Microinteraction terminal styled scrambler text */}
          <div className="text-lg sm:text-xl font-bold mb-8 h-8 flex justify-center items-center gap-2 text-zinc-400">
            <span>Para quem quer:</span>
            <TextScramble phrases={scramblePhrases} />
          </div>

          <p className="text-[#E5E5E5] text-base sm:text-lg max-w-3xl mx-auto mb-10 leading-relaxed">
            Crie, envie e acompanhe propostas profissionais antes da concorrência responder. Transforme rascunhos em links interativos e feche contratos 60 segundos após o primeiro contato.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button 
              onClick={onStartClick} 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-black font-extrabold text-base transition-all flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: '#FF9F1C' }}
            >
              Criar orçamento em 60 segundos
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={onDemoClick} 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#2B2B2B] hover:bg-[#3B3B3B] border border-zinc-800 text-white font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              Ver proposta modelo
            </button>
          </div>

          {/* Core Promise Badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-zinc-500 font-medium select-none">
            <span className="flex items-center gap-1.5">✓ Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5">✓ Zero atrito de login</span>
            <span className="flex items-center gap-1.5">✓ WhatsApp imediato</span>
          </div>
        </div>
      </section>

      {/* Visual Live Preview Below Hero */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8 z-10 relative">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#2B2B2B] p-1.5 rounded-[24px] border border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="bg-[#111111] rounded-[18px] border border-zinc-805 p-4 sm:p-6 overflow-hidden">
              
              {/* Fake Window Header bar bar */}
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-zinc-650 text-xs font-mono ml-4 select-none">painel.orkto.com/proposta-modelo</span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 bg-[#2B2B2B]/60 rounded-lg text-[10px] text-[#FF9F1C] border border-[#FF9F1C]/20">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span>Visualizando Agora</span>
                </div>
              </div>

              {/* Layout simulation representing the premium quote showcase */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start text-left">
                
                {/* Left col: Invoice Details */}
                <div className="md:col-span-8 space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <OrktoLogo size="sm" showSlogan={false} />
                      <p className="text-xs text-zinc-400 mt-2">ORKTO Pro Smart Proposals — Tecnologia & Design comercial</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#FF9F1C] bg-[#FF9F1C]/10 border border-[#FF9F1C]/20 px-2 py-0.5 rounded uppercase font-bold font-mono">Proposta #2591</span>
                      <p className="text-xs text-zinc-500 mt-1">Validade: 15 dias</p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-850 pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cliente</p>
                      <p className="text-sm font-bold text-white mt-0.5">Carlos Henrique Albuquerque</p>
                      <p className="text-xs text-zinc-400">Marinho Negócios Digitais</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Escopo / Projeto</p>
                      <p className="text-sm font-bold text-[#FF9F1C] mt-0.5">Landing Page Premium & Identidade Visual</p>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="border-t border-zinc-850 pt-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3.5">Itens e Serviços Contratados</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between p-3 bg-[#2B2B2B]/40 rounded-xl border border-zinc-850">
                        <div>
                          <p className="font-bold text-white">Desenvolvimento de Web Interface Comercial</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Landing page estruturada, otimizada para mobile e SEO, baseada em código limpo.</p>
                        </div>
                        <span className="font-mono text-white whitespace-nowrap self-center font-bold">R$ 5.500,00</span>
                      </div>
                      <div className="flex justify-between p-3 bg-[#2B2B2B]/40 rounded-xl border border-zinc-850">
                        <div>
                          <p className="font-bold text-white">Consuloria Técnica de Conteúdo e UX</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Reuniões estratégicas para design de fluxo de vendas e copyrighting comercial.</p>
                        </div>
                        <span className="font-mono text-white whitespace-nowrap self-center font-bold">R$ 2.400,00</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right col: Call to Action approvals */}
                <div className="md:col-span-4 bg-[#2B2B2B]/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold text-center">Investimento Consolidado</p>
                  
                  <div className="text-center py-2">
                    <p className="text-3xl font-display font-bold text-white font-mono">R$ 7.900,00</p>
                    <p className="text-[10px] text-zinc-400 mt-1">Ou em até 12x via cartão de crédito</p>
                  </div>

                  <div className="border-t border-zinc-850 pt-4 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono">R$ 7.900,00</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Descontos comerciais</span>
                      <span className="font-mono text-emerald-500">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-[#FF9F1C] border-t border-zinc-850 pt-2.5">
                      <span>Total Garantido</span>
                      <span className="font-mono font-bold">R$ 7.900,00</span>
                    </div>
                  </div>

                  {/* Simulator Pix/Action button */}
                  <div className="border-t border-zinc-850 pt-4 text-center space-y-2 select-none">
                    <div className="py-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Aprovar Proposta comercial
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">O prestador será notificado instantaneamente por WhatsApp ao clicar.</p>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Real SaaS Value / Benefits section */}
      <section className="py-20 border-t border-zinc-900 bg-[#111111] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="uppercase text-[#FF9F1C] font-bold tracking-[0.2em] text-xs mb-3">
              Fluxo Comercial Rápido
            </h2>
            <p className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">Como a ORKTO acelera suas propostas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Box 1 */}
            <div className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-805 flex flex-col justify-between hover:border-zinc-800 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#FF9F1C]/10 flex items-center justify-center mb-6">
                  <Smartphone className="w-6 h-6 text-[#FF9F1C]" style={{ color: '#FF9F1C' }} />
                </div>
                <h3 className="text-lg font-bold mb-3 text-white">1. Escreva no Celular ou PC</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Adicione dados do cliente, termos do projeto, valores de itens e descontos comerciais em apenas alguns segundos.
                </p>
              </div>
              <span className="text-zinc-800 text-5xl font-extrabold select-none mt-6 font-mono">01</span>
            </div>

            {/* Box 2 */}
            <div className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-805 flex flex-col justify-between hover:border-zinc-800 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
                  <MessageSquare className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold mb-3 text-white">2. Envie por WhatsApp Instantâneo</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Gere um link premium para o cliente interagir. Chega de PDFs pesados e textos feios digitados.
                </p>
              </div>
              <span className="text-zinc-800 text-5xl font-extrabold select-none mt-6 font-mono">02</span>
            </div>

            {/* Box 3 */}
            <div className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-805 flex flex-col justify-between hover:border-zinc-800 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold mb-3 text-white">3. Notificação Automática</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Saiba no instante exato quando seu cliente abrir e aprovar o orçamento. Feche vendas onde você estiver.
                </p>
              </div>
              <span className="text-zinc-800 text-5xl font-extrabold select-none mt-6 font-mono">03</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / Plano Único */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900 bg-[#111111]/90">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#FF9F1C] uppercase tracking-widest text-xs font-bold mb-3">Preço Simples</h2>
            <p className="text-3xl sm:text-4xl font-sans font-black tracking-tight mb-4 text-white">Plano Único Comercial</p>
            <p className="text-zinc-400 text-sm max-w-lg mx-auto">
              Grátis para testar. Depois, apenas uma mensalidade simples e fixa para escalar sua agência ou prestação de serviços.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Free Tier */}
            <div className="bg-[#2B2B2B]/60 p-8 rounded-[32px] border border-zinc-800 shadow-xl flex flex-col justify-between h-full relative">
              <div>
                <h3 className="text-lg font-bold text-zinc-300">Conhecer Plataforma</h3>
                <p className="text-xs text-zinc-500 mt-1">Ideal para testar sem custo</p>
                <div className="my-6">
                  <span className="text-4xl font-display font-extrabold text-white">R$ 0</span>
                  <span className="text-zinc-500 text-xs"> / sempre</span>
                </div>
                <ul className="space-y-3.5 text-sm text-zinc-400">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#FF9F1C]" style={{ color: '#FF9F1C' }} /> Até 5 orçamentos criados</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#FF9F1C]" style={{ color: '#FF9F1C' }} /> Envio por link interativo</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#FF9F1C]" style={{ color: '#FF9F1C' }} /> Histórico de clientes no local</li>
                  <li className="flex items-center gap-2 text-zinc-700 strike font-medium">✕ Sem exportação em PDF</li>
                </ul>
              </div>
              <button 
                onClick={onStartClick} 
                className="w-full mt-8 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-850 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Criar Conta Grátis
              </button>
            </div>

            {/* Paid Tier Pro */}
            <div className="bg-[#2B2B2B] p-8 rounded-[32px] border-2 border-[#FF9F1C] shadow-2xl flex flex-col justify-between h-full relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 px-3.5 py-1 text-black font-extrabold text-[10px] rounded-full uppercase tracking-wider font-sans" style={{ backgroundColor: '#FF9F1C' }}>
                MAIS RECOMENDADO
              </div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  Plano Pro Comercial
                  <Sparkles className="w-4 h-4 text-[#FF9F1C] fill-[#FF9F1C]/20 animate-pulse" />
                </h3>
                <p className="text-xs text-zinc-400 mt-1">SaaS ilimitado para prestadores e agências</p>
                <div className="my-6">
                  <span className="text-5xl font-display font-extrabold text-white">R$ 59</span>
                  <span className="text-zinc-400 text-xs">,90 / mês</span>
                </div>
                <ul className="space-y-3.5 text-sm text-zinc-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Propostas comerciais ilimitadas</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Sincronização Google Sheets</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> WhatsApp com variáveis padrão</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Exportação de contratos e PDFs</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Personalização de cores e marca</li>
                </ul>
              </div>
              <button 
                onClick={onStartClick} 
                className="w-full mt-8 py-3.5 rounded-2xl text-black font-extrabold text-sm transition-all shadow-lg hover:scale-[1.01] active:scale-95 cursor-pointer"
                style={{ backgroundColor: '#FF9F1C' }}
              >
                Escalar Meus Contratos
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900 bg-[#111111]/95 text-left">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <HelpCircle className="w-10 h-10 text-[#FF9F1C] mx-auto mb-4" style={{ color: '#FF9F1C' }} />
            <p className="text-3xl font-sans font-black tracking-tight text-white text-center">Respostas rápidas</p>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
              <h4 className="font-bold text-base mb-2 text-white">Como meu cliente recebe e aprova o orçamento?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Você envia um link curto personalizado via WhatsApp. Ao clicar, o cliente acessa uma página adaptada onde confere os valores, notas explicativas e o botão de aprovação imediata. O dashboard atualiza instantaneamente.
              </p>
            </div>
            <div className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
              <h4 className="font-bold text-base mb-2 text-white">Posso testar sem compromisso de faturamento?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Sim! Você pode criar sua conta gratuitamente agora mesmo e fazer suas primeiras propostas comerciais sem custos para sentir a conversão no seu faturamento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 px-4 sm:px-6 lg:px-8 bg-[#111111] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-zinc-500 text-xs gap-6">
          <div className="flex items-center gap-2">
            <OrktoLogo size="sm" showSlogan={false} />
          </div>
          <p>© 2026 ORKTO — O orçamento antes da concorrência. Feito para empresas rápidas comercialmente.</p>
        </div>
      </footer>
    </div>
  );
}
