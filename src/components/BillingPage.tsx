import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Crown, Star, Zap, Check, Loader2, ArrowUpRight, X, ShieldCheck, Award } from 'lucide-react';
import { UserProfile, PlanType, PLAN_LIMITS } from '../types';

interface BillingPageProps {
  userProfile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
}

const BETA_PLANS: { id: PlanType; name: string; icon: any; color: string; price: number; features: string[]; popular?: boolean }[] = [
  {
    id: 'free',
    name: 'Fundador',
    icon: Star,
    color: 'text-orange-400',
    price: 4900,
    popular: true,
    features: [
      'Orçamentos ilimitados',
      'PDF profissional',
      'Envio por WhatsApp',
      'Histórico 30 dias',
      'Templates premium',
      'Página pública do orçamento',
      'Preço vitalício para os primeiros clientes',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Crown,
    color: 'text-emerald-400',
    price: 7900,
    features: [
      'Tudo do Fundador +',
      '30 refinamentos IA/mês',
      'Histórico ilimitado',
      'Links compartilháveis',
      'Analytics básico',
    ],
  },
];

const FINAL_PLANS: { id: PlanType; name: string; icon: any; color: string; price: number; features: string[]; popular?: boolean }[] = [
  {
    id: 'free',
    name: 'Starter',
    icon: Star,
    color: 'text-zinc-400',
    price: 9900,
    features: [
      'Orçamentos ilimitados',
      'PDF profissional',
      'Envio por WhatsApp',
      'Histórico 30 dias',
      'Templates premium',
      'Página pública do orçamento',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Crown,
    color: 'text-orange-400',
    price: 17900,
    popular: true,
    features: [
      'Tudo do Starter +',
      '30 refinamentos IA/mês',
      'Histórico ilimitado',
      'Links compartilháveis',
      'Analytics básico',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    icon: Zap,
    color: 'text-emerald-400',
    price: 29900,
    features: [
      'Tudo do Pro +',
      'Refinamentos IA ilimitados',
      'PDF sem marca d\'água',
      'Analytics avançado',
      'Suporte prioritário',
    ],
  },
];

export default function BillingPage({ userProfile, onProfileUpdated }: BillingPageProps) {
  const currentPlan = userProfile?.activePlan || 'free';
  const isFounder = userProfile?.isFounder || false;
  const founderPrice = userProfile?.founderPrice || 0;
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const plans = BETA_PLANS;

  const handleSelectPlan = async (planId: PlanType) => {
    if (planId === 'free' && currentPlan !== 'free') return;
    if (planId === currentPlan) return;
    setSelectedPlan(planId);
    setLoading(true);
    setStatusMessage('Preparando checkout Asaas...');

    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile?.uid,
          plan: planId,
          email: userProfile?.email,
          name: userProfile?.companyName || userProfile?.displayName,
          phone: userProfile?.whatsappNumber,
          cpfCnpj: userProfile?.taxID,
          returnUrl: window.location.origin + '/app',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || 'Erro ao criar checkout');
        return;
      }

      const data = await res.json();

      if (data.url) {
        setCheckoutUrl(data.url);
        setStatusMessage('Redirecionando para pagamento...');
      } else if (data.success && data.subscriptionId) {
        setStatusMessage('Gerando link de pagamento...');
        const checkoutRes = await fetch('/api/asaas/generate-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userProfile?.uid, subscriptionId: data.subscriptionId }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.checkoutUrl) {
          setCheckoutUrl(checkoutData.checkoutUrl);
          setStatusMessage('Redirecionando para cadastro do cartão...');
        } else {
          onProfileUpdated({ ...userProfile!, activePlan: planId, isFounder: true, founderPrice: planId === 'pro' ? 7900 : 4900 } as UserProfile);
          setStatusMessage('Plano ativado! Acesse o link no seu e-mail para cadastrar o cartão.');
          setTimeout(() => { setSelectedPlan(null); setCheckoutUrl(null); }, 3000);
        }
      } else if (data.success) {
        onProfileUpdated({ ...userProfile!, activePlan: planId, isFounder: true, founderPrice: planId === 'pro' ? 7900 : 4900 } as UserProfile);
        setStatusMessage('Plano ativado com sucesso!');
        setTimeout(() => { setSelectedPlan(null); setCheckoutUrl(null); }, 2000);
      }
    } catch (err: any) {
      setStatusMessage('Erro de conexão. Verifique sua API Key Asaas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <CreditCard className="w-6 h-6 text-orange-500" />
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Planos</h1>
          <p className="text-xs text-zinc-500 font-medium">Escolha o plano ideal para seu negócio</p>
        </div>
      </div>

      {isFounder && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            ✅ Você é um fundador! Seu preço vitalício de R$ {(founderPrice / 100).toFixed(2).replace('.', ',')}/mês está garantido para sempre.
          </p>
        </div>
      )}

      {!isFounder && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
          <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
            🔥 Preço fundador — valor vitalício para os primeiros clientes. Beta aberto por 3 meses.
          </p>
        </div>
      )}

      <div className={`grid gap-4 mb-8 ${plans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan && currentPlan !== 'free';
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 transition-all ${
                isCurrent
                  ? 'bg-orange-500/5 border-orange-500/30 ring-1 ring-orange-500/20'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
              } ${plan.popular ? 'md:scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">
                  Popular
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <Icon className={`w-8 h-8 ${plan.color}`} />
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">{plan.name}</h3>
                  <p className="text-sm text-zinc-500">
                    R$ {(plan.price / 100).toFixed(2).replace('.', ',')}/mês
                  </p>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent || loading}
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isCurrent
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
                    : plan.popular
                      ? 'bg-orange-500 hover:bg-orange-600 text-zinc-950 shadow-lg shadow-orange-500/20'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-orange-500 dark:hover:bg-orange-600 dark:text-zinc-950'
                }`}
              >
                {isCurrent ? 'Plano Atual' : 'Assinar'} <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => { setSelectedPlan(null); setCheckoutUrl(null); setStatusMessage(''); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold">
                {checkoutUrl ? 'Pagamento' : loading ? 'Processando...' : 'Confirmar Assinatura'}
              </h3>
              <button onClick={() => { setSelectedPlan(null); setCheckoutUrl(null); setStatusMessage(''); }} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusMessage && (
              <p className="text-sm text-zinc-400 mb-4">{statusMessage}</p>
            )}

            {loading && !checkoutUrl && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            )}

            {checkoutUrl && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-400">Você será redirecionado para o ambiente seguro Asaas para finalizar o pagamento.</p>
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-extrabold text-sm rounded-xl text-center transition-all cursor-pointer"
                >
                  Ir para Pagamento
                </a>
              </div>
            )}

            {!loading && !checkoutUrl && !statusMessage && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-300">Confirme a assinatura do plano <strong className="text-orange-400">{plans.find(p => p.id === selectedPlan)?.name}</strong> por <strong className="text-orange-400">R$ {(plans.find(p => p.id === selectedPlan)!.price / 100).toFixed(2).replace('.', ',')}/mês</strong>.</p>
                <button
                  onClick={() => handleSelectPlan(selectedPlan)}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-extrabold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Confirmar Assinatura
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: ShieldCheck, title: 'Pagamento Seguro', desc: 'Processado pelo Asaas, plataforma PCI-DSS' },
          { icon: Award, title: 'Ativação Imediata', desc: 'Plano liberado assim que o pagamento for confirmado' },
          { icon: CreditCard, title: 'Pix ou Cartão', desc: 'Pagamento via Pix (aprovação instantânea) ou cartão de crédito' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{item.title}</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
