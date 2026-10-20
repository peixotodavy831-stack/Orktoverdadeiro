import { ChevronDown, PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import { OrktoIcon } from '../icons/orkto-icon';
import OrktoLogo from '../../components/OrktoLogo';
import { getActiveNavigationId, primaryNavigation, secondaryNavigation } from './navigation-config';
import type { ProductView } from '../types';
import { WorkspaceIdentity } from './workspace-identity';
import { useEffect, useState } from 'react';

interface DesktopSidebarProps {
  currentView: ProductView;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onNavigate: (view: ProductView) => void;
  darkMode: boolean;
  onThemeChange: (dark: boolean) => void;
  companyName?: string | null;
  userName?: string | null;
  companyLogo?: string | null;
  photoUrl?: string | null;
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
  companyLogo,
  photoUrl,
  isInternalAdmin = false,
  onSignOut,
}: DesktopSidebarProps) {
  const activeId = getActiveNavigationId(currentView);
  const [managementOpen,setManagementOpen]=useState(false);
  useEffect(()=>{if(primaryNavigation.find(section=>section.label==='Gestão')?.items.some(item=>item.view===currentView))setManagementOpen(true);},[currentView]);
  const upcoming = [...primaryNavigation.flatMap(section => section.items), ...secondaryNavigation].filter(item => item.availability !== 'available' || !item.view);
  return (
    <aside style={{ width: collapsed ? 'var(--orkto-shell-sidebar-compact)' : 'var(--orkto-shell-sidebar)' }} className="orkto-sidebar-glass relative hidden h-dvh shrink-0 flex-col border-r orkto-product-border orkto-product-surface transition-[width] duration-200 lg:flex" aria-label="Navegação principal">
      <div className={`orkto-sidebar-brand flex min-h-16 shrink-0 items-center border-b orkto-product-border ${collapsed ? 'flex-col gap-1 px-2 py-3' : 'justify-between px-4'}`}>
        <button type="button" onClick={() => onNavigate('dashboard')} className="flex min-h-11 items-center gap-2 rounded-lg text-left" aria-label="ORKTO, ir para Hoje">
          <OrktoLogo size="sm" onlyO={collapsed} darkMode={darkMode} />
        </button>
        <button type="button" onClick={() => onCollapsedChange(!collapsed)} className="flex h-10 w-10 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted" aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'} title={collapsed ? 'Expandir navegação' : 'Recolher navegação'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Módulos">
        <div className="flex flex-col gap-2">
          {primaryNavigation.map(section => ({ ...section, items: section.items.filter(item => item.availability === 'available' && item.view) })).filter(section => section.items.length > 0).map(section => (
            <section key={section.label} aria-label={section.label}>
              {!collapsed && (section.label==='Gestão'?<h2><button type="button" onClick={()=>setManagementOpen(value=>!value)} aria-expanded={managementOpen} aria-controls="orkto-management-links" className="flex w-full items-center justify-between rounded-lg px-3 text-left text-xs font-medium orkto-product-muted">Gestão <ChevronDown size={14} className={managementOpen?'rotate-180':''} aria-hidden="true" /></button></h2>:<h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.09em] orkto-product-subtle">{section.label}</h2>)}
              <ul id={section.label==='Gestão'?'orkto-management-links':undefined} hidden={!collapsed&&section.label==='Gestão'&&!managementOpen} className="space-y-0.5">
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

          <section aria-label="Suporte e controle"><ul className="space-y-1">{secondaryNavigation.filter(item=>item.availability==='available'&&item.view).map(item=><li key={item.id}><button type="button" onClick={()=>item.view&&onNavigate(item.view)} aria-current={currentView===item.view?'page':undefined} aria-label={collapsed?item.label:undefined} title={collapsed?item.label:undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] ${collapsed?'justify-center px-0':''} ${currentView===item.view?'orkto-product-nav-active font-semibold':'orkto-product-muted hover:orkto-product-surface-muted'}`}><OrktoIcon name={item.icon} size={20} />{!collapsed&&item.label}</button></li>)}</ul></section>

          {isInternalAdmin && <section aria-label="Administração interna">
            {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Interno</h2>}
            <button type="button" onClick={() => onNavigate('internal_finance')} aria-current={currentView === 'internal_finance' ? 'page' : undefined} aria-label={collapsed ? 'Financeiro ORKTO / POK' : undefined} title={collapsed ? 'Financeiro ORKTO / POK' : undefined} className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] ${collapsed ? 'justify-center px-0' : ''} ${currentView === 'internal_finance' ? 'orkto-product-nav-active font-semibold' : 'orkto-product-muted hover:orkto-product-surface-muted'}`}>
              {currentView === 'internal_finance' && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: 'var(--orkto-brand)' }} aria-hidden="true" />}
              <OrktoIcon name="finance" size={20} />{!collapsed && <span>Financeiro ORKTO / POK</span>}
            </button>
          </section>}

          {!collapsed && upcoming.length>0 && <details className="orkto-upcoming">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-xs orkto-product-muted">Próximos recursos <ChevronDown size={14} aria-hidden="true" /></summary>
            <ul className="space-y-1 pt-1" aria-label="Recursos ainda indisponíveis">
              {upcoming.map(item => <li key={item.id} className="flex min-h-10 items-center gap-3 px-3 text-xs orkto-product-subtle" title={item.hint}>
                <OrktoIcon name={item.icon} size={17} /><span className="flex-1">{item.label}</span><span className="text-[10px]">Em breve</span>
              </li>)}
            </ul>
          </details>}
        </div>
      </nav>

      <div className="shrink-0 border-t p-3 orkto-product-border">
        <div className={`mb-2 flex rounded-lg border p-1 orkto-product-border orkto-product-surface-muted ${collapsed ? 'flex-col' : ''}`} aria-label="Aparência">
          <button type="button" onClick={() => onThemeChange(false)} aria-pressed={!darkMode} title="Modo claro" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs ${!darkMode ? 'orkto-product-nav-active' : 'orkto-product-muted hover:orkto-product-surface'}`}><Sun size={16} />{!collapsed && 'Claro'}</button>
          <button type="button" onClick={() => onThemeChange(true)} aria-pressed={darkMode} title="Modo escuro" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs ${darkMode ? 'orkto-product-nav-active' : 'orkto-product-muted hover:orkto-product-surface'}`}><Moon size={16} />{!collapsed && 'Escuro'}</button>
        </div>
        <WorkspaceIdentity companyName={companyName} userName={userName} companyLogo={companyLogo} photoUrl={photoUrl} collapsed={collapsed} onOpenProfile={()=>onNavigate('profile')} />
        <button type="button" onClick={onSignOut} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] orkto-product-muted hover:orkto-product-surface-muted ${collapsed ? 'justify-center px-0' : ''}`} aria-label={collapsed ? 'Sair' : undefined} title={collapsed ? 'Sair' : undefined}>
          <OrktoIcon name="signout" size={20} />{!collapsed && 'Sair'}
        </button>
      </div>
    </aside>
  );
}
