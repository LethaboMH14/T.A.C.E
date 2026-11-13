import { describe, expect, it } from 'vitest';
import type { LedgerEvent } from '@/state';
import { buildTimeline, tickStep } from './Timeline';

const T0 = Date.parse('2026-11-13T16:00:00.000Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
let seq = 0;
const ev = (sec: number, type: string, role: string | null, taskId: string | null, data: any = {}): LedgerEvent => ({
  seq: ++seq, runId: 'r1', ts: at(sec), type, role, taskId, data,
});

const events: LedgerEvent[] = [
  ev(0, 'RUN_STARTED', null, null, {}),
  ev(1, 'MODEL_CALL', 'Goal Reader', null, { agent: 'Goal Reader', provider: 'meta', model: 'muse', ok: true, ms: 2000, usage: { prompt: 10, completion: 5, total: 15 } }),
  ev(2, 'TASK_STARTED', 'Analyst', 'compute_gaps'),
  ev(2.5, 'TASK_STARTED', 'Scheduler', 'mentor_schedule'),
  ev(3, 'TASK_COMPLETED', 'Analyst', 'compute_gaps', { summary: {} }),
  ev(4, 'REVIEW_STARTED', 'Reviewer', 'review', { round: 1 }),
  ev(5, 'VERIFICATION_FAILED', 'Reviewer', 'review', { round: 1, failed: ['C04'], messages: ['x'] }),
  ev(5.5, 'REPAIR_SCHEDULED', 'Repair', 'repair', { round: 1, strategy: 'reschedule_affected_sessions' }),
  ev(6, 'ARTIFACT_REPAIRED', 'Repair', 'repair', { round: 1, from: 'a@v1', to: 'a@v2', changes: [{}] }),
  ev(6.2, 'TASK_RERUN', 'Message Writer', 'draft_messages', { reason: 'input changed' }),
  ev(6.5, 'TASK_STARTED', 'Message Writer', 'draft_messages'),
  ev(7, 'TASK_COMPLETED', 'Message Writer', 'draft_messages', {}),
  ev(7.5, 'REVIEW_STARTED', 'Reviewer', 'review', { round: 2 }),
  ev(8, 'VERIFICATION_PASSED', 'Reviewer', 'review', { round: 2, passed: 14, total: 14 }),
  ev(8.2, 'RUN_FINISHED', null, null, { status: 'VERIFIED' }),
];

describe('buildTimeline', () => {
  const tl = buildTimeline(events, T0 + 99000, false);
  const bars = tl.lanes.flatMap((l) => l.bars);

  it('orders lanes by first appearance with Reviewer and Repair last', () => {
    expect(tl.lanes.map((l) => l.name)).toEqual(['Goal Reader', 'Analyst', 'Scheduler', 'Message Writer', 'Reviewer', 'Repair']);
  });

  it('places a model call from ts minus ms to ts, in seconds from RUN_STARTED', () => {
    const b = bars.find((x) => x.kind === 'model');
    expect(b).toMatchObject({ lane: 'Goal Reader', startS: 0, endS: 1, tone: 'plain' });
  });

  it('pairs TASK_STARTED with TASK_COMPLETED so parallel tasks overlap in time', () => {
    const a = bars.find((x) => x.lane === 'Analyst')!;
    const s = bars.find((x) => x.lane === 'Scheduler')!;
    expect([a.startS, a.endS]).toEqual([2, 3]);
    expect(s.open).toBe(true);
    expect(a.startS < s.endS && s.startS < a.endS).toBe(true);
  });

  it('colours failed rounds red, repairs purple and passes green', () => {
    const fail = bars.find((x) => x.kind === 'review' && x.tone === 'bad')!;
    expect([fail.startS, fail.endS]).toEqual([4, 5]);
    expect(fail.detail.join(' ')).toContain('C04');
    expect(bars.find((x) => x.kind === 'repair')).toMatchObject({ tone: 'redo', startS: 5.5, endS: 6 });
    expect(bars.find((x) => x.kind === 'review' && x.tone === 'ok')).toMatchObject({ startS: 7.5, endS: 8 });
  });

  it('marks a re-run after TASK_RERUN as a rerun bar', () => {
    expect(bars.find((x) => x.kind === 'rerun')).toMatchObject({ lane: 'Message Writer', startS: 6.5, endS: 7 });
  });

  it('extends an open bar to now while the run is live and marks it running', () => {
    const live = buildTimeline(events.slice(0, 4), T0 + 6000, true);
    const open = live.lanes.flatMap((l) => l.bars).find((x) => x.lane === 'Analyst')!;
    expect(open.open).toBe(true);
    expect(open.tone).toBe('running');
    expect(open.endS).toBeCloseTo(6, 6);
  });

  it('returns no lanes for no events', () => {
    expect(buildTimeline([], T0, false).lanes).toEqual([]);
  });
});

describe('tickStep', () => {
  it('keeps the axis to about eight labels', () => {
    expect(tickStep(7)).toBe(1);
    expect(tickStep(40)).toBe(5);
    expect(tickStep(400)).toBe(60);
  });
});
