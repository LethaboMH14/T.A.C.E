// T.A.C.E domain-neutral LMS client: calls named RPC functions on a Supabase-style backend.
// Config comes only from the environment (LMS_URL, LMS_PUBLISHABLE_KEY, LMS_ADMIN_TOKEN).
// Secrets are never logged, never returned, and are scrubbed from any error text.

const FN_RE = /^[a-z][a-z0-9_]{0,63}$/;

function lmsError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/** Read the three LMS settings from an environment object. Values are never printed. */
export function lmsConfig(env = process.env) {
  const url = String(env.LMS_URL || '').trim().replace(/\/+$/, '');
  return {
    url,
    publishableKey: String(env.LMS_PUBLISHABLE_KEY || '').trim(),
    adminToken: String(env.LMS_ADMIN_TOKEN || '').trim(),
  };
}

/**
 * @param {object} [env]          environment (defaults to process.env)
 * @param {{fetchImpl?: typeof fetch, timeoutMs?: number}} [opts]
 */
export function createLmsClient(env = process.env, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const cfg = lmsConfig(env);
  const configured = !!(cfg.url && cfg.publishableKey);
  const adminConfigured = configured && !!cfg.adminToken;
  const secrets = [cfg.publishableKey, cfg.adminToken].filter((s) => s.length >= 8);
  // Backend error text is shown only after every secret value has been removed from it.
  const scrub = (text) => secrets.reduce((t, s) => t.split(s).join('[redacted]'), String(text ?? ''));

  /** Call one RPC. args are sent as the JSON body (named arguments). Returns the parsed JSON body. */
  async function rpc(fn, args = {}) {
    if (!configured) throw lmsError('LMS_NOT_CONFIGURED', 'LMS is not configured (set LMS_URL and LMS_PUBLISHABLE_KEY in .env)');
    if (!FN_RE.test(fn)) throw lmsError('LMS_BAD_FUNCTION', `bad RPC name: ${fn}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${cfg.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: cfg.publishableKey, 'content-type': 'application/json' },
        body: JSON.stringify(args ?? {}),
        signal: ctrl.signal,
      });
    } catch (err) {
      const reason = err?.name === 'AbortError' ? 'timed out' : 'network error';
      throw lmsError('LMS_UNREACHABLE', `${fn}: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body && typeof body.message === 'string' ? `: ${scrub(body.message).slice(0, 200)}` : '';
      throw lmsError('LMS_HTTP', `${fn}: HTTP ${res.status}${msg}`, { status: res.status, fn });
    }
    return body;
  }

  /** Call an admin RPC. The admin token is added server-side from the environment, never by the caller. */
  async function admin(fn, args = {}) {
    if (!adminConfigured) throw lmsError('LMS_ADMIN_NOT_CONFIGURED', 'LMS admin is not configured (set LMS_ADMIN_TOKEN in .env)');
    return rpc(fn, { p_admin: cfg.adminToken, ...args });
  }

  return { configured, adminConfigured, url: cfg.url, rpc, admin, scrub };
}
