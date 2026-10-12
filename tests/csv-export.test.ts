import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeCsvTextCell } from '../src/utils/csv-export.js';

test('CSV text cells quote commas and double embedded quotes', () => {
  assert.equal(escapeCsvTextCell('Ana, "Maria"'), '"Ana, ""Maria"""');
});

test('CSV text cells neutralize spreadsheet formula prefixes', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)', '  =1+1', '\t=1+1', '\r\n@SUM(A1:A2)']) {
    assert.equal(escapeCsvTextCell(value), `"'${value.replace(/"/g, '""')}"`, value);
  }
});

test('CSV text cells preserve ordinary values and empty cells', () => {
  assert.equal(escapeCsvTextCell('Serviço normal'), '"Serviço normal"');
  assert.equal(escapeCsvTextCell("'already text"), "\"'already text\"");
  assert.equal(escapeCsvTextCell(''), '');
});
