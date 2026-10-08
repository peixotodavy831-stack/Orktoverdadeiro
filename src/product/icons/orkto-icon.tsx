import type { ReactNode } from 'react';
import WiaMark from '../../components/wia/WiaMark';

export type OrktoIconName =
  | 'today'
  | 'inbox'
  | 'clients'
  | 'deals'
  | 'proposals'
  | 'catalog'
  | 'wia'
  | 'reports'
  | 'integrations'
  | 'team'
  | 'billing'
  | 'settings'
  | 'profile'
  | 'audit'
  | 'finance'
  | 'notifications'
  | 'help'
  | 'signout';

interface OrktoIconProps {
  name: OrktoIconName;
  size?: number;
  className?: string;
  decorative?: boolean;
}

const glyphs: Record<Exclude<OrktoIconName, 'wia'>, ReactNode> = {
  today: <><path d="M4.5 7.5h6l2 2h7" /><path d="M4.5 7.5v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9.5" /><circle cx="16.5" cy="14" r="2.5" /><path d="m18.3 15.8 2 2" /></>,
  inbox: <><path d="M4 5.5h16l1 10.5h-5l-1.5 2h-5L8 16H3z" /><path d="M4 12h4l1.5 2h5L16 12h4" /><path d="M12 3v6m0 0-2.5-2.5M12 9l2.5-2.5" /></>,
  clients: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V19z" /><circle cx="17" cy="9" r="2.2" /><path d="M16.2 13h.7a4 4 0 0 1 4 4v2h-4" /></>,
  deals: <><path d="M4 19.5h16" /><path d="M5.5 16.5 10 12l3 2.5 5.5-6" /><circle cx="18.5" cy="8.5" r="2" /><path d="M15.5 5.5h3v3" /></>,
  proposals: <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h3" /><path d="M9 9h2" /></>,
  catalog: <><path d="m4 8 8-4.5L20 8v8l-8 4.5L4 16z" /><path d="m4.5 8.2 7.5 4.3 7.5-4.3M12 12.5v8" /><path d="M8 6.2 16 10.7" /></>,
  reports: <><path d="M4 19.5V5" /><path d="M4 19.5h16" /><path d="M7 15v-3m4 3V8m4 7V5m4 10v-5" /><path d="m6.5 9 4-3 4 1 4-3" /></>,
  integrations: <><path d="M7 4v5m4-5v5M5 9h8v2a4 4 0 0 1-4 4h0v5" /><path d="M17 20v-5m-4 0h8v-2a4 4 0 0 0-4-4h0V4" /></>,
  team: <><circle cx="12" cy="7" r="3" /><circle cx="5" cy="10" r="2" /><circle cx="19" cy="10" r="2" /><path d="M5.5 19v-1a6.5 6.5 0 0 1 13 0v1z" /><path d="M2.5 18v-.7A3.3 3.3 0 0 1 5.8 14M21.5 18v-.7a3.3 3.3 0 0 0-3.3-3.3" /></>,
  billing: <><path d="M5 4.5h14v15l-2.4-1.5-2.3 1.5-2.3-1.5-2.3 1.5-2.3-1.5L5 19.5z" /><path d="M8 9h8M8 12.5h5" /><circle cx="16" cy="15.5" r="2.3" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="18" r="2" /></>,
  profile: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /><path d="M18.5 4.5h2v2" /></>,
  audit: <><path d="M5 5.5h14M5 10h8M5 14.5h7M5 19h6" /><circle cx="17.5" cy="15.5" r="3.5" /><path d="M17.5 13.5v2l1.5 1" /></>,
  finance: <><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5c-.6-.8-1.5-1.2-2.7-1.2-1.6 0-2.7.8-2.7 2s.9 1.7 2.7 2c1.7.3 2.7.9 2.7 2.1s-1.1 2.1-2.8 2.1c-1.2 0-2.3-.5-3-1.4M12.7 5.8v12.4" /></>,
  notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 9h17C20.5 16 18 16 18 9Z" /><path d="M10 21h4" /><circle cx="19.5" cy="5" r="2.5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 1 1 4.8 1.4c-.7 1-2.3 1.2-2.3 2.8" /><circle cx="12" cy="17" r=".7" /></>,
  signout: <><path d="M13 4h6a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20h-6" /><path d="M3.5 12h11m0 0-4-4m4 4-4 4" /></>,
};

export function OrktoIcon({ name, size = 24, className, decorative = true }: OrktoIconProps) {
  if (name === 'wia') return <WiaMark size={size} className={className || ''} accentColor="currentColor" />;
  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {glyphs[name]}
    </svg>
  );
}
