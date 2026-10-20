import { COMMERCIAL_PLANS, COMMERCIAL_CATEGORIES } from '../../supabase/functions/orkto-core-mutations/_shared/commercial-catalog';

export default function CommercialPlans({onProposal,onSelect}:{onProposal:()=>void;onSelect?:()=>void}) {
  return <section className="orkto-commercial-plans" id="planos" aria-label="Planos da ORKTO">
    <h2>Um plano para o seu momento.</h2>
    <p>Valores mensais aprovados. Contratação online em preparação; nenhum pagamento é iniciado aqui. Recursos, usuários e franquias de Pulso serão definidos nas condições de contratação.</p>
    {(['growth','advanced'] as const).map(category=><div key={category} className="orkto-commercial-category">
      <h3>{COMMERCIAL_CATEGORIES[category]}</h3>
      <div className="orkto-commercial-grid">{COMMERCIAL_PLANS.filter(plan=>plan.category===category).map(plan=><article key={plan.id}>
        <h4>{plan.name}</h4><p className="orkto-commercial-price">{plan.priceCents===null?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(plan.priceCents/100)}{plan.priceCents!==null&&<small> / mês</small>}</p>
        <p>{plan.id==='enterprise'?'Volume, usuários, integrações, governança e SLA definidos por proposta e aprovação comercial.':'Condições e limites sujeitos à versão aprovada do contrato.'}</p>
        <button type="button" onClick={plan.id==='enterprise'?onProposal:onSelect} disabled={plan.id!=='enterprise'&&!onSelect} className="orkto-landing-secondary">{plan.id==='enterprise'?'Solicitar proposta':onSelect?'Consultar contratação':'Contratação em preparação'}</button>
      </article>)}</div>
    </div>)}
  </section>;
}
