import React from 'react';
import { Home, Users, Plus, Menu, FileText } from 'lucide-react';
import { Dock, DockIcon, DockItem, DockLabel } from './dock';

interface TubelightNavbarProps {
  currentView: 'landing' | 'auth' | 'dashboard' | 'quotes' | 'create_quote' | 'quote_detail' | 'clients' | 'services' | 'settings' | 'analytics' | 'billing' | 'conversations' | 'conversation';
  setCurrentView: (view: any) => void;
  setSelectedQuoteId: (id: any) => void;
  onMenuOpen: () => void;
}

export default function TubelightNavbar({
  currentView,
  setCurrentView,
  setSelectedQuoteId,
  onMenuOpen,
}: TubelightNavbarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: Home, view: 'dashboard' as const },
    { id: 'quotes', label: 'Orçamentos', icon: FileText, view: 'quotes' as const },
    { id: 'create_quote', label: 'Novo', icon: Plus, view: 'create_quote' as const, isSpecial: true },
    { id: 'clients', label: 'Clientes', icon: Users, view: 'clients' as const },
    { id: 'menu', label: 'Menu', icon: Menu, view: null, opensMenu: true },
  ];

  const handleTabClick = (item: typeof navItems[0]) => {
    if (item.opensMenu) {
      onMenuOpen();
      return;
    }
    setSelectedQuoteId(null);
    if (item.view) setCurrentView(item.view);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[100] flex justify-center px-3 lg:hidden">
      <Dock className="pointer-events-auto pb-0.5" panelHeight={54} magnification={56} distance={82}>
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <DockItem key={item.id} className="h-[52px]">
              <DockLabel>{item.label}</DockLabel>
              <DockIcon>
                <button
                  id={`dock-btn-${item.id}`}
                  type="button"
                  onClick={() => handleTabClick(item)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-full w-full touch-manipulation items-center justify-center rounded-2xl border transition-colors active:scale-95 ${
                    item.isSpecial
                      ? 'border-orange-400 bg-[#FF9F1C] text-zinc-950 shadow-[0_6px_18px_rgba(255,159,28,0.35)]'
                      : isActive
                        ? 'border-orange-400/40 bg-orange-500/15 text-[#FF9F1C] dark:bg-orange-500/20'
                        : 'border-zinc-200 bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <Icon className="h-6 w-6 stroke-[2.3]" />
                  {isActive && !item.isSpecial && (
                    <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#FF9F1C]" />
                  )}
                </button>
              </DockIcon>
            </DockItem>
          );
        })}
      </Dock>
    </div>
  );
}
