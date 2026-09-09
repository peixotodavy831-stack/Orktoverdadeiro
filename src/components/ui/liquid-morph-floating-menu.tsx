import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

const ease = [0.22, 1, 0.36, 1] as const;

export type FloatingMenuItem = {
  label: string;
  onClick: () => void;
  active?: boolean;
};

type FloatingMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: FloatingMenuItem[];
};

export default function LiquidMorphFloatingMenu({
  isOpen,
  onOpenChange,
  items,
}: FloatingMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <motion.div
      ref={containerRef}
      aria-hidden={!isOpen}
      className={`fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.3rem)] z-[120] flex justify-center px-4 lg:hidden ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      initial={false}
      animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 24 }}
      transition={{ duration: 0.2, ease }}
    >
      <motion.div
        className="relative flex w-full max-w-[340px] flex-col overflow-hidden border border-orange-400/60 shadow-[0_24px_70px_rgba(0,0,0,0.4)]"
        initial={false}
        animate={{
          height: isOpen ? Math.min(390, 72 + items.length * 39) : 48,
          borderRadius: isOpen ? 30 : 999,
        }}
        transition={{ duration: 0.3, ease }}
      >
        <div className="absolute inset-0 bg-[#FF9F1C]" />
        <motion.div
          className="absolute left-1/2 h-[210%] w-[210%] -translate-x-1/2 rounded-full bg-zinc-950"
          initial={false}
          animate={{ bottom: isOpen ? '-28%' : '-220%' }}
          transition={{ duration: 0.32, ease }}
        />

        <nav
          aria-label="Menu completo"
          className="relative z-10 flex min-h-0 flex-1 flex-col items-stretch justify-center gap-0.5 overflow-y-auto px-5 pt-4"
        >
          {items.map((item, index) => (
            <motion.button
              key={item.label}
              type="button"
              tabIndex={isOpen ? 0 : -1}
              onClick={() => {
                item.onClick();
                onOpenChange(false);
              }}
              initial={false}
              animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 8 }}
              transition={{ duration: 0.18, delay: isOpen ? index * 0.012 : 0, ease }}
              className={`rounded-xl px-4 py-2 text-left text-sm font-extrabold uppercase tracking-tight transition-colors ${
                item.active
                  ? 'bg-[#FF9F1C] text-zinc-950'
                  : 'text-zinc-100 hover:bg-white/10 active:bg-white/15'
              }`}
            >
              {item.label}
            </motion.button>
          ))}
        </nav>

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => onOpenChange(false)}
          className="relative z-10 flex h-14 w-full shrink-0 items-center justify-between px-6 text-sm font-bold text-zinc-100"
          aria-label="Fechar menu"
        >
          <span>Menu</span>
          <span className="relative h-6 w-6" aria-hidden="true">
            <motion.span className="absolute left-1 top-1/2 block h-0.5 w-[18px] -translate-y-1/2 rounded-full bg-zinc-100" animate={{ rotate: 45 }} />
            <motion.span className="absolute left-1 top-1/2 block h-0.5 w-[18px] -translate-y-1/2 rounded-full bg-zinc-100" animate={{ rotate: -45 }} />
          </span>
        </button>
      </motion.div>
    </motion.div>
  );
}
