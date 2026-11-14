import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Loading, NextStep, Notice, PageTitle } from '../components/ui';
import { isRelogin } from '../lib/api';
import { usePortal } from '../lib/ctx';
import { formatClock, minutesBetween } from '../lib/helpers';
import type { QuizQuestion, QuizResult } from '../lib/types';

type Phase = 'loading' | 'answering' | 'submitting' | 'done' | 'error';

// One question per card. Keys 1-4 pick an option, Enter moves on (or submits after the last question).
export function Quiz({ id }: { id: string }) {
  const { call, reloadMe, skillName } = useQuizSkill(id);
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    call<QuizQuestion[]>('lms_quiz', { p_skill: id })
      .then((qs) => {
        const sorted = [...qs].sort((a, b) => a.id.localeCompare(b.id));
        setQuestions(sorted);
        setAnswers(sorted.map(() => null));
        const t = Date.now();
        setStartedAt(t);
        setNow(t);
        setPhase(sorted.length ? 'answering' : 'error');
        if (!sorted.length) setError('This skill has no quiz questions yet.');
      })
      .catch((e: unknown) => {
        if (!isRelogin(e)) setError(e instanceof Error ? e.message : 'Could not load the quiz.');
        setPhase('error');
      });
  }, [call, id]);

  // Live timer that measures real minutes while answering.
  useEffect(() => {
    if (phase !== 'answering') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const q = questions[index];
  const answered = answers.filter((a) => a !== null).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  const submit = async () => {
    if (!allAnswered || phase !== 'answering') return;
    setPhase('submitting');
    setError(null);
    try {
      const minutes = minutesBetween(startedAt, Date.now());
      const r = await call<QuizResult>('lms_submit_quiz', { p_skill: id, p_answers: answers, p_minutes: minutes });
      setResult(r);
      setPhase('done');
      void reloadMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
      setPhase('answering');
    }
  };

  const next = () => {
    if (index < questions.length - 1) setIndex(index + 1);
    else void submit();
  };

  const pick = (i: number) => {
    if (phase !== 'answering') return;
    setAnswers((prev) => prev.map((a, k) => (k === index ? i : a)));
  };

  // Keyboard: 1 to 4 pick, Enter moves on or submits.
  useEffect(() => {
    if (phase !== 'answering' || !q) return;
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        if (n < q.options.length) pick(n);
      } else if (e.key === 'Enter' && answers[index] !== null) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const review = useMemo(() => {
    if (!result) return [];
    return result.review.map((r) => ({ ...r, question: questions.find((x) => x.id === r.id) }));
  }, [result, questions]);

  if (phase === 'loading') return <Loading what="quiz" />;

  if (phase === 'done' && result) {
    const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
    return (
      <>
        <PageTitle title={`${skillName ?? id}: your result`} />
        <div className="mx-auto max-w-2xl space-y-4">
          <Card>
            <p className="font-mono text-[40px] font-semibold text-ink">{result.score}</p>
            <p className="text-[16px] text-ink-2">
              {result.correct} of {result.total} right ({pct}%). Marked by the database.
            </p>
          </Card>
          {review.map((r, n) => (
            <Card key={r.id}>
              <p className="font-mono text-[13px] text-ink-3">Question {n + 1}</p>
              <p className="mt-1 text-[17px] font-semibold text-ink">{r.question?.prompt ?? r.id}</p>
              <p className={`mt-2 text-[15px] font-semibold ${r.your === r.right ? 'text-ok' : 'text-bad'}`}>
                {r.your === r.right ? 'Right' : 'Not quite'}
              </p>
              {r.your !== r.right && (
                <p className="mt-1 text-[15px] text-ink-2">
                  Your answer: {r.question?.options[r.your] ?? r.your}. Right answer: {r.question?.options[r.right] ?? r.right}.
                </p>
              )}
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{r.explanation}</p>
            </Card>
          ))}
          <NextStep href={`#/learner/skill/${id}`} label="Back to the skill">
            {result.correct === result.total
              ? 'All right. Ask for help with anything you want to go deeper on, or move on to the next skill.'
              : 'Read the explanations above, then ask for help with any question that was still hard.'}
          </NextStep>
        </div>
      </>
    );
  }

  if (phase === 'error' || !q) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Notice tone="bad">{error ?? 'The quiz could not load.'}</Notice>
        <a href={`#/learner/skill/${id}`} className="inline-block text-accent-ink underline">
          Back to the skill
        </a>
      </div>
    );
  }

  const elapsed = startedAt ? now - startedAt : 0;
  const last = index === questions.length - 1;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <a href={`#/learner/skill/${id}`} className="rounded-field px-2 py-1 text-[15px] font-medium text-accent-ink hover:bg-accent-weak">
          ← Leave quiz
        </a>
        <p className="font-mono text-[18px] text-ink" aria-label={`Time on quiz ${formatClock(elapsed)}`}>
          ⏱ {formatClock(elapsed)}
        </p>
      </div>
      <PageTitle title={skillName ?? id} lead={`Question ${index + 1} of ${questions.length}. ${answered} answered.`} />
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-300 ease-studio" style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>
      <Card className="p-6 lg:p-8">
        <p className="text-[20px] font-semibold leading-snug text-ink lg:text-[22px]">{q.prompt}</p>
        <div role="radiogroup" aria-label="Options" className="mt-6 grid gap-3">
          {q.options.map((opt, i) => {
            const on = answers[index] === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(i)}
                disabled={phase !== 'answering'}
                className={`flex min-h-14 items-center gap-4 rounded-field border px-4 py-3 text-left text-[17px] transition-colors ${
                  on ? 'border-accent bg-accent-weak text-accent-ink' : 'border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-weak/60'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-[14px] ${on ? 'border-accent bg-accent text-white' : 'border-line-strong text-ink-3'}`}>
                  {i + 1}
                </span>
                <span className="font-mono text-[16px]">{opt}</span>
              </button>
            );
          })}
        </div>
        {error && (
          <div className="mt-4">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0 || phase !== 'answering'} className="min-h-12">
            Previous
          </Button>
          {last ? (
            <Button variant="primary" onClick={submit} disabled={!allAnswered || phase !== 'answering'} className="min-h-12 min-w-40">
              {phase === 'submitting' ? 'Submitting…' : 'Submit quiz'}
            </Button>
          ) : (
            <Button variant="primary" onClick={next} disabled={answers[index] === null} className="min-h-12 min-w-40">
              Next
            </Button>
          )}
        </div>
        <p className="mt-5 text-center text-[13px] text-ink-3">Keys 1 to 4 pick an option. Enter goes on.</p>
      </Card>
    </div>
  );
}

// The quiz screen needs the skill's name and the portal call. Both come from the portal context.
function useQuizSkill(id: string) {
  const ctx = usePortal();
  const skillName = ctx.me?.skills.find((s) => s.id === id)?.name;
  return { call: ctx.call, reloadMe: ctx.reloadMe, skillName };
}
