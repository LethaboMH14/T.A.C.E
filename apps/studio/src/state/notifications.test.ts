import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initialMission, reduce } from '@/state/mission';
import type { LedgerEvent } from '@/state/types';
import { clearNotices, collectNotices, markAllRead, markRead, noticeFor, pushNotice, unreadCount, dismissToast, getNoticeSnapshot, requestFocus, takeFocus } from './notifications';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/ladder.events.jsonl', import.meta.url));
const events: LedgerEvent[] = readFileSync(FIXTURE, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as LedgerEvent);
const mission = events.reduce(reduce, initialMission('ladder-1'));

const ev = (type: string, data: unknown, seq = 900): LedgerEvent => ({ seq, runId: 'r1', ts: '2026-11-13T10:00:00Z', type, taskId: null, role: null, data });

describe('noticeFor on a real ledger', () => {
  const all = collectNotices(events, mission, 0);
  it('raises a failed-check notice that names the check by its title', () => {
    const failed = all.filter((n) => n.title === 'Check failed');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]!.nodeId).toBe('review');
    const failedIds = (events.find((e) => e.type === 'VERIFICATION_FAILED')!.data.failed as string[]);
    expect(failed[0]!.detail).toContain(mission.checks[failedIds[0]!]?.title ?? failedIds[0]!);
  });
  it('raises a repair notice and a finished notice', () => {
    expect(all.some((n) => n.title === 'Repair applied' && n.nodeId === 'repair')).toBe(true);
    expect(all.some((n) => n.title === 'Plan verified' || n.title === 'Plan finished with open issues' || n.title === 'Plan stopped')).toBe(true);
  });
  it('gives every notice a unique id and skips events at or below afterSeq', () => {
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
    const lastSeq = events[events.length - 1]!.seq;
    expect(collectNotices(events, mission, lastSeq)).toEqual([]);
  });
});

describe('noticeFor', () => {
  const m = { runId: 'r1', checks: {}, tasks: [{ id: 't-sched', role: 'Scheduler', label: '', dependsOn: [], consumes: [], produces: [], capabilityId: '' }] };
  it('model fallback opens the task of the agent that switched', () => {
    const n = noticeFor(ev('MODEL_FALLBACK', { agent: 'Scheduler', from: 'groq', to: 'cerebras', reason: 'MODEL_HTTP_429' }), m)!;
    expect(n.detail).toBe('groq to cerebras (rate limit)');
    expect(n.nodeId).toBe('t-sched');
  });
  it('a question, a delivery and a blocked run each get a notice', () => {
    expect(noticeFor(ev('HUMAN_QUESTION', { question: 'Which week?' }), m)).toMatchObject({ title: 'Question waiting for you', detail: 'Which week?', nodeId: 'goal' });
    expect(noticeFor(ev('MESSAGES_DELIVERED', { count: 39, learners: 36, mentors: 3 }), m)).toMatchObject({ title: 'Delivered to portal inboxes', detail: '36 learner plans, 3 mentor schedules' });
    expect(noticeFor(ev('RUN_FINISHED', { status: 'BLOCKED', reason: 'A source is missing' }), m)).toMatchObject({ title: 'Plan stopped', detail: 'A source is missing', nodeId: 'blocked' });
  });
  it('ignores events that need no notice', () => {
    expect(noticeFor(ev('TASK_STARTED', {}), m)).toBeNull();
  });
});

describe('store', () => {
  beforeEach(() => clearNotices());
  const n = (id: string) => ({ id, runId: 'r1', tone: 'ok' as const, title: id, detail: null, nodeId: null });
  it('counts unread, dedupes by id and marks read', () => {
    pushNotice(n('r1:1'));
    pushNotice(n('r1:1'));
    pushNotice(n('r1:2'));
    expect(unreadCount(collect())).toBe(2);
    markRead('r1:1');
    expect(unreadCount(collect())).toBe(1);
    markAllRead();
    expect(unreadCount(collect())).toBe(0);
  });
  it('keeps at most three toasts and lets one be dismissed', () => {
    for (let i = 1; i <= 5; i++) pushNotice(n(`r1:${i}`));
    expect(collectToasts().map((t) => t.id)).toEqual(['r1:5', 'r1:4', 'r1:3']);
    dismissToast('r1:4');
    expect(collectToasts().map((t) => t.id)).toEqual(['r1:5', 'r1:3']);
  });
  it('hands a focus request to the matching run once', () => {
    (globalThis as { window?: unknown }).window = { dispatchEvent: () => true };
    requestFocus({ runId: 'r1', nodeId: 'review' });
    expect(takeFocus('other')).toBeNull();
    expect(takeFocus('r1')).toEqual({ runId: 'r1', nodeId: 'review' });
    expect(takeFocus('r1')).toBeNull();
    delete (globalThis as { window?: unknown }).window;
  });
});

const collect = () => getNoticeSnapshot().notices;
const collectToasts = () => getNoticeSnapshot().toasts;
