import {projectFinance,type FinanceAssumptions,type FinanceScenarioKey} from './finance-model.js';

const count=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=1_000_000;
const money=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=100_000_000_000;
const percent=(n:number)=>Number.isFinite(n)&&n>=0&&n<=100;

/** Founder-only scenario. No contracts, financial entries or release gates are written. */
export function planAcquisition(input:{contacts:number;demoPercent:number;paidPercent:number;spendCents:number;hours:number;hourCostCents:number|null}){
 if(!count(input.contacts)||!percent(input.demoPercent)||!percent(input.paidPercent)||!money(input.spendCents)
  ||!Number.isFinite(input.hours)||input.hours<0||input.hours>10_000
  ||input.hourCostCents!==null&&!money(input.hourCostCents))throw new Error('Revise as premissas do funil.');
 const demos=Math.floor(input.contacts*input.demoPercent/100);
 const customers=Math.floor(demos*input.paidPercent/100);
 const timeCostCents=input.hourCostCents===null?null:Math.round(input.hours*input.hourCostCents);
 return {basis:'simulation' as const,demos,customers,cashSpendCents:input.spendCents,timeCostCents,
  cashCacCents:customers>0?Math.round(input.spendCents/customers):null,
  fullCacCents:customers>0&&timeCostCents!==null?Math.round((input.spendCents+timeCostCents)/customers):null};
}

/** Reuses the economic model; collections differ from accrued recurring revenue.
 * Reserve is an earmark within cash, never an extra expense or a bank transfer. */
export function planLaunchCash(assumptions:FinanceAssumptions,scenario:FinanceScenarioKey,
 periods:Array<{companies:number;collectionPercent:number;extraOutflowCents:number}>,setupCents:number){
 if(!Array.isArray(periods)||periods.length<1||periods.length>12||!money(setupCents))throw new Error('Informe de um a doze meses e um custo inicial válido.');
 let cash=assumptions.openingCashCents-setupCents,reserve=0;
 return periods.map((input,index)=>{
  if(!count(input.companies)||!percent(input.collectionPercent)||!money(input.extraOutflowCents))throw new Error('Revise empresas, recebimento e saídas do mês.');
  const projection=projectFinance(assumptions,input.companies,scenario);
  const collectionsCents=Math.round(projection.mrrCents*input.collectionPercent/100);
  const outflowCents=projection.mrrCents-projection.channelAdjustedOperatingResultCents+input.extraOutflowCents;
  const openingCents=cash;
  cash+=collectionsCents-outflowCents;
  reserve+=Math.round(collectionsCents*assumptions.plannedReservePercent/100);
  if(![cash,reserve,outflowCents,collectionsCents].every(Number.isSafeInteger))throw new Error('Projeção excede a precisão monetária suportada.');
  return {month:index+1,companies:input.companies,mrrCents:projection.mrrCents,collectionsCents,outflowCents,
   openingCents,closingCents:cash,reserveTargetCents:reserve,freeAfterReserveCents:cash-reserve,
   capitalNeededCents:Math.max(0,-cash),reserveGapCents:Math.max(0,reserve-cash),basis:'simulation' as const};
 });
}
