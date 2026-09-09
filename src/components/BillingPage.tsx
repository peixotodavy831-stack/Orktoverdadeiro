import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Crown, Star, Zap, Check, Loader2, ArrowUpRight, X, ShieldCheck, Award } from 'lucide-react';
import { UserProfile, PlanType } from '../types';
import { supabase } from '../lib/supabase';
import { PLAN_CATALOG } from '../lib/plans';

interface BillingPageProps {
  userProfile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
}

const PLANS = PLAN_CATALOG.map(plan => ({
  ...plan,
  icon: plan.id === 'free' ? Star : plan.id === 'pro' ? Crown : Zap,
  color: plan.id === 'free' ? 'text-zinc-400' : plan.id === 'pro' ? 'text-orange-400' : 'text-emerald-400',
}));

export default function BillingPage({ userProfile }: BillingPageProps) {
  const currentPlan = userProfile?.activePlan || 'free';
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const closeModal = () => {
    if (loading) return;
    setSelectedPlan(null);
    setCheckoutUrl(null);
    setStatusMessage('');
  };

  const handleSelectPlan = async (planId: PlanType) => {
    if (planId === 'free' || planId === currentPlan) return;
    setSelectedPlan(planId);
    setLoading(true);
    setCheckoutUrl(null);
    setStatusMessage('Preparando checkout seguro...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Faça login novamente para assinar.');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
      const response = await fetch('/api/asaas/checkout', {
        method: 'POST', headers,
        body: JSON.stringify({
          plan: planId,
          email: userProfile?.email,
          name: userProfile?.companyName || userProfile?.displayName,
          phone: userProfile?.whatsappNumber,
          cpfCnpj: userProfile?.taxID,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao criar checkout.');

      const url = result.url || null;
      if (!url) throw new Error('O provedor não retornou o link de pagamento. Tente novamente.');

      setCheckoutUrl(url);
      setStatusMessage(url
        ? 'Conclua o pagamento no ambiente Asaas. O plano será ativado após a confirmação.'
        : 'Não foi possível abrir o checkout. Tente novamente.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Erro de conexão com a cobrança.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <CreditCard className="w-6 h-6 text-orange-500" />
        <div><h1 className="text-2xl font-black text-zinc-900 dark:text-white">Planos</h1><p className="text-xs text-zinc-500">Cresça conforme sua operação precisar</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan;
          return (
            <div key={plan.id} className={`relative rounded-2xl border p-6 ${isCurrent ? 'bg-orange-500/5 border-orange-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-zinc-950 text-[10px] font-extrabold px-3 py-1 rounded-full">POPULAR</span>}
              <div className="flex items-center gap-3 mb-4"><Icon className={`w-8 h-8 ${plan.color}`} /><div><h3 className="font-extrabold text-zinc-900 dark:text-white">{plan.name}</h3><p className="text-sm text-zinc-500">{plan.price === 0 ? 'Grátis' : `R$ ${(plan.price / 100).toFixed(2).replace('.', ',')}/mês`}</p></div></div>
              <ul className="space-y-2 mb-6">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{feature}</li>)}</ul>
              <button disabled={isCurrent || plan.id === 'free' || loading} onClick={() => handleSelectPlan(plan.id)} className={`w-full py-3 rounded-xl font-extrabold text-xs flex justify-center gap-2 disabled:cursor-not-allowed ${isCurrent ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500' : 'bg-orange-500 hover:bg-orange-600 text-zinc-950'}`}>
                {isCurrent ? 'Plano atual' : 'Assinar'} <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={closeModal} />
          <motion.div initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white">
            <div className="flex justify-between mb-4"><h3 className="font-extrabold">Pagamento</h3><button onClick={closeModal}><X className="w-5 h-5" /></button></div>
            <p className="text-sm text-zinc-400 mb-5">{statusMessage}</p>
            {loading && <Loader2 className="w-8 h-8 mx-auto animate-spin text-orange-500" />}
            {checkoutUrl && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="block w-full py-3 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-extrabold text-sm rounded-xl text-center">Ir para o pagamento</a>}
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{ icon: ShieldCheck, title: 'Pagamento seguro', desc: 'Processado pelo Asaas' }, { icon: Award, title: 'Ativação confirmada', desc: 'Liberação somente após pagamento' }, { icon: CreditCard, title: 'Cartão de crédito', desc: 'Assinatura mensal recorrente' }].map(item => {
          const Icon = item.icon;
          return <div key={item.title} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-3"><Icon className="w-4 h-4 text-orange-500" /><div><h4 className="text-xs font-bold text-zinc-900 dark:text-white">{item.title}</h4><p className="text-[10px] text-zinc-500">{item.desc}</p></div></div>;
        })}
      </div>
    </div>
  );
}
