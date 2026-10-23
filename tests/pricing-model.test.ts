import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedPricingTiers } from '../src/product/adapters/pricing-model.js';
test('pricing reference is adapted to exactly five approved monthly offers',()=>{
 const tiers=approvedPricingTiers();
 assert.deepEqual(tiers.map(t=>t.name),['Start','Pro','Business','Scale','Enterprise']);
 assert.deepEqual(tiers.map(t=>t.priceMonthly),[79.9,149.9,299.9,599.9,null]);
 assert.equal(new Set(tiers.map(t=>t.id)).size,5);
 assert.equal(tiers.at(-1)?.buttonLabel,'Solicitar proposta');
 assert.equal(tiers.some(t=>'priceAnnually' in t||'isPopular' in t),false);
});
test('pending entitlements do not become quotas or contractual guarantees',()=>{
 for(const plan of approvedPricingTiers())for(const feature of plan.features){assert.equal(feature.isIncluded,null);assert.ok(feature.detail);assert.doesNotMatch(feature.detail,/ilimitad|garantid|grátis|\d+%|\d+ usuários/i);}
});
