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

import { BackgroundPaths } from './ui/background-paths';
import { MagnetizeButton } from './ui/magnetize-button';

export default function LandingPage({ onStartClick, onDemoClick }: LandingPageProps) {
  // Phrases for premium TextScramble
  const scramblePhrases = [
    "Responda primeiro.",
    "Feche mais rápido.",
    "Velocidade fecha contrato.",
    "Antes da concorrência."
  ];

  const [selectedVariation, setSelectedVariation] = useState<number>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  
  const heroVariations = [
    {
      title: "Orçamentos em Segundos – Responda seus clientes antes da concorrência",
      subtitle: "Crie e envie orçamentos personalizados por WhatsApp, e-mail ou PDF automaticamente, sem complicação ou planilhas difíceis.",
      cta: "Comece Grátis",
      label: "✨ Padrão Principal",
      tagline: "Proposta de valor direta e infalível",
      accent: "#FF9F1C",
      bullets: [
        "⚡ Resposta Imediata: Envie seu orçamento em 1 clique, 24/7.",
        "📊 Controle Total: Acompanhe status e histórico de orçamentos em um painel único.",
        "💰 Mais Vendas: Conquiste até 30% mais clientes com follow-up automático."
      ]
    },
    {
      title: "Não Perca Mais Vendas — Orçamentos Prontos em Segundos",
      subtitle: "Responda instantaneamente pelo WhatsApp. Agilize seu fluxo, apresente seus serviços com requinte comercial e garanta a venda de imediato.",
      cta: "Começar Grátis",
      label: "🚨 Abordagem Urgência",
      tagline: "Ideal para capturar decisões de compra por impulso",
      accent: "#EF4444",
      bullets: [
        "⏱️ Menos de 60 segundos por proposta",
        "📲 Envie no WhatsApp direto para o celular do tomador",
        "🔥 Acabe com a procrastinação e vença o concorrente devagar"
      ]
    },
    {
      title: "Seja o 1º a Responder — Venda de Segunda!",
      subtitle: "Plataforma inteligente de orçamentos automáticos que desbanca métodos arcaicos. Dê ao seu cliente a proposta polida em minutos.",
      cta: "Começar Grátis",
      label: "📈 Diferencial Competitivo",
      tagline: "Destaca sua agilidade incomparável em 3 segundos",
      accent: "#3B82F6",
      bullets: [
        "🌐 Orçamentos interativos e elegantes sem complicação",
        "🎨 Use as cores de sua marca e logotipo personalizado",
        "🚀 3x mais fechamentos que propostas manuais por texto"
      ]
    },
    {
      title: "+500 empresas já automatizaram orçamentos conosco!",
      subtitle: "Junte-se a centenas de agências, freelancers e pequenas empresas que eliminaram horas perdidas em cotações e faturam mais.",
      cta: "Começar Grátis",
      label: "👥 Prova Social no Hero",
      tagline: "Usa o poder de autoridade e comunidade para converter",
      accent: "#10B981",
      bullets: [
        "⭐ Classificação de 4.9/5 estrelas de satisfação",
        "💼 Milhares de orçamentos gerados e aprovados",
        "🤝 Transmita o máximo de confiança profissional instantaneamente"
      ]
    },
    {
      title: "Aumente suas Vendas em Até 50% com Orçamentos Rápidos",
      subtitle: "Apresente propostas robustas, estruturadas e elegantes que elevam a percepção de valor dos seus serviços do agendamento à entrega.",
      cta: "Começar Grátis",
      label: "💲 Foco no Benefício",
      tagline: "Gera desejo direto através do crescimento financeiro",
      accent: "#F59E0B",
      bullets: [
        "📈 Aumento provado da taxa de fechamento e ticket médio",
        "🔄 Notas informativas antiobjeções já integradas",
        "💎 Visual Premium que faz você cobrar mais caro e fechar"
      ]
    },
    {
      title: "Acabe com a Burocracia — Orçamentos Instantâneos",
      subtitle: "Envie orçamentos profissionais via WhatsApp em apenas 3 passos práticos, sem planilhas ou burocracias desnecessárias.",
      cta: "Começar Grátis",
      label: "⚡ Chamada Direta",
      tagline: "Foca no passo a passo funcional e intuitivo",
      accent: "#8B5CF6",
      bullets: [
        "1️⃣ Digite o nome do cliente e escopo rápido",
        "2️⃣ Adicione seus serviços salvos do catálogo permanente",
        "3️⃣ Envie o link de aprovação direta com 1 clique"
      ]
    }
  ];

  const currentHero = heroVariations[selectedVariation];

  return (
    <div className="bg-[#111111] text-white min-h-screen font-sans selection:bg-[#FF9F1C]/20 selection:text-white relative overflow-hidden">
      
      {/* Background elegant grid/radial overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_100%)] opacity-35" />
      <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#FF9F1C]/10 via-transparent to-transparent pointer-events-none blur-3xl opacity-60" />

      {/* Header / Navigation */}
      <nav className="border-b border-[#2B2B2B] bg-[#111111]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-display">
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
      <BackgroundPaths>
        <section className="relative pt-16 pb-14 px-4 sm:px-6 lg:px-8 z-10 w-full">
          <div className="max-w-5xl mx-auto text-center">
            
            {/* Slogan pill heading */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2B2B2B] border border-zinc-800 rounded-full text-[10px] uppercase font-bold tracking-widest text-[#FF9F1C]/90 mb-6 select-none shadow-sm hover:shadow-orange-500/10 transition-all">
              <Zap className="w-3.5 h-3.5 text-[#FF9F1C]" />
              <span>O ORÇAMENTO DE ALTA CONVERSÃO PARA SEU SAAS & AGÊNCIA</span>
            </div>

            {/* Premium switcher for 5 Conversion-Optimized Hero Variations from PDF benchmarks */}
            <div className="mb-8 space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                💡 Testador de Testes A/B (Selecione uma das 6 variações de copy recomendadas no PDF):
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-zinc-950/80 rounded-2xl border border-zinc-900 max-w-4xl mx-auto">
                {heroVariations.map((v, idx) => (
                  <button
                    key={`v_${idx}`}
                    onClick={() => setSelectedVariation(idx)}
                    style={{ borderColor: selectedVariation === idx ? v.accent : 'transparent' }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border cursor-pointer select-none ${
                      selectedVariation === idx 
                        ? 'bg-[#1A1A1A] text-white shadow-md' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40 bg-transparent'
                    }`}
                  >
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 font-medium">
                Tip: <span className="text-[#FF9F1C] font-bold">{currentHero.tagline}</span> — Comprova como mudar o copy de topo altera os gatilhos mentais da landing!
              </p>
            </div>

            {/* Headline and dynamic text display using premium visual animation */}
            <motion.div
              key={`h_${selectedVariation}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h1 className="text-3xl sm:text-[2.8rem] lg:text-[3.25rem] font-display font-black tracking-tight leading-[1.12]">
                {currentHero.title}
              </h1>
              
              <div className="text-xs sm:text-sm font-bold flex justify-center items-center gap-2 text-zinc-400 h-6">
                <span>Promessa Principal:</span>
                <TextScramble phrases={scramblePhrases} />
              </div>

              <p className="text-[#D4D4D8] text-sm sm:text-lg max-w-3xl mx-auto leading-relaxed pt-2">
                {currentHero.subtitle}
              </p>
            </motion.div>

            {/* Interactive bullets corresponding to Section 5 from PDF benchmarks */}
            <motion.div 
              key={`b_${selectedVariation}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              className="mt-6 p-4 max-w-3xl mx-auto bg-zinc-950/45 border border-zinc-900 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-3 text-left shadow-sm"
            >
              {currentHero.bullets.map((bulletText, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2 h-auto">
                  <div className="w-5 h-5 rounded-full bg-[#FF9F1C]/10 flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${currentHero.accent}15` }}>
                    <Check className="w-3.5 h-3.5" style={{ color: currentHero.accent }} />
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold text-zinc-300 leading-snug">{bulletText}</span>
                </div>
              ))}
            </motion.div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mt-8">
              <MagnetizeButton 
                onClick={onStartClick} 
                className="w-full sm:w-auto h-auto px-8 py-4 rounded-2xl bg-[#FF9F1C] border-none text-black hover:text-black font-extrabold text-base transition-all flex items-center justify-center gap-2 hover:opacity-95 hover:bg-[#FF9F1C] active:scale-[0.98] cursor-pointer shadow-lg shadow-orange-500/10"
                particleCount={15}
              >
                {currentHero.cta}
                <ArrowRight className="w-5 h-5 ml-1 animate-pulse" />
              </MagnetizeButton>
              <button 
                onClick={onDemoClick} 
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#2B2B2B] hover:bg-[#3B3B3B] border border-zinc-800 text-white font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                Ver proposta modelo
              </button>
            </div>

            {/* Core Promise Badges */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-zinc-500 font-semibold select-none">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Zero atrito de login</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> WhatsApp imediato</span>
            </div>
          </div>
        </section>
      </BackgroundPaths>

      {/* Visual Live Preview Below Hero */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8 z-10 relative">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#2B2B2B] p-1.5 rounded-[24px] border border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="bg-[#111111] rounded-[18px] border border-zinc-800 p-4 sm:p-6 overflow-hidden">
              
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
            <div className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-800 flex flex-col justify-between hover:border-zinc-800 transition-all">
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
            <div className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-800 flex flex-col justify-between hover:border-zinc-800 transition-all">
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
            <div className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-800 flex flex-col justify-between hover:border-zinc-800 transition-all">
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

      {/* Premium Proven Results & Social Proof Section */}
      <section className="py-20 border-t border-zinc-900 bg-zinc-950/40 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF9F1C]/2 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto z-10 relative">
          <div className="text-center mb-16">
            <h2 className="uppercase text-[#FF9F1C] font-bold tracking-[0.2em] text-xs mb-3">
              RESULTADOS COMPROVADOS NO WHATSAPP
            </h2>
            <p className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">O que dizem os SaaS & Negócios Rápidos</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-zinc-850 shadow-xl relative overflow-hidden group hover:border-[#FF9F1C]/40 transition-all">
              <span className="absolute -top-6 -right-6 text-9xl font-serif text-zinc-800/10 select-none">“</span>
              <div className="flex gap-1.5 mb-4 text-[#FF9F1C]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#FF9F1C]" />
                ))}
              </div>
              <p className="text-sm font-bold text-white mb-6 leading-relaxed">
                "Duplicamos nossa taxa de fechamento usando o ORKTO. O cliente recebe no WhatsApp o link limpo da proposta e fecha na hora."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center font-display font-black text-xs text-[#FF9F1C] border border-[#FF9F1C]/20">
                  DF
                </div>
                <div>
                  <p className="text-xs font-bold text-white">DevFlow Technologies</p>
                  <p className="text-[10px] text-zinc-500 font-medium font-sans">SaaS de Gestão e Software</p>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-zinc-855 shadow-xl relative overflow-hidden group hover:border-[#FF9F1C]/40 transition-all">
              <span className="absolute -top-6 -right-6 text-9xl font-serif text-zinc-800/10 select-none">“</span>
              <div className="flex gap-1.5 mb-4 text-[#FF9F1C]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#FF9F1C]" />
                ))}
              </div>
              <p className="text-sm font-bold text-white mb-6 leading-relaxed">
                "Cerca de 80% dos leads iniciam conversa pelo WhatsApp antes de finalizar o orçamento. Ter o ORKTO agilizou 100% esse funil."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center font-display font-black text-xs text-blue-400 border border-blue-500/20">
                  XP
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Agência Nexo Digital</p>
                  <p className="text-[10px] text-zinc-500 font-medium font-sans">Marketing & Tráfego Pago</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#FF9F1C]/5 border border-[#FF9F1C]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="text-xs font-extrabold text-[#FF9F1C] uppercase tracking-widest">Estatística CRO</p>
              <h4 className="text-lg font-bold text-white mt-1">Mais de 500 mil empresas e negócios locais confiam na ORKTO</h4>
            </div>
            <button 
              onClick={onStartClick}
              className="px-5 py-2.5 bg-[#FF9F1C] hover:opacity-90 text-black text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              Começar Teste Sem Cartão
            </button>
          </div>
        </div>
      </section>

      {/* Pricing / Planos de Conversão */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900 bg-[#111111]/90">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[#FF9F1C] uppercase tracking-widest text-[10px] font-extrabold mb-3">Escolha de Forma Racional (Ou Quase Isso...)</h2>
            <p className="text-3xl sm:text-5xl font-sans font-black tracking-tight mb-4 text-white">Planos Sob Medida</p>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto">
              Economize <span className="text-[#FF9F1C] font-bold">35% do seu tempo comercial</span> enviando propostas estruturadas em segundos.
            </p>

            {/* Premium Billing Cycle Selector */}
            <div className="mt-8 flex justify-center items-center gap-3">
              <span className={`text-xs font-bold transition-all ${billingCycle === 'monthly' ? 'text-[#FF9F1C]' : 'text-zinc-400'}`}>COBRANÇA MENSAL</span>
              <button 
                onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'annual' : 'monthly')}
                className="w-14 h-7 rounded-full bg-zinc-900 border border-zinc-800 p-0.5 relative transition-all duration-300 focus:outline-none cursor-pointer"
                aria-label="Toggle billing cycle"
              >
                <div 
                  className="w-6 h-6 rounded-full bg-[#FF9F1C] shadow-md transition-transform duration-300"
                  style={{ transform: billingCycle === 'annual' ? 'translateX(1.65rem)' : 'none' }}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold transition-all ${billingCycle === 'annual' ? 'text-[#FF9F1C]' : 'text-zinc-400'}`}>
                  OFERTA ANUAL 👑
                </span>
                <span className="px-2 py-0.5 bg-[#FF9F1C]/10 text-[#FF9F1C] border border-[#FF9F1C]/25 text-[9px] font-extrabold rounded-full tracking-wider">
                  2 MESES GRÁTIS
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mt-12">
            {/* Starter Tier */}
            <div className="bg-[#2B2B2B]/40 p-6 sm:p-8 rounded-[32px] border border-zinc-850 hover:border-zinc-800/80 transition-all flex flex-col justify-between h-full relative">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟠</span>
                  <h3 className="text-lg font-bold text-zinc-300">ORKTO Starter</h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Para autônomos e pequenas empresas.</p>
                <div className="my-6">
                  {billingCycle === 'monthly' ? (
                    <>
                      <span className="text-4xl font-display font-black text-white">R$ 79</span>
                      <span className="text-zinc-500 text-xs font-semibold"> / mês</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-display font-black text-white">R$ 790</span>
                      <span className="text-zinc-500 text-xs font-semibold"> / ano</span>
                      <div className="text-[10px] text-emerald-500 font-bold mt-1.5 flex items-center gap-1">
                        <span>💰 Economiza R$ 158</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px]">2 meses grátis</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="h-[1px] bg-zinc-850 w-full mb-5" />
                <ul className="space-y-3 text-xs sm:text-sm text-zinc-400">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> Clientes ilimitados</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> Orçamentos ilimitados</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> PDFs profissionais</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> Envio por WhatsApp</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> Templates básicos</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> Dashboard simples</li>
                </ul>
              </div>
              <button 
                onClick={onStartClick} 
                className="w-full mt-8 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-850 text-white hover:bg-zinc-850 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Começar Starter Grátis
              </button>
            </div>

            {/* PRO Tier (Highlighted) */}
            <div className="bg-[#1A1A1A] p-6 sm:p-8 rounded-[32px] border-2 border-[#FF9F1C] shadow-2xl shadow-orange-500/5 hover:shadow-orange-500/10 transition-all flex flex-col justify-between h-full relative z-10">
              <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-[#FF9F1C] to-amber-500 text-black font-extrabold text-[9px] px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap shadow-md">
                ⭐ MAIS POPULAR
              </div>
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  ORKTO Pro
                  <Sparkles className="w-4 h-4 text-[#FF9F1C] fill-[#FF9F1C]/20 animate-pulse" />
                </h3>
                <p className="text-xs text-zinc-400 mt-1">SaaS de alto impacto para agências e consultores</p>
                <div className="my-6">
                  {billingCycle === 'monthly' ? (
                    <>
                      <span className="text-5xl font-display font-black text-white">R$ 149</span>
                      <span className="text-zinc-400 text-xs font-semibold"> / mês</span>
                    </>
                  ) : (
                    <>
                      <span className="text-5xl font-display font-black text-white">R$ 1.490</span>
                      <span className="text-zinc-400 text-xs font-semibold"> / ano</span>
                      <div className="text-[10px] text-emerald-500 font-bold mt-1.5 flex items-center gap-1">
                        <span>💰 Economiza R$ 298</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px]">2 meses grátis</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="h-[1px] bg-zinc-800 w-full mb-5" />
                <p className="text-[10px] font-extrabold tracking-widest text-[#FF9F1C] uppercase mb-3">TUDO DO STARTER +</p>
                <ul className="space-y-3 text-xs sm:text-sm text-zinc-200">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> <strong>IA para criar orçamentos</strong></li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Identidade visual personalizada</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Página pública do orçamento</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Analytics completo</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Histórico completo</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Métricas de conversão</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Dashboard avançado</li>
                </ul>
              </div>
              <button 
                onClick={onStartClick} 
                className="w-full mt-8 py-4 rounded-2xl text-black font-extrabold text-xs sm:text-sm transition-all hover:opacity-95 shadow-lg relative overflow-hidden group/btn cursor-pointer"
                style={{ backgroundColor: '#FF9F1C' }}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10">Adquirir Plano Pro</span>
              </button>
            </div>

            {/* Business Tier */}
            <div className="bg-[#2B2B2B]/40 p-6 sm:p-8 rounded-[32px] border border-zinc-850 hover:border-zinc-800/80 transition-all flex flex-col justify-between h-full relative">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <h3 className="text-lg font-bold text-zinc-300">ORKTO Business</h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Soluções multiusuário para times em escala</p>
                <div className="my-6">
                  {billingCycle === 'monthly' ? (
                    <>
                      <span className="text-4xl font-display font-black text-white">R$ 299</span>
                      <span className="text-zinc-500 text-xs font-semibold"> / mês</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-display font-black text-white">R$ 2.990</span>
                      <span className="text-zinc-500 text-xs font-semibold"> / ano</span>
                      <div className="text-[10px] text-emerald-500 font-bold mt-1.5 flex items-center gap-1">
                        <span>💰 Economiza R$ 598</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px]">2 meses grátis</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="h-[1px] bg-zinc-850 w-full mb-5" />
                <p className="text-[10px] font-extrabold tracking-widest text-[#FF9F1C] uppercase mb-3">TUDO DO PRO +</p>
                <ul className="space-y-3 text-xs sm:text-sm text-zinc-400">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Equipe multiusuário</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Permissões avançadas</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" /> Aprovação de orçamentos</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Integrações e API</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Relatórios avançados</li>
                </ul>
              </div>
              <button 
                onClick={onStartClick} 
                className="w-full mt-8 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-850 text-white hover:bg-zinc-850 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Iniciar Plano Business
              </button>
            </div>
          </div>

          {/* Psychology Decoy Insight Box */}
          <div className="mt-12 max-w-2xl mx-auto p-5 rounded-2xl bg-[#FF9F1C]/5 border border-[#FF9F1C]/15 flex items-start gap-3.5 text-left">
            <span className="text-xl">💡</span>
            <div className="space-y-1">
              <p className="text-xs font-extrabold text-[#FF9F1C] uppercase tracking-wider">Estratégia Psicológica Opcional</p>
              <p className="text-[11px] text-zinc-400 leading-normal">
                O <strong>Starter</strong> existe para você ver seu potencial sem medos. O <strong>Business</strong> existe com recursos robustos corporativos. O resultado? O <strong>Plano Pro</strong> se apresenta como a escolha inteligente e de maior retorno sobre investimento racional <strong>(repare como é fácil decidir)</strong>. 😉
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900 bg-[#111111]/95 text-left">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <HelpCircle className="w-10 h-10 text-[#FF9F1C] mx-auto mb-4" style={{ color: '#FF9F1C' }} />
            <p className="text-3xl font-sans font-black tracking-tight text-white text-center">Perguntas Frequentes</p>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
              <h4 className="font-bold text-base mb-2 text-white">Como começo sem cartão de crédito?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Você tem 14 dias grátis para criar orçamentos e testar todas as funcionalidades premium sem cobrar absolutamente nada de você.
              </p>
            </div>
            <div className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
              <h4 className="font-bold text-base mb-2 text-white">Preciso de cartão de crédito para testar?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                <strong>Resposta: Não!</strong> Nosso período de avaliação é livre de burocracias ou cadastros de cartões.
              </p>
            </div>
            <div className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
              <h4 className="font-bold text-base mb-2 text-white">Como o ORKTO integra com o WhatsApp?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Nossa integração é feita via link otimizado direto com variáveis personalizadas. Você pode encaminhar propostas profissionais em 1 clique.
              </p>
            </div>
            <div className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
              <h4 className="font-bold text-base mb-2 text-white">Tenho suporte especializado?</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                <strong>Sim, suporte 24/7!</strong> Estamos prontos para responder qualquer dúvida técnica e te ajudar a otimizar ao máximo suas taxas de conversão.
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
