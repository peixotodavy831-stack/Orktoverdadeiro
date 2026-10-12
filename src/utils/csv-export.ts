const FORMULA_PREFIX = /^[\u0000-\u0020\uFEFF]*[=+\-@]/;

/** Quote a CSV text cell and neutralize spreadsheet formula prefixes. */
export function escapeCsvTextCell(value: string): string {
  if (value.length === 0) return '';

  const safeValue = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}
