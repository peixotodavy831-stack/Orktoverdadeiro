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
