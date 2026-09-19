import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface WiaInlineProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: string[];
  onPrimaryAction?: () => void;
  primaryLabel?: string;
}

export default function WiaInline({
  eyebrow = 'WIA preparou',
  title,
  description,
  actions = [],
  onPrimaryAction,
  primaryLabel = 'Revisar ação',
}: WiaInlineProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#FF8A00]/20 bg-[#111214] p-4 text-zinc-100 shadow-sm sm:p-5" aria-label="Recomendação da WIA">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF8A00]/10 text-[#FF8A00]"><Sparkles className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#FF8A00]">{eyebrow}</p>
            <h2 className="mt-1 text-sm font-bold text-white">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">{description}</p>
            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map(action => <span key={action} className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-[10px] text-zinc-400"><CheckCircle2 className="h-3 w-3 text-[#FF8A00]" />{action}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] text-zinc-600"><ShieldCheck className="h-3.5 w-3.5" />controle humano</span>
          {onPrimaryAction && <button type="button" onClick={onPrimaryAction} className="inline-flex items-center gap-2 rounded-xl bg-[#FF8A00] px-3.5 py-2.5 text-xs font-bold text-black hover:bg-[#ff9d2e]">{primaryLabel}<ArrowRight className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
    </section>
  );
}
