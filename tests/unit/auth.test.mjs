import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStaffGate, COOKIE } from '../../web/api/auth.mjs';
import { createLmsClient } from '../../engine/lms.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const KEY = 'test-publishable-key-0001';
const EMAIL = 'coord@example.org';
const PASSWORD = 'correct-horse-battery';
const LMS_URL = 'http://127.0.0.1:1'; // replaced by the fake below

/**
 * A fake of the three staff RPCs (and the login-state they keep). It stands in for the database in these tests only.
 * state.down makes lms_staff_me fail with a server error, to test fail-closed behaviour.
 */
function fakeDatabase() {
  const sessions = new Map(); // token -> staff row
  const state = { calls: [], down: false };
  const expires = () => new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  function answer(fn, args, apikey) {
    state.calls.push(fn);
    if (apikey !== KEY) return { status: 401, body: { message: 'Invalid API key' } };
    if (fn === 'lms_staff_login') {
      if (args.p_email !== EMAIL || args.p_password !== PASSWORD) return { status: 400, body: { message: 'Email or password is wrong' } };
      const token = `tok_${randomBytes(16).toString('hex')}`;
      const staff = { id: 'staff-1', email: EMAIL, display_name: 'Coordinator' };
      sessions.set(token, { ...staff, expires_at: expires() });
      return { status: 200, body: { token, staff } };
    }
    if (fn === 'lms_staff_me') {
      if (state.down) return { status: 500, body: { message: 'database unavailable' } };
      const row = sessions.get(args.p_token);
      return row ? { status: 200, body: row } : { status: 400, body: { message: 'Please sign in again' } };
    }
    if (fn === 'lms_staff_logout') {
      sessions.delete(args.p_token);
      return { status: 200, body: { ok: true } };
    }
    return { status: 404, body: { message: `unknown function ${fn}` } };
  }
  const fetchImpl = async (url, init) => {
    const fn = new URL(url).pathname.split('/').pop();
    const r = answer(fn, JSON.parse(init.body), init.headers.apikey);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  return { state, sessions, fetchImpl, answer };
}

const configuredEnv = { LMS_URL, LMS_PUBLISHABLE_KEY: KEY, LMS_ADMIN_TOKEN: '' };
const cookieHeader = (token) => ({ headers: { cookie: `${COOKIE}=${token}` } });
const reqWith = (cookie) => ({ headers: cookie ? { cookie } : {} });

test('no cookie, LMS configured: check returns 401 AUTH_REQUIRED', async () => {
  const db = fakeDatabase();
  const gate = createStaffGate(configuredEnv, { lms: createLmsClient(configuredEnv, { fetchImpl: db.fetchImpl }) });
  assert.equal(gate.required, true);
  const out = await gate.check(reqWith(undefined));
  assert.deepEqual(out, { ok: false, status: 401, body: { error: 'Sign in to continue', code: 'AUTH_REQUIRED' } });
  assert.equal(db.state.calls.length, 0, 'no database call without a cookie');
});

test('a malformed cookie is treated as no cookie', async () => {
  const db = fakeDatabase();
  const gate = createStaffGate(configuredEnv, { lms: createLmsClient(configuredEnv, { fetchImpl: db.fetchImpl }) });
  assert.equal((await gate.check(reqWith(`${COOKIE}=bad value;;`))).status, 401);
  assert.equal(db.state.calls.length, 0);
});

test('STUDIO_LOGIN=off: no guard even with the LMS configured', async () => {
  const db = fakeDatabase();
  const env = { ...configuredEnv, STUDIO_LOGIN: 'off' };
  const gate = createStaffGate(env, { lms: createLmsClient(env, { fetchImpl: db.fetchImpl }) });
  assert.equal(gate.required, false);
  assert.deepEqual(await gate.check(reqWith(undefined)), { ok: true, staff: null });
});

test('LMS not configured: login is not required', async () => {
  const gate = createStaffGate({}, { lms: createLmsClient({}) });
  assert.equal(gate.required, false);
  assert.equal((await gate.check(reqWith(undefined))).ok, true);
});

test('valid cookie passes; the database is asked once per 60 s, then again after expiry', async () => {
  const db = fakeDatabase();
  const lms = createLmsClient(configuredEnv, { fetchImpl: db.fetchImpl });
  let clock = 1_000_000;
  const gate = createStaffGate(configuredEnv, { lms, now: () => clock });
  const login = await lms.rpc('lms_staff_login', { p_email: EMAIL, p_password: PASSWORD });
  const req = cookieHeader(login.token);
  const first = await gate.check(req);
  assert.equal(first.ok, true);
  assert.equal(first.staff.email, EMAIL);
  assert.equal((await gate.check(req)).ok, true);
  assert.equal(db.state.calls.filter((c) => c === 'lms_staff_me').length, 1, 'second check served from the cache');
  clock += 61_000;
  assert.equal((await gate.check(req)).ok, true);
  assert.equal(db.state.calls.filter((c) => c === 'lms_staff_me').length, 2, 'cache expired after 60 s');
});

test('an unknown or signed-out token is 401, not a server error', async () => {
  const db = fakeDatabase();
  const gate = createStaffGate(configuredEnv, { lms: createLmsClient(configuredEnv, { fetchImpl: db.fetchImpl }) });
  assert.equal((await gate.check(cookieHeader('tok_never_issued_0001'))).status, 401);
});

test('a database failure on the session check fails closed with 503 and no secret in the message', async () => {
  const db = fakeDatabase();
  db.state.down = true;
  const gate = createStaffGate(configuredEnv, { lms: createLmsClient(configuredEnv, { fetchImpl: db.fetchImpl }) });
  const out = await gate.check(cookieHeader('tok_anything_0001'));
  assert.equal(out.ok, false);
  assert.equal(out.status, 503);
  assert.equal(out.body.code, 'AUTH_CHECK_FAILED');
  assert.ok(!JSON.stringify(out).includes(KEY));
});

test('forget() drops a cached session so a logged-out token is checked again', async () => {
  const db = fakeDatabase();
  const lms = createLmsClient(configuredEnv, { fetchImpl: db.fetchImpl });
  const gate = createStaffGate(configuredEnv, { lms });
  const login = await lms.rpc('lms_staff_login', { p_email: EMAIL, p_password: PASSWORD });
  assert.equal((await gate.check(cookieHeader(login.token))).ok, true);
  await lms.rpc('lms_staff_logout', { p_token: login.token });
  gate.forget(login.token);
  assert.equal((await gate.check(cookieHeader(login.token))).status, 401);
});

// ---- the real server, with a local fake of the database (no real DB, no real account)

const children = [];
const closers = [];
after(async () => {
  for (const c of children) c.kill();
  for (const close of closers) await close();
});

async function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function startFakeDatabase() {
  const db = fakeDatabase();
  const srv = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const fn = req.url.split('/').pop();
      const r = db.answer(fn, raw ? JSON.parse(raw) : {}, req.headers.apikey);
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  closers.push(() => new Promise((r) => srv.close(r)));
  return { url: `http://127.0.0.1:${srv.address().port}`, db };
}

async function startStudio(extraEnv) {
  const fake = await startFakeDatabase();
  const port = await freePort();
  // Every LMS and notification setting is given explicitly, so a local .env cannot change what this test sees.
  const env = {
    ...process.env,
    PORT: String(port),
    LMS_URL: fake.url,
    LMS_PUBLISHABLE_KEY: KEY,
    LMS_ADMIN_TOKEN: '',
    BREVO_API_KEY: '',
    NOTIFY_FROM_EMAIL: '',
    NOTIFY_SMS_SENDER: '',
    PORTAL_URL: '',
    ...extraEnv,
  };
  const child = spawn(process.execPath, [path.join(repo, 'web', 'server.mjs')], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  await new Promise((resolve, reject) => {
    let out = '';
    const onData = (c) => { out += c; if (out.includes('Mission Studio')) resolve(); };
    child.stdout.on('data', onData);
    child.stderr.on('data', (c) => { out += c; });
    child.on('exit', (code) => reject(new Error(`server exited early (${code}): ${out.slice(0, 300)}`)));
  });
  return { base: `http://127.0.0.1:${port}`, db: fake.db };
}

async function call(base, pathname, { method = 'GET', cookie, body, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) { h['content-type'] = 'application/json'; }
  const res = await fetch(`${base}${pathname}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: () => JSON.parse(text) };
}

test('studio with login on: guard, login, cookie, session and logout', async () => {
  const { base } = await startStudio({ STUDIO_LOGIN: 'on' });

  const none = await call(base, '/api/runs');
  assert.equal(none.status, 401);
  assert.deepEqual(none.json(), { error: 'Sign in to continue', code: 'AUTH_REQUIRED' });

  const staticFile = await call(base, '/classic/');
  assert.notEqual(staticFile.status, 401, 'static files are not guarded');

  const badPw = await call(base, '/api/auth/login', { method: 'POST', body: { email: EMAIL, password: 'wrong-password-xx' } });
  assert.equal(badPw.status, 401);
  assert.deepEqual(badPw.json(), { error: 'Email or password is wrong' });

  const good = await call(base, '/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  assert.equal(good.status, 200);
  assert.equal(good.json().staff.email, EMAIL);
  const setCookie = good.headers.get('set-cookie');
  assert.match(setCookie, new RegExp(`^${COOKIE}=tok_[0-9a-f]{32}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200$`));
  const cookie = setCookie.split(';')[0];

  const runs = await call(base, '/api/runs', { cookie });
  assert.equal(runs.status, 200);
  assert.ok(Array.isArray(runs.json()));

  const me = await call(base, '/api/auth/me', { cookie });
  assert.deepEqual(me.json(), { required: true, staff: { id: 'staff-1', email: EMAIL, display_name: 'Coordinator' } });

  const secure = await call(base, '/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD }, headers: { 'x-forwarded-proto': 'https' } });
  assert.match(secure.headers.get('set-cookie'), /; Secure$/);

  const out = await call(base, '/api/auth/logout', { method: 'POST', cookie, body: {} });
  assert.equal(out.status, 200);
  assert.match(out.headers.get('set-cookie'), new RegExp(`^${COOKIE}=; .*Max-Age=0`));
  const after1 = await call(base, '/api/runs', { cookie });
  assert.equal(after1.status, 401, 'a signed-out cookie no longer opens /api');
});

test('studio with STUDIO_LOGIN=off: no guard', async () => {
  const { base } = await startStudio({ STUDIO_LOGIN: 'off' });
  const runs = await call(base, '/api/runs');
  assert.equal(runs.status, 200);
  const me = await call(base, '/api/auth/me');
  assert.deepEqual(me.json(), { required: false, staff: null });
});
