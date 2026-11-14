// Notification centre. Pure mapping from ledger events to notices, plus a tiny store the bell and the toasts read.
// A notice exists only because a real ledger event said so; its words come from the event and the mission it belongs to.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { LedgerEvent, Mission } from '@/state';

export type NoticeTone = 'ok' | 'bad' | 'redo' | 'run';

export interface Notice {
  id: string;                    // `${runId}:${seq}`
  at: number;                    // epoch ms when it was raised
  tone: NoticeTone;
  title: string;
  detail: string | null;
  runId: string;
  nodeId: string | null;         // the graph node to open
  read: boolean;
}

const reasonWords = (code: unknown): string => {
  const c = String(code ?? '');
  if (c === 'MODEL_HTTP_429') return 'rate limit';
  if (/^MODEL_HTTP_5\d\d$/.test(c)) return 'service error';
  if (c === 'MODEL_HTTP_402') return 'out of credit';
  if (c === 'auth' || c === 'MODEL_HTTP_401' || c === 'MODEL_HTTP_403') return 'key refused';
  return c ? c.replace(/^MODEL_/, '').replace(/_/g, ' ').toLowerCase() : 'unknown reason';
};

/** The notice a ledger event deserves, or null. `m` is the mission after the event was folded in. */
export function noticeFor(e: LedgerEvent, m: Pick<Mission, 'checks' | 'tasks' | 'runId'>): Omit<Notice, 'at' | 'read'> | null {
  const d = e.data ?? {};
  const runId = e.runId ?? m.runId ?? '';
  const id = `${runId}:${e.seq}`;
  switch (e.type) {
    case 'VERIFICATION_FAILED': {
      const failed: string[] = Array.isArray(d.failed) ? d.failed : [];
      const titles = failed.map((cid) => m.checks[cid]?.title ?? cid);
      const detail = titles.length ? titles.join('; ') : (Array.isArray(d.messages) && d.messages[0] ? String(d.messages[0]) : null);
      return { id, runId, tone: 'bad', title: 'Check failed', detail, nodeId: 'review' };
    }
    case 'ARTIFACT_REPAIRED': {
      const n = Array.isArray(d.changes) ? d.changes.length : 0;
      return { id, runId, tone: 'redo', title: 'Repair applied', detail: `${d.to ?? 'A file'} updated, ${n} change${n === 1 ? '' : 's'}`, nodeId: 'repair' };
    }
    case 'RUN_FINISHED': {
      if (d.status === 'VERIFIED') return { id, runId, tone: 'ok', title: 'Plan verified', detail: `${d.checksPassed} of ${d.checksTotal} checks passed`, nodeId: 'deliver' };
      if (d.status === 'PARTIAL') return { id, runId, tone: 'bad', title: 'Plan finished with open issues', detail: `${d.checksPassed} of ${d.checksTotal} checks passed`, nodeId: 'deliver' };
      return { id, runId, tone: 'bad', title: 'Plan stopped', detail: d.reason ? String(d.reason) : null, nodeId: 'blocked' };
    }
    case 'MODEL_FALLBACK': {
      const task = m.tasks.find((t) => t.role === d.agent);
      return { id, runId, tone: 'run', title: 'Switched to another model', detail: `${d.from} to ${d.to} (${reasonWords(d.reason)})`, nodeId: task?.id ?? null };
    }
    case 'HUMAN_QUESTION':
      return { id, runId, tone: 'run', title: 'Question waiting for you', detail: d.question ? String(d.question) : null, nodeId: 'goal' };
    case 'MESSAGES_DELIVERED':
      return { id, runId, tone: 'ok', title: 'Delivered to portal inboxes', detail: `${d.learners ?? 0} learner plans, ${d.mentors ?? 0} mentor schedules`, nodeId: 'deliver' };
    case 'NOTIFICATIONS_SENT': {
      const failed = Number(d.email?.failed ?? 0) + Number(d.sms?.failed ?? 0);
      return {
        id, runId, tone: failed ? 'bad' : 'ok', title: failed ? 'Some notices failed' : 'Notices sent',
        detail: `${Number(d.email?.sent ?? 0)} email, ${Number(d.sms?.sent ?? 0)} SMS sent${failed ? `, ${failed} failed` : ''}`, nodeId: 'deliver',
      };
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------------ store

const CAP = 100;
const MAX_TOASTS = 3;

interface Snapshot {
  notices: Notice[];             // newest first
  toasts: Notice[];              // newest first, at most MAX_TOASTS
}

let snap: Snapshot = { notices: [], toasts: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (next: Snapshot) => {
  snap = next;
  emit();
};

export function pushNotice(n: Omit<Notice, 'at' | 'read'>, at = Date.now()): void {
  if (snap.notices.some((x) => x.id === n.id)) return;
  const notice: Notice = { ...n, at, read: false };
  set({ notices: [notice, ...snap.notices].slice(0, CAP), toasts: [notice, ...snap.toasts].slice(0, MAX_TOASTS) });
}

export const markRead = (id: string): void =>
  set({ ...snap, notices: snap.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) });
export const markAllRead = (): void => set({ ...snap, notices: snap.notices.map((n) => (n.read ? n : { ...n, read: true })) });
export const dismissToast = (id: string): void => set({ ...snap, toasts: snap.toasts.filter((t) => t.id !== id) });
export const clearNotices = (): void => set({ notices: [], toasts: [] });
export const unreadCount = (notices: Notice[]): number => notices.filter((n) => !n.read).length;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Current notices and toasts without React (tests, non-component code). */
export const getNoticeSnapshot = (): Snapshot => snap;
export const useNotices = (): Snapshot => useSyncExternalStore(subscribe, () => snap, () => snap);

// ------------------------------------------------------------------ focus a node from a notice

export interface FocusRequest {
  runId: string;
  nodeId: string | null;
}

const FOCUS_EVENT = 'tace:focus-node';
let pendingFocus: FocusRequest | null = null;

export function requestFocus(r: FocusRequest): void {
  pendingFocus = r;
  window.dispatchEvent(new Event(FOCUS_EVENT));
}

/** The mission view calls this on mount and on the event; returns a request for its run once. */
export function takeFocus(runId: string | null): FocusRequest | null {
  if (!pendingFocus || pendingFocus.runId !== runId) return null;
  const r = pendingFocus;
  pendingFocus = null;
  return r;
}

export function onFocusRequest(fn: () => void): () => void {
  window.addEventListener(FOCUS_EVENT, fn);
  return () => window.removeEventListener(FOCUS_EVENT, fn);
}

// ------------------------------------------------------------------ feeding the store from the open run

/** Events that arrive this long after a run is opened are live; earlier ones are history being replayed. */
export const REPLAY_WINDOW_MS = 1500;

/** Notices for events with seq > afterSeq. Pure: the caller decides whether they are live. */
export function collectNotices(events: LedgerEvent[], m: Pick<Mission, 'checks' | 'tasks' | 'runId'>, afterSeq: number): Omit<Notice, 'at' | 'read'>[] {
  const out: Omit<Notice, 'at' | 'read'>[] = [];
  for (const e of events) {
    if (e.seq <= afterSeq) continue;
    const n = noticeFor(e, m);
    if (n) out.push(n);
  }
  return out;
}

/** Turns the open run's live events into notices and toasts. Replayed history is skipped. */
export function useRunNotifications(m: Mission): void {
  const state = useRef<{ runId: string | null; seq: number; liveAfter: number }>({ runId: null, seq: 0, liveAfter: 0 });
  useEffect(() => {
    const s = state.current;
    if (s.runId !== m.runId) {
      state.current = { runId: m.runId, seq: 0, liveAfter: Date.now() + REPLAY_WINDOW_MS };
    }
    const cur = state.current;
    if (!m.runId || m.events.length === 0) return;
    const live = Date.now() >= cur.liveAfter;
    if (live) for (const n of collectNotices(m.events, m, cur.seq)) pushNotice(n);
    cur.seq = Math.max(cur.seq, m.lastSeq);
  }, [m.runId, m.lastSeq]); // eslint-disable-line react-hooks/exhaustive-deps
}
