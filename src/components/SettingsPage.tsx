import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Briefcase, 
  Phone, 
  MessageSquare, 
  CreditCard, 
  Palette, 
  Save, 
  Check, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Users,
  MapPin
} from 'lucide-react';
import { UserProfile, Timestamp } from '../types';

interface SettingsPageProps {
  userProfile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
}

export default function SettingsPage({ userProfile, onProfileUpdated }: SettingsPageProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // States
  const [companyName, setCompanyName] = useState(userProfile?.companyName || '');
  const [taxID, setTaxID] = useState(userProfile?.taxID || '');
  const [whatsappNumber, setWhatsappNumber] = useState(userProfile?.whatsappNumber || '');
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    userProfile?.whatsappTemplate || 
    'Olá *[CLIENT_NAME]*, aqui está a proposta comercial de *[SERVICE_TYPE]* no valor de *[TOTAL]*. Clique no link abaixo para visualizar todos os detalhes e aprovar online com 1 clique:\n\n*[LINK]*'
  );
  const [paymentInfo, setPaymentInfo] = useState(
    userProfile?.paymentInfo || 
    'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: Orkto Pro Solutions Ltda'
  );
  const [quoteColor, setQuoteColor] = useState(userProfile?.quoteColor || '#FF9F1C');
  const [address, setAddress] = useState(userProfile?.address || '');

  // Live Preview Placeholder custom state
  const [previewClientName, setPreviewClientName] = useState('Felipe Albuquerque');
  const [previewServiceType, setPreviewServiceType] = useState(
    userProfile?.profession ? `${userProfile.profession} Personalizado` : 'Instalação Elétrica Premium'
  );
  const [previewTotal, setPreviewTotal] = useState('R$ 1.850,00');
  const [previewLink, setPreviewLink] = useState('https://orkto.com/q/74921x');

  // Notifications Toggles (Simulated options)
  const [notifyView, setNotifyView] = useState(true);
  const [notifyApprove, setNotifyApprove] = useState(true);

  const colorsOption = [
    { name: 'Laranja Orkto', hex: '#FF9F1C' },
    { name: 'Azul Stripe Elegante', hex: '#2563eb' },
    { name: 'Verde Fintech Pix', hex: '#16a34a' },
    { name: 'Vermelho Linear Estilo', hex: '#dc2626' },
    { name: 'Cinza Apple Minimalista', hex: '#4b5563' }
  ];

  const handleInjectPlaceholder = (placeholder: string) => {
    setWhatsappTemplate(prev => prev + placeholder);
  };

  const renderFormattedPreview = (text: string) => {
    let filled = text
      .replace(/\[CLIENT_NAME\]/g, previewClientName || '[CLIENT_NAME]')
      .replace(/\[SERVICE_TYPE\]/g, previewServiceType || '[SERVICE_TYPE]')
      .replace(/\[TOTAL\]/g, previewTotal || '[TOTAL]')
      .replace(/\[LINK\]/g, previewLink || '[LINK]');

    const parts = filled.split('*');
    return (
      <span className="whitespace-pre-wrap text-[12px] sm:text-[13px] font-sans leading-relaxed text-zinc-900 dark:text-zinc-100">
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            return <strong key={index} className="font-extrabold text-black dark:text-white">{part}</strong>;
          }
          return part;
        })}
      </span>
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setIsSaving(true);
    setSuccess(false);

    try {
      const userUid = userProfile?.uid || 'anonymous';
      const updatedProfile: UserProfile = {
        uid: userUid,
        displayName: userProfile?.displayName || 'Dono do Negócio',
        email: userProfile?.email || 'noreply@gmail.com',
        photoURL: userProfile?.photoURL || null,
        createdAt: userProfile?.createdAt || Timestamp.now(),
        onboardingCompleted: true,
        companyName,
        taxID,
        whatsappNumber,
        whatsappTemplate,
        paymentInfo,
        quoteColor,
        address
      };

      onProfileUpdated(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Settings header */}
      <header className="mb-8 flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Settings className="w-8 h-8 text-orange-500" />
            Configurações do Sistema
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Personalize os dados de cobrança, a cor do orçamento digital e as mensagens padrão do WhatsApp.
          </p>
        </div>
      </header>

      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <Check className="w-5 h-5 shrink-0" />
          Configurações salvas com sucesso! Suas alterações já estão ativas nos novos orçamentos.
        </div>
      )}

      {/* Subscription Plans & Billing Selector Hub (Decoy Effect / Loss Aversion / Endowment Effect) */}
      {(() => {
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
            priceMonthly: 0,
            priceAnnual: 0,
            badge: 'Sua Conta Atual',
            features: [
              'Limite de até 5 propostas ativas',
              'Link público interativo',
              'Relatório básico de conversão',
              'Exportação padrão PDF'
            ],
            cta: 'Plano Grátis Ativo',
            color: 'zinc',
            isCurrent: currentActivePlan === 'starter'
          },
          pro: {
            title: 'Premium Pro',
            tagline: 'Mais vendido e recomendado',
            priceMonthly: 59.90,
            priceAnnual: 47.90,
            badge: 'RECOMENDADO ⭐',
            features: [
              'Orçamentos ILIMITADOS (Sem amarras)',
              'Polidor de Copys Avançado via IA',
              'Integração e Exportação Google Sheets',
              'Customização total de Cores & Branding',
              'Remoção de marca dágua Orkto'
            ],
            cta: currentActivePlan === 'pro' ? 'Seu Plano Ativo' : 'Assinar Pro',
            color: 'orange',
            isCurrent: currentActivePlan === 'pro'
          },
          business: {
            title: 'Business Corp',
            tagline: 'Para times em expansão',
            priceMonthly: 149.90,
            priceAnnual: 119.90,
            badge: 'AVANÇADO 🚀',
            features: [
              'Tudo da versão Pro Comercial',
              'Multi-usuários integrados no time',
              'Atendimento dedicado de CS',
              'Relatórios de faturamento estendidos',
              'Exclusão permanente de marca'
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
          <div className="mb-10 space-y-6">
            <div className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-zinc-850">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                    <Sparkles className="w-3.5 h-3.5 fill-[#FF9F1C]" />
                    <span className="mt-0.5">Assinatura & Faturamento</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white font-display">Estágio Financeiro Residencial</h3>
                  <p className="text-xs text-zinc-400">Verifique seu uso atual de propostas de vendas e mude de plano instantaneamente para expandir.</p>
                </div>

                {/* Billing toggle */}
                <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 self-start md:self-auto select-none">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${billingCycle === 'monthly' ? 'bg-[#FF9F1C] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${billingCycle === 'annual' ? 'bg-[#FF9F1C] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}
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

                        <div className="pt-2 flex items-baseline gap-1">
                          {currentPrice === 0 ? (
                            <span className="text-2xl font-black font-display text-white">Grátis</span>
                          ) : (
                            <>
                              <span className="text-2xl font-black font-display text-stone-100">R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                              <span className="text-[10px] text-zinc-500 uppercase">/mês</span>
                            </>
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
                            className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all text-center select-none active:scale-95 cursor-pointer ${plan.title.includes('Pro') ? 'bg-orange-500 text-black hover:opacity-90' : plan.title.includes('Corp') ? 'bg-purple-600 text-stone-100 hover:bg-purple-700' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
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

            {/* Simulated Checkout Modal (Zero setup payment friction) */}
            {selectedPlanForCheckout && (
              <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 max-w-md w-full rounded-3xl p-6 shadow-2xl relative text-white animate-in fade-in duration-200">
                  <header className="flex justify-between items-center pb-4 border-b border-zinc-800 mb-6">
                    <div>
                      <h4 className="text-base font-extrabold uppercase font-display text-white">Checkout Orkto Payments</h4>
                      <p className="text-[11px] text-zinc-400">Ativação instantânea do plano comercial</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedPlanForCheckout(null)}
                      className="text-zinc-500 hover:text-white px-2.5 py-1 bg-zinc-800 rounded-lg text-xs"
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
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                        Seu upgrade para o plano <strong className="text-white uppercase">{selectedPlanForCheckout}</strong> foi concluído. Os limites da sua conta foram estendidos!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected plan details review */}
                      <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-850 flex justify-between items-center">
                        <div>
                          <p className="text-xs text-zinc-550 lowercase tracking-wider font-extrabold uppercase font-mono">Produto Selecionado</p>
                          <p className="text-sm font-extrabold text-white">Orkto {selectedPlanForCheckout === 'pro' ? 'Premium Pro' : 'Business Corporation'}</p>
                        </div>
                        <p className="text-base font-bold font-mono text-[#FF9F1C]">
                          R$ {(billingCycle === 'annual' ? (selectedPlanForCheckout === 'pro' ? 47.90 : 119.90) : (selectedPlanForCheckout === 'pro' ? 59.90 : 149.90)).toFixed(2).replace('.', ',')}
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
                            className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${paymentMethod === 'pix' ? 'bg-[#FF9F1C]/15 border-[#FF9F1C] text-[#FF9F1C]' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                          >
                            Pix (Aprovação em 2s)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('card')}
                            className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${paymentMethod === 'card' ? 'bg-[#FF9F1C]/15 border-[#FF9F1C] text-[#FF9F1C]' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                          >
                            Cartão de Crédito
                          </button>
                        </div>
                      </div>

                      {paymentMethod === 'pix' ? (
                        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 flex flex-col items-center gap-3 text-center">
                          <div className="w-24 h-24 bg-white/10 rounded-xl border border-zinc-850 flex items-center justify-center font-mono text-[9px] text-zinc-400">
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
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Expiração" disabled value="12/28" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none" />
                            <input type="text" placeholder="CVV" disabled value="382" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                      )}

                      <div className="pt-4 border-t border-zinc-800 flex justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPlanForCheckout(null)}
                          className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-stone-300 rounded-xl text-xs font-bold transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleActivatePlanSimulated}
                          disabled={isPurchasing}
                          className="flex-1 py-3 bg-[#FF9F1C] text-black font-extrabold rounded-xl text-xs transition-colors hover:opacity-90 active:scale-95 flex items-center justify-center gap-1.5"
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
        );
      })()}

      {/* Main Settings Form split rows block */}
      <form onSubmit={handleSaveSettings} className="space-y-8">
        
        {/* Row 1: Profile & Company Name */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-orange-500" />
            Perfil da Empresa
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Nome do Estabelecimento *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Acme Consulting & Tech Agency"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">CNPJ ou CPF (Opcional)</label>
              <input
                type="text"
                value={taxID}
                onChange={(e) => setTaxID(e.target.value)}
                placeholder="Ex: 00.000.000/0001-00"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">WhatsApp para Contato</label>
              <div className="relative">
                <Phone className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Ex: 11987654321"
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Insira somente os dígitos incluindo DDD, sem espaços ou traços.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Endereço de Negócio (Aparece no Cabeçalho)</label>
            <div className="relative">
              <MapPin className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. das Nações Unidas, 1200 - Centro, São Paulo"
                className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Row 2: WhatsApp Send Message Template Customization with Live Preview */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Notificação por WhatsApp (Template)
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 leading-none">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Live Sync ativa
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Input Block */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Redija sua Mensagem</label>
                <textarea
                  rows={6}
                  value={whatsappTemplate}
                  onChange={(e) => setWhatsappTemplate(e.target.value)}
                  placeholder="Redija o texto com markdown padrão..."
                  className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans leading-relaxed"
                />
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Clique para inserir variáveis inteligentes:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [CLIENT_NAME]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Nome Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [SERVICE_TYPE]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Tipo Serviço
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [TOTAL]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Total (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [LINK]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Link Proposta
                  </button>
                </div>
              </div>

              {/* Visual Editor Customizing values of the placeholders */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800/80 pb-2 mb-1">
                  <Palette className="w-4 h-4 text-orange-500" />
                  <span className="text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Simulador: Testar Valores dos Placeholders
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [CLIENT_NAME] (Nome p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewClientName}
                      onChange={(e) => setPreviewClientName(e.target.value)}
                      placeholder="Felipe Albuquerque"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [SERVICE_TYPE] (Serviço p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewServiceType}
                      onChange={(e) => setPreviewServiceType(e.target.value)}
                      placeholder="Instalação Elétrica Premium"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [TOTAL] (Total p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewTotal}
                      onChange={(e) => setPreviewTotal(e.target.value)}
                      placeholder="R$ 1.850,00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [LINK] (Link p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewLink}
                      onChange={(e) => setPreviewLink(e.target.value)}
                      placeholder="https://orkto.com/q/74921x"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Smartphone Chat Preview Container */}
            <div className="flex flex-col">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Live Preview no WhatsApp</label>
              
              <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col shadow-xl">
                {/* Simulated Header */}
                <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[11px] text-zinc-100 uppercase shrink-0">
                      {(previewClientName || 'Cliente').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">{previewClientName || 'Felipe Albuquerque'} (Cliente)</p>
                      <p className="text-[9px] text-[#25d366] font-bold">Online</p>
                    </div>
                  </div>
                </div>

                {/* Simulated message wrapper with wallpaper pattern color */}
                <div className="flex-1 p-4 bg-[#efeae2] dark:bg-[#0b141a] overflow-y-auto space-y-3 min-h-[220px] max-h-[360px]">
                  {/* Message bubble from owner (sent) */}
                  <div className="flex justify-end animate-fade-in">
                    <div className="relative max-w-[90%] bg-[#d9fdd3] dark:bg-[#005c4b] p-3 rounded-[18px] rounded-tr-none shadow-md text-zinc-900 dark:text-stone-100 flex flex-col transition-all duration-300">
                      {renderFormattedPreview(whatsappTemplate)}
                      
                      {/* Checkmarks and simulated time */}
                      <span className="text-[9px] text-zinc-500 dark:text-zinc-350 ml-auto mt-2 flex items-center gap-1">
                        <span>12:30</span>
                        <span className="text-blue-500 dark:text-emerald-300">✓✓</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Colors Branding Accent and Pix info defaults */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Colors box */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-orange-500" />
                Tema Visual da Cobrança
              </h3>
              <p className="text-xs text-zinc-500 mb-6">A cor será aplicada no topo e em botões cruciais do Link do Cliente.</p>
              
              <div className="space-y-3">
                {colorsOption.map(color => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setQuoteColor(color.hex)}
                    className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-left hover:border-orange-500 group transition-all"
                  >
                    <div className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      <div className="w-5 h-5 rounded-lg border shadow-inner" style={{ backgroundColor: color.hex }} />
                      <span>{color.name}</span>
                    </div>
                    {quoteColor === color.hex && <Check className="w-4 h-4 text-orange-500" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pix Instructions box */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              Pix / Destaques Gerais
            </h3>
            <p className="text-xs text-zinc-500">Insira a chave e instruções de pagamento padrão para aparecer no rodapé de cada boleto.</p>
            
            <textarea
              rows={6}
              value={paymentInfo}
              onChange={(e) => setPaymentInfo(e.target.value)}
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
              placeholder="Instruções de pagamento..."
            />
          </div>
        </div>

        {/* Row 4: Simulated App Notifications options */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-2">Avisos e Lembretes (Simulado)</h3>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-bold">Lembrete de expiração de orçamentos pendentes</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Dispare um alerta quando o orçamento estiver a 24 horas de vencer.</p>
            </div>
            <input 
              type="checkbox" 
              checked={notifyView} 
              onChange={() => setNotifyView(!notifyView)} 
              className="accent-orange-500 w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between py-1 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
            <div>
              <p className="text-xs font-bold">Notificações por e-mail de faturamento fechado</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Receba avisos instantâneos com dados do caixa consolidado.</p>
            </div>
            <input 
              type="checkbox" 
              checked={notifyApprove} 
              onChange={() => setNotifyApprove(!notifyApprove)} 
              className="accent-orange-500 w-4 h-4"
            />
          </div>
        </div>

        {/* Bottom submit row */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-2xl transition-all shadow-xl shadow-orange-500/20 flex items-center gap-2 active:scale-95"
          >
            {isSaving ? 'Gravando Configurações...' : 'Salvar Alterações'}
            <Save className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
