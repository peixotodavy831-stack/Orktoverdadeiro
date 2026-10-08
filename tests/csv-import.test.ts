import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv } from '../src/utils/csv-import.js';

test('CSV parser reads UTF-8 BOM, quoted commas, escaped quotes and embedded newlines', () => {
  const parsed = parseCsv('\uFEFFNome,Telefone,Notas\r\n"Ana, Maria",11999999999,"Disse ""olá""\ne pediu retorno"\r\n');
  assert.deepEqual(parsed.headers, ['Nome', 'Telefone', 'Notas']);
  assert.deepEqual(parsed.rows, [{ Nome: 'Ana, Maria', Telefone: '11999999999', Notas: 'Disse "olá"\ne pediu retorno' }]);
  assert.equal(parsed.delimiter, ',');
});

test('CSV parser detects semicolon delimiter, trims headers and gives duplicate headers stable names', () => {
  const parsed = parseCsv(' Nome ;Nome;Empresa\nJoão;João Silva;Oficina\n');
  assert.deepEqual(parsed.headers, ['Nome', 'Nome (2)', 'Empresa']);
  assert.deepEqual(parsed.rows[0], { Nome: 'João', 'Nome (2)': 'João Silva', Empresa: 'Oficina' });
  assert.equal(parsed.delimiter, ';');
});

test('CSV parser explains empty, header-only, malformed quote, and excess-column input', () => {
  assert.throws(() => parseCsv('  '), /vazio/i);
  assert.throws(() => parseCsv('Nome,Telefone\n'), /cabeçalho/i);
  assert.throws(() => parseCsv('Nome,Notas\nAna,"sem fechar'), /aspas não fechadas/i);
  assert.throws(() => parseCsv('Nome\nAna,extra\n'), /mais colunas/i);
});

test('CSV parser enforces the API import batch limit', () => {
  const csv = `Nome\n${Array.from({ length: 1001 }, (_, index) => `Cliente ${index + 1}`).join('\n')}`;
  assert.throws(() => parseCsv(csv), /1\.000 clientes/i);
});
