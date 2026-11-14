// Live class feed. Pure reducer + selectors over what GET /api/lms/live sends, plus the hook that opens the stream.
// Nothing here invents a value: every name, score, skill and count is copied from an event.

import { useEffect, useReducer, useRef } from 'react';
import { probeAuth } from '@/lib/auth';

export const FEED_CAP = 2000;

export interface AttemptItem {
  type: 'attempt';
  id: string | number | null;
  learner: string | null;
  name: string | null;
  skill: string | null;
  score: number | null;
  source: string | null;
  at: string | null;
}

export interface HelpItem {
  type: 'help';
  id: string | number | null;
  learner: string | null;
  name: string | null;
  skill: string | null;
  category: string | null;
  text: string | null;
  at: string | null;
}

export type LiveItem = AttemptItem | HelpItem;

export interface LiveCounts {
  claimed: number | null;
  attempts: number | null;
  help: number | null;
}

export type Connection = 'idle' | 'connecting' | 'live' | 'reconnecting';

export interface LiveState {
  items: LiveItem[];                 // arrival order, oldest first, at most FEED_CAP
  keys: ReadonlySet<string>;         // dedupe keys of everything in items
  counts: LiveCounts | null;         // latest 'counts' event
  connection: Connection;
  serverError: string | null;        // latest 'error' event from the server (for example, the portal is unreachable)
  dropped: number;                   // items discarded by the cap
}

export type LiveAction =
  | { type: 'item'; item: LiveItem }
  | { type: 'counts'; counts: LiveCounts }
  | { type: 'connection'; connection: Connection }
  | { type: 'server-error'; message: string }
  | { type: 'reset' };

export const initialLive: LiveState = { items: [], keys: new Set(), counts: null, connection: 'idle', serverError: null, dropped: 0 };

/** (type,id) is the identity of an item. The server may omit an id; then the content is the identity. */
export function itemKey(i: LiveItem): string {
  if (i.id !== null && i.id !== undefined && i.id !== '') return `${i.type}:${i.id}`;
  const body = i.type === 'help' ? i.text : i.score;
  return `${i.type}:~${i.learner}|${i.skill}|${i.at}|${body}`;
}

export function liveReducer(s: LiveState, a: LiveAction): LiveState {
  switch (a.type) {
    case 'item': {
      const key = itemKey(a.item);
      if (s.keys.has(key)) return s;
      const keys = new Set(s.keys);
      keys.add(key);
      let items = [...s.items, a.item];
      let dropped = s.dropped;
      if (items.length > FEED_CAP) {
        const over = items.length - FEED_CAP;
        for (const gone of items.slice(0, over)) keys.delete(itemKey(gone));
        items = items.slice(over);
        dropped += over;
      }
      return { ...s, items, keys, dropped };
    }
    case 'counts':
      return { ...s, counts: a.counts };
    case 'connection':
      return { ...s, connection: a.connection, serverError: a.connection === 'live' ? null : s.serverError };
    case 'server-error':
      return { ...s, serverError: a.message };
    case 'reset':
      return initialLive;
    default:
      return s;
  }
}

// ---------------------------------------------------------------- ordering helpers (deterministic)

