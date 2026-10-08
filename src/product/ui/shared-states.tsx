import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, CircleHelp, LoaderCircle, LockKeyhole, RefreshCw, Settings2 } from 'lucide-react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between orkto-product-border">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--orkto-brand-text)' }}>{eyebrow}</p>}
        <h1 className="mt-1 text-[25px] font-semibold leading-8 tracking-[-0.025em] sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-5 orkto-product-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold leading-6 tracking-[-0.015em]">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-5 orkto-product-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Metric({ label, value, note, icon }: { label: string; value: ReactNode; note?: string; icon?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-l-2 pl-3" style={{ borderColor: 'var(--orkto-border-strong)' }}>
      {icon && <span className="mt-1 orkto-product-muted">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[12px] leading-4 orkto-product-muted">{label}</p>
        <p className="mt-1 truncate text-[22px] font-semibold leading-7 tabular-nums">{value}</p>
        {note && <p className="mt-0.5 text-[11px] leading-4 orkto-product-subtle">{note}</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'critical' | 'attention' | 'success' | 'info' }) {
  const color = {
    neutral: 'var(--orkto-text-secondary)',
    critical: 'var(--orkto-critical)',
    attention: 'var(--orkto-attention)',
    success: 'var(--orkto-success)',
    info: 'var(--orkto-info)',
  }[tone];
  return <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium" style={{ color, borderColor: 'color-mix(in srgb, ' + color + ' 34%, var(--orkto-border))', background: 'color-mix(in srgb, ' + color + ' 8%, var(--orkto-surface-1))' }}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-start justify-center gap-3 rounded-xl border border-dashed p-6 orkto-product-border">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg orkto-product-surface-muted orkto-product-muted">{icon || <CircleHelp size={18} />}</span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-lg text-[13px] leading-5 orkto-product-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Não foi possível carregar', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'color-mix(in srgb, var(--orkto-critical) 35%, var(--orkto-border))' }}>
      <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--orkto-critical)' }} />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-[13px] leading-5 orkto-product-muted">{message}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold orkto-product-control"><RefreshCw size={14} />Tentar novamente</button>}
      </div>
    </div>
  );
}

export function LoadingState({ rows = 3, label = 'Carregando conteúdo' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b pb-4 orkto-product-border">
          <div className="h-9 w-9 animate-pulse rounded-lg orkto-product-surface-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded orkto-product-surface-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded orkto-product-surface-muted" />
          </div>
        </div>
      ))}
      <span className="sr-only"><LoaderCircle aria-hidden="true" /></span>
    </div>
  );
}

export function PermissionState({ message = 'Você não tem acesso a estes dados ou a esta ação.' }: { message?: string }) {
  return <EmptyState title="Acesso necessário" description={message} icon={<LockKeyhole size={18} />} />;
}

export function ConfigurationRequired({ title = 'Configuração necessária', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return <EmptyState title={title} description={message} icon={<Settings2 size={18} />} action={action} />;
}

export function BackendPending({ title = 'Recurso pendente neste ambiente', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return <EmptyState title={title} description={`${message} Esta pendência de desenvolvimento não representa uma experiência de produção concluída.`} icon={<CircleHelp size={18} />} action={action} />;
}

export function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold" style={{ color: 'var(--orkto-brand-text)' }}>{children}<ArrowRight size={14} /></button>;
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return <div role="status" className="flex items-start gap-2 rounded-lg border p-3 text-[13px]" style={{ color: 'var(--orkto-success)', borderColor: 'color-mix(in srgb, var(--orkto-success) 32%, var(--orkto-border))' }}><Check size={16} className="mt-0.5 shrink-0" />{children}</div>;
}
