import type { ComponentProps } from 'react';
import { ArrowUpRight, Gauge } from 'lucide-react';
import { cn } from '../../lib/utils';
import { quotaSnapshot } from '../../product/adapters/quota-model';

export interface QuotaBannerProps extends ComponentProps<'aside'> {
  label?: string;
  limit: number | null;
  used: number | null;
  remaining?: number | null;
  resetsAt?: string | null;
  unit?: string;
  onUpgrade?: () => void;
}
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** Supplied quota-banner layout, adapted to ORKTO's nullable, server-owned Pulso balance. */
export function QuotaBanner({ className, label = 'Pulso', limit, used, remaining, resetsAt,
  unit = 'Pulsos', onUpgrade, ...props }: QuotaBannerProps) {
  const quota = quotaSnapshot(used, limit, remaining);
  return <aside {...props} data-slot="quota-banner" className={cn('orkto-quota-banner', className)} aria-label={label}>
    <span className="orkto-quota-icon"><Gauge size={19} aria-hidden="true" /></span>
    <div className="orkto-quota-body">
      <h2>{label}</h2>
      {quota.state === 'known' ? <>
        <p className="orkto-quota-numbers">{number.format(quota.used)} <span>/ {number.format(quota.limit)} {unit}</span></p>
        <p className="orkto-quota-caption">Utilizados ou reservados na franquia aprovada</p>
        {quota.limit > 0 && <meter className="sr-only" min={0} max={quota.limit} value={Math.min(quota.used, quota.limit)}
          aria-label={`${label}: ${number.format(quota.used)} de ${number.format(quota.limit)} ${unit} utilizados ou reservados`} />}
        <div className="orkto-quota-track" aria-hidden="true"><div data-tone={quota.tone} style={{ width: `${quota.percentage}%` }} /></div>
        <p className="orkto-quota-caption">{number.format(quota.remaining)} disponíveis{resetsAt ? ` · Renovação: ${resetsAt}` : ' · Renovação não informada'}</p>
      </> : <>
        <p className="orkto-quota-unknown">{quota.state === 'unknown' ? 'Franquia ainda não aprovada' : 'Saldo não confirmado'}</p>
        <p className="orkto-quota-caption">{quota.state === 'unknown' ? 'Consultas determinísticas continuam disponíveis. Uso generativo exige limite aprovado.' : 'Os dados retornados são inconsistentes. Atualize a consulta para confirmar o consumo.'}</p>
      </>}
    </div>
    {onUpgrade && <button type="button" className="orkto-quota-plans" onClick={onUpgrade}>Ver planos<ArrowUpRight size={16} aria-hidden="true" /></button>}
  </aside>;
}
export default QuotaBanner;
