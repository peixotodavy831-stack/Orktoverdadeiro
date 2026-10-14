import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completePasswordRecovery, hasRecoveryCallback, signUpOutcome, validateNewPassword, type RecoveryAuth } from '../src/lib/auth-flows.js';

const password = 'Synthetic-New-Password-Only-1!';
function fixture(options: { noUser?: boolean; identityError?: boolean; updateError?: string; signoutError?: boolean; signoutThrows?: boolean; throws?: boolean } = {}) {
  const calls: string[] = [];
  const auth: RecoveryAuth = {
    getUser: async () => { calls.push('getUser'); if (options.throws) throw new Error('opaque-private-provider-diagnostic'); return { data: { user: options.noUser ? null : { id: 'synthetic-account' } }, error: options.identityError ? { code: 'bad_jwt' } : null }; },
    updateUser: async attributes => { calls.push('updateUser'); assert.deepEqual(attributes, { password }); return { error: options.updateError ? { code: options.updateError } : null }; },
    signOut: async optionsValue => { calls.push('signOut'); assert.deepEqual(optionsValue, { scope: 'global' }); if (options.signoutThrows) throw new Error('opaque-private-provider-diagnostic'); return { error: options.signoutError ? { status: 503 } : null }; },
  };
  return { auth, calls };
}

test('recovery callback is an exact navigation signal, never a credential', () => {
  assert.equal(hasRecoveryCallback('#type=recovery&access_token=synthetic'), true);
  assert.equal(hasRecoveryCallback('#type=signup'), false);
  assert.equal(hasRecoveryCallback('#next=recovery'), false);
  assert.equal(hasRecoveryCallback(''), false);
});
test('password input enforces minimum, bound and confirmation without trimming or logging', () => {
  assert.match(validateNewPassword('short', 'short')!, /12/);
  assert.match(validateNewPassword('x'.repeat(257), 'x'.repeat(257))!, /256/);
  assert.match(validateNewPassword(password, password + 'x')!, /iguais/);
  assert.equal(validateNewPassword(password, password), null);
});
test('invalid local password never calls Auth', async () => {
  const f = fixture(); assert.equal((await completePasswordRecovery(f.auth, 'short', 'short')).status, 'validation_failed'); assert.deepEqual(f.calls, []);
});
test('a forged recovery URL or stale local marker cannot authorize a password mutation', async () => {
  for (const options of [{ noUser: true }, { identityError: true }]) {
    const f = fixture(options); assert.equal((await completePasswordRecovery(f.auth, password, password)).status, 'session_required'); assert.deepEqual(f.calls, ['getUser']);
  }
});
test('password recovery verifies identity, changes password and revokes sessions before success', async () => {
  const f = fixture(); assert.equal((await completePasswordRecovery(f.auth, password, password)).status, 'complete'); assert.deepEqual(f.calls, ['getUser', 'updateUser', 'signOut']);
});
test('update denial is not reported as a completed reset and retains the existing session', async () => {
  for (const code of ['weak_password', 'same_password', 'opaque-private-provider-diagnostic']) {
    const f = fixture({ updateError: code }); const result = await completePasswordRecovery(f.auth, password, password);
    assert.equal(result.status, 'update_failed'); assert.ok(!JSON.stringify(result).includes('opaque-private')); assert.ok(!JSON.stringify(result).includes(password)); assert.deepEqual(f.calls, ['getUser', 'updateUser']);
  }
});
test('session revocation failure is a distinct partial state, never completed or retried password update', async () => {
  for (const options of [{ signoutError: true }, { signoutThrows: true }]) {
    const f = fixture(options); const result = await completePasswordRecovery(f.auth, password, password); assert.equal(result.status, 'signout_failed'); assert.ok(!JSON.stringify(result).includes('opaque-private')); assert.deepEqual(f.calls, ['getUser', 'updateUser', 'signOut']);
  }
});
test('transport failures expose a bounded message without provider diagnostics', async () => {
  const f = fixture({ throws: true }); const result = await completePasswordRecovery(f.auth, password, password); assert.equal(result.status, 'unavailable'); assert.ok(!JSON.stringify(result).includes('opaque-private'));
});
test('email confirmation is a successful pending signup state, not an attempted password sign-in', () => {
  assert.deepEqual(signUpOutcome({ session: null }), { confirmationRequired: true });
  assert.deepEqual(signUpOutcome({ session: { user: { id: 'synthetic' } } }), { confirmationRequired: false });
});
