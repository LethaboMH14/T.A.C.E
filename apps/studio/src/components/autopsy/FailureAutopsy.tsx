import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { TriangleAlert, Wrench, Check } from 'lucide-react';
import type { Mission } from '@/state';
import { ClashTable } from './ClashTable';
import { MismatchBoxes, fmtValue } from './ValueBox';
import { useRepairPhase, FINAL_PHASE } from './useRepairPhase';
import { useRoundSnapshots, type StoredCheck } from './useRoundSnapshots';

type Repair = Mission['repairs'][number];
type Round = Mission['rounds'][number];

const EASE = [0.16, 1, 0.3, 1] as const;

/** Red case per VERIFICATION_FAILED round. The repair and re-check lines appear only from the ledger. */
export function FailureAutopsy({ mission }: { mission: Mission }) {
  const reduce = useReducedMotion() ?? false;
  const snapshots = useRoundSnapshots(mission);
  if (mission.rounds.length === 0) return null;

  // The re-check line belongs to the last failed round before the passing round.
  const passRound = mission.passed?.round ?? null;
  const passCase = passRound === null ? null : mission.rounds.filter((r) => r.round < passRound).at(-1)?.round ?? null;

  return (
    <section aria-label="Failure autopsy" className="grid gap-2.5">
      {mission.rounds.map((round) => (
        <AutopsyCase
          key={round.round}
          mission={mission}
          round={round}
          snapshot={snapshots.get(round.round) ?? null}
          reduce={reduce}
          showPass={passCase === round.round}
        />
      ))}
    </section>
  );
}

interface CaseProps {
  mission: Mission;
  round: Round;
  snapshot: StoredCheck[] | null;
  reduce: boolean;
  showPass: boolean;
}

function AutopsyCase({ mission, round, snapshot, reduce, showPass }: CaseProps) {
  const failed = round.failed;
  const primary = snapshot?.find((c) => c.id === failed[0]) ?? snapshot?.[0] ?? null;
  const repair: Repair | null = mission.repairs.find((r) => r.round === round.round) ?? null;
  const artifact: string | null = primary?.artifact ?? repair?.from ?? null;
  const detail: Record<string, unknown> = (primary?.detail as Record<string, unknown> | undefined) ?? {};
  const conflicts = Array.isArray(detail.conflicts) ? (detail.conflicts as { sessions?: string[] }[]) : null;
  const mismatches = Array.isArray(detail.mismatches) ? (detail.mismatches as { field?: unknown; expected?: unknown; observed?: unknown }[]) : null;
  const problems = Array.isArray(detail.problems) ? (detail.problems as Record<string, unknown>[]) : null;
  const message = primary?.message ?? round.messages[0] ?? '';
  const isClash =
    !!artifact && artifact.startsWith('mentor-schedule') && (conflicts !== null || failed.some((id) => id.startsWith('C04')));

  const readyKey = `${artifact ?? ''}|${repair?.to ?? ''}`;
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = isClash ? readyFor === readyKey : true;
  const phase = useRepairPhase(!!repair && ready, reduce);

  const passed = showPass ? mission.passed : null;
  const conflictSessions = conflicts ? conflicts.flatMap((c) => c.sessions ?? []) : null;
  const caseMotion = reduce
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, clipPath: 'inset(0 0 100% 0 round 10px)' }, animate: { opacity: 1, clipPath: 'inset(0 0 0 0 round 10px)' } };

  return (
    <motion.article
      {...caseMotion}
      transition={{ duration: 0.7, ease: EASE }}
      className="overflow-hidden rounded-[10px] border border-bad-line"
      aria-label={`Round ${round.round} problem`}
    >
      <div className="flex items-start gap-2.5 bg-bad-weak p-3 text-bad">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h3 className="m-0 text-[14.5px] font-bold">
            Reviewer caught {failed.length === 1 ? 'a problem' : `${failed.length} problems`} in round {round.round}
          </h3>
          {message && <p className="mt-0.5 mb-0 break-words text-[13.5px] leading-snug">{message}</p>}
        </div>
      </div>

      <div className="grid gap-2.5 bg-surface p-3">
        {isClash && artifact && (
          <>
            <p className="m-0 text-[13px] text-ink-3">
              Two sessions claim the same mentor at the same time. Source: <span className="font-mono">{artifact}</span>
            </p>
            <ClashTable
              mission={mission}
              artifact={artifact}
              conflictSessions={conflictSessions}
              repair={repair}
              phase={phase}
              reduce={reduce}
              readyKey={readyKey}
              onReady={setReadyFor}
            />
          </>
        )}

        {!isClash && mismatches?.[0] && <MismatchBoxes mismatch={mismatches[0]} artifact={artifact} />}

        {!isClash && repair && <FieldChanges repair={repair} phase={phase} reduce={reduce} />}

        {problems && problems.length > 0 && (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {problems.map((p, i) => {
              const label = [p.draft_id, p.session_id].filter((x) => x !== undefined && x !== null).map(fmtValue).join(' · ');
              const text = p.issue ?? p.message ?? p.reason ?? JSON.stringify(p);
              return (
                <li key={i} className="rounded-field bg-bad-weak px-2.5 py-2 text-[13px] text-bad">
                  {label && <span className="mr-2 font-mono text-[12px]">{label}</span>}
                  <span className="break-words">{fmtValue(text)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {repair && phase >= FINAL_PHASE && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-start gap-2 rounded-[10px] bg-accent-weak px-3 py-2.5 text-[13.5px] text-accent-ink"
          >
            <Wrench className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              Repair wrote <b className="font-mono font-medium">{repair.to}</b> and kept <b className="font-mono font-medium">{repair.from}</b>.{' '}
              {repair.changes.length} change{repair.changes.length === 1 ? '' : 's'}, nothing else touched.
            </span>
          </motion.div>
        )}

        {passed && (!repair || phase >= FINAL_PHASE) && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-start gap-2 rounded-[10px] bg-ok-weak px-3 py-2.5 text-[14px] font-semibold text-ok"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              Re-checked from the files on disk: {passed.passed} of {passed.total} pass.
            </span>
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}

/** Field table for repairs that are not a schedule rewrite (from → to per field). Rows slide in after the strike phase. */
function FieldChanges({ repair, phase, reduce }: { repair: Repair; phase: number; reduce: boolean }) {
  const cell = 'border-b border-line px-1.5 py-1.5 font-mono text-[12.5px] break-all';
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="pb-1.5 text-left text-[12px] text-ink-3">
          {repair.from} → {repair.to}
        </caption>
        <thead>
          <tr>
            {['Field', 'Was', 'Now'].map((h) => (
              <th key={h} className="border-b border-line px-1.5 py-1 text-left text-[11.5px] font-medium text-ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {phase >= 2 &&
            repair.changes.map((c, i) => {
              const row = (c ?? {}) as { field?: unknown; session_id?: unknown; from?: unknown; to?: unknown };
              return (
                <motion.tr
                  key={i}
                  initial={reduce ? false : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="bg-ok-weak text-ok"
                >
                  <td className={cell}>{fmtValue(row.field ?? row.session_id)}</td>
                  <td className={cell}>{fmtValue(row.from)}</td>
                  <td className={cell}>{fmtValue(row.to)}</td>
                </motion.tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
