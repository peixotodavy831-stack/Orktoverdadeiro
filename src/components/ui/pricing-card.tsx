import { useId, type HTMLAttributes } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import './pricing-card.css';
import type { PriceTier, PricingFeature } from '../../product/adapters/pricing-model';
export type { PriceTier, PricingFeature } from '../../product/adapters/pricing-model';
export interface PricingComponentProps extends HTMLAttributes<HTMLElement> { plans:readonly PriceTier[];billingCycle:'monthly';onPlanSelect:(planId:string,cycle:'monthly')=>void }
const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const featureLabel=(feature:PricingFeature|undefined)=>feature?.detail||(feature?.isIncluded===true?'Incluído':feature?.isIncluded===false?'Não incluído':'A definir');

/** Supplied pricing-card adapted to five approved offers, without checkout. */
export function PricingComponent({plans,billingCycle,onPlanSelect,className,...props}:PricingComponentProps){
 const titleId=useId();const allFeatures=[...new Set(plans.flatMap(plan=>plan.features.map(feature=>feature.name)))];
 return <section {...props} className={cn('orkto-pricing',className)} aria-labelledby={titleId}>
  <header className="orkto-pricing-header"><div><h2 id={titleId}>Um plano para o seu momento.</h2><p>Valores mensais aprovados. Compare as opções; a contratação online continua em preparação.</p></div><span className="orkto-pricing-cycle">Mensal · BRL</span></header>
  <div className="orkto-pricing-grid">{plans.map(plan=><Card key={plan.id} data-plan={plan.id}>
   <CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.description}</CardDescription><p className="orkto-pricing-price">{plan.priceMonthly===null?'Sob consulta':brl.format(plan.priceMonthly)}{plan.priceMonthly!==null&&<span> / mês</span>}</p></CardHeader>
   <CardContent><ul>{plan.features.map(feature=>{const Icon=feature.isIncluded===true?Check:feature.isIncluded===false?X:Minus;return <li key={feature.name}><Icon size={15} aria-hidden="true"/><div><span>{feature.name}</span><small>{featureLabel(feature)}</small></div></li>;})}</ul></CardContent>
   <CardFooter><Button type="button" variant="outline" className="orkto-pricing-button" onClick={()=>onPlanSelect(plan.id,billingCycle)} aria-label={`${plan.buttonLabel} — ${plan.name}`}>{plan.buttonLabel}</Button></CardFooter>
  </Card>)}</div>
  <p className="orkto-pricing-policy">Usuários, recursos, integrações e franquias de Pulso dependem das condições comerciais aprovadas. Comparar um plano não cria assinatura, pagamento ou permissão.</p>
  <details className="orkto-pricing-comparison"><summary>Comparar condições dos cinco planos</summary><div className="orkto-pricing-table-wrap" role="region" aria-label="Comparação de planos" tabIndex={0}><table><caption className="sr-only">Condições comerciais; campos não aprovados permanecem a definir</caption><thead><tr><th scope="col">Condição</th>{plans.map(plan=><th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead><tbody><tr><th scope="row">Preço mensal</th>{plans.map(plan=><td key={plan.id}>{plan.priceMonthly===null?'Sob consulta':brl.format(plan.priceMonthly)}</td>)}</tr>{allFeatures.map(name=><tr key={name}><th scope="row">{name}</th>{plans.map(plan=><td key={plan.id}>{featureLabel(plan.features.find(feature=>feature.name===name))}</td>)}</tr>)}</tbody></table></div></details>
 </section>;
}
export default PricingComponent;
