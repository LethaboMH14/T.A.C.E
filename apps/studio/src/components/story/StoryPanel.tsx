import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, FileSearch, ListChecks, Loader2, ShieldCheck, Target, Users, X } from 'lucide-react';
import { buildStory, storyLineCount, type ChapterIcon, type ChapterStatus, type LineTone } from '@/state/narrative';
import type { Mission } from '@/state';
import { cn } from '@/lib/utils';

const ICON: Record<ChapterIcon, typeof Target> = { goal: Target, sources: FileSearch, plan: ListChecks, work: Users, review: ShieldCheck };
const TONE: Record<LineTone, string> = { '': 'text-ink', ok: 'text-ok', bad: 'text-bad', redo: 'text-accent-ink' };
const MARK: Record<LineTone, string> = { '': '', ok: 'Passed: ', bad: 'Problem: ', redo: 'Repair: ' };
const STATUS: Record<ChapterStatus, string> = { idle: 'Not started', active: 'In progress', done: 'Done', bad: 'Needs attention' };

/** The run told in plain English, in order. Every line comes from a ledger event; clicking one opens its node. */
export function StoryPanel({ mission, onSelectNode }: { mission: Mission; onSelectNode: (id: string) => void }) {
  const chapters = buildStory(mission);
  const count = storyLineCount(chapters);
  const reduce = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const live = mission.stream === 'live' && !mission.finished;

  // Follow the story while a live run adds lines, unless the reader scrolled up.
  useEffect(() => {
    const parent = endRef.current?.parentElement?.parentElement;
    if (!parent) return;
    const onScroll = () => { pinned.current = parent.scrollHeight - parent.scrollTop - parent.clientHeight < 120; };
    parent.addEventListener('scroll', onScroll);
    return () => parent.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const parent = endRef.current?.parentElement?.parentElement;
    if (live && pinned.current && parent) parent.scrollTo({ top: parent.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [count, live, reduce]);

  if (!mission.events.length) {
    return (
      <div className="flex items-center gap-2 text-[13.5px] text-ink-2" role="status">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        {mission.stream === 'stopped' ? 'The run ended before it wrote anything.' : 'Waiting for the run to start.'}
      </div>
    );
  }

  return (
    <div>
      {mission.stream === 'lost' || mission.stream === 'stopped' ? (
        <p className="mb-3 text-[13px] text-bad" role="status">
          {mission.stream === 'lost' ? 'Connection lost. Reconnecting; the story may be missing the latest steps.' : 'The run stopped before it finished.'}
        </p>
      ) : null}
      <ol className="m-0 flex list-none flex-col gap-4 p-0" aria-label="The run, step by step">
        {chapters.map((c) => {
          const Icon = ICON[c.icon];
          return (
            <li key={c.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-2', c.status === 'done' && 'border-ok text-ok', c.status === 'bad' && 'border-bad text-bad', c.status === 'active' && 'border-accent text-accent-ink')}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                  <span>{c.n}. {c.title}</span>
                  <span className={cn('inline-flex items-center gap-1 text-[12px] font-medium text-ink-3', c.status === 'done' && 'text-ok', c.status === 'bad' && 'text-bad', c.status === 'active' && 'text-accent-ink')}>
                    {c.status === 'done' ? <Check className="h-3 w-3" aria-hidden /> : c.status === 'bad' ? <X className="h-3 w-3" aria-hidden /> : null}
                    {STATUS[c.status]}
                  </span>
                </h3>
                {c.lines.length ? (
                  <ul className="m-0 mt-1 flex list-none flex-col p-0">
                    {c.lines.map((l) => (
                      <motion.li
                        key={l.id}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={cn(l.heading && 'mt-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3')}
                      >
                        {l.heading ? (
                          l.text
                        ) : l.nodeId ? (
                          <button
                            type="button"
                            title={l.title}
                            onClick={() => onSelectNode(l.nodeId!)}
                            className={cn('block w-full cursor-pointer rounded-[6px] px-1 py-1 text-left text-[13.5px] leading-[1.4] hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', TONE[l.tone])}
                          >
                            {MARK[l.tone] ? <span className="sr-only">{MARK[l.tone]}</span> : null}{l.text}
                          </button>
                        ) : (
                          <p title={l.title} className={cn('m-0 px-1 py-1 text-[13.5px] leading-[1.4]', TONE[l.tone])}>
                            {MARK[l.tone] ? <span className="sr-only">{MARK[l.tone]}</span> : null}{l.text}
                          </p>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 mt-1 px-1 text-[13px] text-ink-3">{c.waiting}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
