/** Owner-approved offer, 2026-10-16. Internal legacy keys are never new offers. */
export const COMMERCIAL_PLANS = [
  { id:'starter', name:'Start', priceCents:7990, category:'growth', targetCogsCents:1199, ceilingCogsCents:1598 },
  { id:'pro', name:'Pro', priceCents:14990, category:'growth', targetCogsCents:2249, ceilingCogsCents:2998 },
  { id:'business', name:'Business', priceCents:29990, category:'growth', targetCogsCents:4499, ceilingCogsCents:5998 },
  { id:'scale', name:'Scale', priceCents:59990, category:'advanced', targetCogsCents:8999, ceilingCogsCents:11998 },
  { id:'enterprise', name:'Enterprise', priceCents:null, category:'advanced', targetCogsCents:null, ceilingCogsCents:null },
] as const;
export type CommercialPlanKey = typeof COMMERCIAL_PLANS[number]['id'];
export const COMMERCIAL_VERSION = 2;
export function commercialPlan(key:unknown) { return COMMERCIAL_PLANS.find(plan=>plan.id===key) ?? null; }
export const COMMERCIAL_CATEGORIES = { growth:'Pequenos negócios e empresas em crescimento', advanced:'Operações avançadas e grandes empresas' };
export function validateCommercialPrice(key:unknown, priceCents:unknown, version:unknown) {
  const plan=commercialPlan(key);
  return !!plan && plan.priceCents!==null && priceCents===plan.priceCents && version===COMMERCIAL_VERSION;
}
