import { describe, expect, it } from 'vitest';
import {
  backoffMs, byLearnerView, bySkillView, cursors, FEED_CAP, initialLive, itemKey, liveReducer, needsHelpView, parseCounts, parseLiveItem,
  timelineView, type AttemptItem, type HelpItem, type LiveItem, type LiveState,
} from './live';

const attempt = (o: Partial<AttemptItem> & { id: number | string | null }): AttemptItem => ({
  type: 'attempt', learner: 'L-01', name: 'Learner 01', skill: 'S1', score: 50, source: 'quiz', at: '2026-11-13T10:00:00Z', ...o,
});
const help = (o: Partial<HelpItem> & { id: number | string | null }): HelpItem => ({
  type: 'help', learner: 'L-01', name: 'Learner 01', skill: 'S1', category: 'concept', text: 'I do not follow', at: '2026-11-13T10:00:00Z', ...o,
});
const feed = (items: LiveItem[]): LiveState => items.reduce((s, item) => liveReducer(s, { type: 'item', item }), initialLive);

describe('live reducer: dedupe', () => {
  it('ignores the same (type,id) delivered twice', () => {
    const s = feed([attempt({ id: 1 }), attempt({ id: 1, score: 99 }), help({ id: 1 })]);
    expect(s.items).toHaveLength(2);
    expect(s.items[0]).toMatchObject({ type: 'attempt', score: 50 });
  });
  it('treats a numeric and a text id as the same item', () => {
    expect(feed([attempt({ id: 7 }), attempt({ id: '7' })]).items).toHaveLength(1);
  });
  it('falls back to content when the server sent no id', () => {
    const a = attempt({ id: null });
    expect(itemKey(a)).toBe(itemKey({ ...a }));
    expect(feed([a, { ...a }]).items).toHaveLength(1);
    expect(feed([a, { ...a, score: 51 }]).items).toHaveLength(2);
  });
});

describe('live reducer: memory cap', () => {
  it('keeps at most FEED_CAP items, dropping the oldest, and frees their dedupe keys', () => {
    const many = Array.from({ length: FEED_CAP + 5 }, (_, i) => attempt({ id: i + 1 }));
    const s = feed(many);
    expect(s.items).toHaveLength(FEED_CAP);
    expect(s.items[0]!.id).toBe(6);
    expect(s.dropped).toBe(5);
    expect(s.keys.size).toBe(FEED_CAP);
    // a dropped id can be shown again if the server sends it again
    expect(liveReducer(s, { type: 'item', item: attempt({ id: 1 }) }).items.at(-1)!.id).toBe(1);
  });
});

describe('live reducer: connection', () => {
  it('clears a server error once the stream is live again', () => {
    let s = liveReducer(initialLive, { type: 'server-error', message: 'portal unreachable' });
    s = liveReducer(s, { type: 'connection', connection: 'reconnecting' });
    expect(s.serverError).toBe('portal unreachable');
    s = liveReducer(s, { type: 'connection', connection: 'live' });
    expect(s.serverError).toBeNull();
  });
  it('stores counts', () => {
    expect(liveReducer(initialLive, { type: 'counts', counts: { claimed: 12, attempts: 30, help: 2 } }).counts).toEqual({ claimed: 12, attempts: 30, help: 2 });
  });
});

describe('Needs help ordering', () => {
  it('lists help requests first, newest first, and breaks time ties on id', () => {
    const items: LiveItem[] = [
      attempt({ id: 9, at: '2026-11-13T10:09:00Z' }),
      help({ id: 1, at: '2026-11-13T10:01:00Z' }),
      help({ id: 3, at: '2026-11-13T10:05:00Z' }),
      help({ id: 2, at: '2026-11-13T10:05:00Z' }),
    ];
    const v = needsHelpView(items);
    expect(v.help.map((h) => h.id)).toEqual([3, 2, 1]);
    expect(v.submissions.map((a) => a.id)).toEqual([9]);
  });
  it('gives the same order whatever order the events arrived in', () => {
    const items: LiveItem[] = [
      help({ id: 4, at: '2026-11-13T10:05:00Z' }), help({ id: 5, at: '2026-11-13T10:05:00Z' }), help({ id: 6, at: null }), help({ id: 2, at: '2026-11-13T09:00:00Z' }),
    ];
    const a = needsHelpView(items).help.map((h) => h.id);
    const b = needsHelpView([...items].reverse()).help.map((h) => h.id);
    expect(a).toEqual(b);
    expect(a).toEqual([5, 4, 2, 6]);
  });
});

