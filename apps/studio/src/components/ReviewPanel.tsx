import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, TriangleAlert, X } from 'lucide-react';
import type { Mission } from '@/state';
import { FailureAutopsy } from './autopsy/FailureAutopsy';
import { EvidenceXRay } from './EvidenceXRay';
import { cmp } from './autopsy/csv';
import type { StoredCheck } from './autopsy/useRoundSnapshots';

const MARK: Record<string, string> = {
  PASS: 'border-ok bg-ok',
  FAIL: 'border-bad bg-bad',
  UNKNOWN: 'border-run bg-run',
};

/** One check row. The mark flips when the status changes between rounds. */
function CheckRow({ check, selected, reduce, onSelect }: { check: StoredCheck; selected: boolean; reduce: boolean; onSelect: () => void }) {
  const lastStatus = useRef(check.status);
  const [flip, setFlip] = useState(0);
  useEffect(() => {
    if (lastStatus.current !== check.status) {
      lastStatus.current = check.status;
      setFlip((n) => n + 1);
    }
  }, [check.status]);

  const Mark = check.status === 'PASS' ? Check : check.status === 'FAIL' ? X : TriangleAlert;
  return (
    <li data-status={check.status}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`grid w-full grid-cols-[22px_minmax(0,1fr)] items-start gap-2.5 rounded-field px-2 py-2 text-left text-[13.5px] leading-snug text-ink hover:bg-sunken ${selected ? 'bg-accent-weak hover:bg-accent-weak' : ''}`}
      >
        <motion.span
          key={flip}
          initial={!reduce && flip > 0 ? { rotateX: 90, scale: 0.6 } : false}
          animate={{ rotateX: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className={`grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] text-white ${MARK[check.status] ?? MARK.UNKNOWN}`}
        >
          <Mark className="h-3 w-3" strokeWidth={2.8} aria-hidden />
        </motion.span>
        <span className="min-w-0">
          <span className={`block break-words ${check.status === 'FAIL' ? 'font-semibold text-bad' : ''}`}>{check.title}</span>
          <span className="mt-px block break-words font-mono text-[11.5px] text-ink-3">
            {check.id} · {check.artifact}
          </span>
        </span>
      </button>
    </li>
  );
}

export function ReviewPanel({ mission }: { mission: Mission }) {
  const reduce = useReducedMotion() ?? false;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const checks = Object.values(mission.checks).sort((a, b) => cmp(a.id, b.id));
  const selected = selectedId ? (mission.checks[selectedId] ?? null) : null;
  const verdicts = mission.messages.filter((m) => (m.from === 'Reviewer' || m.from === 'Reviewer voice') && m.type === 'RESULT');

  return (
    <section className="grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card" aria-labelledby="h-review">
      <div>
        <h2 id="h-review" className="m-0 text-[15px] font-semibold text-ink">
          Independent review
        </h2>
        <p className="mt-1 mb-0 text-[13px] leading-snug text-ink-3">
          Re-opens every saved file and recomputes from the raw sources. It shares no code with the workers.
        </p>
      </div>

      <FailureAutopsy mission={mission} />

      {checks.length === 0 ? (
        <p className="m-0 text-[13.5px] text-ink-3">Checks appear here when the Reviewer starts.</p>
      ) : (
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {checks.map((c) => (
            <CheckRow
              key={c.id}
              check={c}
              selected={selectedId === c.id}
              reduce={reduce}
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </ul>
      )}

      {verdicts.length > 0 && (
        <div className="grid gap-1.5">
          {verdicts.map((m) => (
            <p key={m.id} className="m-0 text-[13px] leading-snug text-ink-2">
              <span className="text-ink-3">Reviewer (model) says: </span>
              <q>{m.reason}</q>
            </p>
          ))}
        </div>
      )}

      {selected && <EvidenceXRay check={selected} sources={mission.sources} />}
    </section>
  );
}
