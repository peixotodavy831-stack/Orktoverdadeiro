export type WhatsAppCategory='marketing'|'utility'|'authentication'|'service';
export interface WhatsAppRateCard {version:string;country:string;currency:string;category:WhatsAppCategory;effectiveFrom:string;effectiveUntil:string|null;unitPriceMicros:number;freeMessages:number;reviewed:boolean;sourceUrl:string}
/** Estimates only. No defaults/free-tier assumptions or cross-currency conversion.
 * Rates must be reviewed against the current official account/contract. */
export function estimateWhatsAppCost(input:{cards:WhatsAppRateCard[];country:string;currency:string;category:WhatsAppCategory;at:string;count:number;alreadyUsed:number}) {
  const at=Date.parse(input.at);
  if(!Number.isFinite(at)||!Number.isSafeInteger(input.count)||input.count<0||!Number.isSafeInteger(input.alreadyUsed)||input.alreadyUsed<0)throw new Error('INVALID_USAGE');
  const applicable=input.cards.filter(card=>card.country===input.country&&card.currency===input.currency&&card.category===input.category&&card.reviewed&&Date.parse(card.effectiveFrom)<=at&&(card.effectiveUntil===null||Date.parse(card.effectiveUntil)>at));
  if(applicable.length!==1)return {status:'RATE_CONFIGURATION_REQUIRED' as const,estimatedCostMicros:null};
  const card=applicable[0];
  if(!Number.isSafeInteger(card.unitPriceMicros)||card.unitPriceMicros<0||!Number.isSafeInteger(card.freeMessages)||card.freeMessages<0||!card.version||!/^https:\/\//.test(card.sourceUrl))throw new Error('INVALID_RATE_CARD');
  const remainingFree=Math.max(0,card.freeMessages-input.alreadyUsed);
  const billedMessages=Math.max(0,input.count-remainingFree);
  const cost=billedMessages*card.unitPriceMicros;
  if(!Number.isSafeInteger(cost))throw new Error('COST_OVERFLOW');
  return {status:'ESTIMATED' as const,estimatedCostMicros:cost,currency:card.currency,rateVersion:card.version,billedMessages,freeMessagesApplied:input.count-billedMessages,reconciled:false};
}
