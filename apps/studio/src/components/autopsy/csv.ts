// Pure helpers for reading saved CSV files in the review panel. No React, no network.
// Every set returned is sorted, so the same input always renders the same output.

export type CsvRow = Record<string, string>;

export interface CsvTable {
  header: string[];
  rows: CsvRow[];
}

export interface RowDiff {
  changed: string[];
  removed: string[];
  added: string[];
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** RFC-4180-style parser: quoted cells, doubled quotes, CRLF or LF line endings. The first non-empty row is the header. */
export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...rest] = rows.filter((r) => r.length > 1 || r[0]);
  const header = head ?? [];
  return {
    header,
    rows: rest.map((r) => Object.fromEntries(header.map((k, i) => [k, r[i] ?? '']))),
  };
}

/** Sessions that share a mentor, day and start time with another BOOKED session (same rule as the classic preview). */
export function clashSessionIds(rows: CsvRow[]): string[] {
  const firstAt = new Map<string, string>();
  const clash = new Set<string>();
  for (const r of rows) {
    if (r.status !== 'BOOKED') continue;
    const key = `${r.mentor_id}|${r.day}|${r.start}`;
    const first = firstAt.get(key);
    if (first !== undefined) {
      clash.add(first);
      clash.add(r.session_id);
    } else {
      firstAt.set(key, r.session_id);
    }
  }
  return [...clash].sort(cmp);
}

/** Compares two CSV texts by session_id. A session is changed when any cell differs, removed when only v1 has it, added when only v2 has it. */
export function changedSessions(v1Text: string, v2Text: string): RowDiff {
  const a = parseCsv(v1Text);
  const b = parseCsv(v2Text);
  const signatures = (t: CsvTable): Map<string, string> =>
    new Map(t.rows.map((r) => [r.session_id, t.header.map((h) => r[h]).join('\u001f')] as [string, string]));
  const before = signatures(a);
  const after = signatures(b);
  const changed: string[] = [];
  const removed: string[] = [];
  const added: string[] = [];
  for (const [id, sig] of before) {
    if (!after.has(id)) removed.push(id);
    else if (after.get(id) !== sig) changed.push(id);
  }
  for (const id of after.keys()) if (!before.has(id)) added.push(id);
  return { changed: changed.sort(cmp), removed: removed.sort(cmp), added: added.sort(cmp) };
}

/** The raw text of a 1-based line (line 1 is the header). Null when the file has no such line. */
export function sourceLineAt(text: string, row: number): string | null {
  const line = text.split('\n')[row - 1];
  return line === undefined ? null : line.replace(/\r$/, '');
}

export { cmp };
