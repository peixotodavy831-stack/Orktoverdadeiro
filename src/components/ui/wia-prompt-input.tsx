import { forwardRef, useEffect, useRef, useState } from 'react';
import { ArrowUp, LoaderCircle, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  id?: string;
  maxLength?: number;
}

/** Adapted from the supplied morphing input. Text only matches the current WIA API. */
export const PromptInput = forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput({
  value, onChange, onSubmit, placeholder = 'O que vamos organizar?', className,
  disabled = false, busy = false, id = 'wia-request', maxLength = 4000,
}, ref) {
  const [focused, setFocused] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const expanded = focused || value.length > 0 || busy;
  const unavailable = disabled || busy;
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(160, Math.max(expanded ? 68 : 24, element.scrollHeight))}px`;
  }, [value, expanded]);

  function submit() {
    const text = value.trim();
    if (!text || unavailable) return;
    // Parent clears only after success; failures preserve the author's text.
    onSubmit(text);
  }
  return <div ref={ref} className={cn('orkto-prompt-input', className)} data-expanded={expanded}>
    <form onSubmit={event => { event.preventDefault(); submit(); }}
      className="orkto-prompt-card" aria-label="Pedido para a WIA"
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <label htmlFor={id} className="sr-only">Pergunta para a WIA</label>
      <textarea ref={textarea} id={id} value={value} disabled={unavailable} maxLength={maxLength}
        rows={1} placeholder={placeholder} aria-describedby={`${id}-hint`}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault(); submit();
          }
        }} />
      {expanded && <div className="orkto-prompt-toolbar">
        <span className="orkto-prompt-model"><Sparkles size={14} aria-hidden="true" />WIA</span>
        <span className="orkto-prompt-review">Revisão humana</span>
      </div>}
      <button type="submit" disabled={!value.trim() || unavailable} className="orkto-prompt-send"
        aria-label={busy ? 'Consultando WIA' : 'Consultar WIA'} title={busy ? 'Consultando WIA' : 'Consultar WIA'}>
        {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
      </button>
    </form>
    <p id={`${id}-hint`} className="orkto-prompt-hint">Enter consulta · Shift + Enter quebra a linha. Você revisa antes de agir.</p>
  </div>;
});
