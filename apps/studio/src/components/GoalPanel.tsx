import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/state';

export function GoalPanel({ mission: m }: { mission: Mission }) {
  const sourceLine =
    m.goalSource === 'model'
      ? 'Drafted by the model.'
      : m.goalSource === 'fixture'
        ? 'Drafted by a fixture (no model call).'
        : null;
  const unsupported = new Set(m.unsupported);

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card" aria-labelledby="h-goal">
      <h2 id="h-goal" className="mb-2.5 text-[15px] font-semibold tracking-[-0.005em]">
        Goal
      </h2>
      <blockquote className="m-0 p-0 text-[15px] leading-[1.55] text-ink before:text-ink-3 before:content-['“'] after:text-ink-3 after:content-['”']">
        {m.goalText || '—'}
      </blockquote>

      {m.goalCheck ? (
        <div className="mt-3 flex items-start gap-2 rounded-field bg-sunken px-3 py-2.5 text-[13px] leading-[1.45] text-ink-2">
          <Check className="mt-px h-4 w-4 shrink-0 text-ok" aria-hidden />
          <div>
            <p className="m-0">
              Goal accepted by the G02 validator. That means the request is well-formed, <b>not</b> that any action is approved.
            </p>
            {sourceLine ? <p className="mono m-0 mt-1 text-[12px] text-ink-3">{sourceLine}</p> : null}
          </div>
        </div>
      ) : null}

      {m.deliverables.length ? (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
          {m.deliverables.map((d) => (
            <li
              key={d}
              title={unsupported.has(d) ? 'Cannot be produced from the admitted sources' : undefined}
              className={cn(
                'mono rounded-full px-2.5 py-[3px] text-[12.5px] font-medium',
                unsupported.has(d) ? 'bg-bad-weak text-bad line-through decoration-1' : 'bg-accent-weak text-accent-ink',
              )}
            >
              {d}
            </li>
          ))}
        </ul>
      ) : null}

      {m.goalDrafts.length ? (
        <ol className="m-0 mt-3 list-none p-0 text-[12.5px] text-ink-3">
          {m.goalDrafts.map((g) => (
            <li key={g.attempt}>
              Goal draft attempt {g.attempt}: {g.ok ? 'accepted' : `rejected (${g.code ?? 'no code'})`}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
