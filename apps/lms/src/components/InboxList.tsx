import { BookOpen, Brain, CalendarDays, GitBranch, ListOrdered, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { STEP_TITLES } from '../lib/constants';
import { languageName, pickVoice, scoreBar, shortTime } from '../lib/helpers';
import type { Message, MessagePayload, StepType } from '../lib/types';
import { Card, Mono, Notice, ScoreBar } from './ui';

export function InboxList({ messages, onOpen }: { messages: Message[]; onOpen: (m: Message) => void }) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <MessageCard key={m.id} m={m} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function MessageCard({ m, onOpen }: { m: Message; onOpen: (m: Message) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen(m);
  };
  return (
    <li>
      <Card className="p-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-start gap-3 rounded-card p-4 text-left transition-colors hover:bg-sunken"
        >
          <span aria-label={m.read ? 'Read' : 'New'} className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${m.read ? 'bg-transparent' : 'bg-accent'}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-ink">{m.subject}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[13px] text-ink-3">
              <span>{shortTime(m.at)}</span>
              {m.language !== 'en' && <span>{languageName(m.language)}</span>}
            </span>
          </span>
          <span className="mt-1 text-[14px] font-semibold text-accent-ink">{open ? 'Close' : 'Read'}</span>
        </button>
        {open && (
          <div className="space-y-4 border-t border-line p-4">
            <MessageBody m={m} />
          </div>
        )}
      </Card>
    </li>
  );
}

function MessageBody({ m }: { m: Message }) {
  const p = (m.payload ?? {}) as MessagePayload;
  return (
    <>
      {p.reviewer_note && <Notice tone="run">{p.reviewer_note}</Notice>}
      {m.language !== 'en' && p.machine_translated && <Notice tone="info">Machine translation. Ask a fluent speaker if unsure.</Notice>}
      <Listen m={m} />
      {p.session && <SessionCard s={p.session} />}
      {m.format === 'visual' && p.skills && p.skills.length > 0 && (
        <div className="space-y-3">
          <p className="text-[15px] font-semibold text-ink">Where you stand now</p>
          {p.skills.map((s) => {
            const b = scoreBar(s.score, s.threshold);
            return (
              <div key={s.id}>
                <div className="mb-1 flex justify-between text-[15px]">
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="font-mono text-[13px] text-ink-2">
                    {s.score} / pass mark {s.threshold} {b.status === 'ok' ? '· passed' : ''}
                  </span>
                </div>
                <ScoreBar score={s.score} threshold={s.threshold} />
              </div>
            );
          })}
        </div>
      )}
      <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink">{m.body}</p>
      {p.steps && p.steps.length > 0 && <Plan steps={p.steps} />}
    </>
  );
}

// A study plan: for each step, what to work on, why, when, and with whom.
function Plan({ steps }: { steps: NonNullable<MessagePayload['steps']> }) {
  return (
    <div className="space-y-3">
      <p className="text-[16px] font-semibold text-ink">Your study plan</p>
      <ol className="space-y-3">
        {steps.map((step, i) => {
          if (typeof step === 'string') {
            return (
              <li key={i} className="flex gap-3 rounded-field border border-line bg-surface p-3">
                <span className="font-mono text-[14px] text-ink-3">{i + 1}.</span>
                <span className="text-[15px] leading-relaxed text-ink">{step}</span>
              </li>
            );
          }
          const type = step.type as StepType | undefined;
          const Icon = type === 'worked_example' ? BookOpen : type === 'parsons' ? ListOrdered : type === 'retrieval_quiz' ? Brain : GitBranch;
          const kind = (type && STEP_TITLES[type]) || 'Study step';
          const rows: [string, string | undefined][] = [
            ['What to work on', step.title],
            ['Why', step.why],
            ['When', step.when],
            ['With', step.with],
          ];
          return (
            <li key={i} className="rounded-card border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent-ink">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="text-[15px] font-semibold text-ink">
                  Step {i + 1}: {kind}
                </span>
              </div>
              <dl className="space-y-2">
                {rows
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-[15px] leading-relaxed">
                      <dt className="font-semibold text-ink-2">{k}</dt>
                      <dd className="text-ink">{v}</dd>
                    </div>
                  ))}
              </dl>
              {step.body && (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-sunken p-3 font-mono text-[14px] leading-relaxed text-ink">{step.body}</pre>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SessionCard({ s }: { s: NonNullable<MessagePayload['session']> }) {
  return (
    <div className="flex gap-3 rounded-card border border-accent/30 bg-accent-weak p-4">
      <CalendarDays className="mt-0.5 shrink-0 text-accent-ink" size={22} aria-hidden />
      <div className="space-y-1">
        <p className="text-[16px] font-semibold text-ink">Your session{s.mentor ? ` with ${s.mentor}` : ''}</p>
        {(s.day_label || s.day) && <p className="text-[15px] text-ink-2">{s.day_label ?? s.day}</p>}
        {(s.start || s.end) && (
          <Mono>
            {s.start ?? '—'} – {s.end ?? '—'}
          </Mono>
        )}
      </div>
    </div>
  );
}

// Read aloud on request only (never autoplay). Own-language voice if the phone has one, else English with a note.
function Listen({ m }: { m: Message }) {
  const [note, setNote] = useState<string | null>(null);
  const speak = () => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      setNote('Reading aloud is not available in this browser. The text is shown below.');
      return;
    }
    const voices = synth.getVoices();
    const own = pickVoice(voices, m.language);
    const english = own ? null : pickVoice(voices, 'en');
    const voice = own ?? english;
    if (!voice) {
      setNote(`No voice for ${languageName(m.language)} on this phone — showing text`);
      return;
    }
    const u = new SpeechSynthesisUtterance(`${m.subject}. ${m.body}`);
    u.voice = voice;
    u.lang = voice.lang;
    synth.cancel();
    synth.speak(u);
    setNote(english ? 'Read in English voice' : null);
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={speak}
        className="inline-flex min-h-11 items-center gap-2 rounded-field border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink transition-colors hover:border-accent hover:bg-accent-weak"
      >
        <Volume2 size={18} aria-hidden /> Read aloud
      </button>
      {note && <Notice tone="info">{note}</Notice>}
    </div>
  );
}
