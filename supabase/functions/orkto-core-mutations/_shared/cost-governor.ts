export type OperationClass='deterministic'|'simple'|'light'|'normal'|'complex';
/** Integer milli-Pulso avoids floating point account balances. Reference, not an approved allowance. */
export const REFERENCE_PULSO_MILLI={deterministic:0,simple:250,light:500,normal:1000,complex:4000} as const;
export interface ModelTariff {version:number;provider:string;model:string;effectiveFrom:string;effectiveUntil:string|null;
  inputMicrousdPerMillion:number;outputMicrousdPerMillion:number;cachedMicrousdPerMillion:number;}
export function estimateModelCost(tariff:ModelTariff|null,usage:{provider:string;model:string;input:number;cached:number;output:number},at=Date.now()) {
  const counts=[usage.input,usage.cached,usage.output];
  if(counts.some(n=>!Number.isSafeInteger(n)||n<0)||usage.cached>usage.input)throw new Error('USAGE_INVALID');
  if(!tariff||tariff.provider!==usage.provider||tariff.model!==usage.model
    ||Date.parse(tariff.effectiveFrom)>at||!Number.isFinite(Date.parse(tariff.effectiveFrom))
    ||(tariff.effectiveUntil!==null&&(!Number.isFinite(Date.parse(tariff.effectiveUntil))||Date.parse(tariff.effectiveUntil)<=at)))return null;
  const rates=[tariff.inputMicrousdPerMillion,tariff.outputMicrousdPerMillion,tariff.cachedMicrousdPerMillion];
  if(!Number.isSafeInteger(tariff.version)||tariff.version<=0||rates.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('TARIFF_INVALID');
  const cost=((usage.input-usage.cached)*rates[0]+usage.output*rates[1]+usage.cached*rates[2])/1_000_000;
  if(!Number.isSafeInteger(Math.ceil(cost)))throw new Error('COST_OVERFLOW');
  return {microusd:Math.ceil(cost),tariffVersion:tariff.version,basis:'estimated' as const};
}
export function canConsumePulso(input:{approved:boolean;allowanceMilli:number|null;usedMilli:number;reservedMilli:number;requestedMilli:number}) {
  const numbers=[input.usedMilli,input.reservedMilli,input.requestedMilli];
  if(!input.approved||input.allowanceMilli===null||!Number.isSafeInteger(input.allowanceMilli)||input.allowanceMilli<0
    ||numbers.some(n=>!Number.isSafeInteger(n)||n<0))return {allowed:false,remainingMilli:null,reason:'configuration_required'};
  const remaining=Math.max(0,input.allowanceMilli-input.usedMilli-input.reservedMilli);
  return {allowed:input.requestedMilli<=remaining,remainingMilli:remaining,reason:input.requestedMilli<=remaining?'ok':'limit_reached'};
}
