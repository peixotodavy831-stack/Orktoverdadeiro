import { useId, useState } from 'react';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Builds a draft in the existing composer. It never sends or writes by itself. */
export function ProposalRecoveryRequest({onDraft}:{onDraft:(message:string)=>void}) {
  const id=useId();
  const [quoteId,setQuoteId]=useState('');
  const [invalid,setInvalid]=useState(false);
  return <details className="my-4 border-t orkto-product-border pt-3">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Recuperar uma proposta sem resposta</summary>
    <p className="mb-3 text-sm orkto-product-muted">Informe o ID da proposta. A WIA confere o envio e a ausência de decisão usando as regras do Radar. Exige Playbook habilitado para a empresa; preparar não cria tarefa nem envia mensagem.</p>
    <label htmlFor={id} className="block text-sm font-semibold">ID da proposta</label>
    <input id={id} value={quoteId} onChange={event=>{setQuoteId(event.target.value);setInvalid(false);}} aria-invalid={invalid} aria-describedby={invalid?`${id}-error`:undefined} className="mt-2 min-h-11 w-full rounded-lg border orkto-product-border bg-transparent px-3 text-sm" autoComplete="off" spellCheck={false}/>
    {invalid&&<p id={`${id}-error`} role="alert" className="mt-2 text-sm">Use o ID completo da proposta, no formato UUID.</p>}
    <button type="button" className="today-text-action mt-2 min-h-11" onClick={()=>{
      const value=quoteId.trim();if(!UUID.test(value)){setInvalid(true);return;}
      onDraft(`Preparar recuperação da proposta ${value.toLowerCase()}`);
    }}>Colocar pedido no campo da WIA</button>
    <p className="text-xs orkto-product-muted">Depois envie o pedido. Uma sugestão elegível ficará em Aprovações; somente a aprovação autorizada cria a tarefa interna.</p>
  </details>;
}
