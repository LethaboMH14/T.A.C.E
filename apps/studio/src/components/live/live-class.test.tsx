import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialMission, reduce } from '@/state/mission';
import type { LedgerEvent } from '@/state/types';
import { initialLive } from '@/state/live';
import { LiveView } from '@/views/LiveView';
import { SignIn, loginErrorText } from '@/components/auth/SignIn';
import { LoginError } from '@/lib/auth';
import { intakeRows, shortDigest, SourceIntake } from './SourceIntake';

const ev = (seq: number, type: string, data: unknown): LedgerEvent => ({ seq, runId: 'r1', ts: `2026-11-13T10:00:0${seq}Z`, type, taskId: null, role: null, data });
const D1 = 'a'.repeat(64);
const D2 = 'b'.repeat(64);

describe('class snapshot in the mission state', () => {
  const snap = ev(2, 'LMS_SNAPSHOT', { at: '2026-11-13T10:00:00Z', files: [{ name: 'trainees.csv', rows: 36, digest: D1 }, { name: 'assessments.csv', rows: 216, digest: D2 }], learners: 36, helpRequests: 2 });

  it('records the snapshot and the delivery from their ledger events', () => {
    let m = [ev(1, 'RUN_STARTED', { title: 'Live class' }), snap].reduce(reduce, initialMission('r1'));
    expect(m.lmsSnapshot).toMatchObject({ learners: 36, helpRequests: 2 });
    expect(m.lmsSnapshot!.files).toHaveLength(2);
    m = reduce(m, ev(3, 'MESSAGES_DELIVERED', { count: 39, learners: 36, mentors: 3 }));
    expect(m.delivered).toEqual({ count: 39, learners: 36, mentors: 3 });
    m = reduce(m, ev(4, 'NOTIFICATIONS_SENT', { email: { sent: 3, failed: 1 }, sms: { sent: 0, failed: 0 } }));
    expect(m.notified).toEqual({ email: { sent: 3, failed: 1 }, sms: { sent: 0, failed: 0 } });
  });

  it('source intake rows wait for SOURCE_ADMITTED, then settle', () => {
    let m = [ev(1, 'RUN_STARTED', {}), snap].reduce(reduce, initialMission('r1'));
    expect(intakeRows(m).map((r) => r.state)).toEqual(['reading', 'reading']);
    m = reduce(m, ev(3, 'SOURCE_ADMITTED', { sourceId: 'trainees', file: 'trainees.csv', rows: 36, digest: D1 }));
    expect(intakeRows(m).map((r) => r.state)).toEqual(['admitted', 'reading']);
    m = reduce(m, ev(4, 'SOURCE_ADMITTED', { sourceId: 'assessments', file: 'assessments.csv', rows: 216, digest: D1 }));
    expect(intakeRows(m)[1]!.state).toBe('changed');
  });

  it('shows the file name, row count and first 8 characters of the sha256', () => {
    const m = [ev(1, 'RUN_STARTED', {}), snap].reduce(reduce, initialMission('r1'));
    const html = renderToStaticMarkup(<SourceIntake mission={m} />);
    expect(html).toContain('trainees.csv');
    expect(html).toContain('216 rows');
    expect(html).toContain(`>${shortDigest(D1)}<`);
    expect(html).not.toContain(`>${D1}<`);
  });

  it('renders nothing for a run that did not read the class', () => {
    expect(renderToStaticMarkup(<SourceIntake mission={initialMission('r1')} />)).toBe('');
  });
});

describe('Live class view states', () => {
  const view = (status: Parameters<typeof LiveView>[0]['status'], feedAvailable = true) =>
    renderToStaticMarkup(<LiveView status={status} onRetry={() => {}} live={initialLive} feedAvailable={feedAvailable} />);
  const ready = (over: object) => ({ kind: 'ready' as const, status: { configured: true, url: 'https://x.supabase.co', portalUrl: null, counts: { profiles: 39, claimed: 4, attempts_live: 10, help: 2 }, notify: { email: { connected: false }, sms: { connected: false } }, ...over } });

  it('loading says what is loading', () => expect(view({ kind: 'loading' })).toContain('Reading the class portal'));
  it('error says what is missing and offers a retry', () => {
    const html = view({ kind: 'error', message: 'HTTP 502' });
    expect(html).toContain('Class portal unreachable');
    expect(html).toContain('HTTP 502');
    expect(html).toContain('Try again');
  });
  it('not configured is its own state', () => expect(view(ready({ configured: false }))).toContain('Class portal not connected'));
  it('a missing portal link shows Portal link not set instead of a QR code', () => {
    const html = view(ready({}));
    expect(html).toContain('Portal link not set');
    expect(html).not.toContain('QR code for');
  });
  it('a portal link shows the QR code and the short URL', () => {
    const html = view(ready({ portalUrl: 'https://tace-portal.example/join' }));
    expect(html).toContain('QR code for tace-portal.example/join');
    expect(html).toContain('Copy link');
  });
  it('shows the totals from the status when the stream has not sent counts yet', () => {
    const html = view(ready({}));
    expect(html).toContain('Joined');
    expect(html).toContain('Help requests');
  });
  it('an empty feed says so, and a feed without admin access says why', () => {
    expect(view(ready({}))).toContain('No activity yet');
    expect(view(ready({}), false)).toContain('Live feed unavailable');
  });
  it('offers the four groupings', () => {
    const html = view(ready({}));
    for (const t of ['Needs help', 'By learner', 'By skill', 'Timeline']) expect(html).toContain(t);
  });
});

describe('Sign-in screen', () => {
  it('has labelled email and password fields and a submit button', () => {
    const html = renderToStaticMarkup(<SignIn onSignedIn={() => {}} />);
    expect(html).toContain('for="signin-email"');
    expect(html).toContain('for="signin-password"');
    expect(html).toContain('Sign in');
  });
  it('turns failures into plain text', () => {
    expect(loginErrorText(new LoginError('Invalid credentials', 401))).toBe('Invalid credentials');
    expect(loginErrorText(new LoginError('Sign-in failed (HTTP 401)', 401))).toBe('Email or password is not right.');
    expect(loginErrorText(new TypeError('Failed to fetch'))).toContain('Can’t reach the server');
  });
});
