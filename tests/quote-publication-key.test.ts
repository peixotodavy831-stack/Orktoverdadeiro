import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { completeQuotePublication, pendingQuotePublicationKey } from '../src/lib/quote-publication-key.js';

test('a pending publication reuses its request key until confirmed', () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  } });
  try {
    const first = pendingQuotePublicationKey('quote-a');
    assert.equal(pendingQuotePublicationKey('quote-a'), first);
    assert.notEqual(pendingQuotePublicationKey('quote-b'), first);
    assert.equal(values.get('orkto:quote-publication:quote-a'), first);
    completeQuotePublication('quote-a');
    assert.notEqual(pendingQuotePublicationKey('quote-a'), first);
  } finally {
    completeQuotePublication('quote-a');
    completeQuotePublication('quote-b');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  }
});

test('quote creation cannot share an app URL when the proposal link is unconfirmed', async () => {
  const source = await readFile(resolve('src/components/CreateQuote.tsx'), 'utf8');
  assert.match(source, /'x-idempotency-key': pendingQuotePublicationKey\(persistedQuote\.id\)/);
  assert.match(source, /if \(!createdQuote \|\| !proposalLink\) return '';/);
  assert.doesNotMatch(source, /proposalLink \|\| origin/);
  assert.match(source, /Gere o link antes de compartilhar/);
});
