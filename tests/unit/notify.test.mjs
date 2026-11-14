import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier, notifyRecipients, notificationText, NOTIFY_SUBJECT } from '../../engine/notify.mjs';

const KEY = 'xkeysecret-0123456789-abcdef';
const BASE_ENV = { BREVO_API_KEY: KEY, NOTIFY_FROM_EMAIL: 'portal@example.org', NOTIFY_SMS_SENDER: 'TACE', PORTAL_URL: 'https://portal.example.org/' };

/** A fake fetch that records every call and answers from a queue (or 201 by default). */
function fakeFetch(replies = []) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = replies.shift() ?? { status: 201, json: { messageId: 'm-1' } };
    if (r.hang) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

test('status reports email and sms separately, from key plus sender', () => {
  const both = createNotifier(BASE_ENV, { fetchImpl: fakeFetch().fetchImpl }).status();
  assert.deepEqual(both, { email: { connected: true, provider: 'brevo' }, sms: { connected: true, provider: 'brevo' } });
  const keyOnly = createNotifier({ BREVO_API_KEY: KEY }).status();
  assert.equal(keyOnly.email.connected, false);
  assert.equal(keyOnly.sms.connected, false);
  const noKey = createNotifier({ NOTIFY_FROM_EMAIL: 'portal@example.org', NOTIFY_SMS_SENDER: 'TACE' }).status();
  assert.equal(noKey.email.connected, false);
  assert.equal(noKey.sms.connected, false);
});

test('an unset key means not_connected: sends refuse and never call the network', async () => {
  const f = fakeFetch();
  const n = createNotifier({}, { fetchImpl: f.fetchImpl });
  await assert.rejects(n.sendEmail({ to: 'a@example.org', subject: 's', text: 't' }), (e) => e.code === 'NOT_CONNECTED');
  await assert.rejects(n.sendSms({ to: '+27825550100', text: 't' }), (e) => e.code === 'NOT_CONNECTED');
  assert.equal(f.calls.length, 0);
});

test('invalid sender configuration fails at creation, naming the variable', () => {
  assert.throws(() => createNotifier({ NOTIFY_SMS_SENDER: 'WAYTOOLONGNAME' }), (e) => e.code === 'CONFIG_SMS_SENDER');
  assert.throws(() => createNotifier({ NOTIFY_FROM_EMAIL: 'not-an-address' }), (e) => e.code === 'CONFIG_FROM_EMAIL');
});

test('sendEmail posts the documented Brevo shape with the default sender name', async () => {
  const f = fakeFetch();
  const n = createNotifier({ BREVO_API_KEY: KEY, NOTIFY_FROM_EMAIL: 'portal@example.org' }, { fetchImpl: f.fetchImpl });
  const out = await n.sendEmail({ to: 'learner@example.org', subject: NOTIFY_SUBJECT, text: 'Hi Ann, you have a new plan.' });
  assert.deepEqual(out, { ok: true });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(f.calls[0].init.headers['api-key'], KEY);
  assert.deepEqual(f.calls[0].body, {
    sender: { email: 'portal@example.org', name: 'Learning Portal' },
    to: [{ email: 'learner@example.org' }],
    subject: 'New message in your learning portal',
    textContent: 'Hi Ann, you have a new plan.',
  });
});

test('sendSms posts the documented Brevo shape, normalises the number, marks non-ASCII as unicode', async () => {
  const f = fakeFetch([{ status: 201, json: { messageId: 1, reference: 'r', remainingCredits: 5 } }, { status: 201, json: { messageId: 2 } }]);
  const n = createNotifier(BASE_ENV, { fetchImpl: f.fetchImpl });
  await n.sendSms({ to: '+27 82 555 0100', text: 'Hi Ann, you have a new plan.' });
  await n.sendSms({ to: '0825550100', text: 'Hi Zoë, you have a new plan.' });
  assert.equal(f.calls[0].url, 'https://api.brevo.com/v3/transactionalSMS/sms');
  assert.deepEqual(f.calls[0].body, { sender: 'TACE', recipient: '+27825550100', content: 'Hi Ann, you have a new plan.', type: 'transactional', unicodeEnabled: false });
  assert.equal(f.calls[1].body.recipient, '0825550100');
  assert.equal(f.calls[1].body.unicodeEnabled, true);
});

test('bad recipients and over-long SMS are refused before any request', async () => {
  const f = fakeFetch();
  const n = createNotifier(BASE_ENV, { fetchImpl: f.fetchImpl });
  await assert.rejects(n.sendEmail({ to: 'nope', subject: 's', text: 't' }), (e) => e.code === 'BAD_ADDRESS' && !e.message.includes('nope'));
  await assert.rejects(n.sendSms({ to: 'call me', text: 't' }), (e) => e.code === 'BAD_PHONE');
  await assert.rejects(n.sendSms({ to: '+27825550100', text: 'x'.repeat(161) }), (e) => e.code === 'SMS_TOO_LONG');
  assert.equal(f.calls.length, 0);
});

test('HTTP errors keep Brevo short code only, and the key never appears in the error', async () => {
  const f = fakeFetch([{ status: 401, json: { code: 'unauthorized', message: `Key ${KEY} is invalid for learner@example.org` } }]);
  const n = createNotifier(BASE_ENV, { fetchImpl: f.fetchImpl, retryDelayMs: 0 });
  await assert.rejects(n.sendEmail({ to: 'learner@example.org', subject: 's', text: 't' }), (e) => {
    assert.equal(e.code, 'NOTIFY_HTTP');
    assert.equal(e.status, 401);
    assert.equal(e.message, 'email: HTTP 401: unauthorized');
    assert.ok(!e.message.includes(KEY) && !e.message.includes('learner@example.org'));
    return true;
  });
  assert.equal(f.calls.length, 1, 'a 401 is not retried');
});

