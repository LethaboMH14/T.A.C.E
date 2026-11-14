import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initialMission, reduce } from '@/state/mission';
import type { LedgerEvent } from '@/state/types';
import { buildStory, describeChange, plain, plainArtifact } from './narrative';

const load = (f: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${f}`, import.meta.url)), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as LedgerEvent);
const run = (evs: LedgerEvent[]) => evs.reduce(reduce, initialMission('r'));
const texts = (m: ReturnType<typeof run>, i: number) => buildStory(m)[i]!.lines.map((l) => l.text);

describe('plain words', () => {
  it('maps technical ids and falls back sensibly', () => {
    expect(plain('mentor-schedule.csv')).toBe('mentor schedule');
    expect(plain('unsent-message-drafts')).toBe('message drafts');
    expect(plain('rerun_producer')).toBe('re-ran that step');
    expect(plain('some_new_thing.csv')).toBe('some new thing');
    expect(plainArtifact('mentor-schedule.csv@v2')).toBe('mentor schedule (version 2)');
  });
  it('describes a schedule move without repeating the mentor', () => {
    expect(describeChange({ trainee_id: 'L-33', session_id: 'S-09', from: 'M-B Tue 09:00', to: 'M-B Thu 09:00' })).toBe("moved Learner 33's session from Tue 09:00 to Thu 09:00");
    expect(describeChange({ nothing: 1 })).toBeNull();
  });
});

describe('story of the inject_overlap run', () => {
  const m = run(load('inject_overlap.events.jsonl'));
  const ch = buildStory(m);
  it('has 5 chapters in order', () => expect(ch.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]));
  it('1: quotes the goal and names the deliverables', () => {
    const t = texts(m, 0);
    expect(t[0]).toContain('36 bootcamp learners');
    expect(t.some((x) => x.startsWith('I read this as 5 things to deliver: gap analysis'))).toBe(true);
  });
  it('2: lists each source with rows', () => {
    expect(texts(m, 1)).toContain('assessment scores: 216 rows');
    expect(texts(m, 1).length).toBeGreaterThanOrEqual(m.sources.length);
  });
  it('3: groups steps by depth and counts helpers', () => {
    const t = texts(m, 2);
    expect(t.slice(0, 2)).toEqual(['First', 'Analyst will find skill gaps and learners at risk']);
    expect(t).toContain('Then');
    expect(t).toContain('After that');
    expect(t).toContain('Only these 5 helpers were needed.');
    expect(t.some((x) => x.startsWith('Analyst joined: Produces gap analysis'))).toBe(true);
  });
  it('4: completions, plain handoffs, the re-run marked', () => {
    const t = texts(m, 3);
    expect(t).toContain('Scheduler handed the mentor schedule to the Message Writer');
    expect(t.some((x) => x.startsWith('Re-ran on the repaired file: Message Writer drafted'))).toBe(true);
    expect(t.some((x) => x.startsWith('Analyst found 57 gaps'))).toBe(true);
  });
  it('5: failure, repair with change, second round, final line', () => {
    const t = texts(m, 4);
    expect(t[0]).toMatch(/^Round 1: The Reviewer re-checked everything from the raw files: \d+ of \d+ checks passed$/);
    expect(t).toContain('Problem: Mentor B is booked twice on Tue at 09:00 (S-06 and S-09).');
    expect(t).toContain('Round 1: Repair moved only the sessions that break a rule');
    expect(t.some((x) => x.includes("moved Learner 33's session from Tue 09:00 to Thu 09:00"))).toBe(true);
    expect(t.some((x) => x.startsWith('Round 2:'))).toBe(true);
    expect(t[t.length - 1]).toMatch(/^All \d+ checks pass\. Nothing is sent until you approve\.$/);
    expect(ch[4]!.status).toBe('done');
  });
  it('links lines to graph nodes', () => {
    expect(ch[2]!.lines.find((l) => l.title === 'mentor_schedule')?.nodeId).toBe('mentor_schedule');
    expect(ch[4]!.lines.some((l) => l.nodeId === 'repair')).toBe(true);
  });
});

describe('story with missing events', () => {
  it('is empty and idle for an empty mission, inventing nothing', () => {
    const ch = buildStory(initialMission('x'));
    expect(ch.every((c) => c.lines.length === 0 && c.status === 'idle')).toBe(true);
  });
  it('mentions delivery only when MESSAGES_DELIVERED exists', () => {
    const evs = load('ladder.events.jsonl');
    expect(texts(run(evs), 4).some((x) => x.startsWith('Delivered'))).toBe(evs.some((e) => e.type === 'MESSAGES_DELIVERED'));
    const last = evs[evs.length - 1]!;
    const extra: LedgerEvent = { seq: last.seq + 1, runId: 'r', ts: '2026-11-13T15:00:00Z', type: 'MESSAGES_DELIVERED', taskId: null, role: null, data: { count: 17, learners: 14, mentors: 3 } };
    expect(texts(run([...evs, extra]), 4).at(-1)).toBe('Delivered to 17 portal inboxes after your approval.');
  });
  it('shows a partial run as needing attention, not as passed', () => {
    const evs = load('inject_overlap.events.jsonl').filter((e) => e.type !== 'VERIFICATION_PASSED').map((e) => (e.type === 'RUN_FINISHED' ? { ...e, data: { ...e.data, status: 'PARTIAL', checksPassed: 27, checksTotal: 28, reason: 'one check still fails' } } : e));
    const c = buildStory(run(evs))[4]!;
    expect(c.status).toBe('bad');
    expect(c.lines.at(-1)!.text).toContain('Finished with 27 of 28 checks passing');
  });
});
