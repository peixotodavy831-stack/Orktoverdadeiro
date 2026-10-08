import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isQuoteEmailRecipientAuthorized } from '../backend/quote-email-policy.js';

test('proposal email is restricted to the registered client recipient', () => {
  assert.equal(isQuoteEmailRecipientAuthorized('client@example.test', 'client@example.test'), true);
  assert.equal(isQuoteEmailRecipientAuthorized(' Client@Example.Test ', 'client@example.test'), true);
  assert.equal(isQuoteEmailRecipientAuthorized('other@example.test', 'client@example.test'), false);
  assert.equal(isQuoteEmailRecipientAuthorized('client@example.test', null), false);
});
