import type { PlanType } from '../types';

/** Display names only. Pricing and entitlements come from the authenticated, versioned server catalog. */
export const PLAN_CATALOG: Array<{ id: PlanType; name: string }> = [
  { id:'starter', name:'Start' },
  { id:'pro', name:'Pro' },
  { id:'business', name:'Business' },
  { id:'scale', name:'Scale' },
  { id:'enterprise', name:'Enterprise' },
];
