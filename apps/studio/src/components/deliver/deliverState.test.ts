import { describe, expect, it } from 'vitest';
import {
  canConfirm, countDrafts, deliverEligibility, deliverReducer, initialDeliver, whatHappens, type DeliverState,
} from './deliverState';

const finished = (status: 'VERIFIED' | 'PARTIAL' | 'BLOCKED') => ({ status, checksPassed: 1, checksTotal: 1, repairs: 0, reason: null });
const snap = { at: null, files: [], learners: 36, helpRequests: 2 };
const result = { delivered: 39, remembered: 10, learners: 36, mentors: 3 };

const ready = (channels = { email: false, sms: false }, learners = 36, mentors = 3): DeliverState =>
  [
    { type: 'open' } as const,
    { type: 'loaded', learners, mentors, channels } as const,
  ].reduce(deliverReducer, initialDeliver);

describe('deliver eligibility', () => {
  it('is offered for finished VERIFIED and PARTIAL runs with a class snapshot', () => {
    expect(deliverEligibility({ finished: finished('VERIFIED'), lmsSnapshot: snap, delivered: null })).toBe('ready');
    expect(deliverEligibility({ finished: finished('PARTIAL'), lmsSnapshot: snap, delivered: null })).toBe('ready');
  });
  it('is hidden for BLOCKED, unfinished, or runs without a class snapshot', () => {
    expect(deliverEligibility({ finished: finished('BLOCKED'), lmsSnapshot: snap, delivered: null })).toBe('hidden');
    expect(deliverEligibility({ finished: null, lmsSnapshot: snap, delivered: null })).toBe('hidden');
    expect(deliverEligibility({ finished: finished('VERIFIED'), lmsSnapshot: null, delivered: null })).toBe('hidden');
  });
  it('is delivered once MESSAGES_DELIVERED is in the ledger', () => {
    expect(deliverEligibility({ finished: finished('VERIFIED'), lmsSnapshot: snap, delivered: { count: 39, learners: 36, mentors: 3 } })).toBe('delivered');
  });
});

describe('deliver dialog', () => {
  it('opens into loading, then shows the real counts', () => {
    expect(deliverReducer(initialDeliver, { type: 'open' })).toEqual({ phase: 'loading' });
    const s = ready({ email: true, sms: false });
    expect(s).toMatchObject({ phase: 'ready', learners: 36, mentors: 3, notify: false });
    expect(whatHappens(36, 3)).toBe('36 learner plans and 3 mentor schedules go to the portal inboxes.');
    expect(whatHappens(1, 1)).toBe('1 learner plan and 1 mentor schedule go to the portal inboxes.');
  });
  it('reports a load failure instead of a confirm button', () => {
    const s = deliverReducer({ phase: 'loading' }, { type: 'load-failed', message: 'HTTP 404' });
    expect(s).toEqual({ phase: 'load-error', message: 'HTTP 404' });
    expect(canConfirm(s)).toBe(false);
  });
  it('cannot switch the notice on when no channel is connected', () => {
    const s = deliverReducer(ready(), { type: 'toggle-notify' });
    expect(s).toMatchObject({ phase: 'ready', notify: false });
  });
  it('switches the notice on and off when a channel is connected', () => {
    const on = deliverReducer(ready({ email: false, sms: true }), { type: 'toggle-notify' });
    expect(on).toMatchObject({ notify: true });
    expect(deliverReducer(on, { type: 'toggle-notify' })).toMatchObject({ notify: false });
  });
  it('does not confirm when there is nothing to deliver', () => {
    expect(canConfirm(ready({ email: true, sms: true }, 0, 0))).toBe(false);
    expect(deliverReducer(ready({ email: true, sms: true }, 0, 0), { type: 'submit' }).phase).toBe('ready');
  });
  it('sends once, ignores a second submit and cannot be closed while sending', () => {
    const sending = deliverReducer(ready({ email: true, sms: false }), { type: 'submit' });
    expect(sending.phase).toBe('sending');
    expect(deliverReducer(sending, { type: 'submit' })).toBe(sending);
    expect(deliverReducer(sending, { type: 'close' })).toBe(sending);
  });
  it('a refused delivery returns to ready with the server message and keeps the choice', () => {
    let s = deliverReducer(ready({ email: true, sms: false }), { type: 'toggle-notify' });
    s = deliverReducer(s, { type: 'submit' });
    s = deliverReducer(s, { type: 'failed', message: 'this run was already delivered' });
    expect(s).toMatchObject({ phase: 'ready', notify: true, error: 'this run was already delivered' });
  });
  it('success ends in done with the server counts', () => {
    const s = deliverReducer(deliverReducer(ready(), { type: 'submit' }), { type: 'succeeded', result });
    expect(s).toEqual({ phase: 'done', result, notify: false });
    expect(deliverReducer(s, { type: 'close' })).toEqual({ phase: 'closed' });
  });
});

describe('countDrafts', () => {
  it('counts learner and mentor drafts', () => {
    expect(countDrafts(JSON.stringify({ drafts: [{ to_role: 'learner' }, { to_role: 'learner' }, { to_role: 'mentor' }] }))).toEqual({ learners: 2, mentors: 1 });
  });
  it('rejects text that is not a drafts file', () => {
    expect(countDrafts('not json')).toBeNull();
    expect(countDrafts('{}')).toBeNull();
  });
});