describe('By learner ordering', () => {
  const items: LiveItem[] = [
    attempt({ id: 1, learner: 'L-03', name: 'Learner 03', score: 80 }),
    attempt({ id: 2, learner: 'L-02', name: 'Learner 02', score: 35 }),
    attempt({ id: 3, learner: 'L-01', name: 'Learner 01', score: 35 }),
    attempt({ id: 4, learner: 'L-04', name: 'Learner 04', score: 90 }),
    help({ id: 1, learner: 'L-04', name: 'Learner 04' }),
    attempt({ id: 5, learner: 'L-05', name: 'Learner 05', score: null }),
  ];
  it('puts learners with help first, then lowest latest score, then learner id', () => {
    expect(byLearnerView(items).map((g) => g.learner)).toEqual(['L-04', 'L-01', 'L-02', 'L-03', 'L-05']);
  });
  it('counts help requests and submissions per learner', () => {
    const g = byLearnerView(items)[0]!;
    expect(g).toMatchObject({ learner: 'L-04', help: 1, submissions: 1 });
    expect(g.latest?.score).toBe(90);
  });
  it('uses the newest submission as the latest score', () => {
    const g = byLearnerView([attempt({ id: 1, score: 20, at: '2026-11-13T10:00:00Z' }), attempt({ id: 2, score: 70, at: '2026-11-13T10:30:00Z' })]);
    expect(g[0]!.latest?.score).toBe(70);
  });
  it('is independent of arrival order', () => {
    expect(byLearnerView([...items].reverse()).map((g) => g.learner)).toEqual(byLearnerView(items).map((g) => g.learner));
  });
});

describe('By skill ordering', () => {
  const items: LiveItem[] = [
    attempt({ id: 1, skill: 'S2', score: 40 }), attempt({ id: 2, skill: 'S2', score: 90 }),
    attempt({ id: 3, skill: 'S1', score: 30 }), attempt({ id: 4, skill: 'S1', score: 20 }), attempt({ id: 5, skill: 'S1', score: 99 }),
    attempt({ id: 6, skill: 'S3', score: 10 }), help({ id: 1, skill: 'S3' }),
  ];
  it('with a known pass mark, orders by below-pass-mark submissions, then help, then submissions, then skill id', () => {
    const g = bySkillView(items, 60);
    expect(g.map((x) => [x.skill, x.below])).toEqual([['S1', 2], ['S3', 1], ['S2', 1]]);
  });
  it('without a pass mark, reports null below-counts and orders by help, then submissions, then skill id', () => {
    const g = bySkillView(items, null);
    expect(g.every((x) => x.below === null)).toBe(true);
    expect(g.map((x) => x.skill)).toEqual(['S3', 'S1', 'S2']);
  });
  it('breaks a full tie on skill id', () => {
    const g = bySkillView([attempt({ id: 1, skill: 'S9' }), attempt({ id: 2, skill: 'S4' })], null);
    expect(g.map((x) => x.skill)).toEqual(['S4', 'S9']);
  });
});

describe('Timeline', () => {
  it('is every item, newest first', () => {
    const t = timelineView([attempt({ id: 1, at: '2026-11-13T10:00:00Z' }), help({ id: 2, at: '2026-11-13T10:02:00Z' }), attempt({ id: 3, at: '2026-11-13T10:01:00Z' })]);
    expect(t.map((i) => `${i.type}:${i.id}`)).toEqual(['help:2', 'attempt:3', 'attempt:1']);
  });
});

describe('cursors and parsing', () => {
  it('reports the highest numeric id per type', () => {
    expect(cursors([attempt({ id: 4 }), attempt({ id: '9' }), help({ id: 2 }), help({ id: null })])).toEqual({ attempt: 9, help: 2 });
  });
  it('parses stream frames and rejects unknown ones', () => {
    expect(parseLiveItem({ type: 'attempt', id: 5, learner: 'L-01', name: 'Learner 01', skill: 'S1', score: '72', source: 'quiz', at: 'x' })).toMatchObject({ score: 72, id: 5 });
    expect(parseLiveItem({ type: 'help', id: 1, text: 'hi' })).toMatchObject({ type: 'help', text: 'hi', name: null });
    expect(parseLiveItem({ type: 'other' })).toBeNull();
    expect(parseLiveItem(null)).toBeNull();
    expect(parseCounts({ claimed: 3, attempts: 'x', help: 1 })).toEqual({ claimed: 3, attempts: null, help: 1 });
  });
  it('backs off 1s, 2s, 4s, 8s and stops at 15s', () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
  });
});
