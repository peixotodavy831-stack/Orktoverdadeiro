import { useEffect, useState } from 'react';
import { productApi } from '../api';

import { wiaRuntimeLabel } from './wia-runtime-label';

/** Uses the existing read-only status contract; never invokes inference. */
export default function WiaRuntimeStatus({ accessToken, onOpenSettings }: { accessToken: string | null; onOpenSettings: () => void }) {
  const [status, setStatus] = useState<{ token: string | null; label: string } | null>(null);
  useEffect(() => {
    let active = true;
    productApi<{ data?: { wia?: { state?: unknown } } }>('/api/integrations/status', accessToken)
      .then(result => { if (active) setStatus({ token: accessToken, label: wiaRuntimeLabel(result.data?.wia?.state) }); })
      .catch(() => { if (active) setStatus({ token: accessToken, label: wiaRuntimeLabel(null) }); });
    return () => { active = false; };
  }, [accessToken]);
  return <section className="wia-runtime-status rounded-lg border p-3 orkto-product-border orkto-product-surface-muted" aria-label="Disponibilidade da WIA">
    <p role="status" className="text-sm leading-6">{status?.token === accessToken ? status.label : 'Consultando disponibilidade do modelo…'}</p>
    <p className="mt-1 text-xs leading-5 orkto-product-muted">Consultas aos registros e linguagem livre têm requisitos diferentes. Uma configuração encontrada não confirma acesso ao modelo.</p>
    <button type="button" onClick={onOpenSettings} className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold" style={{ color: 'var(--orkto-brand-text)' }}>Ver integrações</button>
  </section>;
}
