import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, CreditCard, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import CommercialPlans from './CommercialPlans';
import './landing.css';

interface BillingPageProps {
  userProfile: UserProfile | null;
  onProfileUpdated?: (profile: UserProfile) => void;
}

type CatalogPlan = {
  plan_key: string;
  price_cents: number | null;
  currency: string;
  price_is_public: boolean;
  entitlements: { features?: Record<string, boolean>; limits?: Record<string, number | null> };
  version: number;
};

type BillingCurrent = {
  subscription: { status: string; trial_ends_at: string | null; current_period_end: string | null } | null;
  workspacePlan: string | null;
  status: string;
  trialEndsAt: string | null;
  readOnly: boolean;
  configurationRequired: boolean;
  entitlements: CatalogPlan['entitlements'];
  usage: Array<{ feature_key: string; quantity: number; period_start: string }>;
  checkout: 'not_configured';
  pulso?:{state:string;allowance:number|null;used:number|null;remaining:number|null};
};

const PLAN_NAMES: Record<string, string> = {
  starter:'Start', pro:'Pro', business:'Business', scale:'Scale', enterprise:'Enterprise',
  founders:'Founders', legacy_standard:'Legacy Standard', free:'Legacy Standard',
};
const PLAN_ORDER = ['starter','pro','business','scale','enterprise'];
const FEATURE_NAMES: Record<string,string> = { core_crm:'Operação comercial', proposals:'Propostas', wia:'WIA' };
const STATUS_NAMES:Record<string,string>={trial:'Período de teste',active:'Ativo',past_due:'Pagamento pendente',suspended:'Suspenso',cancelled:'Cancelado',configuration_required:'Configuração necessária'};
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR') : null;

