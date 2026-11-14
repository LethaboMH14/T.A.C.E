// T.A.C.E "check your portal" notifications through Brevo (email and SMS).
// Opt-in only: the caller passes only the people the database says opted in (lms_admin_contacts).
// Fixed text: no plan content and no other people's names. Counts only leave this module; never addresses.
// Request shapes are quoted in docs/NOTIFICATIONS.md (developers.brevo.com).
// Config comes only from the environment. Secrets are never logged, never returned, and scrubbed from error text.

const EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const SMS_URL = 'https://api.brevo.com/v3/transactionalSMS/sms';
const SMS_MAX = 160;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENDER_RE = /^[A-Za-z0-9]{1,11}$/;
const PHONE_RE = /^\+?\d{6,15}$/;
const CODE_RE = /^[a-z_]{1,40}$/;
const CHANNELS = ['email', 'sms'];

export const NOTIFY_SUBJECT = 'New message in your learning portal';

function notifyError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/** The fixed message. Only the person's own display name and the portal address go in it. */
export function notificationText({ displayName, portalUrl }) {
  if (!displayName) throw notifyError('NO_DISPLAY_NAME', 'a recipient has no display name in the snapshot');
  if (!portalUrl) throw notifyError('PORTAL_URL_MISSING', 'PORTAL_URL is not set (the message must say where to sign in)');
  const email = `Hi ${displayName}, you have a new plan waiting in your learning portal. Open ${portalUrl} and sign in to read it.`;
  const sms = `Hi ${displayName}, you have a new plan in your learning portal. Open ${portalUrl} and sign in to read it.`;
  if (sms.length > SMS_MAX) throw notifyError('SMS_TOO_LONG', `SMS text is ${sms.length} characters; the limit is ${SMS_MAX}`);
  return { subject: NOTIFY_SUBJECT, email, sms };
}

/**
 * @param {object} [env]  environment (defaults to process.env)
 * @param {{fetchImpl?: typeof fetch, timeoutMs?: number, retryDelayMs?: number}} [opts]
 */
