import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, formatLocaleCurrency, formatLocaleDate, formatLocaleNumber, resolveLocale } from '../src/lib/localization.js';

test('locale selection maps supported language families and defaults to Brazilian Portuguese', () => {
  assert.equal(resolveLocale('pt-BR'), 'pt-BR');
  assert.equal(resolveLocale('en-GB'), 'en-US');
  assert.equal(resolveLocale('es-MX'), 'es-419');
  assert.equal(resolveLocale('fr-FR'), DEFAULT_LOCALE);
  assert.equal(resolveLocale(null), DEFAULT_LOCALE);
});

test('formats money and numbers with locale conventions without changing numeric inputs', () => {
  assert.equal(formatLocaleCurrency(1234.5, 'BRL', 'pt-BR'), 'R$ 1.234,50');
  assert.equal(formatLocaleNumber(1234.5, 'en-US'), '1,234.5');
  assert.equal(formatLocaleNumber(1234.5, 'es-419'), '1,234.5');
});

test('formats dates by locale and reports invalid source dates as unavailable', () => {
  assert.equal(formatLocaleDate('2026-10-22T12:00:00.000Z', 'pt-BR', { timeZone: 'UTC', dateStyle: 'short' }), '22/10/2026');
  assert.equal(formatLocaleDate('invalid-date'), null);
});
