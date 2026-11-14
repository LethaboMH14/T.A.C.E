import { useEffect, useState } from 'react';
import { FORMATS, LANGUAGES } from '../lib/constants';
import { usePortal } from '../lib/ctx';
import type { Format, Lang } from '../lib/types';
import { Button, Notice } from './ui';

export function PrefsForm() {
  const { me, call, reloadMe } = usePortal();
  const saved = me?.profile.prefs;
  const [format, setFormat] = useState<Format>(saved?.format ?? 'text');
  const [language, setLanguage] = useState<Lang>(saved?.language ?? 'en');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    if (saved) {
      setFormat(saved.format);
      setLanguage(saved.language);
    }
  }, [saved?.format, saved?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      await call('lms_set_prefs', { p_format: format, p_language: language });
      await reloadMe();
      setNote({ tone: 'ok', text: 'Saved. Your next messages use these settings.' });
    } catch (e) {
      setNote({ tone: 'bad', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p id="fmt-label" className="mb-2 text-[15px] font-semibold text-ink">
          How should plans and messages look?
        </p>
        <div role="radiogroup" aria-labelledby="fmt-label" className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.code}
              type="button"
              role="radio"
              aria-checked={format === f.code}
              onClick={() => setFormat(f.code)}
              className={`min-h-11 rounded-field border px-3 text-[15px] font-semibold transition-colors ${
                format === f.code ? 'border-accent bg-accent-weak text-accent-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-ink'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="lang" className="mb-2 block text-[15px] font-semibold text-ink">
          Language
        </label>
        <select
          id="lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Lang)}
          className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-3 text-[16px] text-ink transition-colors hover:border-accent"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <Button variant="primary" onClick={save} disabled={busy} className="w-full">
        {busy ? 'Saving…' : 'Save preferences'}
      </Button>
      {note && <Notice tone={note.tone === 'ok' ? 'ok' : 'bad'}>{note.text}</Notice>}
    </div>
  );
}
