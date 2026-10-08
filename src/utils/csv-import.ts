export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
  delimiter: ',' | ';' | '\t';
}

const detectDelimiter = (source: string): ParsedCsv['delimiter'] => {
  let quoted = false;
  const counts: Record<ParsedCsv['delimiter'], number> = { ',': 0, ';': 0, '\t': 0 };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char in counts) counts[char as ParsedCsv['delimiter']] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ',') as ParsedCsv['delimiter'];
};

export function parseCsv(source: string): ParsedCsv {
  const input = source.replace(/^\uFEFF/, '');
  if (!input.trim()) throw new Error('O arquivo CSV está vazio.');
  const delimiter = detectDelimiter(input);
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  const finishField = () => { record.push(field); field = ''; afterQuote = false; };
  const finishRecord = () => {
    finishField();
    if (record.some(value => value.trim() !== '')) records.push(record);
    record = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else field += char;
      continue;
    }
    if (afterQuote && char !== delimiter && char !== '\n' && char !== '\r' && !/\s/.test(char)) {
      throw new Error('O CSV contém texto inesperado depois de uma célula entre aspas.');
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) finishField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      finishRecord();
    } else if (!afterQuote || !/\s/.test(char)) field += char;
  }
  if (quoted) throw new Error('O CSV contém uma célula com aspas não fechadas.');
  if (field.length || record.length) finishRecord();
  if (records.length < 2) throw new Error('Inclua uma linha de cabeçalho e pelo menos um cliente.');

  const originalHeaders = records[0].map((value, index) => value.trim() || `Coluna ${index + 1}`);
  const usedHeaders = new Map<string, number>();
  const headers = originalHeaders.map(header => {
    const occurrence = (usedHeaders.get(header) || 0) + 1;
    usedHeaders.set(header, occurrence);
    return occurrence === 1 ? header : `${header} (${occurrence})`;
  });
  const dataRows = records.slice(1);
  if (dataRows.length > 1000) throw new Error('O limite é de 1.000 clientes por importação. Divida o arquivo em partes menores.');

  const rows = dataRows.map((values, rowIndex) => {
    if (values.length > headers.length) throw new Error(`A linha ${rowIndex + 2} tem mais colunas do que o cabeçalho.`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  return { headers, rows, delimiter };
}
