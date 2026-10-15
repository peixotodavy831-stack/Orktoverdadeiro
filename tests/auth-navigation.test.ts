import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSignedOutView } from '../src/lib/auth-navigation.js';

test('session loss keeps the public landing and explicit login routes', () => {
  assert.equal(resolveSignedOutView('landing'), 'landing');
  assert.equal(resolveSignedOutView('auth'), 'auth');
});

test('session loss redirects every protected module to the public landing', () => {
  for (const protectedView of ['dashboard', 'clients', 'services', 'deals', 'quotes', 'wia', 'conversations']) {
    assert.equal(resolveSignedOutView(protectedView), 'landing', protectedView);
  }
});

test('an authentication failure stays on login so its safe error is not hidden by the landing', () => {
  for (const currentView of ['landing', 'auth', 'dashboard', 'clients']) {
    assert.equal(resolveSignedOutView(currentView, true), 'auth', currentView);
  }
  assert.equal(resolveSignedOutView('landing', false), 'landing');
});
