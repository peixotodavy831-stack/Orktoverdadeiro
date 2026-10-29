import {useModalFocus as useModalKeyboard} from '../ui/use-modal-focus';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, MoreHorizontal, Plus, X } from 'lucide-react';
import { OrktoIcon } from '../icons/orkto-icon';
import { quickCreateItems, getActiveNavigationId } from './navigation-config';
import type { ProductView } from '../types';
import {NavigationDirectory} from './navigation-directory-view';

interface MobileNavigationProps {
  currentView: ProductView;
  onNavigate: (view: ProductView) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSignOut: () => void;
  onQuickCreate?: (id: string, view: ProductView) => void;
}

const dock = [
  { id: 'today', label: 'Hoje', icon: 'today' as const, view: 'dashboard' as ProductView },
  { id: 'inbox', label: 'Conversas', icon: 'inbox' as const, view: 'conversations' as ProductView },
  { id: 'deals', label: 'Negócios', icon: 'deals' as const, view: 'deals' as ProductView },
  { id: 'wia', label: 'WIA', icon: 'wia' as const, view: 'wia' as ProductView },
  { id: 'more', label: 'Mais', icon: null, view: null },
];


export function MobileNavigation({ currentView, onNavigate, menuOpen, onMenuOpenChange, onSignOut, onQuickCreate }: MobileNavigationProps) {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const activeId = getActiveNavigationId(currentView);
  const moreActive = !dock.some(item => item.id === activeId);
  const hideDock = currentView === 'conversation';

  useModalKeyboard(menuOpen, () => onMenuOpenChange(false), menuRef);
  useModalKeyboard(quickCreateOpen, () => setQuickCreateOpen(false), quickRef);

  const navigate = (view: ProductView) => {
    onNavigate(view);
    onMenuOpenChange(false);
    setQuickCreateOpen(false);
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && (event.target as HTMLElement).getAttribute('data-action') === 'menu-item-disabled') event.preventDefault();
  };

  return (
    <>
      {!hideDock && <nav className="orkto-mobile-dock fixed inset-x-0 bottom-0 z-[90] border-t orkto-product-border orkto-product-surface lg:hidden" aria-label="Navegação móvel principal">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5 items-center px-2">
          {dock.map(item => {
            const active = activeId === item.id;
            if (item.id === 'more') return <button key={item.id} type="button" onClick={() => onMenuOpenChange(true)} aria-label="Mais módulos" aria-haspopup="dialog" aria-expanded={menuOpen} aria-current={moreActive ? 'page' : undefined} style={moreActive ? {color: 'var(--orkto-brand-text)'} : undefined} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs orkto-product-muted"><MoreHorizontal size={21} aria-hidden="true" /><span>Mais</span></button>;
            return <button key={item.id} type="button" onClick={() => item.view && navigate(item.view)} aria-current={active ? 'page' : undefined} aria-label={item.label} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${active ? 'font-semibold' : 'orkto-product-muted'}`} style={active ? { color: 'var(--orkto-brand-text)' } : undefined}>
              {item.icon && <OrktoIcon name={item.icon} size={21} />}
              <span>{item.label}</span>
              {active && <span className="sr-only">Selecionado</span>}
            </button>;
          })}
        </div>
      </nav>}

      {menuOpen && <div className="fixed inset-0 z-[140] lg:hidden" onMouseDown={event => { if (event.target === event.currentTarget) onMenuOpenChange(false); }}>
        <div className="absolute inset-0 bg-[var(--orkto-overlay)]" aria-hidden="true" onMouseDown={() => onMenuOpenChange(false)} />
        <section ref={menuRef} role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title" onKeyDown={handlePanelKeyDown} className="orkto-mobile-sheet absolute inset-x-0 bottom-0 flex max-h-[min(90dvh,760px)] flex-col overflow-hidden rounded-t-2xl border-t p-4 pb-[max(16px,env(safe-area-inset-bottom))] orkto-product-border orkto-product-surface shadow-[var(--orkto-shadow-panel)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full orkto-product-surface-muted" aria-hidden="true" />
          <div className="mb-3 flex items-center justify-between">
            <h2 id="mobile-menu-title" className="text-lg font-semibold">Mais</h2>
            <button type="button" data-autofocus="true" onClick={() => onMenuOpenChange(false)} aria-label="Fechar menu" className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><X size={18} /></button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Todos os módulos">
            <NavigationDirectory currentView={currentView} onNavigate={navigate}/>
            <button type="button" onClick={()=>{onMenuOpenChange(false);setQuickCreateOpen(true);}} className="mt-4 flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-sm orkto-product-border orkto-product-muted"><Plus size={18} aria-hidden="true"/>Outras criações</button>
          </nav>
          <button type="button" onClick={onSignOut} className="mt-3 flex min-h-12 w-full items-center gap-3 border-t pt-3 text-left text-sm orkto-product-border orkto-product-muted"><OrktoIcon name="signout" size={18} />Sair</button>
        </section>
      </div>}

      {quickCreateOpen && <div className="fixed inset-0 z-[150] lg:hidden" onMouseDown={event => { if (event.target === event.currentTarget) setQuickCreateOpen(false); }}>
        <div className="absolute inset-0 bg-[var(--orkto-overlay)]" aria-hidden="true" onMouseDown={() => setQuickCreateOpen(false)} />
        <section ref={quickRef} role="dialog" aria-modal="true" aria-labelledby="quick-create-title" className="orkto-mobile-sheet absolute inset-x-0 bottom-0 rounded-t-2xl border-t p-4 pb-[max(16px,env(safe-area-inset-bottom))] orkto-product-border orkto-product-surface shadow-[var(--orkto-shadow-panel)]">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-medium uppercase tracking-[0.14em] orkto-product-subtle">Atalho</p><h2 id="quick-create-title" className="mt-1 text-lg font-semibold">Criar novo</h2></div><button type="button" data-autofocus="true" onClick={() => setQuickCreateOpen(false)} aria-label="Fechar criação rápida" className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><X size={18} /></button></div>
          <ul className="space-y-2">
            {quickCreateItems.map(item => {
              const disabled = item.availability !== 'available';
              return <li key={item.id}><button type="button" disabled={disabled} data-action={disabled ? 'menu-item-disabled' : undefined} onClick={() => { if (disabled) return; onQuickCreate?.(item.id, item.view); navigate(item.view); }} title={disabled ? item.hint : undefined} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm orkto-product-border ${disabled ? 'cursor-not-allowed opacity-55' : 'orkto-product-surface hover:orkto-product-surface-muted'}`}><span>{item.label}{disabled && item.hint && <span className="mt-0.5 block text-[11px] orkto-product-subtle">{item.hint}</span>}</span>{!disabled && <ArrowRight size={16} className="orkto-product-muted" />}</button></li>;
            })}
          </ul>
        </section>
      </div>}
    </>
  );
}
