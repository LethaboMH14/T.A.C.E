// T.A.C.E runtime slice — small RFC 4180 CSV parser and writer (ADR-0008: no csv-parse dependency).
// Zero dependencies. Every value is a string on read.

const NUMBER_RE = /^[-+]?\d+(\.\d+)?$/;
const FORMULA_START_RE = /^[=+\-@\t\r]/;
const QUOTE_NEEDED_RE = /[",\r\n]|^ | $/;

function csvError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Parse CSV text. The first non-blank record is the header (physical line 1 unless a
 * blank line precedes it). Blank lines are ignored. A leading UTF-8 BOM is stripped.
 * @param {string} text
 * @returns {{header: string[], rows: Record<string,string>[], rowNumbers: number[]}}
 */
export function parseCsv(text) {
  let s = typeof text === 'string' ? text : String(text ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  const records = []; // {fields, line}
  const n = s.length;
  let i = 0;
  let line = 1;
  let field = '';
  let fields = [];
  let inQuotes = false;
  let quoteLine = 0;
  let inRecord = false;
  let recLine = 0;

  const endRecord = () => {
    fields.push(field);
    records.push({ fields, line: recLine });
    fields = [];
    field = '';
    inRecord = false;
  };

  while (i < n) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (c === '\n') line += 1;
      field += c;
      i += 1;
      continue;
    }
    if (c === '\n' || (c === '\r' && s[i + 1] === '\n')) {
      if (inRecord) endRecord();
      if (c === '\r') i += 1;
      line += 1;
      i += 1;
      continue;
    }
    if (!inRecord) { inRecord = true; recLine = line; }
    if (c === '"' && field === '') {
      inQuotes = true;
      quoteLine = line;
      i += 1;
      continue;
    }
    if (c === ',') {
      fields.push(field);
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  if (inQuotes) {
    throw csvError('CSV_UNCLOSED_QUOTE', `unclosed quoted field starting on line ${quoteLine}`);
  }
  if (inRecord) endRecord();
  if (records.length === 0) {
    throw csvError('CSV_EMPTY', 'CSV has no header row');
  }

  const header = records[0].fields;
  const seen = new Set();
  for (const name of header) {
    if (seen.has(name)) {
      throw csvError('CSV_DUPLICATE_HEADER', `duplicate header column "${name}"`);
    }
    seen.add(name);
  }

  const rows = [];
  const rowNumbers = [];
  for (const rec of records.slice(1)) {
    if (rec.fields.length !== header.length) {
      throw csvError(
        'CSV_RAGGED',
        `line ${rec.line} has ${rec.fields.length} fields, header has ${header.length}`,
      );
    }
    const row = {};
    header.forEach((name, j) => {
      Object.defineProperty(row, name, {
        value: rec.fields[j], enumerable: true, writable: true, configurable: true,
      });
    });
    rows.push(row);
    rowNumbers.push(rec.line);
  }
  return { header: [...header], rows, rowNumbers };
}

/**
 * Escape one cell: formula-injection guard, then RFC 4180 quoting.
 * Plain numbers are never prefixed, so "-5" and "3.2" stay as they are.
 * @param {unknown} v
 * @returns {string}
 */
export function escapeCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (FORMULA_START_RE.test(s) && !NUMBER_RE.test(s)) s = `'${s}`;
  if (QUOTE_NEEDED_RE.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Serialise rows to CSV with LF line endings and a final newline. Column order = header order.
 * @param {string[]} header
 * @param {Record<string, unknown>[]} rows
 * @returns {string}
 */
export function toCsv(header, rows) {
  const lines = [header.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(header.map((name) => escapeCell(row[name])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
