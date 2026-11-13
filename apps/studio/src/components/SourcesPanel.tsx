import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/state';

export function SourcesPanel({ mission: m }: { mission: Mission }) {
  const empty = m.sources.length === 0 && m.blockedSources.length === 0;
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card" aria-labelledby="h-src">
      <h2 id="h-src" className="mb-2.5 text-[15px] font-semibold tracking-[-0.005em]">
        Sources
      </h2>
      {empty ? <p className="m-0 text-[13px] text-ink-3">Sources appear as each file is admitted.</p> : null}
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {m.sources.map((s) => (
          <li
            key={s.sourceId}
            title={`sha256 ${s.digest}`}
            className="grid grid-cols-[18px_1fr_auto] items-center gap-2 rounded-[6px] px-1 py-1.5 text-[13.5px] hover:bg-sunken"
          >
            <Check className="h-4 w-4 text-ok" aria-hidden />
            <span className="min-w-0 truncate">{s.file}</span>
            <span className="mono text-[12px] text-ink-3">
              {s.rows} rows · {s.digest.slice(0, 8)}
            </span>
          </li>
        ))}
        {m.blockedSources.map((b) => (
          <li
            key={`blocked-${b.sourceId}`}
            className="grid grid-cols-[18px_1fr_auto] items-center gap-2 rounded-[6px] px-1 py-1.5 text-[13.5px] hover:bg-sunken"
          >
            <X className="h-4 w-4 text-bad" aria-hidden />
            <span className={cn('min-w-0 truncate font-semibold text-bad')}>{b.sourceId}</span>
            <span className="mono text-[12px] text-ink-3">{b.code === 'MISSING_SOURCE' ? 'missing' : b.code}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
