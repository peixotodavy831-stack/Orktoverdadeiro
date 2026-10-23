import { COMMERCIAL_PLANS, COMMERCIAL_CATEGORIES } from '../../../supabase/functions/orkto-core-mutations/_shared/commercial-catalog.js';
export interface PricingFeature { name:string; isIncluded:boolean|null; detail?:string }
export interface PriceTier { id:string;name:string;description:string;priceMonthly:number|null;buttonLabel:string;features:readonly PricingFeature[] }
/** Only approved catalog facts; unknown entitlements are never converted to zero. */
export function approvedPricingTiers():PriceTier[]{
 return COMMERCIAL_PLANS.map(plan=>({id:plan.id,name:plan.name,description:COMMERCIAL_CATEGORIES[plan.category],priceMonthly:plan.priceCents===null?null:plan.priceCents/100,buttonLabel:plan.id==='enterprise'?'Solicitar proposta':'Ver condições',features:[
  {name:'Usuários',isIncluded:null,detail:'A definir em contrato'},
  {name:'Franquia de Pulsos',isIncluded:null,detail:'Sujeita à aprovação'},
  {name:'Limites operacionais',isIncluded:null,detail:'A definir em contrato'},
  {name:'Integrações',isIncluded:null,detail:'Exigem configuração e homologação'},
 ]}));
}
