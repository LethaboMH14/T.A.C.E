import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/state';
import type { Mission } from '@/state';

// The Goal Reader asked a person one blocking question. The run waits; this card is the only place to answer.
export function QuestionCard({ mission: m }: { mission: Mission }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = m.questions[m.questions.length - 1];
  if (!latest || !m.runId) return null;

  if (latest.answered) {
    return (
      <section className="rounded-card border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2 shadow-card" aria-label="Question answered">
        Answered: <span className="text-ink">{latest.answer}</span>
      </section>
    );
  }

  const send = async (answer: string) => {
    const clean = answer.trim();
    if (!clean || clean.length > 500 || !m.runId) return;
    setSending(true);
    setError(null);
    try {
      await api.answer(m.runId, latest.id, clean);
      setText('');
    } catch {
      setError('This question has expired or the run has moved on. Start a new run to try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      className="rounded-card border border-run-line bg-run-weak p-4 shadow-card"
      aria-labelledby="h-question"
    >
      <h2 id="h-question" className="mb-1.5 text-[15px] font-semibold tracking-[-0.005em] text-run">
        The Goal Reader needs one answer
      </h2>
      <p className="m-0 text-[15px] leading-[1.5] text-ink">{latest.question}</p>
      {latest.whyAsked ? <p className="m-0 mt-1.5 text-[13px] leading-[1.45] text-ink-2">{latest.whyAsked}</p> : null}

      {latest.options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {latest.options.map((o) => (
            <Button key={o.id} variant="outline" disabled={sending} onClick={() => send(o.label)}>
              {o.label}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <label className="sr-only" htmlFor="answer-input">Your answer</label>
          <input
            id="answer-input"
            value={text}
            maxLength={500}
            disabled={sending}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a short answer"
            className="h-9 min-w-0 flex-1 rounded-field border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3"
          />
          <Button type="submit" disabled={sending || !text.trim()}>
            Answer and continue
          </Button>
        </form>
      )}

      {error ? <p role="alert" className="m-0 mt-2.5 text-[13px] text-bad">{error}</p> : null}
    </section>
  );
}
