// Reducer tests on a REAL ledger: src/state/__fixtures__/inject_overlap.events.jsonl was produced by
// `node cli/tace.mjs run --scenario inject_overlap --run-id u1-fixture --model off` (no model calls).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initialMission, reduce } from './mission';
import type { LedgerEvent, Mission } from './types';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/inject_overlap.events.jsonl', import.meta.url));
const events: LedgerEvent[] = readFileSync(FIXTURE, 'utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as LedgerEvent);

function fold(list: LedgerEvent[]): Mission {
  return list.reduce(reduce, initialMission('u1-fixture'));
}

describe('reduce on the inject_overlap ledger', () => {
  const m = fold(events);

  it('reaches VERIFIED with 14 of 14 checks after one repair', () => {
    expect(m.finished).toEqual({ status: 'VERIFIED', checksPassed: 14, checksTotal: 14, repairs: 1, reason: null });
  });

  it('records exactly one failed round, caught by C04', () => {
    expect(m.rounds).toHaveLength(1);
    expect(m.rounds[0].round).toBe(1);
    expect(m.rounds[0].failed).toEqual(['C04_schedule_no_overlap']);
    expect(m.rounds[0].messages[0]).toContain('Mentor B is booked twice');
  });

  it('records one repair from mentor-schedule.csv@v1 to @v2 with one change', () => {
    expect(m.repairs).toHaveLength(1);
    expect(m.repairs[0].from).toBe('mentor-schedule.csv@v1');
    expect(m.repairs[0].to).toBe('mentor-schedule.csv@v2');
    expect(m.repairs[0].changes).toHaveLength(1);
    expect(m.repairs[0].changes[0].session_id).toBe('S-09');
  });

  it('ends with the review node done and the latest C04 result PASS on v2', () => {
    expect(m.node.review.state).toBe('done');
    expect(m.node.review.badge).toEqual({ text: '14/14', tone: 'ok' });
    expect(m.checks.C04_schedule_no_overlap.status).toBe('PASS');
    expect(m.checks.C04_schedule_no_overlap.artifact).toBe('mentor-schedule.csv@v2');
    expect(m.checks.C04_schedule_no_overlap.round).toBe(2);
  });

  it('keeps both versions of the mentor schedule', () => {
    expect(m.files['mentor-schedule.csv'].versions).toHaveLength(2);
    expect(m.files['mentor-schedule.csv'].versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it('marks every stage and every planned task done at the end', () => {
    expect(m.stage).toEqual({ goal: 'done', plan: 'done', execute: 'done', verify: 'done', deliver: 'done' });
    for (const t of m.tasks) expect(m.node[t.id].state).toBe('done');
    expect(m.node.deliver.state).toBe('done');
  });

  it('reads the planted fault and the goal from RUN_STARTED and GOAL_VALIDATED', () => {
    expect(m.title).toBe('Self-correction: the scheduler double-books a mentor');
    expect(m.planted).toEqual(['the Scheduler is set to double-book Mentor B once']);
    expect(m.plantedHeading).toBe('Planted on purpose');
    expect(m.agents).toEqual({ mode: 'code', profile: null, chain: [], provider: undefined, model: undefined, note: 'Model turned off for this run' });
    expect(m.deliverables).toHaveLength(5);
    expect(m.goalSource).toBe('fixture');
  });

  it('collects five agents joined and five handoffs', () => {
    expect(m.joined.map((j) => j.agent)).toEqual(['Analyst', 'Report Writer', 'Support Planner', 'Scheduler', 'Message Writer']);
    expect(m.handoffs).toHaveLength(5);
  });

  it('writes the feed in the same wording as web/app.js', () => {
    const text = m.feed.map((f) => f.text);
    expect(text[0]).toBe('Mission started');
    expect(text).toContain('Analyst found 57 gaps; 14 learners at risk; 6 missing scores flagged, not counted as zero');
    expect(text).toContain('Scheduler booked 14 sessions');
    expect(text).toContain('Repair: move only the sessions that break a rule');
    expect(text).toContain('Reviewer round 2: 14 of 14 checks passed');
    expect(text[text.length - 1]).toBe('Mission VERIFIED after 1 repair');
    expect(m.feed.find((f) => f.text.startsWith('Reviewer caught'))?.tone).toBe('bad');
  });

  it('is pure and idempotent: replaying an event already folded changes nothing', () => {
    const again = reduce(m, events[5]);
    expect(again).toBe(m);
    expect(fold([...events, ...events])).toEqual(m);
  });

  it('is deterministic: two folds give the same state', () => {
    expect(fold(events)).toEqual(fold(events));
  });
});

describe('reduce on a partial ledger', () => {
  it('keeps the review node in failed state between VERIFICATION_FAILED and the repair', () => {
    const upto = events.findIndex((e) => e.type === 'VERIFICATION_FAILED');
    const m = fold(events.slice(0, upto + 1));
    expect(m.node.review.state).toBe('failed');
    expect(m.node.review.badge).toEqual({ text: '1 failed', tone: 'bad' });
    expect(m.stage.verify).toBe('bad');
    expect(m.finished).toBeNull();
  });
});
