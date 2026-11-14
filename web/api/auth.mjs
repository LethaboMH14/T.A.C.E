// T.A.C.E coordinator sign-in for the Studio server. Accounts live in the LMS database (lms_staff_* RPCs).
//   POST /api/auth/login   {email, password} -> sets the tace_staff cookie, returns {staff}
//   GET  /api/auth/me      -> {required, staff|null}
//   POST /api/auth/logout  {} -> clears the cookie and ends the database session
// createStaffGate() is the guard server.mjs runs before every other /api route. Static files stay unguarded.
import { createHash } from 'node:crypto';
import { createLmsClient } from '../../engine/lms.mjs';

export const COOKIE = 'tace_staff';
const MAX_AGE_S = 43200;
const CACHE_MS = 60000;
const TOKEN_RE = /^[A-Za-z0-9._~+/=-]{8,512}$/;
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const isHttps = (req) => !!req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
const sessionCookie = (req, token) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_S}${isHttps(req) ? '; Secure' : ''}`;
const clearedCookie = (req) => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
const isWrongLogin = (err) => err.code === 'LMS_HTTP' && /Email or password is wrong/.test(err.message);
const isSignedOut = (err) => err.code === 'LMS_HTTP' && /Please sign in again/.test(err.message);
const publicStaff = (s) => ({ id: s.id, email: s.email, display_name: s.display_name });

/**
 * @param {object} [env]  environment (defaults to process.env). STUDIO_LOGIN=off turns the guard off.
 * @param {{lms?: ReturnType<typeof createLmsClient>, now?: () => number}} [opts]
 */
export function createStaffGate(env = process.env, { lms = createLmsClient(env), now = () => Date.now() } = {}) {
  // Login is required only when the LMS is configured. Without it there is no account database to check against.
  const required = lms.configured && env.STUDIO_LOGIN !== 'off';
  const cache = new Map(); // sha256(token) -> {staff, until}. Raw tokens are never kept as keys or logged.

  /** The session token from the request cookie, or null when absent or malformed. */
  function cookieToken(req) {
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === COOKIE) {
        const v = part.slice(i + 1).trim();
        return TOKEN_RE.test(v) ? v : null;
      }
    }
    return null;
  }

  /** The staff row for a session token, or null when the database says the session is over. Other errors throw. */
  async function staffFor(token) {
    const key = sha256(token);
    const hit = cache.get(key);
    if (hit && hit.until > now()) return hit.staff;
    let row;
    try {
      row = await lms.rpc('lms_staff_me', { p_token: token });
    } catch (err) {
      if (isSignedOut(err)) return null;
      throw err;
    }
    if (!row || typeof row.email !== 'string') throw Object.assign(new Error('lms_staff_me returned no staff row'), { code: 'AUTH_CHECK_FAILED' });
    const exp = Date.parse(row.expires_at);
    const until = Math.min(now() + CACHE_MS, Number.isFinite(exp) ? exp : Infinity);
    const staff = publicStaff(row);
    cache.set(key, { staff, until });
    return staff;
  }

  /** Drop a cached session (used on logout so a signed-out token is not trusted for another 60 s). */
  function forget(token) {
    cache.delete(sha256(token));
  }

  /** Guard for every /api route except /api/auth. Returns {ok:true, staff} or {ok:false, status, body}. */
  async function check(req) {
    if (!required) return { ok: true, staff: null };
    try {
      const token = cookieToken(req);
      const staff = token ? await staffFor(token) : null;
      if (staff) return { ok: true, staff };
      return { ok: false, status: 401, body: { error: 'Sign in to continue', code: 'AUTH_REQUIRED' } };
    } catch (err) {
      // Fail closed: if the database cannot confirm the session, nothing under /api is served.
      return { ok: false, status: 503, body: { error: `sign-in check failed: ${err.message}`, code: 'AUTH_CHECK_FAILED' } };
    }
  }

  return { required, lms, cookieToken, staffFor, forget, check };
}

async function login(req, res, ctx, gate) {
  const body = await ctx.readJson(req, res, 2048);
  if (body === null) return;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password || email.length > 254 || password.length > 200) return ctx.send(res, 400, { error: 'send email and password' });
  let out;
  try {
    out = await gate.lms.rpc('lms_staff_login', { p_email: email, p_password: password });
  } catch (err) {
    if (isWrongLogin(err)) return ctx.send(res, 401, { error: 'Email or password is wrong' });
    return ctx.send(res, 503, { error: err.message, code: 'AUTH_CHECK_FAILED' });
  }
  if (!out || typeof out.token !== 'string' || !out.staff) return ctx.send(res, 502, { error: 'sign-in returned no session' });
  if (!TOKEN_RE.test(out.token)) return ctx.send(res, 502, { error: 'sign-in returned a session token that a cookie cannot carry' });
  res.setHeader('set-cookie', sessionCookie(req, out.token));
  return ctx.send(res, 200, { staff: publicStaff(out.staff) });
}

async function me(req, res, ctx, gate) {
  if (!gate.required) return ctx.send(res, 200, { required: false, staff: null });
  try {
    const token = gate.cookieToken(req);
    const staff = token ? await gate.staffFor(token) : null;
    return ctx.send(res, 200, { required: true, staff });
  } catch (err) {
    return ctx.send(res, 503, { error: err.message, code: 'AUTH_CHECK_FAILED' });
  }
}

async function logout(req, res, ctx, gate) {
  const body = await ctx.readJson(req, res, 1024);
  if (body === null) return;
  const token = gate.cookieToken(req);
  res.setHeader('set-cookie', clearedCookie(req));
  if (!token) return ctx.send(res, 200, { ok: true });
  gate.forget(token);
  try {
    await gate.lms.rpc('lms_staff_logout', { p_token: token });
  } catch (err) {
    return ctx.send(res, 502, { error: err.message });
  }
  return ctx.send(res, 200, { ok: true });
}

// API route module: server.mjs loads every web/api/*.mjs. ctx.staffGate is the gate from createStaffGate().
export async function handle(req, res, url, parts, ctx) {
  if (parts[0] !== 'api' || parts[1] !== 'auth') return false;
  const gate = ctx.staffGate;
  const route = parts.slice(2).join('/');
  if (req.method === 'POST' && route === 'login') await login(req, res, ctx, gate);
  else if (req.method === 'GET' && route === 'me') await me(req, res, ctx, gate);
  else if (req.method === 'POST' && route === 'logout') await logout(req, res, ctx, gate);
  else ctx.send(res, 404, { error: 'unknown auth endpoint' });
  return true;
}
