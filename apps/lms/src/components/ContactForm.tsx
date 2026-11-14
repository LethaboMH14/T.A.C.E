import { useState } from 'react';
import { usePortal } from '../lib/ctx';
import { Button, Notice } from './ui';

// Opt-in only: no contact is stored unless the person ticks consent here.
export function ContactForm() {
  const { me, call, reloadMe } = usePortal();
  const saved = me?.contact ?? null;
  const [email, setEmail] = useState(saved?.email ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      await reloadMe();
      setNote({ tone: 'ok', text: ok });
    } catch (e) {
      // Server error text is shown as it comes back.
      setNote({ tone: 'bad', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      setConsent(false);
      await call('lms_set_contact', { p_email: email.trim() || null, p_phone: phone.trim() || null, p_consent: true });
    }, 'Saved. We will send a short notice that points you to this portal.');

  const remove = () =>
    run(async () => {
      await call('lms_set_contact', { p_email: null, p_phone: null, p_consent: false });
      setEmail('');
      setPhone('');
    }, 'Removed. No contact details are stored.');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-bold text-ink">Get a notice when a new plan arrives</h2>
        <p className="mt-1 text-[14px] text-ink-3">Optional. Add an email, a South African mobile number, or both.</p>
      </div>
      {saved && (
        <Notice tone="info">
          <span className="block">Stored: {saved.email ?? 'no email'} · {saved.phone ?? 'no mobile'}</span>
          {saved.consent_at && <span className="block font-mono text-[13px]">Consent given {saved.consent_at}</span>}
        </Notice>
      )}
      <div>
        <label htmlFor="c-email" className="mb-2 block text-[15px] font-semibold text-ink">
          Email
        </label>
        <input
          id="c-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-3 text-[16px] text-ink transition-colors hover:border-accent placeholder:text-ink-3"
        />
      </div>
      <div>
        <label htmlFor="c-phone" className="mb-2 block text-[15px] font-semibold text-ink">
          Mobile
        </label>
        <input
          id="c-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="082 123 4567 or +27 82 123 4567"
          className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-3 text-[16px] text-ink transition-colors hover:border-accent placeholder:text-ink-3"
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-field p-1 text-[15px] leading-relaxed text-ink-2 hover:bg-sunken">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span>I agree to receive a short notice that points me to this portal. You can remove this any time.</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="primary" onClick={save} disabled={!consent || busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="danger" onClick={remove} disabled={busy || !saved}>
          Remove
        </Button>
      </div>
      {note && <Notice tone={note.tone === 'ok' ? 'ok' : 'bad'}>{note.text}</Notice>}
    </div>
  );
}