export function createNotifier(env = process.env, { fetchImpl = globalThis.fetch, timeoutMs = 10000, retryDelayMs = 1000 } = {}) {
  const apiKey = String(env.BREVO_API_KEY || '').trim();
  const fromEmail = String(env.NOTIFY_FROM_EMAIL || '').trim();
  const fromName = String(env.NOTIFY_FROM_NAME || '').trim() || 'Learning Portal';
  const smsSender = String(env.NOTIFY_SMS_SENDER || '').trim();
  const portalUrl = String(env.PORTAL_URL || '').trim().replace(/\/+$/, '') || null;
  if (fromEmail && !EMAIL_RE.test(fromEmail)) throw notifyError('CONFIG_FROM_EMAIL', 'NOTIFY_FROM_EMAIL is not an email address');
  if (smsSender && !SENDER_RE.test(smsSender)) throw notifyError('CONFIG_SMS_SENDER', 'NOTIFY_SMS_SENDER must be 1 to 11 letters or digits');

  const secrets = [apiKey].filter((s) => s.length >= 8);
  // Backend error text is shown only after every secret value has been removed from it.
  const scrub = (text) => secrets.reduce((t, s) => t.split(s).join('[redacted]'), String(text ?? ''));
  const connected = {
    email: !!apiKey && !!fromEmail,
    sms: !!apiKey && !!smsSender,
  };

  /** POST one JSON body to Brevo. One retry on 429 or 5xx. Returns the parsed JSON response. */
  async function post(url, body, what) {
    for (let attempt = 1; ; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (err) {
        const code = err?.name === 'AbortError' ? 'NOTIFY_TIMEOUT' : 'NOTIFY_UNREACHABLE';
        throw notifyError(code, `${what}: ${code === 'NOTIFY_TIMEOUT' ? 'timed out' : 'network error'}`);
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) return res.json().catch(() => null);
      if ((res.status === 429 || res.status >= 500) && attempt === 1) {
        await res.arrayBuffer().catch(() => {});
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      // Brevo's message can echo the recipient, so only its short error code is kept.
      const detail = await res.json().catch(() => null);
      const brevoCode = detail && CODE_RE.test(String(detail.code ?? '')) ? `: ${detail.code}` : '';
      throw notifyError('NOTIFY_HTTP', scrub(`${what}: HTTP ${res.status}${brevoCode}`), { status: res.status });
    }
  }

  function requireConnected(channel) {
    if (!connected[channel]) {
      const need = channel === 'email' ? 'BREVO_API_KEY and NOTIFY_FROM_EMAIL' : 'BREVO_API_KEY and NOTIFY_SMS_SENDER';
      throw notifyError('NOT_CONNECTED', `${channel} is not connected (set ${need} in .env)`);
    }
  }

  /** @param {{to: string, subject: string, text: string}} msg */
  async function sendEmail({ to, subject, text }) {
    requireConnected('email');
    const address = String(to ?? '').trim();
    if (!EMAIL_RE.test(address)) throw notifyError('BAD_ADDRESS', 'recipient is not an email address');
    if (!subject || !text) throw notifyError('EMPTY_MESSAGE', 'subject and text are required');
    await post(EMAIL_URL, {
      sender: { email: fromEmail, name: fromName },
      to: [{ email: address }],
      subject,
      textContent: text,
    }, 'email');
    return { ok: true };
  }

  /** @param {{to: string, text: string}} msg */
  async function sendSms({ to, text }) {
    requireConnected('sms');
    const phone = String(to ?? '').replace(/[\s()-]/g, '');
    if (!PHONE_RE.test(phone)) throw notifyError('BAD_PHONE', 'recipient is not a phone number in international form');
    if (!text || text.length > SMS_MAX) throw notifyError('SMS_TOO_LONG', `SMS text must be 1 to ${SMS_MAX} characters`);
    await post(SMS_URL, {
      sender: smsSender,
      recipient: phone,
      content: text,
      type: 'transactional',
      unicodeEnabled: !/^[\x00-\x7F]*$/.test(text),
    }, 'sms');
    return { ok: true };
  }

  function status() {
    return {
      email: { connected: connected.email, provider: 'brevo' },
      sms: { connected: connected.sms, provider: 'brevo' },
    };
  }

  return { status, sendEmail, sendSms, portalUrl };
}

/** Run fn over items with at most `limit` in flight. fn must not throw. */
async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

/**
 * Send the portal message to each person, `concurrency` at a time. people: [{displayName, email, phone}] (null when not opted in).
 * Returns counts and error codes only. Result keys are sorted so the output is deterministic.
 */
export async function notifyRecipients(notifier, people, { concurrency = 5 } = {}) {
  const st = notifier.status();
  const counts = { email: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0 } };
  const errors = { email: {}, sms: {} };
  const jobs = [];
  for (const p of people) {
    const text = notificationText({ displayName: p.displayName, portalUrl: notifier.portalUrl });
    if (st.email.connected && p.email) jobs.push({ channel: 'email', p, text });
    if (st.sms.connected && p.phone) jobs.push({ channel: 'sms', p, text });
  }
  await mapLimit(jobs, concurrency, async ({ channel, p, text }) => {
    try {
      if (channel === 'email') await notifier.sendEmail({ to: p.email, subject: text.subject, text: text.email });
      else await notifier.sendSms({ to: p.phone, text: text.sms });
      counts[channel].sent += 1;
    } catch (err) {
      counts[channel].failed += 1;
      const code = err.code || 'ERROR';
      errors[channel][code] = (errors[channel][code] || 0) + 1;
    }
  });
  for (const ch of CHANNELS) errors[ch] = Object.fromEntries(Object.entries(errors[ch]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { counts, errors };
}
