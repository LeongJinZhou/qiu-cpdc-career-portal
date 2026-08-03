/**
 * Spreadsheet-safe CSV helpers.
 *
 * Values that begin with formula characters are prefixed with an apostrophe so
 * opening an exported file in Excel/Sheets cannot execute data as a formula.
 */
export function csvCell(value) {
  const text = value == null ? '' : String(value);
  const spreadsheetFormula = /^[\t\r ]*[=+\-@]/.test(text);
  const safeText = spreadsheetFormula ? `'${text}` : text;
  return /[",\n]/.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText;
}

export function buildCsv(columns, rows, labels = {}) {
  const header = columns.map((column) => csvCell(labels[column] ?? column)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n');
  return `${header}\n${body}`;
}
