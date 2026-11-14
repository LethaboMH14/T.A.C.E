import { Mic, MicOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { AI_NOTICE, HELP_CATEGORIES } from '../lib/constants';
import { usePortal } from '../lib/ctx';
import { recognitionLang } from '../lib/helpers';
import type { HelpCategory } from '../lib/types';
import { Button, Notice } from './ui';

// Web Speech API (SpeechRecognition / webkitSpeechRecognition). Typed locally: not every browser ships these types.
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechCtor = new () => SpeechRec;

export function speechCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Ask for help. Pass `skill` to fix the skill; omit it to let the learner choose one (or none).
export function HelpForm({ skill }: { skill?: { id: string; name: string } }) {
  const { me, call, reloadMe } = usePortal();
  const [chosen, setChosen] = useState<string>(skill?.id ?? '');
  const [category, setCategory] = useState<HelpCategory>('concept');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const trimmed = text.trim();
  const valid = trimmed.length >= 1 && text.length <= 500;

  const [voiceSupported] = useState(() => speechCtor() !== null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = recognitionLang(me?.profile.prefs.language);
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (said) setText((t) => (t ? `${t} ${said}` : said).slice(0, 500));
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      setNote({ tone: 'bad', text: `Voice input stopped (${e.error}). You can type instead.` });
    };
    recRef.current = rec;
    setNote(null);
    rec.start();
    setListening(true);
  };

  const send = async () => {
    setBusy(true);
    setNote(null);
    try {
      await call('lms_request_help', { p_skill: skill ? skill.id : chosen, p_category: category, p_text: trimmed });
      await reloadMe();
      setText('');
      setNote({ tone: 'ok', text: 'Request saved. Your coordinator will see it in T.A.C.E.' });
    } catch (e) {
      setNote({ tone: 'bad', text: e instanceof Error ? e.message : 'Could not send.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!skill && (
        <div>
          <p id="skill-label" className="mb-2 text-[15px] font-semibold text-ink">
            Which skill? <span className="font-normal text-ink-3">(optional)</span>
          </p>
          <div role="radiogroup" aria-labelledby="skill-label" className="flex flex-wrap gap-2">
            {[{ id: '', name: 'No specific skill' }, ...(me?.skills ?? [])].map((s) => (
              <Chip key={s.id || 'none'} selected={chosen === s.id} onClick={() => setChosen(s.id)} label={s.name} />
            ))}
          </div>
        </div>
      )}
      <div>
        <p id="cat-label" className="mb-2 text-[15px] font-semibold text-ink">
          What kind of help?
        </p>
        <div role="radiogroup" aria-labelledby="cat-label" className="flex flex-wrap gap-2">
          {HELP_CATEGORIES.map((c) => (
            <Chip key={c.code} selected={category === c.code} onClick={() => setCategory(c.code)} label={c.name} />
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="help-text" className="mb-2 block text-[15px] font-semibold text-ink">
          Tell us in your own words
        </label>
        <textarea
          id="help-text"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="For example: loops confuse me when the stop value is missing."
          className="w-full rounded-field border border-line-strong bg-surface p-3 text-[16px] leading-relaxed text-ink transition-colors hover:border-accent placeholder:text-ink-3"
        />
        {voiceSupported && (
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={listening}
              className={`inline-flex min-h-11 items-center gap-2 rounded-field border px-4 text-[15px] font-semibold transition-colors ${
                listening ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-weak'
              }`}
            >
              {listening ? <MicOff size={18} aria-hidden /> : <Mic size={18} aria-hidden />}
              {listening ? 'Listening… tap to stop' : 'Speak your request'}
            </button>
            {listening && <Notice tone="info">Your words appear in the box. Check and edit them before you send.</Notice>}
          </div>
        )}
        <div className="mt-1 flex justify-between text-[13px] text-ink-3">
          <span>{AI_NOTICE}</span>
          <span className="shrink-0 pl-3 font-mono" aria-live="polite">
            {text.length}/500
          </span>
        </div>
      </div>
      <Button variant="primary" onClick={send} disabled={busy || !valid} className="w-full">
        {busy ? 'Sending…' : 'Send request'}
      </Button>
      {note && <Notice tone={note.tone === 'ok' ? 'ok' : 'bad'}>{note.text}</Notice>}
    </div>
  );
}

function Chip({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-[15px] font-medium transition-colors ${
        selected ? 'border-accent bg-accent-weak text-accent-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}
