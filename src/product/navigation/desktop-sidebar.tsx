import { PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import { OrktoIcon } from '../icons/orkto-icon';
import { getActiveNavigationId, primaryNavigation, secondaryNavigation } from './navigation-config';
import type { ProductView } from '../types';

interface DesktopSidebarProps {
  currentView: ProductView;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onNavigate: (view: ProductView) => void;
  darkMode: boolean;
  onThemeChange: (dark: boolean) => void;
  companyName?: string | null;
  userName?: string | null;
  isInternalAdmin?: boolean;
  onSignOut: () => void;
}

export function DesktopSidebar({
  currentView,
  collapsed,
  onCollapsedChange,
  onNavigate,
  darkMode,
  onThemeChange,
  companyName,
  userName,
  isInternalAdmin = false,
  onSignOut,
}: DesktopSidebarProps) {
  const activeId = getActiveNavigationId(currentView);
  return (
    <aside style={{ width: collapsed ? 'var(--orkto-shell-sidebar-compact)' : 'var(--orkto-shell-sidebar)' }} className="relative hidden h-dvh shrink-0 flex-col border-r orkto-product-border orkto-product-surface transition-[width] duration-200 lg:flex" aria-label="Navegação principal">
      <div className="flex min-h-16 shrink-0 items-center justify-between border-b px-4 orkto-product-border">
        <button type="button" onClick={() => onNavigate('dashboard')} className="flex min-h-11 items-center gap-2 rounded-lg text-left" aria-label="ORKTO, ir para Hoje">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl font-semibold" style={{ background: 'var(--orkto-brand)', color: 'var(--orkto-brand-on-fill)' }}>O</span>
          {!collapsed && <span className="text-sm font-semibold tracking-[0.12em]">ORKTO</span>}
        </button>
        <button type="button" onClick={() => onCollapsedChange(!collapsed)} className="flex h-10 w-10 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted" aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'} title={collapsed ? 'Expandir navegação' : 'Recolher navegação'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Módulos">
        <div className="space-y-5">
          {primaryNavigation.map(section => (
            <section key={section.label} aria-label={section.label}>
              {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">{section.label}</h2>}
              <ul className="space-y-1">
                {section.items.map(item => {
                  const active = activeId === item.id;
                  const disabled = item.availability !== 'available' || !item.view;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => item.view && onNavigate(item.view)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? `${item.label}${disabled && item.hint ? ` — ${item.hint}` : ''}` : disabled ? item.hint : undefined}
                        className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] transition-colors ${collapsed ? 'justify-center px-0' : ''} ${active ? 'orkto-product-nav-active font-semibold' : 'orkto-product-muted hover:orkto-product-surface-muted'} ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
                      >
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: 'var(--orkto-brand)' }} aria-hidden="true" />}
                        <OrktoIcon name={item.icon} size={20} />
                        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                        {disabled && !collapsed && <span className="text-[10px] orkto-product-subtle">Em breve</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {isInternalAdmin && <section aria-label="Administração interna">
            {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Interno</h2>}
            <button type="button" onClick={() => onNavigate('internal_finance')} aria-current={currentView === 'internal_finance' ? 'page' : undefined} aria-label={collapsed ? 'Financeiro ORKTO / POK' : undefined} title={collapsed ? 'Financeiro ORKTO / POK' : undefined} className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] ${collapsed ? 'justify-center px-0' : ''} ${currentView === 'internal_finance' ? 'orkto-product-nav-active font-semibold' : 'orkto-product-muted hover:orkto-product-surface-muted'}`}>
              {currentView === 'internal_finance' && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: 'var(--orkto-brand)' }} aria-hidden="true" />}
              <OrktoIcon name="finance" size={20} />{!collapsed && <span>Financeiro ORKTO / POK</span>}
            </button>
          </section>}

          <section aria-label="Conta e ajuda">
            {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Conta / secundário</h2>}
            <ul className="space-y-1">
              {secondaryNavigation.map(item => <li key={item.id}>
                <button type="button" disabled className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] orkto-product-muted opacity-60 ${collapsed ? 'justify-center px-0' : ''}`} aria-label={collapsed ? item.label : undefined} title={`${item.label} — ${item.hint || 'Indisponível'}`}>
                  <OrktoIcon name={item.icon} size={20} />{!collapsed && <><span className="min-w-0 flex-1 truncate">{item.label}</span><span className="text-[10px] orkto-product-subtle">Em breve</span></>}
                </button>
              </li>)}
            </ul>
          </section>
        </div>
      </nav>

      <div className="shrink-0 border-t p-3 orkto-product-border">
        <div className={`mb-2 flex rounded-lg border p-1 orkto-product-border orkto-product-surface-muted ${collapsed ? 'flex-col' : ''}`} aria-label="Aparência">
          <button type="button" onClick={() => onThemeChange(false)} aria-pressed={!darkMode} title="Modo claro" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs ${!darkMode ? 'orkto-product-nav-active' : 'orkto-product-muted hover:orkto-product-surface'}`}><Sun size={16} />{!collapsed && 'Claro'}</button>
          <button type="button" onClick={() => onThemeChange(true)} aria-pressed={darkMode} title="Modo escuro" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs ${darkMode ? 'orkto-product-nav-active' : 'orkto-product-muted hover:orkto-product-surface'}`}><Moon size={16} />{!collapsed && 'Escuro'}</button>
        </div>
        {!collapsed && <div className="mb-2 truncate px-2 text-xs font-medium" title={companyName || userName || 'Conta'}>{companyName || userName || 'Conta'}</div>}
        <button type="button" onClick={onSignOut} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] orkto-product-muted hover:orkto-product-surface-muted ${collapsed ? 'justify-center px-0' : ''}`} aria-label={collapsed ? 'Sair' : undefined} title={collapsed ? 'Sair' : undefined}>
          <OrktoIcon name="signout" size={20} />{!collapsed && 'Sair'}
        </button>
      </div>
    </aside>
  );
}
