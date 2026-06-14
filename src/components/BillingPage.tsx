import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Award, 
  Coins 
} from 'lucide-react';
import { UserProfile, Timestamp } from '../types';

interface BillingPageProps {
  userProfile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
}

export default function BillingPage({ userProfile, onProfileUpdated }: BillingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(userProfile?.planPeriod || 'monthly');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<'starter' | 'pro' | 'business' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const currentActivePlan = userProfile?.activePlan || 'starter';

  // Plans details
  const plans = {
    starter: {
      title: 'Starter',
      tagline: 'Ideal para iniciar',
      priceMonthly: 79,
      priceAnnual: 790,
      badge: 'Sua Conta Atual',
      features: [
        'Clientes ilimitados',
        'Orçamentos ilimitados',
        'PDFs profissionais',
        'Envio por WhatsApp',
        'Templates básicos',
        'Dashboard simples'
      ],
      cta: 'Plano Starter Ativo',
      color: 'zinc',
      isCurrent: currentActivePlan === 'starter'
    },
    pro: {
      title: 'Premium Pro',
      tagline: 'Mais vendido e recomendado',
      priceMonthly: 149,
      priceAnnual: 1490,
      badge: 'RECOMENDADO ⭐',
      features: [
        'Tudo do Starter',
        'IA para criar orçamentos',
        'Identidade visual personalizada',
        'Página pública do orçamento',
        'Analytics completo',
        'Histórico completo',
        'Métricas de conversão',
        'Dashboard avançado'
      ],
      cta: currentActivePlan === 'pro' ? 'Seu Plano Ativo' : 'Assinar Pro',
      color: 'orange',
      isCurrent: currentActivePlan === 'pro'
    },
    business: {
      title: 'Business Corp',
      tagline: 'Para times em expansão',
      priceMonthly: 299,
      priceAnnual: 2990,
      badge: 'AVANÇADO 🚀',
      features: [
        'Tudo do Pro',
        'Equipe multiusuário',
        'Permissões avançadas',
        'Aprovação de orçamentos',
        'Integrações e API',
        'Relatórios avançados'
      ],
      cta: currentActivePlan === 'business' ? 'Seu Plano Ativo' : 'Migrar Business',
      color: 'purple',
      isCurrent: currentActivePlan === 'business'
    }
  };

  const handleActivatePlanSimulated = () => {
    if (!selectedPlanForCheckout) return;
    setIsPurchasing(true);

    setTimeout(() => {
      setIsPurchasing(false);
      setCheckoutSuccess(true);
      
      // Notify parent to update userProfile
      const updatedProfile: UserProfile = {
        ...(userProfile || {
          uid: 'mocked_orkto_user',
          displayName: 'Dono do Negócio',
          email: 'contato@orkto.co',
          photoURL: null,
          createdAt: Timestamp.now(),
        }),
        activePlan: selectedPlanForCheckout,
        planPeriod: billingCycle,
        onboardingCompleted: true
      };
      onProfileUpdated(updatedProfile);

      setTimeout(() => {
        setCheckoutSuccess(false);
        setSelectedPlanForCheckout(null);
      }, 2500);
    }, 1800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12">
      {/* Page Header */}
      <header className="mb-8 flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-[#FF9F1C]" />
            Assinatura e Faturamento
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Gerencie seu plano Orkto, visualize benefícios premium e turbine sua taxa de fechamento.
          </p>
        </div>
      </header>

      {/* Main Billing Card Grid */}
      <div className="mb-10 space-y-6">
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-zinc-850">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                <Sparkles className="w-3.5 h-3.5 fill-[#FF9F1C]" />
                <span className="mt-0.5">Selecione o Ciclo</span>
              </div>
              <h3 className="text-xl font-extrabold text-white font-display">Planos de Conversão Orkto</h3>
              <p className="text-xs text-zinc-400">Verifique os benefícios abaixo e faça o upgrade instantâneo para desbloquear todos os recursos.</p>
            </div>

            {/* Billing cycle toggle */}
            <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 self-start md:self-auto select-none">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${billingCycle === 'monthly' ? 'bg-[#FF9F1C] text-black shadow-md font-extrabold' : 'text-zinc-400 hover:text-white'}`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${billingCycle === 'annual' ? 'bg-[#FF9F1C] text-black shadow-md font-extrabold' : 'text-zinc-400 hover:text-white'}`}
              >
                Anual
                <span className="text-[9px] bg-emerald-500 text-white px-1 py-0.2 rounded-md font-extrabold">-20%</span>
              </button>
            </div>
          </div>

          {/* Plans Columns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.keys(plans) as Array<keyof typeof plans>).map(key => {
              const plan = plans[key];
              const currentPrice = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;

              return (
                <div 
                  key={key} 
                  className={`rounded-2xl p-5 border flex flex-col justify-between ${plan.isCurrent ? 'bg-gradient-to-b from-[#252525] to-[#121212] border-orange-500/50 shadow-lg shadow-orange-500/5' : 'bg-zinc-950/40 border-zinc-850'} transition-all`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${plan.title.includes('Pro') ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25 animate-pulse' : plan.title.includes('Corp') ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'bg-zinc-800 text-zinc-400'}`}>
                        {plan.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-white tracking-tight leading-none">{plan.title}</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">{plan.tagline}</p>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black font-display text-stone-100">R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">/{billingCycle === 'annual' ? 'ano' : 'mês'}</span>
                      </div>
                      {billingCycle === 'annual' && (
                        <div className="text-[9px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                          <span>💰 Economiza R$ {key === 'starter' ? 158 : key === 'pro' ? 298 : 598}</span>
                          <span className="bg-emerald-500/10 px-1 rounded text-[8px]">2 meses grátis</span>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2 pt-3 border-t border-zinc-900 text-[11px] text-zinc-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    {plan.isCurrent ? (
                      <div className="w-full text-center py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold font-mono">
                        ✓ Plano Atual Ativo
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForCheckout(key)}
                        className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all text-center select-none active:scale-95 cursor-pointer ${plan.title.includes('Pro') ? 'bg-[#FF9F1C] text-black hover:opacity-90 font-extrabold' : plan.title.includes('Corp') ? 'bg-purple-600 text-stone-100 hover:bg-purple-700' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                      >
                        {plan.cta}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Premium Benefits Showcase Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#FF9F1C]/10 text-[#FF9F1C]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Segurança de Ponta</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Criptografia em nível industrial para proteger seus orçamentos.</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#FF9F1C]/10 text-[#FF9F1C]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Ativação Instantânea</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Não espere. O upgrade é processado e liberado em menos de 2 segundos.</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#FF9F1C]/10 text-[#FF9F1C]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Design de Auto-Valor</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Assinatura Orkto remove marcas externas e exala prestígio aos clientes.</p>
            </div>
          </div>
        </div>

        {/* Simulated Checkout Modal (Zero setup payment friction) */}
        {selectedPlanForCheckout && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 max-w-md w-full rounded-3xl p-6 shadow-2xl relative text-white animate-in fade-in duration-200">
              <header className="flex justify-between items-center pb-4 border-b border-zinc-800 mb-6 font-sans">
                <div>
                  <h4 className="text-base font-extrabold uppercase font-display text-white">Checkout Orkto Payments</h4>
                  <p className="text-[11px] text-zinc-400">Ativação instantânea do plano comercial</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="text-zinc-500 hover:text-white px-2.5 py-1 bg-zinc-800 rounded-lg text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </header>

              {checkoutSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl animate-bounce">
                    ✓
                  </div>
                  <h5 className="text-xl font-bold text-white">Pagamento Confirmado!</h5>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto animate-pulse">
                    Seu upgrade para o plano <strong className="text-white uppercase">{selectedPlanForCheckout}</strong> foi concluído. Os limites da sua conta foram estendidos!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected plan details review */}
                  <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-850 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-zinc-500 lowercase tracking-wider font-extrabold uppercase font-mono">Produto Selecionado</p>
                      <p className="text-sm font-extrabold text-white">
                        Orkto {selectedPlanForCheckout === 'pro' ? 'Premium Pro' : selectedPlanForCheckout === 'business' ? 'Business Corporation' : 'Starter'}
                      </p>
                    </div>
                    <p className="text-base font-bold font-mono text-[#FF9F1C]">
                      R$ {(billingCycle === 'annual' 
                        ? (selectedPlanForCheckout === 'pro' ? 1490 : selectedPlanForCheckout === 'business' ? 2990 : 790) 
                        : (selectedPlanForCheckout === 'pro' ? 149 : selectedPlanForCheckout === 'business' ? 299 : 79)
                      ).toFixed(2).replace('.', ',')}
                      <span className="text-[9px] text-zinc-400 font-normal">/{billingCycle === 'annual' ? 'ano' : 'mês'}</span>
                    </p>
                  </div>

                  {/* Payment method selector */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${paymentMethod === 'pix' ? 'bg-[#FF9F1C]/15 border-[#FF9F1C] text-[#FF9F1C]' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                      >
                        Pix (Aprovação em 2s)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${paymentMethod === 'card' ? 'bg-[#FF9F1C]/15 border-[#FF9F1C] text-[#FF9F1C]' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                      >
                        Cartão de Crédito
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'pix' ? (
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 flex flex-col items-center gap-3 text-center">
                      <div className="w-24 h-24 bg-white/10 rounded-xl border border-zinc-850 flex items-center justify-center font-mono text-[9px] text-zinc-400 select-none">
                        [ MOCK QRCODE PIX ]
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-stone-100">Pix Copia e Cola Gerado</p>
                        <p className="text-[10px] font-mono text-zinc-500 break-all truncate max-w-[280px]">00020126580014br.gov.bcb.pix0136orktosecurepayments92497</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-850 space-y-3">
                      <input 
                        type="text" 
                        placeholder="Número do Cartão" 
                        disabled 
                        value="4242 •••• •••• 4242 (Simulado)" 
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 rounded-xl text-xs focus:outline-none text-zinc-300"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Expiração" disabled value="12/28" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 rounded-xl text-xs focus:outline-none text-zinc-300" />
                        <input type="text" placeholder="CVV" disabled value="382" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 rounded-xl text-xs focus:outline-none text-zinc-300" />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-zinc-800 flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedPlanForCheckout(null)}
                      className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-stone-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleActivatePlanSimulated}
                      disabled={isPurchasing}
                      className="flex-1 py-3 bg-[#FF9F1C] text-black font-extrabold rounded-xl text-xs transition-colors hover:opacity-90 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isPurchasing ? 'Processando transação...' : 'Confirmar Simulador'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
