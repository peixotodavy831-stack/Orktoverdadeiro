import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Route, ScanLine } from 'lucide-react';
import { productApi } from '../api';

interface EfficiencyPreview {
  tier: 1 | 2 | 3;
  blocked: boolean;
  usage_basis: string;
  block_reasons: string[];
}

/** Planning only. Never calls route-agent, reserves Pulso or invokes a model. */
export function WiaPlanPreview({ message, accessToken, disabled }: { message: string; accessToken: string | null; disabled: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [plan, setPlan] = useState<EfficiencyPreview | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setState('idle');
    setPlan(null);
    return () => controller.current?.abort();
  }, [message, accessToken]);
  const preview = async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setState('loading');
    try {
      const result = await productApi<{data: EfficiencyPreview}>('/api/wia-efficiency/plan', accessToken, {
        method: 'POST', body: JSON.stringify({message: message.trim()}), signal: request.signal,
      });
      if (request.signal.aborted) return;
      if (![1, 2, 3].includes(result.data?.tier) || typeof result.data.blocked !== 'boolean') throw new Error('Invalid preview');
      setPlan(result.data);
      setState('ready');
    } catch {
      if (!request.signal.aborted) setState('error');
    }
  };
  const tooLong = message.trim().length > 2000;
  return <div className="orkto-operation-preview">
    <button type="button" onClick={() => void preview()} disabled={disabled || state === 'loading' || !message.trim() || tooLong} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold orkto-product-control"><ScanLine size={16} aria-hidden="true" />{state === 'loading' ? 'Calculando prévia…' : 'Ver prévia do pedido'}</button>
    <p className="mt-1 text-xs leading-5 orkto-product-muted">Somente planejamento. Não consulta seus registros, não usa IA e não consome Pulsos.</p>
    {tooLong && <p className="mt-2 text-xs orkto-product-muted">A prévia aceita até 2.000 caracteres. Você pode reduzir o texto para planejá-lo.</p>}
    <div role="status" aria-live="polite">
      {state === 'error' && <p className="mt-3 text-sm">Prévia indisponível. Confira sua sessão e tente novamente. Nenhuma ação foi executada.</p>}
      {state === 'ready' && plan && <div className="mt-3 space-y-2 text-sm">
        <p className="font-semibold">{plan.tier === 1 ? 'Consulta determinística prevista' : 'Este pedido pode precisar de um modelo de IA'}</p>
        <p className="text-xs leading-5 orkto-product-muted">{plan.tier === 1 ? 'O planejador reconheceu uma consulta de leitura. Os dados só serão consultados quando você enviar o pedido.' : 'A execução ainda verificará modelo, tarifa, saldo e autorizações. Esta prévia não autoriza gasto nem garante execução.'}</p>
        {plan.blocked && <p className="text-xs leading-5 orkto-product-muted">Há uma dependência de configuração. Confira “Disponibilidade e integrações” antes de enviar.</p>}
      </div>}
    </div>
  </div>;
}

interface PlaybookPreview {
  title: string;
  when_to_use: string;
  steps: Array<{id: string; title: string; description: string; requires_approval: boolean}>;
  read_only: boolean;
  execution_available: boolean;
}

export function CommercialProcessPreview({ accessToken }: { accessToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [preview, setPreview] = useState<PlaybookPreview | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const request = new AbortController();
    setState('loading');
    setPreview(null);
    void productApi<{data: PlaybookPreview}>('/api/playbooks/proposal_recovery/preview', accessToken, {signal:request.signal})
      .then(result => {
        if (request.signal.aborted) return;
        if (result.data?.read_only !== true || result.data.execution_available !== false || !Array.isArray(result.data.steps)) throw new Error('Invalid preview');
        setPreview(result.data);
        setState('ready');
      }).catch(() => { if (!request.signal.aborted) setState('error'); });
    return () => request.abort();
  }, [open, accessToken, attempt]);
  return <section className="orkto-commercial-process" aria-label="Processos comerciais">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="orkto-process-preview" className="flex min-h-12 w-full items-center gap-3 py-3 text-left text-sm font-semibold"><Route size={18} aria-hidden="true" /><span className="min-w-0 flex-1">Processos comerciais <span className="ml-2 text-xs font-normal orkto-product-muted">Playbooks · prévia</span></span><ChevronDown size={16} className={open ? 'rotate-180' : ''} aria-hidden="true" /></button>
    {open && <div id="orkto-process-preview" className="pb-4">
      <p className="text-xs leading-5 orkto-product-muted">Veja como organizar o acompanhamento de propostas. A R1 não inicia processos nem cria tarefas.</p>
      <div aria-live="polite" role="status">{state === 'loading' && <p className="mt-3 text-sm">Carregando processo…</p>}{state === 'error' && <div className="mt-3 text-sm"><p>Não foi possível carregar a prévia. Nenhum processo foi iniciado.</p><button type="button" className="mt-2 min-h-11 rounded-lg px-3 text-xs font-semibold orkto-product-control" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}</div>
      {state === 'ready' && preview && <><h2 className="mt-4 text-base font-semibold">{preview.title}</h2><p className="mt-2 max-w-prose text-sm leading-6 orkto-product-muted">{preview.when_to_use}</p><ol className="orkto-process-steps">{preview.steps.map((step,index) => <li key={step.id}><span className="orkto-process-index" aria-hidden="true">{index+1}</span><div className="min-w-0"><h3 className="text-sm font-semibold">{step.title}</h3>{step.requires_approval && <p className="mt-1 text-xs font-medium" style={{color:'var(--orkto-brand-text)'}}>Depende de aprovação humana</p>}<p className="mt-1 text-xs leading-5 orkto-product-muted">{step.description}</p></div></li>)}</ol><p className="text-xs font-medium orkto-product-muted">Somente leitura · sem execução ou envio externo</p></>}
    </div>}
  </section>;
}
