import {useEffect, useRef, type RefObject} from 'react';

/** Keyboard modality for existing dialogs. Never changes application data. */
export function useModalFocus(open: boolean, onClose: () => void, panelRef: RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel) return;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    (panel.querySelector<HTMLElement>('[data-autofocus="true"]') || controls()[0] || panel).focus();
    const onKey = (event: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll('[aria-modal="true"]')).filter(element => element.getClientRects().length > 0);
      if (dialogs.at(-1) !== panel) return;
      if (event.key === 'Escape') {event.preventDefault(); closeRef.current(); return;}
      if (event.key !== 'Tab') return;
      const elements = controls();
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) {event.preventDefault();panel.focus();return;}
      if (!panel.contains(document.activeElement)) {event.preventDefault();first.focus();}
      else if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('keydown', onKey); if (trigger?.isConnected) trigger.focus();};
  }, [open, panelRef]);
}
