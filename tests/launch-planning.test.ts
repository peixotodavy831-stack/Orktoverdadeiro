import test from 'node:test';
import assert from 'node:assert/strict';
import {planAcquisition,planLaunchCash} from '../backend/finance/launch-planning.js';
import {DEFAULT_FINANCE_ASSUMPTIONS} from '../backend/finance/finance-model.js';
test('acquisition uses whole people/contracts, zero denominators remain unavailable',()=>{
 const r=planAcquisition({contacts:100,demoPercent:20,paidPercent:25,spendCents:50000,hours:10,hourCostCents:2000});
 assert.equal(r.demos,20);assert.equal(r.customers,5);assert.equal(r.cashCacCents,10000);assert.equal(r.fullCacCents,14000);
 const unknown=planAcquisition({contacts:0,demoPercent:0,paidPercent:0,spendCents:0,hours:0,hourCostCents:null});
 assert.equal(unknown.cashCacCents,null);assert.equal(unknown.fullCacCents,null);
 for(const invalid of [{contacts:1.5},{spendCents:Infinity},{demoPercent:101},{hours:-1},{hourCostCents:-1}])
  assert.throws(()=>planAcquisition({contacts:10,demoPercent:20,paidPercent:25,spendCents:0,hours:0,hourCostCents:null,...invalid}));
});
test('cash projection accumulates once, collections do not change MRR, reserve is not double expense',()=>{
 const assumptions={...DEFAULT_FINANCE_ASSUMPTIONS,openingCashCents:100000,monthlyFixedPlatformCostCents:10000};
 const input={companies:10,collectionPercent:50,extraOutflowCents:1000};
 const rows=planLaunchCash(assumptions,'base',[input,input],5000);
 assert.equal(rows[0].openingCents,95000);
 assert.equal(rows[1].openingCents,rows[0].closingCents);
 assert.equal(rows[0].collectionsCents,Math.round(rows[0].mrrCents*.5));
 assert.equal(rows[0].closingCents,95000+rows[0].collectionsCents-rows[0].outflowCents);
 assert.equal(rows[1].reserveTargetCents,2*rows[0].reserveTargetCents);
 assert.equal(rows[1].freeAfterReserveCents,rows[1].closingCents-rows[1].reserveTargetCents);
 assert.throws(()=>planLaunchCash(assumptions,'base',[],0));
 assert.throws(()=>planLaunchCash(assumptions,'base',[{...input,companies:-1}],0));
});
