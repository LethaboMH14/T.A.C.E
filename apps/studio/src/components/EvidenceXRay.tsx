import { useEffect, useState } from 'react';
import { api, type Mission } from '@/state';
import { sourceLineAt, cmp } from './autopsy/csv';
import { ValueBox } from './autopsy/ValueBox';
import type { StoredCheck } from './autopsy/useRoundSnapshots';

type Sources = Mission['sources'];
const SHOWN = 8;

function fileFor(sources: Sources, sourceId: string): string {
  return sources.find((s) => s.sourceId === sourceId)?.file ?? `${sourceId}.csv`;
}

/** Expected against observed, plus the raw source rows the check cites. Only ledger and file data is shown. */
export function EvidenceXRay({ check, sources }: { check: StoredCheck; sources: Sources }) {
  const shown = check.evidence.slice(0, SHOWN);
  const files = [...new Set(shown.map((e) => fileFor(sources, e.sourceId)))].sort(cmp);
  const filesKey = files.join('|');

  // Text per source file: undefined while loading, null when the file could not be opened.
  const [loaded, setLoaded] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    setLoaded({});
    const list = filesKey ? filesKey.split('|') : [];
    for (const file of list) {
      api.sourceLines(file).then(
        (text) => {
          if (!cancelled) setLoaded((prev) => ({ ...prev, [file]: text }));
        },
        () => {
          if (!cancelled) setLoaded((prev) => ({ ...prev, [file]: null }));
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [filesKey]);

  const hasExpected = check.expected !== null && check.expected !== undefined;
  const hasObserved = check.observed !== null && check.observed !== undefined;

  return (
    <div className="grid gap-2 rounded-card bg-sunken p-3 text-[13.5px]" aria-label="Evidence X-Ray">
      <h3 className="m-0 text-[14px] font-semibold text-ink">Evidence X-Ray · {check.title}</h3>
      <p className="m-0 text-ink-2">{check.message}</p>

      {(hasExpected || hasObserved) && (
        <div className="grid grid-cols-2 gap-2">
          <ValueBox label="Recomputed from sources" value={check.expected} />
          <ValueBox label={`Found in ${check.artifact}`} value={check.observed} bad={check.status !== 'PASS'} />
        </div>
      )}

      {check.evidence.length === 0 ? (
        <p className="m-0 text-[12.5px] text-ink-3">This check reads the saved files directly; it cites no single source row.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {shown.map((e) => {
                const file = fileFor(sources, e.sourceId);
                const text = loaded[file];
                let body: string;
                if (text === undefined) body = '';
                else if (text === null) body = `Could not open ${file}`;
                else body = sourceLineAt(text, e.row) ?? '(row not found)';
                return (
                  <tr key={`${file}:${e.row}`}>
                    <td className="whitespace-nowrap border-t border-line px-1.5 py-1.5 align-top font-mono text-[12px] text-ink-3">
                      {file}:{e.row}
                    </td>
                    <td className="break-all border-t border-line px-1.5 py-1.5 align-top font-mono text-[12px] text-ink">{body}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {check.evidence.length > SHOWN && (
            <p className="m-0 pt-1 text-[12.5px] text-ink-3">+{check.evidence.length - SHOWN} more</p>
          )}
        </div>
      )}
    </div>
  );
}
