import { useEffect, useState, type ReactNode } from 'react';
import { Check, Inbox, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mission, StageState } from '@/state';

const STEPS: { key: keyof Mission['stage']; label: string }[] = [
  { key: 'goal', label: 'Goal' },
  { key: 'plan', label: 'Plan' },
  { key: 'execute', label: 'Execute' },
  { key: 'verify', label: 'Verify' },
  { key: 'deliver', label: 'Deliver' },
];

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  const mm = String(Math.floor(safe / 60000)).padStart(2, '0');
  const ss = String(Math.floor((safe % 60000) / 1000)).padStart(2, '0');
  return `${mm}:${ss}.${Math.floor((safe % 1000) / 100)}`;
}

function countLine(m: Mission): ReactNode {
  const g = m.summaries.compute_gaps;
  const sch = m.summaries.mentor_schedule;
  const dr = m.summaries.draft_messages;
  const bits: ReactNode[] = [];
  if (g) {
    bits.push(<span key="g">
      <b>{g.atRisk}</b> of <b>{g.trainees}</b> learners at risk
    </span>);
    bits.push(<span key="gaps"><b>{g.gaps}</b> skill gaps</span>);
    bits.push(<span key="miss"><b>{g.missing}</b> missing scores flagged</span>);
  }
  if (sch) {
    bits.push(<span key="s">
      <b>{sch.booked}</b> sessions booked{sch.unscheduled ? <>, <b>{sch.unscheduled}</b> unscheduled</> : null}
    </span>);
  }
  if (dr) bits.push(<span key="d"><b>{dr.drafts}</b> drafts, all unsent</span>);
  if (m.finished && m.finished.checksTotal) {
    bits.push(<span key="c"><b>{m.finished.checksPassed}/{m.finished.checksTotal}</b> checks</span>);
  }
  if (!bits.length) return 'Numbers appear here as the plan runs.';
  return bits.map((b, i) => (
    <span key={i}>
      {i > 0 ? <span className="mx-2 text-line-strong">/</span> : null}
      {b}
    </span>
  ));
}

function stepClass(state: StageState): string {
  switch (state) {
    case 'done':
      return 'text-ink-2';
    case 'active':
      return 'font-semibold text-ink';
    case 'bad':
      return 'font-semibold text-bad';
    default:
      return 'text-ink-3';
  }
}

