import type { Skill } from '../lib/types';
import { Mono, ScoreBar, SourceBadge } from './ui';

export function SkillList({ skills, linkBase = '#/learner/skill' }: { skills: Skill[]; linkBase?: string }) {
  if (skills.length === 0) {
    return <p className="rounded-card border border-dashed border-line-strong p-5 text-center text-ink-3">No skills are set up in the workspace yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {skills.map((s) => (
        <li key={s.id}>
          <a
            href={`${linkBase}/${s.id}`}
            className="block rounded-card border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-accent hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold text-ink">{s.name}</p>
                <Mono>{s.id}</Mono>
              </div>
              {s.latest ? <SourceBadge source={s.latest.source} /> : <span className="text-[13px] text-ink-3">no score yet</span>}
            </div>
            <div className="mt-3">
              <ScoreBar score={s.latest?.score ?? null} threshold={s.threshold} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[13px] text-ink-2">
              <span>{s.latest ? `${s.latest.score} / 100` : '—'}</span>
              <span className="text-ink-3">pass line {s.threshold}</span>
              <span>{s.latest ? `${s.latest.minutes} min` : '— min'}</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
