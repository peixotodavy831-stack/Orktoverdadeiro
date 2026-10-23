import { useEffect, useState } from 'react';
import { ArrowRight, Gauge } from 'lucide-react';
import { productApi } from '../api';
import { quotaSnapshot } from '../adapters/quota-model';

interface PulsoBalance {
  state: string;
  allowance: number | null;
  used: number | null;
  remaining: number | null;
}
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** Read the existing billing balance; never issue credits or assume a quota. */
export default function PulsoCounter({ accessToken, onOpenBilling, refreshKey }: {
  accessToken: string | null;
  onOpenBilling?: () => void;
  refreshKey: number;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [balance, setBalance] = useState<PulsoBalance | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setBalance(null);
    void productApi<{pulso?: PulsoBalance}>('/api/billing/current', accessToken, {signal:controller.signal,cache:'no-store'})
      .then(result => {
        if (controller.signal.aborted) return;
        setBalance(result?.pulso || null);
        setState('ready');
      }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [accessToken, refreshKey]);
  const quota = quotaSnapshot(balance?.state === 'configured' ? balance.used : null,
    balance?.state === 'configured' ? balance.allowance : null, balance?.remaining);
  return <section className="today-pulso-counter" aria-label="Contador de Pulsos" aria-busy={state === 'loading'}>
    <Gauge size={20} aria-hidden="true" />
    <div className="min-w-0 flex-1" aria-live="polite">
      <h3>Pulsos</h3>
      {state === 'loading' ? <p className="today-pulso-status">Consultando saldo…</p>
        : state === 'error' ? <><p className="today-pulso-status">Saldo indisponível</p><p>Use Atualizar para tentar novamente.</p></>
        : quota.state === 'known' ? <><p className="today-pulso-value">{number.format(quota.remaining)} <span>disponíveis</span></p><p>{number.format(quota.used)} utilizados ou reservados · {number.format(quota.limit)} na franquia</p></>
        : <><p className="today-pulso-status">{quota.state === 'invalid' ? 'Saldo não confirmado' : 'Franquia não configurada'}</p><p>O saldo aparece quando houver um limite aprovado.</p></>}
    </div>
    {onOpenBilling && <button type="button" onClick={onOpenBilling} className="today-pulso-link">Ver consumo <ArrowRight size={15} aria-hidden="true" /></button>}
  </section>;
}
