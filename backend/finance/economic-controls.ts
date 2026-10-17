/** A target is a forecast allocation, never cash already transferred. */
export function reserveTarget(input:{receivedCents:number;availableCashCents:number;constitutedCents:number|null}) {
  if(!Number.isSafeInteger(input.receivedCents)||input.receivedCents<0||!Number.isSafeInteger(input.availableCashCents)
    ||input.constitutedCents!==null&&(!Number.isSafeInteger(input.constitutedCents)||input.constitutedCents<0))throw new Error('FINANCE_INVALID');
  const allocations=[['Runway e segurança',20],['Expansão',10],['Tesouraria',7],['Oportunidades',3]] as const;
  const targetCents=Math.round(input.receivedCents*.4);
  return {basis:'planned' as const,targetCents,constitutedCents:input.constitutedCents,
    cashCapacityCents:Math.max(0,input.availableCashCents),shortfallCents:Math.max(0,targetCents-Math.max(0,input.availableCashCents)),
    allocations:allocations.map(([name,percent])=>({name,percent,targetCents:Math.round(input.receivedCents*percent/100)}))};
}
export function cashForecast13Weeks(openingCents:number,rows:Array<{occurred_on:string;transaction_type:string;amount_cents:number;cash_status:string}>,start=new Date()) {
  if(!Number.isSafeInteger(openingCents))throw new Error('FINANCE_INVALID');
  const day=new Date(start.toISOString().slice(0,10)+'T00:00:00Z');let balance=openingCents;
  return Array.from({length:13},(_,index)=>{
    const from=new Date(day.getTime()+index*7*86400000),until=new Date(from.getTime()+7*86400000);
    const scoped=rows.filter(row=>row.cash_status==='forecast'&&Date.parse(row.occurred_on)>=from.getTime()&&Date.parse(row.occurred_on)<until.getTime());
    const total=(type:string)=>scoped.filter(row=>row.transaction_type===type).reduce((sum,row)=>sum+row.amount_cents,0);
    const inflowCents=total('revenue'),outflowCents=total('expense');balance+=inflowCents-outflowCents;
    return {week:index+1,from:from.toISOString().slice(0,10),inflowCents,outflowCents,closingCents:balance,basis:'forecast' as const};
  });
}
