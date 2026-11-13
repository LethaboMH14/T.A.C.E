import { useEffect, useState } from 'react';
import type { LedgerEvent, Mission } from '@/state';
import { orderNames, sortedEvents, useRunEvents } from '@/lib/ledger';
import { cn } from '@/lib/utils';

export type BarTone = 'ok' | 'bad' | 'redo' | 'plain' | 'running' | 'stopped';

export interface Bar {
  id: string;
  lane: string;
  kind: 'task' | 'rerun' | 'model' | 'review' | 'repair';
  tone: BarTone;
  label: string;
  startS: number;
  endS: number;
  open: boolean;
  detail: string[];
}

export interface Lane {
  name: string;
  bars: Bar[];
}

export interface Timeline {
  lanes: Lane[];
  totalS: number;
  startMs: number | null;
}

const secs = (x: number): string => `${x.toFixed(1)} s`;

/**
 * Pairs raw ledger events into bars. Every time is ledger ts minus RUN_STARTED ts, in seconds.
 * Open bars (no closing event yet) end at nowMs when the run is live, else at the last event.
 */
export function buildTimeline(rawEvents: LedgerEvent[], nowMs: number, live: boolean): Timeline {
  const events = sortedEvents(rawEvents);
  if (!events.length) return { lanes: [], totalS: 0, startMs: null };
  const first = events.find((e) => e.type === 'RUN_STARTED') ?? events[0];
  const startMs = Date.parse(first.ts);
  const at = (e: LedgerEvent): number => (Date.parse(e.ts) - startMs) / 1000;
  const lastS = Math.max(0, ...events.map(at));

  const bars: Bar[] = [];
  const openTask = new Map<string, { startS: number; lane: string; label: string; rerun: boolean }>();
  const pendingRerun = new Set<string>();
  let openReview: { startS: number; round: number } | null = null;
  const openRepair = new Map<number, { startS: number; from: string }>();
  let n = 0;
  const id = (): string => `b${n++}`;

  for (const e of events) {
    const t = at(e);
    const d = e.data ?? {};
    switch (e.type) {
      case 'TASK_STARTED': {
        if (!e.taskId || !e.role || openTask.has(e.taskId)) break;
        const rerun = pendingRerun.has(e.taskId);
        pendingRerun.delete(e.taskId);
        openTask.set(e.taskId, { startS: t, lane: e.role, label: e.taskId, rerun });
        break;
      }
      case 'TASK_RERUN':
        if (e.taskId) pendingRerun.add(e.taskId);
        break;
      case 'TASK_COMPLETED':
      case 'TASK_FAILED': {
        const o = e.taskId ? openTask.get(e.taskId) : undefined;
        if (!e.taskId || !o) break;
        openTask.delete(e.taskId);
        const failed = e.type === 'TASK_FAILED';
        bars.push({
          id: id(),
          lane: o.lane,
          kind: o.rerun ? 'rerun' : 'task',
          tone: failed ? 'bad' : o.rerun ? 'redo' : 'plain',
          label: `${o.rerun ? 're-run' : 'task'}: ${o.label}`,
          startS: o.startS,
          endS: t,
          open: false,
          detail: [
            `${o.lane} · ${e.taskId}`,
            failed ? `failed: ${String(d.message ?? d.code ?? 'no message')}` : 'completed',
          ],
        });
        break;
      }
      case 'REVIEW_STARTED':
        openReview = { startS: t, round: Number(d.round ?? 0) };
        break;
      case 'VERIFICATION_FAILED':
      case 'VERIFICATION_PASSED': {
        const failed = e.type === 'VERIFICATION_FAILED';
        const round = Number(d.round ?? openReview?.round ?? 0);
        const start = openReview && openReview.round === round ? openReview.startS : t;
        const failedIds: string[] = Array.isArray(d.failed) ? d.failed : [];
        bars.push({
          id: id(),
          lane: 'Reviewer',
          kind: 'review',
          tone: failed ? 'bad' : 'ok',
          label: `round ${round} ${failed ? 'failed' : 'passed'}`,
          startS: start,
          endS: t,
          open: false,
          detail: [
            `Reviewer · round ${round}`,
            failed ? `${failedIds.length} check${failedIds.length === 1 ? '' : 's'} failed: ${failedIds.join(', ')}` : `${d.passed ?? '?'} of ${d.total ?? '?'} checks passed`,
          ],
        });
        openReview = null;
        break;
      }
      case 'REPAIR_SCHEDULED': {
        const round = Number(d.round ?? 0);
        openRepair.set(round, { startS: t, from: String(d.artifact ?? '') });
        break;
      }
      case 'ARTIFACT_REPAIRED': {
        const round = Number(d.round ?? 0);
        const o = openRepair.get(round);
        const changes: unknown[] = Array.isArray(d.changes) ? d.changes : [];
        openRepair.delete(round);
        bars.push({
          id: id(),
          lane: 'Repair',
          kind: 'repair',
          tone: 'redo',
          label: `round ${round} repair`,
          startS: o ? o.startS : t,
          endS: t,
          open: false,
          detail: [
            `Repair · round ${round}`,
            `${String(d.from ?? '')} → ${String(d.to ?? '')}`,
            `${changes.length} change${changes.length === 1 ? '' : 's'}`,
          ],
        });
        break;
      }
      case 'MODEL_CALL': {
        const ms = Number(d.ms ?? 0);
        const u = d.usage ?? {};
        const tokens = Number(u.total ?? 0);
        bars.push({
          id: id(),
          lane: String(d.agent ?? e.role ?? 'model'),
          kind: 'model',
          tone: d.ok ? 'plain' : 'bad',
          label: `model call ${d.ok ? '' : '(failed)'}`.trim(),
          // The ledger stamps the call when it returns, so the bar runs from ts - ms to ts.
          startS: Math.max(0, t - ms / 1000),
          endS: t,
          open: false,
          detail: [
            `${String(d.agent ?? '')} · ${String(d.provider ?? '?')} · ${String(d.model ?? '?')}`,
            d.ok ? `${tokens.toLocaleString('en-US')} tokens, ${ms.toLocaleString('en-US')} ms` : `failed: ${String(d.error ?? 'no detail')}`,
          ],
        });
        break;
      }
      default:
        break;
    }
  }

  // Anything still open: running while live, otherwise the run stopped there.
  const end = live ? Math.max(lastS, (nowMs - startMs) / 1000) : lastS;
  for (const [taskId, o] of openTask) {
    bars.push({
      id: id(),
      lane: o.lane,
      kind: o.rerun ? 'rerun' : 'task',
      tone: live ? 'running' : 'stopped',
      label: `${o.rerun ? 're-run' : 'task'}: ${o.label}`,
      startS: o.startS,
      endS: end,
      open: true,
      detail: [`${o.lane} · ${taskId}`, live ? 'running' : 'no completion event in the ledger'],
    });
  }
  if (openReview) {
    bars.push({
      id: id(),
      lane: 'Reviewer',
      kind: 'review',
      tone: live ? 'running' : 'stopped',
      label: `round ${openReview.round} running`,
      startS: openReview.startS,
      endS: end,
      open: true,
      detail: [`Reviewer · round ${openReview.round}`, live ? 'running' : 'no verdict event in the ledger'],
    });
  }
  for (const [round, o] of openRepair) {
    bars.push({
      id: id(),
      lane: 'Repair',
      kind: 'repair',
      tone: live ? 'running' : 'stopped',
      label: `round ${round} repair`,
      startS: o.startS,
      endS: end,
      open: true,
      detail: [`Repair · round ${round}`, live ? 'running' : 'no repair event in the ledger'],
    });
  }

  const laneNames = orderNames(events.filter((e) => e.role || e.type === 'MODEL_CALL').map((e) => String(e.type === 'MODEL_CALL' ? (e.data?.agent ?? e.role) : e.role)));
  const lanes: Lane[] = laneNames.map((name) => ({ name, bars: bars.filter((b) => b.lane === name).sort((a, b) => a.startS - b.startS || (a.id < b.id ? -1 : 1)) }));
  const totalS = Math.max(1, ...bars.map((b) => b.endS), lastS);
  return { lanes, totalS, startMs };
}