test('one retry on 429 or 5xx, then success', async () => {
  const f = fakeFetch([{ status: 503, json: { code: 'service_unavailable' } }, { status: 201, json: { messageId: 'ok' } }]);
  const n = createNotifier(BASE_ENV, { fetchImpl: f.fetchImpl, retryDelayMs: 0 });
  assert.deepEqual(await n.sendSms({ to: '+27825550100', text: 'hi' }), { ok: true });
  assert.equal(f.calls.length, 2);
});

test('a second 429 is reported, not retried again', async () => {
  const f = fakeFetch([{ status: 429, json: { code: 'too_many_requests' } }, { status: 429, json: { code: 'too_many_requests' } }]);
  const n = createNotifier(BASE_ENV, { fetchImpl: f.fetchImpl, retryDelayMs: 0 });
  await assert.rejects(n.sendEmail({ to: 'a@example.org', subject: 's', text: 't' }), (e) => e.message === 'email: HTTP 429: too_many_requests');
  assert.equal(f.calls.length, 2);
});

test('a request that never answers is aborted after timeoutMs with a short code', async () => {
  const f = fakeFetch([{ hang: true }]);
  const n = createNotifier(BASE_ENV, { fetchImpl: f.fetchImpl, timeoutMs: 20 });
  await assert.rejects(n.sendEmail({ to: 'a@example.org', subject: 's', text: 't' }), (e) => e.code === 'NOTIFY_TIMEOUT');
});

test('notificationText is the fixed wording with the name and the portal address only', () => {
  const t = notificationText({ displayName: 'Learner 07', portalUrl: 'https://portal.example.org' });
  assert.equal(t.subject, 'New message in your learning portal');
  assert.equal(t.email, 'Hi Learner 07, you have a new plan waiting in your learning portal. Open https://portal.example.org and sign in to read it.');
  assert.ok(t.sms.length <= 160);
  assert.ok(t.sms.includes('Learner 07') && t.sms.includes('https://portal.example.org'));
  assert.throws(() => notificationText({ displayName: 'Ann', portalUrl: null }), (e) => e.code === 'PORTAL_URL_MISSING');
  assert.throws(() => notificationText({ displayName: '', portalUrl: 'https://x.example' }), (e) => e.code === 'NO_DISPLAY_NAME');
});

test('notifyRecipients counts sent and failed per channel, skips people with no address, and never returns addresses', async () => {
  const people = [
    { displayName: 'Learner 01', email: 'one@example.org', phone: '+27825550101' },
    { displayName: 'Learner 02', email: 'two@example.org', phone: null },
    { displayName: 'Mentor A', email: null, phone: '+27825550103' },
    { displayName: 'Learner 04', email: null, phone: null },
  ];
  // Jobs: one@ email, one +27 sms, two@ email, Mentor A sms. Brevo refuses two@ with 400; everything else is accepted.
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const refused = body.to?.[0]?.email === 'two@example.org';
    return new Response(JSON.stringify(refused ? { code: 'invalid_parameter', message: 'bad address' } : {}), { status: refused ? 400 : 201, headers: { 'content-type': 'application/json' } });
  };
  const n = createNotifier(BASE_ENV, { fetchImpl, retryDelayMs: 0 });
  const out = await notifyRecipients(n, people, { concurrency: 5 });
  assert.deepEqual(out.counts, { email: { sent: 1, failed: 1 }, sms: { sent: 2, failed: 0 } });
  assert.deepEqual(out.errors, { email: { NOTIFY_HTTP: 1 }, sms: {} });
  const text = JSON.stringify(out);
  for (const p of people) {
    assert.ok(!text.includes(p.email ?? '@@@'), 'no email address in the result');
    assert.ok(!text.includes(p.phone ?? '@@@'), 'no phone number in the result');
  }
});

test('notifyRecipients never has more than `concurrency` sends in flight', async () => {
  let inFlight = 0; let peak = 0;
  const fetchImpl = async () => {
    inFlight += 1; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
  };
  const people = Array.from({ length: 12 }, (_, i) => ({ displayName: `Learner ${i}`, email: `p${i}@example.org`, phone: null }));
  const n = createNotifier(BASE_ENV, { fetchImpl });
  const out = await notifyRecipients(n, people, { concurrency: 5 });
  assert.equal(out.counts.email.sent, 12);
  assert.equal(peak, 5);
});

test('notifyRecipients with a channel not connected sends nothing on that channel', async () => {
  const f = fakeFetch();
  const n = createNotifier({ BREVO_API_KEY: KEY, NOTIFY_FROM_EMAIL: 'portal@example.org', PORTAL_URL: 'https://portal.example.org' }, { fetchImpl: f.fetchImpl });
  const out = await notifyRecipients(n, [{ displayName: 'Ann', email: 'ann@example.org', phone: '+27825550100' }]);
  assert.deepEqual(out.counts, { email: { sent: 1, failed: 0 }, sms: { sent: 0, failed: 0 } });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://api.brevo.com/v3/smtp/email');
});

test('notifyRecipients refuses to run without PORTAL_URL rather than sending "Open null"', async () => {
  const f = fakeFetch();
  const n = createNotifier({ BREVO_API_KEY: KEY, NOTIFY_FROM_EMAIL: 'portal@example.org' }, { fetchImpl: f.fetchImpl });
  await assert.rejects(notifyRecipients(n, [{ displayName: 'Ann', email: 'ann@example.org', phone: null }]), (e) => e.code === 'PORTAL_URL_MISSING');
  assert.equal(f.calls.length, 0);
});
