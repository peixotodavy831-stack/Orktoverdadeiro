import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmedSendMessage, confirmedSendState } from '../src/product/inbox-delivery-status.js';

test('Inbox never treats request acceptance or provider acknowledgement as delivery', () => {
  assert.equal(confirmedSendState({ status: 'REQUEST_ACCEPTED' }), 'accepted');
  assert.equal(confirmedSendState({ status: 'PROVIDER_ACKNOWLEDGED' }), 'acknowledged');
  assert.equal(confirmedSendState({ status: 'DELIVERED' }), 'delivered');
  assert.match(confirmedSendMessage('accepted'), /entrega ainda não foi confirmada/i);
  assert.match(confirmedSendMessage('acknowledged'), /entrega ainda não foi confirmada/i);
  assert.match(confirmedSendMessage('delivered'), /entrega confirmada/i);
  assert.equal(confirmedSendState({ status: 'UNKNOWN' }), null);
  assert.equal(confirmedSendState({ delivered: true }), null);
  assert.equal(confirmedSendState(null), null);
});
