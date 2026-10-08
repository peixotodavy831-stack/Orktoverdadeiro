import type { ProductView } from '../types';
import type { OrktoIconName } from '../icons/orkto-icon';

export interface NavigationItem {
  id: string;
  label: string;
  icon: OrktoIconName;
  view?: ProductView;
  availability: 'available' | 'not_available';
  hint?: string;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

export const primaryNavigation: NavigationSection[] = [
  {
    label: 'Operação',
    items: [
      { id: 'today', label: 'Hoje', icon: 'today', view: 'dashboard', availability: 'available' },
      { id: 'inbox', label: 'Inbox', icon: 'inbox', view: 'conversations', availability: 'available' },
      { id: 'clients', label: 'Clientes', icon: 'clients', view: 'clients', availability: 'available' },
      { id: 'deals', label: 'Negócios', icon: 'deals', view: 'deals', availability: 'available' },
      { id: 'proposals', label: 'Propostas', icon: 'proposals', view: 'quotes', availability: 'available' },
      { id: 'catalog', label: 'Catálogo', icon: 'catalog', view: 'services', availability: 'available' },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { id: 'wia', label: 'WIA', icon: 'wia', view: 'wia', availability: 'available' },
      { id: 'reports', label: 'Relatórios', icon: 'reports', view: 'analytics', availability: 'available' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { id: 'integrations', label: 'Integrações', icon: 'integrations', availability: 'not_available', hint: 'O centro de integrações ainda não está disponível neste checkout.' },
      { id: 'team', label: 'Equipe', icon: 'team', availability: 'not_available', hint: 'A tela de equipe ainda não está disponível neste checkout.' },
      { id: 'billing', label: 'Plano & Cobrança', icon: 'billing', view: 'billing', availability: 'available' },
      { id: 'settings', label: 'Configurações', icon: 'settings', view: 'settings', availability: 'available' },
    ],
  },
];

export const secondaryNavigation: NavigationItem[] = [
  { id: 'profile', label: 'Perfil', icon: 'profile', availability: 'not_available', hint: 'A página de perfil ainda não está disponível neste checkout.' },
  { id: 'audit', label: 'Auditoria', icon: 'audit', availability: 'not_available', hint: 'A visualização de auditoria ainda não está disponível nesta tela.' },
  { id: 'help', label: 'Ajuda', icon: 'help', availability: 'not_available', hint: 'Central de ajuda indisponível nesta versão.' },
];

export const getActiveNavigationId = (view: string) => {
  if (view === 'dashboard') return 'today';
  if (view === 'conversations' || view === 'conversation') return 'inbox';
  if (view === 'wia') return 'wia';
  if (view === 'quotes' || view === 'create_quote' || view === 'quote_detail') return 'proposals';
  if (view === 'services') return 'catalog';
  if (view === 'analytics') return 'reports';
  if (view === 'billing') return 'billing';
  if (view === 'internal_finance') return 'finance';
  return view;
};

export const quickCreateItems = [
  { id: 'client', label: 'Novo cliente', view: 'clients' as ProductView, availability: 'available' as const },
  { id: 'deal', label: 'Novo negócio', view: 'deals' as ProductView, availability: 'available' as const },
  { id: 'proposal', label: 'Nova proposta', view: 'create_quote' as ProductView, availability: 'available' as const },
  { id: 'interaction', label: 'Nova interação', view: 'conversations' as ProductView, availability: 'not_available' as const, hint: 'A criação de uma conversa ainda depende de um fluxo de abertura confirmado.' },
];