export function MissionHeader({ mission: m }: { mission: Mission }) {
  // The clock runs only while the stream is live. A lost or stopped stream is not shown as running.
  const running = !m.finished && m.started !== null && m.stream === 'live';
  const now = useNow(running);
  const end = m.finished ? (m.lastTs ?? 0) : Math.max(m.lastTs ?? 0, now);
  const clock = m.started !== null ? formatClock(end - m.started) : '00:00.0';

  const status = m.finished
    ? { state: m.finished.status, text: m.finished.status === 'VERIFIED' ? 'Verified' : m.finished.status === 'PARTIAL' ? 'Partial' : 'Blocked' }
    : m.stream === 'lost'
      ? { state: 'lost', text: 'Connection lost, retrying' }
      : m.stream === 'stopped'
        ? { state: 'stopped', text: 'Stopped without a finish event' }
        : m.started !== null
          ? { state: 'running', text: m.reviewState === 'failed' ? 'Problem found' : m.thinking ? `${m.thinking.agent} is thinking…` : 'Running' }
          : { state: 'idle', text: 'Idle' };

  const statusClass: Record<string, string> = {
    running: 'border-run-line bg-run-weak text-run',
    VERIFIED: 'border-ok-line bg-ok-weak text-ok',
    PARTIAL: 'border-bad-line bg-bad-weak text-bad',
    BLOCKED: 'border-bad-line bg-bad-weak text-bad',
    lost: 'border-bad-line bg-bad-weak text-bad',
    stopped: 'border-bad-line bg-bad-weak text-bad',
    idle: 'border-line bg-surface text-ink-2',
  };
  const dotClass: Record<string, string> = {
    running: 'bg-run animate-pulse',
    VERIFIED: 'bg-ok',
    PARTIAL: 'bg-bad',
    BLOCKED: 'bg-bad',
    lost: 'bg-bad',
    stopped: 'bg-bad',
    idle: 'bg-line-strong',
  };

  const title = m.runId === null ? 'No mission open' : m.title || 'Loading…';
  // Profile from RUN_STARTED; "answered by" from the MODEL_CALL events that actually succeeded.
  const answeredBy = [...new Set(m.modelCalls.filter((c) => c.ok && c.provider).map((c) => c.provider as string))];
  const agentChip =
    m.runId === null
      ? null
      : m.agents?.mode === 'model'
        ? `Profile ${m.agents.profile ?? 'n/a'} · answered by ${answeredBy.length ? answeredBy.join(', ') : 'nobody yet'}`
        : m.agents?.mode === 'code' ? 'Code only' : null;

  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(40% 120% at 88% 0%, rgba(219, 97, 230, .16), transparent 70%), radial-gradient(36% 110% at 68% 100%, rgba(125, 158, 250, .18), transparent 70%), radial-gradient(30% 90% at 100% 80%, rgba(143, 102, 237, .14), transparent 70%)',
        }}
      />
      <div className="relative mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-7 px-6 py-2.5 max-[1000px]:grid-cols-1 max-[1000px]:gap-3.5 max-[860px]:p-4">
        <div className="min-w-0">
          <p className="mb-0.5 text-[12.5px] text-ink-3">
            <span className="mono" data-testid="run-id">{m.runId ?? 'No run yet'}</span>
          </p>
          <h1 title={title} className="truncate font-display text-[22px] font-bold leading-[1.2] tracking-[-0.02em]">
            {title}
          </h1>
          <p className="mt-1 truncate text-[14px] text-ink-2">{countLine(m)}</p>
          {m.planted.length ? (
            <p className="mt-1.5 flex max-w-[76ch] items-start gap-2 rounded-field bg-run-weak px-3 py-[7px] text-[13px] leading-[1.45] text-[#7A4700]">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>
                {m.plantedHeading}: {m.planted.join('; ')}.
              </span>
            </p>
          ) : null}
        </div>

        <ol className="flex list-none p-0 m-0 max-[1000px]:w-full" aria-label="Mission stage">
          {STEPS.map((s, i) => {
            const st = m.stage[s.key];
            const dot =
              st === 'done'
                ? 'border-ok bg-ok'
                : st === 'bad'
                  ? 'border-bad bg-bad'
                  : st === 'active'
                    ? 'border-accent shadow-[0_0_0_4px_var(--accent-weak)]'
                    : 'border-line-strong bg-surface';
            const connector = st === 'done' || st === 'active' ? 'before:bg-ok' : 'before:bg-line';
            return (
              <li
                key={s.key}
                data-state={st}
                className={cn(
                  'relative flex min-w-[74px] flex-col items-center gap-1.5 text-[13px] font-medium max-[1000px]:min-w-0 max-[1000px]:flex-1 max-[860px]:text-[11.5px]',
                  i > 0 &&
                    `before:absolute before:left-[calc(-50%+13px)] before:right-[calc(50%+13px)] before:top-[10px] before:h-0.5 before:content-[''] ${connector}`,
                  stepClass(st),
                )}
              >
                <span className={cn('grid h-[22px] w-[22px] place-items-center rounded-full border-2 transition-colors', dot)}>
                  {st === 'done' ? <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden /> : null}
                  {st === 'active' ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col items-end gap-1.5 max-[1000px]:flex-row max-[1000px]:items-center max-[1000px]:justify-between">
          <span
            role="status" data-state={status.state}
            className={cn(
              'inline-flex h-[30px] items-center gap-[7px] rounded-full border px-3 text-[13.5px] font-semibold',
              statusClass[status.state] ?? statusClass.idle,
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', dotClass[status.state] ?? dotClass.idle)} />
            {status.text}
          </span>
          {m.delivered ? (
            <span data-testid="header-delivered" className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-ok-line bg-ok-weak px-2.5 text-[12.5px] font-semibold text-ok">
              <Inbox className="h-3.5 w-3.5" aria-hidden />
              Delivered
            </span>
          ) : null}
          <span className="mono text-[13px] text-ink-3">{clock}</span>
          {agentChip ? (
            <span className="inline-flex items-center rounded-full bg-sunken px-2.5 py-0.5 text-[12.5px] text-ink-2">
              {agentChip}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
