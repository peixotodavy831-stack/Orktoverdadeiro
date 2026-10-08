import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteCreateInput, calculateQuoteMoney, quoteCustomerMatchesDeal } from '../backend/orkto-core/quote-input.js';

test('quote create accepts only editable fields and prices lines on the server', () => {
  const valid = { clientName:'Cliente sintético',clientPhone:'+5500000000000',
    items:[{id:'1',name:'Serviço',description:'',quantity:2,unitPrice:12.5,discount:10}],taxes:1.25 };
  assert.equal(quoteCreateInput.safeParse(valid).success,true);
  assert.equal(quoteCreateInput.safeParse({...valid,workspace_id:'foreign'}).success,false);
  assert.equal(quoteCreateInput.safeParse({...valid,total:0}).success,false);
  assert.equal(quoteCreateInput.safeParse({...valid,items:[{...valid.items[0],discount:101}]}).success,false);
  assert.deepEqual(calculateQuoteMoney(valid.items,valid.taxes),{
    subtotal:25,discount_total:2.5,taxes:1.25,total:23.75,
  });
});

test('quote may not attach an unrelated phone to a deal without a matching customer row', () => {
  assert.equal(quoteCustomerMatchesDeal(null,null,'+5500000000000'),true);
  assert.equal(quoteCustomerMatchesDeal('customer-a',null,'+5500000000000'),false);
  assert.equal(quoteCustomerMatchesDeal('customer-a','customer-a','+5500000000000'),true);
  assert.equal(quoteCustomerMatchesDeal('+5500000000000',null,'+5500000000000'),true);
});
