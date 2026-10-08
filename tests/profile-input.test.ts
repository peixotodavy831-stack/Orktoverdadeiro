import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onboardingInput } from '../backend/orkto-core/profile-input.js';

test('onboarding accepts owner-editable fields and rejects tenant, identity and privilege fields', () => {
  const valid={companyName:'Synthetic Workspace',whatsappNumber:'+5500000000001',brandTone:'comercial',quoteColor:'#FF9F1C'};
  assert.equal(onboardingInput.safeParse(valid).success,true);
  for(const field of ['workspace_id','tenant_id','id','owner_user_id','email','onboarding_completed','active_plan']) {
    assert.equal(onboardingInput.safeParse({...valid,[field]:'forged'}).success,false,field);
  }
  assert.equal(onboardingInput.safeParse({...valid,whatsappNumber:''}).success,false);
  assert.equal(onboardingInput.safeParse({...valid,quoteColor:'javascript:alert(1)'}).success,false);
});