/** Tick step in seconds so the axis has at most about eight labels. */
export function tickStep(totalS: number): number {
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (totalS / s <= 8) return s;
  return 900;
}

const TONE_CLASS: Record<BarTone, string> = {
  ok: 'bg-ok border-ok',
  bad: 'bg-bad border-bad',
  redo: 'bg-violet border-violet',
  plain: 'bg-blue border-blue',
  running: 'bg-run-weak border-run',
  stopped: 'bg-sunken border-line-strong',
};

const TONE_WORD: Record<BarTone, string> = {
  ok: 'passed',
  bad: 'failed',
  redo: 'repair',
  plain: 'done',
  running: 'running',
  stopped: 'stopped',
};

export function Timeline({ mission }: { mission: Mission }) {
  const events = useRunEvents(mission);
  const live = !!mission.runId && mission.finished === null && events.length > 0;
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [live]);

  if (!mission.runId) {
    return <p className="m-0 p-4 text-[13.5px] text-ink-3">Select a run to see its timeline.</p>;
  }
  if (!events.length) {
    return <p className="m-0 p-4 text-[13.5px] text-ink-3">No events yet for this run. The timeline fills in as the ledger writes them.</p>;
  }

  const tl = buildTimeline(events, now, live);
  const step = tickStep(tl.totalS);
  const ticks: number[] = [];
  for (let s = 0; s <= tl.totalS + 1e-9; s += step) ticks.push(s);
  const pct = (s: number): number => (s / tl.totalS) * 100;

  return (
    <div className="grid gap-3 p-4" aria-label="Timeline">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
        <Legend tone="plain" text="task" />
        <Legend tone="ok" text="review passed" />
        <Legend tone="bad" text="review failed or call failed" />
        <Legend tone="redo" text="repair" />
        <Legend tone="running" text="running" />
        <span className="mono ml-auto">{live ? 'live' : 'final'} · x axis in seconds from RUN_STARTED</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="relative ml-[168px] h-5 border-b border-line text-[11px] text-ink-3">
            {ticks.map((s) => (
              <span key={s} className="mono absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(s)}%` }}>
                {s}s
              </span>
            ))}
          </div>
          <ol className="m-0 grid list-none gap-1.5 p-0 pt-2">
            {tl.lanes.map((lane) => (
              <li key={lane.name} className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-2">
                <span className="truncate text-[13px] font-medium text-ink" title={lane.name}>{lane.name}</span>
                <div className="relative h-7 rounded-field bg-sunken">
                  {ticks.slice(1).map((s) => (
                    <span key={s} className="absolute inset-y-0 w-px bg-line" style={{ left: `${pct(s)}%` }} aria-hidden />
                  ))}
                  {lane.bars.map((b) => (
                    <BarButton
                      key={b.id}
                      bar={b}
                      leftPct={pct(b.startS)}
                      widthPct={Math.max(pct(b.endS) - pct(b.startS), 0.6)}
                      onPick={setPicked}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <BarDetail bar={tl.lanes.flatMap((l) => l.bars).find((b) => b.id === picked) ?? null} />
    </div>
  );
}

function Legend({ tone, text }: { tone: BarTone; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2.5 w-4 rounded-sm border', TONE_CLASS[tone])} aria-hidden />
      {text}
    </span>
  );
}

// The detail box shows the bar under the pointer or keyboard focus. Nothing is shown until one is picked.
function BarButton({ bar, leftPct, widthPct, onPick }: { bar: Bar; leftPct: number; widthPct: number; onPick: (id: string) => void }) {
  const text = `${bar.lane}: ${bar.label}, ${secs(bar.startS)} to ${secs(bar.endS)}, ${TONE_WORD[bar.tone]}`;
  return (
    <button
      type="button"
      aria-label={text}
      title={text}
      data-tone={bar.tone}
      data-kind={bar.kind}
      className={cn(
        'absolute inset-y-1 rounded-[5px] border transition-[left,width] duration-500 ease-studio motion-reduce:transition-none',
        TONE_CLASS[bar.tone],
        bar.open && 'border-dashed',
      )}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onMouseEnter={() => onPick(bar.id)}
      onFocus={() => onPick(bar.id)}
    />
  );
}

function BarDetail({ bar }: { bar: Bar | null }) {
  return (
    <div className="min-h-[64px] rounded-field border border-line bg-sunken px-3 py-2 text-[13px] text-ink-2" aria-live="polite">
      {bar ? (
        <>
          <div className="font-medium text-ink">
            {bar.lane} · {bar.label}
          </div>
          <div className="mono text-[12px] text-ink-3">
            {secs(bar.startS)} → {secs(bar.endS)} ({secs(bar.endS - bar.startS)}) · {TONE_WORD[bar.tone]}
          </div>
          {bar.detail.map((d) => (
            <div key={d} className="text-[12.5px]">{d}</div>
          ))}
        </>
      ) : (
        <span className="text-ink-3">Hover a bar to see its event detail.</span>
      )}
    </div>
  );
}
