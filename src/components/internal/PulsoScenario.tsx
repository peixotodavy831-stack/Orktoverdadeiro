import { useState } from 'react';
import { estimatePulsoWorkload } from '../../../backend/finance/finance-model';
const classes=[['deterministic','Determinísticas'],['simple','Simples'],['light','Leves'],['normal','Normais'],['complex','Complexas']] as const;
export function PulsoScenario(){
 const [counts,setCounts]=useState<Record<string,string>>({});
 let estimate:ReturnType<typeof estimatePulsoWorkload>|null=null;
 try{estimate=estimatePulsoWorkload(Object.fromEntries(classes.map(([key])=>[key,Number(counts[key]||0)])));}catch{/* Invalid drafts never show a numeric estimate. */}
 return <details className="my-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Simular operações e Pulsos</summary>
  <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-300">Quantidades hipotéticas por empresa/mês. Usa os pesos técnicos do Cost Governor; não define franquia, saldo ou preço de um Pulso.</p>
  <div className="grid gap-3 sm:grid-cols-2">{classes.map(([key,label])=><label key={key} className="text-xs">{label}<input type="number" min="0" max="1000000" step="1" value={counts[key]??'0'} onChange={event=>setCounts(previous=>({...previous,[key]:event.target.value}))} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-transparent px-3 dark:border-zinc-700"/></label>)}</div>
  <p role="status" className="mt-3 text-sm">{estimate?`${estimate.pulso.toLocaleString('pt-BR')} Pulsos de referência técnica`:'Revise as quantidades: use inteiros entre 0 e 1.000.000.'}</p>
  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Não reserva nem consome créditos. Custo monetário continua dependente de tokens, modelo, tarifa, tentativas e câmbio. Esta simulação não é salva nas premissas nem altera ledgers.</p>
 </details>;
}
