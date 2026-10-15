import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onboardingInput, personalProfileInput } from '../backend/orkto-core/profile-input.js';

test('onboarding accepts owner-editable fields and rejects tenant, identity and privilege fields', () => {
  const valid={companyName:'Synthetic Workspace',whatsappNumber:'+5500000000001',brandTone:'comercial',quoteColor:'#FF9F1C'};
  assert.equal(onboardingInput.safeParse(valid).success,true);
  for(const field of ['workspace_id','tenant_id','id','owner_user_id','email','onboarding_completed','active_plan']) {
    assert.equal(onboardingInput.safeParse({...valid,[field]:'forged'}).success,false,field);
  }
  assert.equal(onboardingInput.safeParse({...valid,whatsappNumber:''}).success,false);
  assert.equal(onboardingInput.safeParse({...valid,quoteColor:'javascript:alert(1)'}).success,false);
});

test('personal profile only accepts the display name and normalizes surrounding spaces', () => {
  assert.deepEqual(personalProfileInput.parse({displayName:'  Nome de teste  '}), {displayName:'Nome de teste'});
  for (const field of ['id','userId','workspace_id','tenant_id','email','photoURL','role','isFounder','active_plan','companyName']) {
    assert.equal(personalProfileInput.safeParse({displayName:'Nome', [field]:'forged'}).success, false, field);
  }
});

test('personal profile rejects invalid lengths, missing fields and control characters', () => {
  for (const displayName of ['', '   ', 'a'.repeat(101), 'Nome\nOutro', 'Nome\u0000Outro']) {
    assert.equal(personalProfileInput.safeParse({displayName}).success, false);
  }
  assert.equal(personalProfileInput.safeParse({}).success,false);
  assert.equal(personalProfileInput.safeParse({displayName:'a'.repeat(100)}).success,true);
});
