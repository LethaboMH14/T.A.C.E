import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'motion/react';
import type { Mission } from '@/state';
import { changedSessions, clashSessionIds, cmp, parseCsv, type CsvRow } from './csv';
import { errorText, loadText, versionFile } from './files';

type Repair = Mission['repairs'][number];

type Line = { kind: 'old'; row: CsvRow; changed: boolean } | { kind: 'new'; row: CsvRow };

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  mission: Mission;
  /** The clashing artifact, e.g. "mentor-schedule.csv@v1". */
  artifact: string;
  /** Sessions named by the failing check (detail.conflicts). Null when unknown: the clash is then recomputed from the file. */
  conflictSessions: string[] | null;
  repair: Repair | null;
  phase: number;
  reduce: boolean;
  /** Identity of this table's state; reported through onReady once both files are read. */
  readyKey: string;
  onReady: Dispatch<SetStateAction<string | null>>;
}

/**
 * The clash between two sessions, read from the saved schedule. After a repair the
 * moved row is struck through, then the repaired row from the next version slides in.
 */
export function ClashTable({ mission, artifact, conflictSessions, repair, phase, reduce, readyKey, onReady }: Props) {
  const runId = mission.runId;
  const v1File = versionFile(mission, artifact);
  const repairTo = repair?.to ?? null;
  const v2File = repairTo ? versionFile(mission, repairTo) : null;

  const [v1Text, setV1Text] = useState<string | null>(null);
  const [v2Text, setV2Text] = useState<string | null>(null);
  const [err1, setErr1] = useState<string | null>(null);
  const [err2, setErr2] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setV1Text(null);
    setErr1(null);
    loadText(runId, v1File, artifact).then(
      (t) => {
        if (!cancelled) setV1Text(t);
      },
      (e) => {
        if (!cancelled) setErr1(errorText(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [runId, v1File, artifact]);

  useEffect(() => {
    if (!repairTo) return;
    let cancelled = false;
    setV2Text(null);
    setErr2(null);
    loadText(runId, v2File, repairTo).then(
      (t) => {
        if (!cancelled) setV2Text(t);
      },
      (e) => {
        if (!cancelled) setErr2(errorText(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [runId, v2File, repairTo]);

  const v1Done = v1Text !== null || err1 !== null;
  const v2Done = !repairTo || v2Text !== null || err2 !== null;
  useEffect(() => {
    if (v1Done && v2Done) onReady(readyKey);
  }, [v1Done, v2Done, readyKey, onReady]);

  const v1 = useMemo(() => (v1Text === null ? null : parseCsv(v1Text)), [v1Text]);
  const v2 = useMemo(() => (v2Text === null ? null : parseCsv(v2Text)), [v2Text]);
  const diff = useMemo(() => (v1Text !== null && v2Text !== null ? changedSessions(v1Text, v2Text) : null), [v1Text, v2Text]);

  const changedIds = useMemo(() => {
    if (!repair) return new Set<string>();
    const named = repair.changes
      .map((c) => (c && typeof c === 'object' ? (c as { session_id?: unknown }).session_id : undefined))
      .filter((s): s is string => typeof s === 'string' && s !== '');
    return new Set(named.length ? named : (diff?.changed ?? []));
  }, [repair, diff]);

  const lines = useMemo<Line[]>(() => {
    if (!v1) return [];
    const sessions = new Set(conflictSessions ?? clashSessionIds(v1.rows));
    const v2ById = new Map<string, CsvRow>((v2?.rows ?? []).map((r) => [r.session_id, r] as [string, CsvRow]));
    const out: Line[] = [];
    const placed = new Set<string>();
    for (const row of v1.rows) {
      if (!sessions.has(row.session_id)) continue;
      const changed = changedIds.has(row.session_id);
      out.push({ kind: 'old', row, changed });
      const next = changed ? v2ById.get(row.session_id) : undefined;
      if (next) {
        out.push({ kind: 'new', row: next });
        placed.add(row.session_id);
      }
    }
    for (const id of [...changedIds].sort(cmp)) {
      const next = v2ById.get(id);
      if (next && !placed.has(id)) out.push({ kind: 'new', row: next });
    }
    return out;
  }, [v1, v2, conflictSessions, changedIds]);

  if (err1) return <p className="m-0 text-[13px] text-bad">{err1}</p>;
  if (err2) return <p className="m-0 text-[13px] text-bad">{err2}</p>;
  if (!v1) return <p className="m-0 text-[13px] text-ink-3">Opening {artifact}</p>;

  const repaired = !!repair && phase >= 1;
  const showNew = !!repair && phase >= 2;
  const cell = 'border-b border-line px-1.5 py-1.5 font-mono text-[12.5px] whitespace-nowrap';

  return (
    <div className="grid gap-1.5">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="pb-1.5 text-left text-[12px] text-ink-3">
            {repaired && repair ? `${repair.from} → ${repair.to}` : `${artifact}: the clash`}
          </caption>
          <thead>
            <tr>
              {['Session', 'Learner', 'Mentor', 'Day', 'Time'].map((h) => (
                <th key={h} className="border-b border-line px-1.5 py-1 text-left text-[11.5px] font-medium text-ink-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-1.5 py-2 text-[12.5px] text-ink-3">
                  No clashing rows in {artifact}.
                </td>
              </tr>
            )}
            {lines.map((ln, i) => {
              if (ln.kind === 'new') {
                if (!showNew) return null;
                return (
                  <motion.tr
                    key={`new-${ln.row.session_id}-${i}`}
                    initial={reduce ? false : { opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="bg-ok-weak text-ok"
                  >
                    <td className={cell}>{ln.row.session_id}</td>
                    <td className={cell}>{ln.row.trainee_id}</td>
                    <td className={cell}>{ln.row.mentor_id}</td>
                    <td className={cell}>{ln.row.day}</td>
                    <td className={cell}>{ln.row.start}</td>
                  </motion.tr>
                );
              }
              const strike = ln.changed && phase >= 1 && !!repair;
              return (
                <tr key={`old-${ln.row.session_id}`} className={repaired ? 'text-ink-3' : 'bg-bad-weak text-bad'}>
                  <td className={`${cell} relative`}>
                    {ln.row.session_id}
                    {strike && (
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute left-1.5 right-1.5 top-1/2 h-[1.5px] origin-left bg-bad"
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, ease: EASE }}
                      />
                    )}
                  </td>
                  <td className={cell}>{ln.row.trainee_id}</td>
                  <td className={cell}>{ln.row.mentor_id}</td>
                  <td className={cell}>{ln.row.day}</td>
                  <td className={cell}>{ln.row.start}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {conflictSessions === null && <p className="m-0 text-[12.5px] text-ink-3">Clashing rows recomputed from the file.</p>}
    </div>
  );
}
