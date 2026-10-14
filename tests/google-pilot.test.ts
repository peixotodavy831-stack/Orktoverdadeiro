import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanOAuthCallback, googleCallbackMessage, isGooglePilot, pilotRedirect } from '../src/lib/google-pilot.js';
import { verifyPilotSession } from '../supabase/functions/orkto-core-mutations/_shared/pilot-access.js';

test('pilot redirects bind staging project and exact current origin, never a supplied next URL', () => {
  assert.equal(pilotRedirect('https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app/','https://ghrjongiodziasupakrk.supabase.co'),
    'https://orkto-staging-da5dotdh0-peixoto-s-projects1.vercel.app/');
  for (const origin of ['http://orkto-staging.vercel.app','https://attacker.example','https://orkto.vercel.app',
    'https://orkto-staging.vercel.app.attacker.example','https://user:pass@orkto-staging.vercel.app']) {
    assert.throws(() => pilotRedirect(origin,'https://ghrjongiodziasupakrk.supabase.co'),/PILOT_CONFIGURATION_REQUIRED/);
  }
  assert.throws(() => pilotRedirect('https://orkto-staging.vercel.app','https://qneqljlphgkptebsaonb.supabase.co'));
  assert.equal(isGooglePilot('google_pilot'),true); assert.equal(isGooglePilot(undefined),false);
});
test('callbacks disclose only bounded messages, strip codes/tokens and retain unrelated navigation', () => {
  assert.match(googleCallbackMessage('https://example.invalid/?error=access_denied&error_description=private-marker')!,/cancelada/);
  assert.ok(!googleCallbackMessage('https://example.invalid/?error=unknown&error_description=private-marker')!.includes('private-marker'));
  assert.equal(cleanOAuthCallback('https://example.invalid/?code=private-marker&state=private-marker&view=clients#access_token=private-marker'), '/?view=clients');
});
test('caller-JWT gate accepts only an explicit true and fails closed on errors or malformed results', async () => {
  for (const data of [false,null,{},'true',1]) assert.equal(await verifyPilotSession({rpc:async name=>{
    assert.equal(name,'orkto_pilot_session_allowed'); return {data,error:null}; }}),'denied');
  assert.equal(await verifyPilotSession({rpc:async()=>({data:true,error:null})}),'allowed');
  assert.equal(await verifyPilotSession({rpc:async()=>({data:true,error:{message:'private-marker'}})}),'unavailable');
  assert.equal(await verifyPilotSession({rpc:async()=>{throw new Error('private-marker');}}),'unavailable');
});
