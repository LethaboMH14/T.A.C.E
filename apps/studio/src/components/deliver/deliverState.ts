// Deliver flow. Pure: what the confirm dialog shows and allows at each step. The numbers come from the run's
// unsent-message-drafts.json and the channel flags from GET /api/lms/status; nothing here is typed in.

import type { Mission } from '@/state';
import type { DeliverResult } from '@/state/lms';

export type Eligibility = 'hidden' | 'ready' | 'delivered';

/** Approve-and-deliver is offered only for a finished VERIFIED or PARTIAL run that read the live class and was not delivered yet. */
export function deliverEligibility(m: Pick<Mission, 'finished' | 'lmsSnapshot' | 'delivered'>): Eligibility {
  if (m.delivered) return 'delivered';
  if (!m.lmsSnapshot || !m.finished) return 'hidden';
  return m.finished.status === 'VERIFIED' || m.finished.status === 'PARTIAL' ? 'ready' : 'hidden';
}

export interface Channels {
  email: boolean;
  sms: boolean;
}

export type DeliverState =
  | { phase: 'closed' }
  | { phase: 'loading' }
  | { phase: 'load-error'; message: string }
  | { phase: 'ready'; learners: number; mentors: number; channels: Channels; notify: boolean; error: string | null }
  | { phase: 'sending'; learners: number; mentors: number; channels: Channels; notify: boolean }
  | { phase: 'done'; result: DeliverResult; notify: boolean };

export type DeliverAction =
  | { type: 'open' }
  | { type: 'loaded'; learners: number; mentors: number; channels: Channels }
  | { type: 'load-failed'; message: string }
  | { type: 'toggle-notify' }
  | { type: 'submit' }
  | { type: 'succeeded'; result: DeliverResult }
  | { type: 'failed'; message: string }
  | { type: 'close' };

export const initialDeliver: DeliverState = { phase: 'closed' };

export const anyChannel = (c: Channels): boolean => c.email || c.sms;

/** The confirm button works only when there is something to deliver and nothing is in flight. */
export function canConfirm(s: DeliverState): boolean {
  return s.phase === 'ready' && s.learners + s.mentors > 0;
}

export function deliverReducer(s: DeliverState, a: DeliverAction): DeliverState {
  switch (a.type) {
    case 'open':
      return s.phase === 'closed' ? { phase: 'loading' } : s;
    case 'loaded':
      return s.phase === 'loading' ? { phase: 'ready', learners: a.learners, mentors: a.mentors, channels: a.channels, notify: false, error: null } : s;
    case 'load-failed':
      return s.phase === 'loading' ? { phase: 'load-error', message: a.message } : s;
    case 'toggle-notify':
      // The notice cannot be switched on when no channel is connected.
      return s.phase === 'ready' && anyChannel(s.channels) ? { ...s, notify: !s.notify } : s;
    case 'submit':
      return canConfirm(s) && s.phase === 'ready'
        ? { phase: 'sending', learners: s.learners, mentors: s.mentors, channels: s.channels, notify: s.notify && anyChannel(s.channels) }
        : s;
    case 'succeeded':
      return s.phase === 'sending' ? { phase: 'done', result: a.result, notify: s.notify } : s;
    case 'failed':
      return s.phase === 'sending'
        ? { phase: 'ready', learners: s.learners, mentors: s.mentors, channels: s.channels, notify: s.notify, error: a.message }
        : s;
    case 'close':
      // A delivery in flight cannot be dismissed: the person must see its outcome.
      return s.phase === 'sending' ? s : { phase: 'closed' };
    default:
      return s;
  }
}

/** Counts learner and mentor drafts in unsent-message-drafts.json text. Returns null if the file is not what it should be. */
export function countDrafts(text: string): { learners: number; mentors: number } | null {
  try {
    const j = JSON.parse(text) as { drafts?: { to_role?: string }[] };
    if (!Array.isArray(j.drafts)) return null;
    return {
      learners: j.drafts.filter((d) => d.to_role === 'learner').length,
      mentors: j.drafts.filter((d) => d.to_role === 'mentor').length,
    };
  } catch {
    return null;
  }
}

export function channelLine(name: string, connected: boolean): string {
  return `${name}: ${connected ? 'connected' : 'not connected'}`;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The sentence the dialog states before anything is sent. */
export function whatHappens(learners: number, mentors: number): string {
  return `${plural(learners, 'learner plan')} and ${plural(mentors, 'mentor schedule')} go to the portal inboxes.`;
}
