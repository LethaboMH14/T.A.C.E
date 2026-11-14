import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Check, TriangleAlert, X } from 'lucide-react';
import { EvidenceXRay } from '@/components/EvidenceXRay';
import { sortedEvents, useRunEvents } from '@/lib/ledger';
import { cn } from '@/lib/utils';
import type { LedgerEvent, Mission } from '@/state';
import type { StoredCheck } from '@/components/autopsy/useRoundSnapshots';

export type Status = 'PASS' | 'FAIL' | 'UNKNOWN';
export type Filter = 'all' | 'failed' | 'passed';

export interface CheckHistory {
  id: string;
  title: string;
  artifact: string;
  /** Status per review round, in round order. */
  rounds: { round: number; status: Status }[];
  latest: Status;
}

/**
 * Round history per check from CHECK_RESULT events. A CHECK_RESULT belongs to the round of the latest REVIEW_STARTED.
 * Without events, falls back to the latest result per check in Mission.checks (no earlier rounds are known).
 */
export function checkHistory(mission: Mission, events: LedgerEvent[]): CheckHistory[] {
  const byId = new Map<string, Map<number, Status>>();
  const meta = new Map<string, { title: string; artifact: string }>();
  let round = 0;
  for (const e of sortedEvents(events)) {
    if (e.type === 'REVIEW_STARTED') round = Number(e.data?.round ?? round);
    if (e.type !== 'CHECK_RESULT') continue;
    const id = String(e.data?.id ?? '');
    if (!id) continue;
    const rounds = byId.get(id) ?? new Map<number, Status>();
    rounds.set(round, e.data.status as Status);
    byId.set(id, rounds);
    meta.set(id, { title: String(e.data.title ?? id), artifact: String(e.data.artifact ?? '') });
  }
  if (!byId.size) {
    return Object.values(mission.checks).map((c) => ({
      id: c.id,
      title: c.title,
      artifact: c.artifact,
      rounds: [{ round: c.round, status: c.status }],
      latest: c.status,
    }));
  }
  return [...byId.entries()]
    .map(([id, rounds]) => {
      const list = [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([r, status]) => ({ round: r, status }));
      return { id, title: meta.get(id)?.title ?? id, artifact: meta.get(id)?.artifact ?? '', rounds: list, latest: list[list.length - 1].status };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function applyFilter(list: CheckHistory[], filter: Filter): CheckHistory[] {
  if (filter === 'failed') return list.filter((c) => c.latest === 'FAIL');
  if (filter === 'passed') return list.filter((c) => c.latest === 'PASS');
  return list;
}

const CELL: Record<Status, string> = {
  PASS: 'bg-ok-weak text-ok border-ok-line',
  FAIL: 'bg-bad-weak text-bad border-bad-line',
  UNKNOWN: 'bg-run-weak text-run border-run-line',
};
const CELL_ICON: Record<Status, typeof Check> = { PASS: Check, FAIL: X, UNKNOWN: TriangleAlert };

export function EvidenceView({ mission }: { mission: Mission }) {
  const events = useRunEvents(mission);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);

  if (!mission.runId) {
    return <section className="rounded-card border border-line bg-surface p-5 text-[14px] text-ink-3">Select a run to see its checks.</section>;
  }

  const all = checkHistory(mission, events);
  if (!all.length) {
    return (
      <section className="rounded-card border border-line bg-surface p-5 text-[14px] text-ink-3">
        No checks have run yet. Checks appear when the Reviewer starts.
      </section>
    );
  }

  const passed = all.filter((c) => c.latest === 'PASS').length;
  const failed = all.filter((c) => c.latest === 'FAIL').length;
  const shown = applyFilter(all, filter);
  const rounds = [...new Set(all.flatMap((c) => c.rounds.map((r) => r.round)))].sort((a, b) => a - b);
  const pick = selected && mission.checks[selected] ? (mission.checks[selected] as StoredCheck) : null;

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card" aria-label="Check totals">
        <p className="m-0 text-[14px]">
          <span className="mono text-[20px] font-semibold text-ok"><NumberFlow value={passed} respectMotionPreference /></span>{' '}
          <span className="text-ink-2">passing</span>
        </p>
        <p className="m-0 text-[14px]">
          <span className="mono text-[20px] font-semibold text-bad"><NumberFlow value={failed} respectMotionPreference /></span>{' '}
          <span className="text-ink-2">failing (latest round)</span>
        </p>
        <p className="m-0 text-[14px] text-ink-3">
          <NumberFlow value={all.length} respectMotionPreference /> checks · {rounds.length} review round{rounds.length === 1 ? '' : 's'}
        </p>
        <div role="group" aria-label="Filter checks" className="ml-auto flex gap-1.5">
          {(['all', 'failed', 'passed'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-3 py-1 text-[13px] capitalize',
                filter === f ? 'border-accent bg-accent-weak text-accent-ink' : 'border-line-strong bg-surface text-ink-2',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="overflow-x-auto rounded-card border border-line bg-surface p-3 shadow-card" aria-label="Check history">
          {shown.length === 0 ? (
            <p className="m-0 p-2 text-[13.5px] text-ink-3">No checks match this filter.</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-ink-3">
                  <th scope="col" className="border-b border-line-strong py-1.5 pr-2 font-medium">Check</th>
                  {rounds.map((r) => (
                    <th key={r} scope="col" className="border-b border-line-strong py-1.5 pr-2 text-center font-medium">R{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={cn('cursor-pointer border-b border-line hover:bg-sunken', selected === c.id && 'bg-accent-weak hover:bg-accent-weak')}
                  >
                    <th scope="row" className="py-2 pr-2 text-left align-top font-medium text-ink">
                      <button type="button" aria-pressed={selected === c.id} onClick={() => setSelected(c.id)} className="cursor-pointer bg-transparent p-0 text-left text-[13px] text-ink">
                        {c.title}
                      </button>
                      <span className="mono block text-[11.5px] font-normal text-ink-3">{c.id} · {c.artifact}</span>
                    </th>
                    {rounds.map((r) => {
                      const cell = c.rounds.find((x) => x.round === r);
                      if (!cell) return <td key={r} className="py-2 text-center text-ink-3">-</td>;
                      const Icon = CELL_ICON[cell.status];
                      return (
                        <td key={r} className="py-2 text-center">
                          <span
                            className={cn('mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px]', CELL[cell.status])}
                            aria-label={`round ${r}: ${cell.status}`}
                          >
                            <Icon className="h-3 w-3" aria-hidden />
                            {cell.status}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-label="Selected check" className="grid content-start gap-3">
          {pick ? (
            <EvidenceXRay check={pick} sources={mission.sources} />
          ) : (
            <p className="m-0 rounded-card border border-line bg-surface p-4 text-[13.5px] text-ink-3">
              Select a check to see its expected and observed values and the source rows it cites.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