/** Numeric ids compare as numbers, everything else as plain strings. Never locale-dependent. */
export function cmpId(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const na = typeof a === 'number' ? a : /^\d+$/.test(a) ? Number(a) : NaN;
  const nb = typeof b === 'number' ? b : /^\d+$/.test(b) ? Number(b) : NaN;
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na < nb ? -1 : na > nb ? 1 : 0;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

const when = (i: { at: string | null }): number => {
  const t = i.at ? Date.parse(i.at) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
};

/** Newest first; equal times break on id (higher id first), then on the dedupe key. */
export function newestFirst(a: LiveItem, b: LiveItem): number {
  const ta = when(a);
  const tb = when(b);
  if (ta !== tb) return ta > tb ? -1 : 1;
  const byId = cmpId(b.id, a.id);
  if (byId !== 0) return byId;
  const ka = itemKey(a);
  const kb = itemKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

export const learnerLabel = (i: { name: string | null; learner: string | null }): string => i.name ?? i.learner ?? 'Unknown learner';

// ---------------------------------------------------------------- views

/** Needs help: help requests first (newest first), then the submissions (newest first). */
export function needsHelpView(items: LiveItem[]): { help: HelpItem[]; submissions: AttemptItem[] } {
  const help = items.filter((i): i is HelpItem => i.type === 'help').sort(newestFirst);
  const submissions = items.filter((i): i is AttemptItem => i.type === 'attempt').sort(newestFirst);
  return { help, submissions };
}

export interface LearnerGroup {
  learner: string;
  label: string;
  help: number;
  submissions: number;
  latest: AttemptItem | null;        // the newest submission
  items: LiveItem[];                 // newest first
}

/** By learner: learners with help requests first, then lowest latest score (no score last), then learner id. */
export function byLearnerView(items: LiveItem[]): LearnerGroup[] {
  const map = new Map<string, LiveItem[]>();
  for (const i of items) {
    const k = i.learner ?? `~${i.name ?? 'unknown'}`;
    const list = map.get(k);
    if (list) list.push(i);
    else map.set(k, [i]);
  }
  const groups: LearnerGroup[] = [];
  for (const [learner, list] of map) {
    const sorted = [...list].sort(newestFirst);
    const attempts = sorted.filter((i): i is AttemptItem => i.type === 'attempt');
    groups.push({
      learner,
      label: learnerLabel(sorted[0]!),
      help: sorted.filter((i) => i.type === 'help').length,
      submissions: attempts.length,
      latest: attempts[0] ?? null,
      items: sorted,
    });
  }
  const score = (g: LearnerGroup): number => (g.latest && typeof g.latest.score === 'number' ? g.latest.score : Infinity);
  return groups.sort((a, b) => {
    if ((a.help > 0) !== (b.help > 0)) return a.help > 0 ? -1 : 1;
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.learner < b.learner ? -1 : a.learner > b.learner ? 1 : 0;
  });
}

export interface SkillGroup {
  skill: string;
  submissions: number;
  below: number | null;              // null when the pass mark is not known
  help: number;
  items: LiveItem[];
}

/**
 * By skill: skills with the most below-pass-mark submissions first. The pass mark is not part of the live
 * stream, so callers pass it only when they have it from the data; with null the order is help requests,
 * then submissions, then skill id.
 */
export function bySkillView(items: LiveItem[], passMark: number | null): SkillGroup[] {
  const map = new Map<string, LiveItem[]>();
  for (const i of items) {
    const k = i.skill ?? '';
    const list = map.get(k);
    if (list) list.push(i);
    else map.set(k, [i]);
  }
  const groups: SkillGroup[] = [];
  for (const [skill, list] of map) {
    const attempts = list.filter((i): i is AttemptItem => i.type === 'attempt');
    groups.push({
      skill,
      submissions: attempts.length,
      below: passMark === null ? null : attempts.filter((a) => typeof a.score === 'number' && a.score < passMark).length,
      help: list.length - attempts.length,
      items: [...list].sort(newestFirst),
    });
  }
  return groups.sort((a, b) => {
    if (a.below !== null && b.below !== null && a.below !== b.below) return b.below - a.below;
    if (a.help !== b.help) return b.help - a.help;
    if (a.submissions !== b.submissions) return b.submissions - a.submissions;
    return a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0;
  });
}

export const timelineView = (items: LiveItem[]): LiveItem[] => [...items].sort(newestFirst);

/** Highest numeric id seen per type; sent on reconnect so the server does not replay what is already shown. */
export function cursors(items: LiveItem[]): { attempt: number; help: number } {
  const c = { attempt: 0, help: 0 };
  for (const i of items) {
    const n = typeof i.id === 'number' ? i.id : typeof i.id === 'string' && /^\d+$/.test(i.id) ? Number(i.id) : 0;
    if (n > c[i.type]) c[i.type] = n;
  }
  return c;
}

// ---------------------------------------------------------------- parsing (the stream is untrusted input)

const str = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);
const idOf = (v: unknown): string | number | null => (typeof v === 'string' || typeof v === 'number' ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Scores can arrive as numbers or as numeric text. Anything else is no score. */
const numLike = (v: unknown): number | null => (typeof v === 'string' && v.trim() !== '' ? numOrNull(Number(v)) : numOrNull(v));

export function parseLiveItem(raw: unknown): LiveItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type === 'attempt') {
    return { type: 'attempt', id: idOf(r.id), learner: str(r.learner), name: str(r.name), skill: str(r.skill), score: numLike(r.score), source: str(r.source), at: str(r.at) };
  }
  if (r.type === 'help') {
    return { type: 'help', id: idOf(r.id), learner: str(r.learner), name: str(r.name), skill: str(r.skill), category: str(r.category), text: str(r.text), at: str(r.at) };
  }
  return null;
}

export function parseCounts(raw: unknown): LiveCounts | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return { claimed: numOrNull(r.claimed), attempts: numOrNull(r.attempts), help: numOrNull(r.help) };
}

/** 1s, 2s, 4s, 8s, then 15s. */
export const backoffMs = (attempt: number): number => Math.min(15000, 1000 * 2 ** Math.max(0, attempt));

// ---------------------------------------------------------------- hook

/**
 * Opens GET /api/lms/live while `enabled`. On a dropped connection it closes and reconnects with backoff,
 * passing the highest ids already shown so nothing is replayed. `reconnecting` is set until the stream is open again.
 */
export function useLiveFeed(enabled: boolean): LiveState {
  const [state, dispatch] = useReducer(liveReducer, initialLive);
  const itemsRef = useRef<LiveItem[]>([]);
  itemsRef.current = state.items;

  useEffect(() => {
    if (!enabled) return;
    // Plain JSON polling every 2 s (GET /api/lms/poll). It works through proxies and tunnels that hold back
    // event streams, and it passes the highest ids already shown so nothing is replayed.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;
    let first = true;

    const tick = async () => {
      if (stopped) return;
      const c = cursors(itemsRef.current);
      if (first) dispatch({ type: 'connection', connection: 'connecting' });
      try {
        const res = await fetch(`/api/lms/poll?after_attempt=${c.attempt || 0}&after_help=${c.help || 0}`, { cache: 'no-store' });
        if (res.status === 401) { void probeAuth(); throw new Error('auth'); }
        const body = (await res.json()) as { items?: unknown[]; counts?: unknown; error?: string };
        if (!res.ok) {
          if (body && typeof body.error === 'string') dispatch({ type: 'server-error', message: body.error });
          throw new Error('poll');
        }
        for (const raw of body.items ?? []) {
          const item = parseLiveItem(raw);
          if (item) dispatch({ type: 'item', item });
        }
        const counts = parseCounts(body.counts);
        if (counts) dispatch({ type: 'counts', counts });
        if (first || attempt > 0) dispatch({ type: 'connection', connection: 'live' });
        first = false;
        attempt = 0;
        timer = setTimeout(tick, 2000);
      } catch {
        if (stopped) return;
        dispatch({ type: 'connection', connection: 'reconnecting' });
        timer = setTimeout(tick, backoffMs(attempt++));
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      dispatch({ type: 'connection', connection: 'idle' });
    };
  }, [enabled]);

  return state;
}
