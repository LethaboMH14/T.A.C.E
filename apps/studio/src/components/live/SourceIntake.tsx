import { useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/state';

export interface IntakeRow {
  name: string;
  rows: number;
  digest: string;
  /** 'reading' until SOURCE_ADMITTED names this file; 'admitted' after; 'changed' if the admitted digest differs. */
  state: 'reading' | 'admitted' | 'changed';
}

export const shortDigest = (d: string): string => d.slice(0, 8);

/** One row per file in LMS_SNAPSHOT, resolved by the SOURCE_ADMITTED event with the same file name. */
export function intakeRows(m: Pick<Mission, 'lmsSnapshot' | 'sources'>): IntakeRow[] {
  if (!m.lmsSnapshot) return [];
  return m.lmsSnapshot.files.map((f) => {
    const admitted = m.sources.find((s) => s.file === f.name);
    const state: IntakeRow['state'] = !admitted ? 'reading' : admitted.digest === f.digest ? 'admitted' : 'changed';
    return { name: f.name, rows: f.rows, digest: f.digest, state };
  });
}

/** The class data a run started from: each file appears when the ledger says it was read, then settles when it is admitted. */
export function SourceIntake({ mission: m }: { mission: Mission }) {
  const rows = intakeRows(m);
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  if (!m.lmsSnapshot) return null;
  const waiting = rows.filter((r) => r.state === 'reading').length;
  const open = openChoice ?? m.tasks.length === 0;
  const s = m.lmsSnapshot;
  const bits = [
    `${rows.length} file${rows.length === 1 ? '' : 's'}`,
    s.learners !== null ? `${s.learners} learners` : null,
    s.helpRequests !== null ? `${s.helpRequests} help request${s.helpRequests === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <section aria-labelledby="h-intake" className="rounded-card border border-line bg-surface shadow-card">
      <h2 id="h-intake" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenChoice(!open)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-card px-4 py-3 text-left"
        >
          <span className="text-[15px] font-semibold text-ink">Class data</span>
          <span className="flex items-center gap-2 text-[13px] text-ink-2">
            {bits.join(' · ')}
            {waiting > 0 && m.stream !== 'ended' ? <span className="text-run">· {waiting} still reading</span> : null}
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-150 ease-out motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
          </span>
        </button>
      </h2>
      {open ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-px overflow-hidden rounded-b-card border-t border-line bg-line p-0">
          {rows.map((r) => (
            <li key={r.name} data-state={r.state} className="intake-row relative flex items-center gap-2.5 overflow-hidden bg-surface px-3 py-2">
              {r.state === 'reading' ? <span className="intake-scan" aria-hidden /> : null}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {r.state === 'reading' ? (
                  <Loader2 className="h-4 w-4 text-run motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Check className={cn('h-4 w-4', r.state === 'admitted' ? 'text-ok' : 'text-bad')} aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="mono block truncate text-[12.5px] text-ink">{r.name}</span>
                <span className="block text-[12px] text-ink-3">
                  {r.rows.toLocaleString('en-GB')} row{r.rows === 1 ? '' : 's'}
                  {r.state === 'reading' ? ' · reading' : r.state === 'changed' ? ' · changed after reading' : ''}
                </span>
              </span>
              <span className="mono shrink-0 text-[11.5px] text-ink-3" title={r.digest}>{shortDigest(r.digest)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
