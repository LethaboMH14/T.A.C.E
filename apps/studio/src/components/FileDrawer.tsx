import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/state';

export interface DrawerTarget {
  name: string;
  file: string;
  version: number;
  digest: string;
}

/** RFC 4180 style parse: quoted cells, doubled quotes, CRLF or LF. Blank lines are dropped. */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    records.push(row);
  }
  const [header = [], ...body] = records.filter((r) => r.length > 1 || r[0]);
  return {
    header,
    rows: body.map((r) => Object.fromEntries(header.map((k, i) => [k, r[i] ?? '']))),
  };
}

/**
 * Indexes of BOOKED rows that share mentor_id + day + start with another BOOKED row.
 * Every row of a clashing group is returned, so the reader sees both sides of the double-booking.
 */
export function clashRows(rows: Record<string, string>[]): Set<number> {
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (r.status !== 'BOOKED') return;
    const key = `${r.mentor_id}|${r.day}|${r.start}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const out = new Set<number>();
  for (const idx of groups.values()) if (idx.length > 1) idx.forEach((i) => out.add(i));
  return out;
}

const isUnsentDraft = (name: string): boolean => name.startsWith('unsent-message-drafts');

export function FileDrawer({
  runId,
  target,
  onClose,
}: {
  runId: string | null;
  target: DrawerTarget | null;
  onClose: () => void;
}) {
  const file = target?.file ?? null;
  const [loaded, setLoaded] = useState<{ file: string; text: string | null } | null>(null);

  useEffect(() => {
    if (!runId || !file) return;
    let alive = true;
    api
      .fileText(runId, file)
      .then((t) => alive && setLoaded({ file, text: t }))
      .catch(() => alive && setLoaded({ file, text: null }));
    return () => {
      alive = false;
    };
  }, [runId, file]);

  const current = loaded && loaded.file === file ? loaded : null;

  return (
    <Sheet modal={false} open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0">
        {target ? (
          <>
            <header className="border-b border-line px-5 py-4 pr-16">
              <SheetTitle className="text-[16px] font-semibold tracking-[-0.005em]">
                {target.name} · v{target.version}
              </SheetTitle>
              <SheetDescription className="mono mt-1 break-all text-[12px] text-ink-3">sha256 {target.digest}</SheetDescription>
            </header>
            <div className="min-h-0 flex-1 overflow-auto px-5 pb-7 pt-4">
              <DrawerBody name={target.name} current={current} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ name, current }: { name: string; current: { text: string | null } | null }) {
  if (!current) return <p className="m-0 text-[13.5px] text-ink-3">Loading file…</p>;
  if (current.text === null) return <p className="m-0 text-[13.5px] text-bad">This file could not be opened.</p>;
  const text = current.text;

  if (name.endsWith('.csv')) {
    const { header, rows } = parseCsv(text);
    const clash = clashRows(rows);
    return (
      <table className="border-collapse font-mono text-[12.5px]">
        <thead>
          <tr>
            {header.map((h) => (
              <th key={h} scope="col" className="sticky top-0 border-b border-line-strong bg-surface px-2.5 py-1.5 text-left font-medium text-ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={clash.has(i) ? 'bg-bad-weak text-bad' : undefined}>
              {header.map((h) => (
                <td key={h} className="whitespace-nowrap border-b border-line px-2.5 py-1">
                  {r[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (name.endsWith('.json')) {
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // Not valid JSON: show the file exactly as written.
    }
    return <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-[1.6] text-ink">{pretty}</pre>;
  }

  return (
    <>
      {isUnsentDraft(name) ? (
        <p className="m-0 mb-3 inline-block rounded-full bg-run-weak px-2.5 py-1 text-[13px] font-semibold text-run">
          Unsent. Needs a person’s approval.
        </p>
      ) : null}
      <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-[1.6] text-ink">{text}</pre>
    </>
  );
}
