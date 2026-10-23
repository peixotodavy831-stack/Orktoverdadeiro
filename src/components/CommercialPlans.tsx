import { useEffect, useRef, useState } from 'react';
import PricingComponent from './ui/pricing-card';
import { approvedPricingTiers } from '../product/adapters/pricing-model';

const plans=approvedPricingTiers();
export default function CommercialPlans({onProposal,onSelect}:{onProposal:()=>void;onSelect?:()=>void}) {
 const [selected,setSelected]=useState<string|null>(null);
 const panel=useRef<HTMLDivElement|null>(null);
 const plan=plans.find(item=>item.id===selected);
 useEffect(()=>{if(selected)panel.current?.focus();},[selected]);
 return <div className="orkto-commercial-offer" id="planos">
  <PricingComponent plans={plans} billingCycle="monthly" onPlanSelect={id=>{
    if(id==='enterprise'){onProposal();return;}
    if(!plans.some(item=>item.id===id))return;
    setSelected(id);onSelect?.();
  }}/>
  {plan&&<div ref={panel} tabIndex={-1} className="orkto-plan-conditions" aria-label={`Condições do plano ${plan.name}`}>
   <h3>Condições do {plan.name}</h3><p>O preço mensal está aprovado. Usuários, franquias de Pulso, limites e termos de contratação ainda dependem da política comercial final.</p><p>O piloto fechado exige convite e acesso aprovado. A contratação online está em preparação; nenhuma assinatura ou cobrança foi criada.</p><a href="/termos.html" className="inline-flex min-h-11 items-center underline">Consultar termos</a>
  </div>}
 </div>;
}
