// Node selectors on the REAL ladder ledger: src/state/__fixtures__/ladder.events.jsonl is a copy of
// runs/ladder-1/events.jsonl (a real run with one planted overlap, two repairs and three review rounds).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initialMission, reduce } from './mission';
import { baseName, fileVersions, nodeDetail, scenarioIdOf, usdFor } from './selectors-node';
import type { LedgerEvent, Mission } from './types';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/ladder.events.jsonl', import.meta.url));
const events: LedgerEvent[] = readFileSync(FIXTURE, 'utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as LedgerEvent);

const m: Mission = events.reduce(reduce, initialMission('ladder-1'));

describe('nodeDetail on the ladder-1 ledger', () => {
  it('keeps the raw events in seq order', () => {
    expect(m.events).toHaveLength(events.length);
    expect(m.events.map((e) => e.seq)).toEqual([...m.events.map((e) => e.seq)].sort((a, b) => a - b));
  });

  it('scheduler node outputs mentor-schedule v1 and its lifecycle has real timestamps', () => {
    const d = nodeDetail(m, 'mentor_schedule');
    expect(d.role).toBe('Scheduler');
    expect(d.outputs.map((o) => `${o.name}@v${o.version}`)).toEqual(['mentor-schedule.csv@v1']);
    expect(d.outputs[0].file).toBe('artifacts/mentor-schedule.v1.csv');
    expect(d.timeline.map((t) => t.type)).toEqual(['READY', 'STARTED', 'COMPLETED']);
    expect(d.timeline.every((t) => /^\d{4}-\d{2}-\d{2}T/.test(events.find((e) => e.seq === t.seq)!.ts))).toBe(true);
    expect(d.kind).toBe('code');
  });

  it('scheduler input comes from the Analyst handoff chain', () => {
    const d = nodeDetail(m, 'mentor_schedule');
    expect(d.inputs.length).toBeGreaterThan(0);
    expect(d.inputs.every((i) => i.artifact && i.version > 0 && i.digest.length === 64)).toBe(true);
  });

  it('repair node shows 2 ARTIFACT_REPAIRED events: v1 to v2 then v2 to v3', () => {
    const d = nodeDetail(m, 'repair');
    expect(d.repairs).toHaveLength(2);
    expect(d.repairs.map((r) => [r.from, r.to])).toEqual([
      ['mentor-schedule.csv@v1', 'mentor-schedule.csv@v2'],
      ['mentor-schedule.csv@v2', 'mentor-schedule.csv@v3'],
    ]);
    expect(d.repairs.map((r) => r.strategy)).toEqual(['shift_one_hour', 'first_free_valid_slot']);
  });

  it('review node shows 3 rounds with the outcome of each', () => {
    const d = nodeDetail(m, 'review');
    expect(d.rounds.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(d.rounds.map((r) => r.outcome)).toEqual(['failed', 'failed', 'passed']);
    expect(d.rounds[0].failed).toEqual(['C04_schedule_no_overlap']);
    expect(d.kind).toBe('independent');
  });

  it('deliver node reports the RUN_FINISHED status', () => {
    const d = nodeDetail(m, 'deliver');
    expect(d.runFinished).toMatchObject({ status: 'VERIFIED', checksPassed: 14, checksTotal: 14, repairs: 2 });
  });

  it('checks touching the scheduler outputs carry their latest status and round', () => {
    const d = nodeDetail(m, 'mentor_schedule');
    const c04 = d.checks.find((c) => c.id === 'C04_schedule_no_overlap');
    expect(c04).toBeDefined();
    expect(c04!.status).toBe('PASS');
    expect(c04!.round).toBe(3);
    expect(d.checks.every((c) => baseName(c.artifact) === 'mentor-schedule.csv')).toBe(true);
  });

  it('file versions of mentor-schedule.csv run v1 to v3', () => {
    expect(fileVersions(m, 'mentor-schedule.csv').map((v) => v.version)).toEqual([1, 2, 3]);
  });

  it('reads the scenario id from RUN_STARTED', () => {
    expect(scenarioIdOf(m.events)).toBe('inject_overlap');
  });

  it('is deterministic: two folds give the same detail', () => {
    const again = events.reduce(reduce, initialMission('ladder-1'));
    expect(nodeDetail(again, 'review')).toEqual(nodeDetail(m, 'review'));
  });
});

describe('model cost', () => {
  it('prices a call only when the provider has a published price', () => {
    expect(usdFor('meta-model-api', { prompt: 1_000_000, completion: 1_000_000 })).toBeCloseTo(5.5, 10);
    expect(usdFor('groq', { prompt: 1000, completion: 1000 })).toBeNull();
    expect(usdFor(undefined, { prompt: 1, completion: 1 })).toBeNull();
  });
});
