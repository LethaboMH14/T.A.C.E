import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/state';

const TONE: Record<string, string> = {
  '': 'text-ink',
  ok: 'text-ok',
  bad: 'text-bad',
  redo: 'text-accent-ink',
};

export function ActivityFeed({ mission: m }: { mission: Mission }) {
  const list = useRef<HTMLOListElement>(null);

  // Follow the newest line only while the reader is already near the bottom.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (stick) el.scrollTop = el.scrollHeight;
  }, [m.feed.length]);

  return (
    <section className="flex max-h-[460px] flex-col rounded-card border border-line bg-surface p-4 shadow-card max-[860px]:max-h-[360px]" aria-labelledby="h-feed">
      <h2 id="h-feed" className="mb-2.5 text-[15px] font-semibold tracking-[-0.005em]">
        Live activity
      </h2>
      <ol ref={list} className="m-0 grid min-h-[120px] flex-1 list-none gap-px overflow-y-auto p-0">
        {m.feed.map((f, i) => (
          <li
            key={`${i}-${f.t}`}
            className={cn('grid grid-cols-[58px_1fr] gap-2.5 rounded-[6px] px-1 py-1.5 text-[13.5px] leading-[1.4]', TONE[f.tone])}
          >
            <time className="mono text-xs leading-[1.6] text-ink-3">+{f.t.toFixed(1)}s</time>
            <span className="min-w-0 [overflow-wrap:anywhere]">{f.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