export default function BillingPage({ userProfile }: BillingPageProps) {
  const [catalog, setCatalog] = useState<CatalogPlan[]>([]);
  const [current, setCurrent] = useState<BillingCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proposalOpen,setProposalOpen]=useState(()=>sessionStorage.getItem('orkto-commercial-intent')==='enterprise');
  const [requirements,setRequirements]=useState('');
  const [proposalStatus,setProposalStatus]=useState('');
  const [proposalSaving,setProposalSaving]=useState(false);
  const [proposalKey]=useState(()=>crypto.randomUUID());
  async function requestProposal(event:React.FormEvent) {
    event.preventDefault();setProposalSaving(true);setProposalStatus('');
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Entre novamente para registrar a solicitação.');
      const result=await fetch('/api/billing/proposal-requests',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,
        'content-type':'application/json','x-idempotency-key':proposalKey},body:JSON.stringify({requirements})});
      const body=await result.json();if(!result.ok||!body.id)throw new Error(body.error||'Não foi possível registrar a solicitação. Tente novamente.');
      setProposalStatus(`Solicitação registrada. Protocolo: ${body.id}. Nenhuma assinatura ou cobrança foi criada.`);
      sessionStorage.removeItem('orkto-commercial-intent');setRequirements('');
    }catch(error){setProposalStatus(error instanceof Error?error.message:'Solicitação indisponível.');}
    finally{setProposalSaving(false);}
  }

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Faça login novamente para consultar seu plano.');
      const headers = { Authorization:`Bearer ${session.access_token}` };
      const [catalogResponse, currentResponse] = await Promise.all([
        fetch('/api/plan/catalog',{ headers }), fetch('/api/billing/current',{ headers }),
      ]);
      const [catalogPayload, currentPayload] = await Promise.all([catalogResponse.json(),currentResponse.json()]);
      if (currentResponse.ok) setCurrent(currentPayload as BillingCurrent);
      if (!catalogResponse.ok) throw new Error(catalogPayload.error || 'Não foi possível carregar os planos.');
      if (!currentResponse.ok) throw new Error(currentPayload.error || 'Não foi possível carregar sua assinatura.');
      setCatalog((catalogPayload.data || []) as CatalogPlan[]);
    } catch (cause) {
      setCurrent(null); setCatalog([]);
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o billing.');
    } finally { setLoading(false); }
  },[]);

  useEffect(() => { void load(); },[load]);

  const currentKey = current?.workspacePlan || (userProfile?.activePlan === 'free' ? 'legacy_standard' : userProfile?.activePlan) || null;
  const currentName = currentKey ? PLAN_NAMES[currentKey] || currentKey : 'Não configurado';
  const trialEndsAt = current?.trialEndsAt || current?.subscription?.trial_ends_at || userProfile?.trialExpirationDate || null;
  const usageByFeature = new Map((current?.usage || []).map(item => [item.feature_key,item]));

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
    <header className="mb-6 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div className="flex items-center gap-3"><CreditCard className="h-6 w-6 text-orange-500" /><div><h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Plano & cobrança</h1><p className="text-xs text-zinc-500">Seu plano, consumo e disponibilidade de contratação.</p></div></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
    </header>

    {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1">{error}</div><button onClick={() => void load()} className="underline">Tentar novamente</button></div>}
    {loading && !current ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" />Carregando plano e uso…</div> : !current ? <p role="status" className="rounded-xl border border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-800">Não foi possível confirmar o plano, os limites ou as permissões de escrita. Tente atualizar a consulta.</p> : <>
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs text-zinc-500">Plano atual</p><strong className="mt-1 block text-xl">{currentName}</strong><p className="mt-2 text-xs text-zinc-500">Situação: {STATUS_NAMES[current?.status||'configuration_required']||'Não reconhecida'}</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="h-4 w-4 text-orange-500" />Trial / acesso</div><strong className="mt-2 block text-sm">{trialEndsAt ? `Período termina em ${date(trialEndsAt)}` : 'Sem período de trial configurado'}</strong><p className="mt-2 text-xs text-zinc-500">{current?.readOnly ? 'Workspace em somente leitura.' : current?.configurationRequired ? 'A configuração do plano ainda é necessária.' : 'Acesso de escrita disponível conforme os limites configurados.'}</p></div>
      </section>

      {current?.readOnly && <div role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">O acesso está em modo somente leitura. Nenhuma cobrança será criada automaticamente.</div>}
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Uso neste período</h2>
        {usageByFeature.size ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{[...usageByFeature.values()].map(item => <div key={`${item.period_start}:${item.feature_key}`} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/60"><span className="text-zinc-500">{FEATURE_NAMES[item.feature_key] || item.feature_key}</span><strong className="float-right">{Number(item.quantity).toLocaleString('pt-BR')}</strong></div>)}</div> : <p className="mt-2 text-xs text-zinc-500">Sem dados de uso registrados para este período.</p>}
      </section>

      <section className="mb-6" aria-label="Saldo de Pulso"><h2 className="font-semibold">Pulso</h2><p className="mt-2 text-sm text-zinc-500">{current.pulso?.state==='configured'?`Saldo: ${current.pulso.remaining} · utilizado/reservado: ${current.pulso.used} · franquia: ${current.pulso.allowance}`:'Franquia ainda não aprovada. Consultas determinísticas continuam disponíveis; uso generativo exige limite aprovado.'}</p></section>
      <CommercialPlans onProposal={()=>setProposalOpen(true)} />
      {proposalOpen&&<form onSubmit={requestProposal} className="my-6 space-y-3 rounded-xl border border-zinc-500/30 p-5"><h2 className="text-lg font-semibold">Solicitar proposta Enterprise</h2><label className="block text-sm">O que sua empresa precisa?<textarea required minLength={10} maxLength={3000} value={requirements} onChange={event=>setRequirements(event.target.value)} className="mt-2 block min-h-32 w-full rounded-lg border border-zinc-500/40 bg-transparent p-3" placeholder="Volume, usuários, integrações, segurança e condições desejadas" /></label><button disabled={proposalSaving} className="rounded-lg bg-[#ff5c00] px-4 py-3 font-semibold text-[#1a1816] disabled:opacity-60">{proposalSaving?'Registrando…':'Registrar solicitação'}</button>{proposalStatus&&<p role="status" className="text-sm">{proposalStatus}</p>}</form>}
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-zinc-200 p-3 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />As limitações de trial, recursos e uso são verificadas no servidor. O checkout está desligado até aprovação comercial; esta tela não cria pagamento ou assinatura.</div>
    </>}
  </div>;
}
