import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, Check, HelpCircle, Zap, ShieldCheck, Smartphone,
  TrendingUp, Search, Bell, MessageSquare, Lock, Sparkles, Layers, Star, DollarSign, X
} from 'lucide-react';
import OrktoLogo from './OrktoLogo';
import { PLAN_CATALOG } from '../lib/plans';

interface LandingPageProps {
  onStartClick: () => void;
  onDemoClick: () => void;
}

import { BackgroundPaths } from './ui/background-paths';
import { MagnetizeButton } from './ui/magnetize-button';

/* ===== Demo animada do fluxo ORKTO ===== */
function AnimatedDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= 11) {
      const t = setTimeout(() => setStep(0), 3000);
      return () => clearTimeout(t);
    }
    const delays = [800, 600, 400, 600, 400, 500, 400, 500, 600, 400, 400];
    const t = setTimeout(() => setStep(s => s + 1), delays[step] || 600);
    return () => clearTimeout(t);
  }, [step]);

  const messages = [
    { side: "left", text: "Quanto fica pra pintar 2 quartos?", time: "14:23", icon: "👤" },
    { side: "right", text: "Ajustando o tom...", time: "14:23", typing: true },
    { side: "right", text: "Pintura 2 quartos (30m²) — R$ 1.200", time: "14:24", highlight: true },
    { side: "right", text: "• Tinta acrílica premium\n• 2 demãos\n• Inclui material\n• Garantia 6 meses", time: "14:24", small: true },
    { side: "right", text: "💸 Prazo: 5x sem juros ou 5% à vista", time: "14:24", small: true },
    { side: "right", text: "📲 Enviando via WhatsApp...", time: "14:24" },
    { side: "right", text: "✅ Enviado para (11) 99999-8888", time: "14:25" },
    { side: "left", text: "Aprovado! Vou pagar no PIX 😃", time: "14:27", icon: "😃" },
    { side: "right", text: "Link PIX gerado!", time: "14:27" },
    { side: "right", text: "💚 R$ 1.140 recebidos (5% off)", time: "14:28", payment: true },
    { side: "center", text: "🎯 Orçamento convertido em 5 min!", time: "", badge: true },
  ];

  return (
    <section className="pb-24 px-4 sm:px-6 lg:px-8 z-10 relative">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#2B2B2B] p-1.5 rounded-[24px] border border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="bg-[#0D0D0D] rounded-[18px] border border-zinc-800 overflow-hidden">
            
            {/* Phone header */}
            <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center text-xs font-bold">O</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">ORKTO — Orçamento</p>
                <p className="text-[10px] text-[#DCF8C6]/70">online • proposta em edição</p>
              </div>
              <Smartphone className="w-4 h-4 text-[#DCF8C6]/70" />
            </div>

            {/* Chat area */}
            <div className="bg-[#0B141A] bg-[radial-gradient(#1f2c33_1px,transparent_1px)] bg-[size:20px_20px] p-4 min-h-[320px] max-h-[340px] overflow-y-auto flex flex-col gap-2.5">
              {messages.map((msg, i) => {
                if (i > step) return null;
                const align = msg.side === "left" ? "items-start" : msg.side === "right" ? "items-end" : "items-center";
                const bg = msg.highlight ? "bg-gradient-to-r from-[#FF9F1C] to-[#e88e0f] text-black" :
                           msg.payment ? "bg-gradient-to-r from-[#25D366] to-[#1DA851] text-white" :
                           msg.badge ? "bg-[#FF9F1C]/10 text-[#FF9F1C] border border-[#FF9F1C]/20" :
                           msg.typing ? "bg-zinc-800/50 text-zinc-300" :
                           msg.small ? "bg-zinc-800/30 text-zinc-300 text-xs" :
                           msg.side === "left" ? "bg-[#1F2C33] text-white" : "bg-[#005C4B] text-white";
                const rounded = msg.side === "center" ? "rounded-full" : "rounded-2xl px-4 py-2.5";
                const maxW = msg.badge ? "" : msg.small ? "max-w-[75%]" : "max-w-[80%]";

                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={`flex flex-col ${align} w-full ${msg.side === "center" ? "" : "max-w-[85%]"}`}>
                    {msg.icon && <span className="text-lg mb-0.5">{msg.icon}</span>}
                    {msg.typing ? (
                      <div className={`${bg} ${rounded} ${maxW} flex items-center gap-1.5`}>
                        <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        <span className="text-[10px] text-zinc-400 ml-1">Ajustando texto...</span>
                      </div>
                    ) : (
                      <div className={`${bg} ${rounded} ${maxW} ${msg.small ? 'py-1.5 px-3 leading-relaxed' : 'leading-relaxed'} whitespace-pre-line`}>
                        {msg.text}
                      </div>
                    )}
                    {msg.time && <span className="text-[9px] text-zinc-600 mt-0.5">{msg.time}</span>}
                  </motion.div>
                );
              })}
            </div>

            {/* Fake input bar */}
            <div className="bg-[#1F2C33] px-3 py-2 flex items-center gap-2">
              <div className="flex-1 bg-[#2A3942] rounded-lg px-3 py-2 text-xs text-zinc-400">
                {step < 1 ? "Digite sua mensagem..." : "Conversa finalizada ✅"}
              </div>
              <div className="w-9 h-9 rounded-full bg-[#FF9F1C] flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-black" />
              </div>
            </div>

          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-5 mt-6">
          {[
            { icon: <MessageSquare className="w-4 h-4" />, label: "Cliente pergunta" },
            { icon: <Zap className="w-4 h-4" />, label: "Orçamento em minutos" },
            { icon: <Smartphone className="w-4 h-4" />, label: "Envia WhatsApp" },
            { icon: <DollarSign className="w-4 h-4" />, label: "Aprova + PIX" },
          ]            .map((s, i) => {
            const msgIndexes = [0, 1, 6, 9];
            const active = step >= msgIndexes[i];
            return (
              <div key={i} className={`flex items-center gap-1 sm:gap-2 transition-all ${active ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${active ? 'bg-[#FF9F1C] text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                  {active ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : i + 1}
                </div>
                <span className={`text-[9px] sm:text-[10px] font-bold tracking-wide hidden sm:block ${active ? 'text-[#FF9F1C]' : 'text-zinc-500'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({ onStartClick, onDemoClick }: LandingPageProps) {

  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();
    onStartClick();
  };

  return (
    <div className="bg-[#111111] text-white min-h-screen font-sans selection:bg-[#FF9F1C]/20 selection:text-white relative overflow-hidden">
      
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_100%)] opacity-35" />
      <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#FF9F1C]/10 via-transparent to-transparent pointer-events-none blur-3xl opacity-60" />

      {/* Nav */}
      <nav className="border-b border-[#2B2B2B] bg-[#111111]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <OrktoLogo size="md" showSlogan={false} />
          <div className="flex items-center gap-4">
            <button onClick={onStartClick} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer">Entrar</button>
            <button onClick={onStartClick} className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#FF9F1C] text-black hover:opacity-95 transition-all shadow-lg active:scale-95 cursor-pointer">
              Começar Grátis
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <BackgroundPaths>
        <section className="relative pt-16 pb-14 px-4 sm:px-6 lg:px-8 z-10 w-full">
          <div className="max-w-5xl mx-auto text-center">

            {/* Pill badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-6 select-none">
              <Sparkles className="w-3.5 h-3.5" />
              <span>4 TONS DE COMUNICAÇÃO</span>
            </div>

            {/* Hero title — sells consequence, not feature */}
            <h1 className="text-3xl sm:text-[2.8rem] lg:text-[3.25rem] font-display font-black tracking-tight leading-[1.12] max-w-4xl mx-auto">
              Crie orçamentos <span className="text-[#FF9F1C]">profissionais em segundos</span> e responda seus clientes antes da concorrência.
            </h1>

            <p className="text-[#D4D4D8] text-sm sm:text-lg max-w-3xl mx-auto leading-relaxed mt-4">
              Monte, envie pelo WhatsApp e acompanhe a aprovação dos seus orçamentos em um só lugar.
            </p>

            {/* CTAs */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-center gap-4 max-w-lg lg:max-w-2xl mx-auto mt-8">
              <MagnetizeButton
                onClick={handleStart}
                className="w-full lg:w-auto min-h-14 px-5 sm:px-7 py-3.5 rounded-2xl !bg-violet-600 dark:!bg-violet-600 border-violet-400/30 !text-white hover:!bg-violet-500 dark:hover:!bg-violet-500 hover:!text-white font-extrabold text-sm sm:text-base active:scale-[0.98] cursor-pointer shadow-lg shadow-violet-950/30"
                particleCount={15}
              >
                <span className="flex flex-col sm:block leading-tight">
                  <span>Criar meu primeiro</span>{' '}
                  <span>orçamento grátis</span>
                </span>
                <ArrowRight className="w-5 h-5 shrink-0 animate-pulse" />
              </MagnetizeButton>
              <button
                onClick={onDemoClick}
                className="w-full lg:w-auto min-h-14 px-6 sm:px-8 py-3.5 rounded-2xl bg-[#2B2B2B] hover:bg-[#3B3B3B] border border-zinc-700 text-white font-bold text-sm sm:text-base transition-all active:scale-[0.98] cursor-pointer"
              >
                Ver proposta modelo
              </button>
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-zinc-500 font-semibold select-none">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Textos profissionais sem custo por uso</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> WhatsApp imediato</span>
            </div>

          </div>
        </section>
      </BackgroundPaths>

      {/* ===== DEMO ANIMADA ===== */}
      <AnimatedDemo />

      {/* ===== ANTES vs DEPOIS ===== */}
      <section className="py-20 border-t border-zinc-900 bg-zinc-950/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="uppercase text-[#FF9F1C] font-bold tracking-[0.2em] text-xs mb-3">A REALIDADE DE QUEM AINDA FAZ MANUAL</h2>
            <p className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">Antes e Depois do ORKTO</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ANTES */}
            <div className="bg-red-950/20 border border-red-900/30 rounded-3xl p-8">
              <p className="text-xs font-extrabold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <X className="w-4 h-4" /> Antes (Manual)
              </p>
              <ul className="space-y-3 text-sm text-zinc-400">
                {[
                  '💬 Cliente pergunta no WhatsApp',
                  '⏰ Você abre o Word/Google Docs',
                  '📝 Digita item por item',
                  '📎 Converte pra PDF',
                  '📤 Envia por WhatsApp (arquivo pesado)',
                  '⏳ Espera o cliente abrir',
                  '❌ Cliente pede alteração',
                  '🔄 Repete o ciclo',
                  '😫 Perde a venda pra quem respondeu primeiro',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-red-300/80"><X className="w-3 h-3 text-red-500 shrink-0" />{item.replace('❌ ', '').replace('🔄 ', '').replace('😫 ', '')}</li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-red-900/20">
                <p className="text-xs font-bold text-red-400">Resultado: <span className="text-red-300/80">Horas perdidas. Vendas escapando.</span></p>
              </div>
            </div>

            {/* DEPOIS */}
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-3xl p-8">
              <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Check className="w-4 h-4" /> Depois (ORKTO)
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  '💬 Cliente pergunta no WhatsApp',
                  '⚡ Você abre o ORKTO',
                  '✍️ Modelos de texto aprimoram o orçamento',
                  '📲 Envia link por WhatsApp (leve, rápido)',
                  '👁️ Cliente abre e vê tudo online',
                  '✅ Cliente aprova com 1 clique',
                  '💳 Paga via PIX na hora',
                  '📊 Você recebe notificação',
                  '💰 Venda fechada em <30 segundos',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-emerald-300/90"><Check className="w-3 h-3 text-emerald-500 shrink-0" />{item.replace('⚡ ', '').replace('🤖 ', '').replace('📲 ', '').replace('👁️ ', '').replace('✅ ', '').replace('💳 ', '').replace('📊 ', '').replace('💰 ', '')}</li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-emerald-900/20">
                <p className="text-xs font-bold text-emerald-400">Resultado: <span className="text-emerald-300/80">Venda fechada em segundos. Cliente feliz.</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== APRIMORAMENTO DE TEXTO ===== */}
      <section className="py-20 border-t border-zinc-900 bg-[#111111] px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF9F1C]/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>APRIMORAMENTO LOCAL DE TEXTO</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">
              Escolha o tom e aprimore seu orçamento
            </h2>
            <p className="text-zinc-400 text-sm max-w-2xl mx-auto mt-4 leading-relaxed">
              Digite o serviço, escolha o tom e o ORKTO organiza valores, descrições e a proposta completa.
              Você mantém controle total: revise e edite o texto antes de enviar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Mock AI */}
            <div className="bg-[#2B2B2B]/70 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">WIA — Assistente de texto</p>
                  <p className="text-[9px] text-zinc-500">Aprimorando proposta...</p>
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/50 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-zinc-400 font-bold w-16 shrink-0">Você:</span>
                  <span className="text-xs text-white">"Orçamento para pintar 3 cômodos, paredes 50m², tinta acrílica premium"</span>
                </div>
                <div className="h-px bg-zinc-800" />
                <div className="flex items-start gap-2">
                  <span className="text-xs text-emerald-400 font-bold w-16 shrink-0">ORKTO:</span>
                  <span className="text-xs text-zinc-200">Pronto! 3 itens gerados: mão de obra, materiais, acabamento. Total: R$ 2.450,00. <span className="text-emerald-400">Enviar no WhatsApp →</span></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/50">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider">Tom</p>
                  <p className="text-white font-bold">Comercial</p>
                </div>
                <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/50">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider">Profissão</p>
                  <p className="text-white font-bold">Pintor</p>
                </div>
              </div>
              <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
                ✨ Aprimorar texto
              </button>
            </div>

            {/* Benefits */}
            <div className="space-y-5">
              {[
                { icon: <Check className="w-5 h-5 text-emerald-400" />, title: "Sem custo por uso", desc: "Modelos locais funcionam sem créditos e sem cobranças extras." },
                { icon: <Check className="w-5 h-5 text-emerald-400" />, title: "Adaptado à sua profissão", desc: "Advogado, eletricista, designer ou mecânico — textos adequados a cada área." },
                { icon: <Check className="w-5 h-5 text-emerald-400" />, title: "4 tons de voz", desc: "Comercial, Técnico, Formal ou Criativo — você escolhe e ainda pode editar." },
                { icon: <Check className="w-5 h-5 text-emerald-400" />, title: "Cálculos protegidos", desc: "O servidor soma itens, aplica descontos e confirma o total antes de salvar." },
                { icon: <Check className="w-5 h-5 text-emerald-400" />, title: "Pronto pra Fechar", desc: "Cliente aprova online, assina digital e paga via PIX. Tudo integrado." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">{item.icon}</div>
                  <div><h4 className="text-sm font-bold text-white">{item.title}</h4><p className="text-xs text-zinc-400 mt-0.5">{item.desc}</p></div>
                </div>
              ))}
              <button onClick={onStartClick} className="w-full mt-4 py-3.5 bg-[#FF9F1C] hover:opacity-90 text-black font-extrabold text-sm rounded-2xl transition-all shadow-lg cursor-pointer">
                Começar Grátis
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SISTEMA OPERACIONAL DE VENDAS ===== */}
      <section className="py-20 border-t border-zinc-900 bg-zinc-950/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF9F1C]/10 border border-[#FF9F1C]/20 rounded-full text-[10px] uppercase font-bold tracking-widest text-[#FF9F1C] mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>MAIS QUE UM GERADOR DE ORÇAMENTO</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white max-w-3xl mx-auto">
            O sistema operacional de vendas para prestadores de serviço
          </h2>
          <p className="text-zinc-400 text-sm max-w-2xl mx-auto mt-4 leading-relaxed">
            ORKTO não é só um gerador de orçamento. É a plataforma que centraliza toda a operação comercial de quem vende serviços.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12 text-left">
            {[
              { icon: <Zap className="w-4 h-4" />, title: "Textos por tom", desc: "Aprimora orçamentos sem serviços externos" },
              { icon: <MessageSquare className="w-4 h-4" />, title: "WhatsApp", desc: "Envio em 1 clique com link interativo" },
              { icon: <Check className="w-4 h-4" />, title: "Aprovação Digital", desc: "Cliente aprova online com 1 toque" },
              { icon: <DollarSign className="w-4 h-4" />, title: "PIX integrado", desc: "Pagamento na hora, sem burocracia" },
              { icon: <Smartphone className="w-4 h-4" />, title: "Catálogo", desc: "Serviços salvos com preço fixo" },
              { icon: <TrendingUp className="w-4 h-4" />, title: "Dashboard", desc: "Métricas de conversão em tempo real" },
              { icon: <Bell className="w-4 h-4" />, title: "Follow-up Auto", desc: "Notifica quando cliente abre" },
              { icon: <ShieldCheck className="w-4 h-4" />, title: "Assinatura Digital", desc: "Contrato com validade jurídica" },
            ].map((item, i) => (
              <div key={i} className="bg-[#2B2B2B]/40 p-4 rounded-2xl border border-zinc-800 hover:border-[#FF9F1C]/30 transition-all group">
                <div className="w-8 h-8 rounded-xl bg-[#FF9F1C]/10 flex items-center justify-center mb-3 text-[#FF9F1C] group-hover:scale-110 transition-transform">{item.icon}</div>
                <h4 className="text-xs font-bold text-white mb-0.5">{item.title}</h4>
                <p className="text-[10px] text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section className="py-20 border-t border-zinc-900 bg-[#111111] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="uppercase text-[#FF9F1C] font-bold tracking-[0.2em] text-xs mb-3">FLUXO COMERCIAL</h2>
            <p className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">Três passos para organizar seu atendimento.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Smartphone className="w-6 h-6 text-[#FF9F1C]" />, num: "01", title: "Crie o orçamento", desc: "Digite o serviço, escolha o tom e revise a proposta completa." },
              { icon: <MessageSquare className="w-6 h-6 text-emerald-500" />, num: "02", title: "Envia por WhatsApp", desc: "Link interativo e leve. Cliente abre no celular sem baixar nada." },
              { icon: <ShieldCheck className="w-6 h-6 text-amber-500" />, num: "03", title: "Cliente aprova e paga", desc: "Aprovação digital com 1 clique. PIX integrado. Você recebe notificação na hora." },
            ].map((item, i) => (
              <div key={i} className="bg-[#2B2B2B]/40 p-8 rounded-3xl border border-zinc-800 flex flex-col justify-between hover:border-zinc-800 transition-all group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FF9F1C]/10 flex items-center justify-center mb-6">{item.icon}</div>
                  <h3 className="text-lg font-bold mb-3 text-white">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
                <span className="text-zinc-800 text-5xl font-extrabold select-none mt-6 font-mono">{item.num}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEITO PARA OFICINAS ===== */}
      <section className="py-20 border-t border-zinc-900 bg-[#111111] px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-4">
              <span>🛞 OFICINAS & MECÂNICOS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">
              Seu orçamento sai em <span className="text-emerald-400">30 segundos</span>
            </h2>
            <p className="text-zinc-400 text-sm max-w-2xl mx-auto mt-4 leading-relaxed">
              Chega de cliente esperando horas pelo orçamento. Com o ORKTO você cadastra serviços e preços, aprimora a proposta e envia pelo WhatsApp — tudo em poucos minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🔧", title: "Serviços com preço fixo", desc: "Cadastre mão de obra, peças e revisões; o ORKTO calcula tudo com segurança." },
              { icon: "📱", title: "Orçamento via WhatsApp", desc: "Cliente recebe o link, vê os itens, aprova e paga. Sem precisar voltar na oficina." },
              { icon: "📋", title: "Histórico por Veículo", desc: "Veja todo o histórico de serviços de cada cliente. Mais controle e profissionalismo." },
            ].map((item, i) => (
              <div key={i} className="bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800 hover:border-emerald-500/30 transition-all group text-left">
                <span className="text-3xl block mb-4">{item.icon}</span>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <button onClick={onStartClick} className="inline-flex items-center gap-2 py-3.5 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg cursor-pointer">
              Começar Grátis
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== DEPOIMENTOS ===== */}
      <section className="py-20 border-t border-zinc-900 bg-zinc-950/40 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF9F1C]/2 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="uppercase text-[#FF9F1C] font-bold tracking-[0.2em] text-xs mb-3">QUEM USA, VENDE MAIS</h2>
            <p className="text-3xl sm:text-4xl font-sans font-black tracking-tight text-white">O que dizem os profissionais</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {[
              { initials: "RF", color: "orange", name: "Ricardo Farias", role: "Eletricista • SP", text: "Antes eu perdia cliente porque demorava pra fazer orçamento. Hoje com o ORKTO eu respondo em segundos. Minha taxa de fechamento subiu 40%." },
              { initials: "AP", color: "blue", name: "Ana Paula", role: "Designer • RJ", text: "Escolho o tom, reviso e mando. O orçamento fica organizado e economizo muito tempo no dia." },
              { initials: "JM", color: "emerald", name: "João Marcos", role: "Mecânico • MG", text: "O cliente aprova na hora pelo link do WhatsApp. Já fechei serviço de R$ 3.500 sem o cliente sair de casa." },
              { initials: "LS", color: "purple", name: "Luciana Santos", role: "Advogada • DF", text: "Uso o tom formal e ajusto os detalhes. A proposta fica profissional e os clientes elogiam." },
            ].map((item, i) => {
              const colorMap: Record<string, string> = { orange: 'bg-orange-500/10 text-[#FF9F1C] border-[#FF9F1C]/20', blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20', emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
              return (
                <div key={i} className="p-8 rounded-[32px] bg-zinc-900/40 border border-zinc-850 shadow-xl relative overflow-hidden group hover:border-[#FF9F1C]/40 transition-all">
                  <span className="absolute -top-6 -right-6 text-9xl font-serif text-zinc-800/10 select-none">"</span>
                  <div className="flex gap-1.5 mb-4 text-[#FF9F1C]">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-[#FF9F1C]" />)}
                  </div>
                  <p className="text-sm font-bold text-white mb-6 leading-relaxed">"{item.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${colorMap[item.color].split(' ')[0]} flex items-center justify-center font-display font-black text-xs ${colorMap[item.color].split(' ')[1]} border ${colorMap[item.color].split(' ')[2]}`}>
                      {item.initials}
                    </div>
                    <div><p className="text-xs font-bold text-white">{item.name}</p><p className="text-[10px] text-zinc-500">{item.role}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== PREÇOS ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900 bg-[#111111]/90">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[#FF9F1C] uppercase tracking-widest text-[10px] font-extrabold mb-3">INVESTIMENTO</h2>
            <p className="text-3xl sm:text-5xl font-sans font-black tracking-tight mb-4 text-white">Planos Sob Medida</p>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto">
              Economize <span className="text-[#FF9F1C] font-bold">tempo no processo comercial</span> com propostas organizadas e fáceis de enviar.
            </p>

            <p className="mt-6 text-sm text-zinc-400">Standard gratuito. Orçamentos disponíveis por 14 dias após envio. Pro e Business permitem prorrogar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {PLAN_CATALOG.map(plan => (
              <article key={plan.id} className={'rounded-3xl border p-6 sm:p-8 flex flex-col bg-zinc-900 ' + (plan.popular ? 'border-orange-400' : 'border-zinc-700')}>
                <h3 className="text-xl font-bold text-white">ORKTO {plan.name}</h3>
                <p className="my-6 text-4xl font-black text-white">{plan.price === 0 ? 'Grátis' : 'R$ ' + plan.price / 100}{plan.price > 0 && <span className="text-sm font-normal text-zinc-400">/mês</span>}</p>
                <ul className="space-y-3 text-sm text-zinc-300 flex-1">{plan.features.map(feature => <li key={feature} className="flex gap-2"><Check size={18} className="text-orange-400 shrink-0" />{feature}</li>)}</ul>
                <button onClick={onStartClick} className="mt-8 w-full rounded-xl bg-orange-400 text-zinc-950 py-3 font-bold">{plan.price === 0 ? 'Começar grátis' : 'Criar conta para assinar'}</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900 bg-[#111111]/95 text-left">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <HelpCircle className="w-10 h-10 text-[#FF9F1C] mx-auto mb-4" />
            <p className="text-3xl font-sans font-black tracking-tight text-white">Perguntas Frequentes</p>
          </div>
          <div className="space-y-6">
            {[
              { q: "Como começo sem cartão de crédito?", a: "Crie sua conta no Standard gratuito, com até 5 propostas ativas. Baixe seus orçamentos antes da exclusão, 14 dias após o envio. Pro e Business permitem prorrogar o prazo." },
              { q: "O que é a WIA?", a: 'A WIA ajuda a aprimorar a redação do orçamento com modelos locais. Você escolhe o tom, revisa e pode editar o resultado antes de enviar.' },
              { q: "O aprimoramento de texto tem custo por uso?", a: "Não. Os textos são gerados por modelos locais do ORKTO, sem IA externa, créditos ou cobrança por uso." },
              { q: "Como funciona o envio por WhatsApp?", a: "O ORKTO gera um link interativo leve. Você envia no WhatsApp e o cliente abre no celular sem baixar nada. Aprova com 1 clique." },
              { q: "Preciso de cartão de crédito para testar?", a: "<strong>Não!</strong> Nosso período de avaliação é livre de burocracias ou cadastros de cartões." },
              { q: "Tenho suporte especializado?", a: "<strong>Sim, suporte 24/7!</strong> Estamos prontos para responder qualquer dúvida e otimizar suas taxas de conversão." },
            ].map((item, i) => (
              <div key={i} className="p-6 bg-[#2B2B2B]/50 rounded-2xl border border-zinc-850">
                <h4 className="font-bold text-base mb-2 text-white">{item.q}</h4>
                <p className="text-zinc-400 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: item.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-zinc-900 py-12 px-4 sm:px-6 lg:px-8 bg-[#111111] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-zinc-500 text-xs gap-6">
          <OrktoLogo size="sm" showSlogan={false} />
          <div className="flex items-center gap-4">
            <a href="/termos.html" target="_blank" className="hover:text-zinc-300 transition-colors">Termos</a>
            <a href="/privacidade.html" target="_blank" className="hover:text-zinc-300 transition-colors">Privacidade</a>
            <a href="mailto:ola@orkto.co" className="hover:text-zinc-300 transition-colors">ola@orkto.co</a>
          </div>
          <p>© 2026 ORKTO</p>
        </div>
      </footer>
    </div>
  );
}
