import { useState } from 'react';
import { HelpForm } from '../components/HelpForm';
import { Button, Card, Loading, Mono, NextStep, Notice, PageTitle, ScoreBar, SourceBadge } from '../components/ui';
import { usePortal } from '../lib/ctx';

type Mode = 'menu' | 'mark' | 'help';

export function SkillSheet({ id }: { id: string }) {
  const { me, meError, call, reloadMe } = usePortal();
  const [mode, setMode] = useState<Mode>('menu');
  const [score, setScore] = useState(60);
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="skill" />;
  const skill = me.skills.find((s) => s.id === id);
  if (!skill) {
    return (
      <div className="py-12 text-center">
        <p className="text-[18px] font-semibold text-ink">No skill called {id}.</p>
        <a href="#/learner/skills" className="mt-3 inline-block text-accent-ink underline">
          Back to skills
        </a>
      </div>
    );
  }

  const saveMark = async () => {
    setBusy(true);
    setNote(null);
    try {
      await call('lms_submit_mark', { p_skill: skill.id, p_score: score, p_minutes: minutes });
      await reloadMe();
      setMode('menu');
      setNote({ tone: 'ok', text: `Saved as self-reported: ${score} out of 100.` });
    } catch (e) {
      setNote({ tone: 'bad', text: e instanceof Error ? e.message : 'Could not save the mark.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <a href="#/learner/skills" className="mb-4 inline-block rounded-field px-2 py-1 text-[15px] font-medium text-accent-ink hover:bg-accent-weak">
        ← All skills
      </a>
      <PageTitle title={skill.name} />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <Mono>{skill.id}</Mono>
            {skill.latest ? <SourceBadge source={skill.latest.source} /> : <span className="text-[14px] text-ink-3">no score yet</span>}
          </div>
          <div className="mt-4">
            <ScoreBar score={skill.latest?.score ?? null} threshold={skill.threshold} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Latest" value={skill.latest ? `${skill.latest.score}` : '—'} />
            <Stat label="Pass line" value={`${skill.threshold}`} />
            <Stat label="Minutes" value={skill.latest ? `${skill.latest.minutes}` : '—'} />
          </dl>
        </Card>

        <Card className="mt-4 lg:mt-0">
          {note && <div className="mb-4"><Notice tone={note.tone === 'ok' ? 'ok' : 'bad'}>{note.text}</Notice></div>}
          {mode === 'menu' && (
            <div className="grid gap-3">
              <a
                href={`#/learner/quiz/${skill.id}`}
                className="flex min-h-14 items-center justify-center rounded-field bg-accent px-4 text-[16px] font-semibold text-white transition-colors hover:bg-accent-ink"
              >
                Take the 3-question quiz
              </a>
              <Button onClick={() => setMode('mark')} className="min-h-14 text-[16px]">
                Submit a mark
              </Button>
              <Button onClick={() => setMode('help')} className="min-h-14 text-[16px]">
                Ask for help with this
              </Button>
            </div>
          )}
          {mode === 'mark' && (
            <div className="space-y-5">
              <div>
                <Notice tone="run">Self-reported for the demo. A submitted mark is not a marked quiz.</Notice>
              </div>
              <div>
                <label htmlFor="score" className="flex justify-between text-[15px] font-semibold text-ink">
                  Your score <span className="font-mono">{score} / 100</span>
                </label>
                <input
                  id="score"
                  type="range"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="mt-3 h-11 w-full accent-[var(--accent)]"
                />
              </div>
              <div>
                <p className="mb-2 text-[15px] font-semibold text-ink">Minutes spent</p>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setMinutes((m) => Math.max(0, m - 5))} aria-label="Minus 5 minutes" className="min-h-12 min-w-12 px-0">
                    −5
                  </Button>
                  <span className="min-w-16 text-center font-mono text-[22px] text-ink" aria-live="polite">
                    {minutes}
                  </span>
                  <Button onClick={() => setMinutes((m) => Math.min(600, m + 5))} aria-label="Plus 5 minutes" className="min-h-12 min-w-12 px-0">
                    +5
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => setMode('menu')} className="min-h-12">
                  Cancel
                </Button>
                <Button variant="primary" onClick={saveMark} disabled={busy} className="min-h-12">
                  {busy ? 'Saving…' : 'Save mark'}
                </Button>
              </div>
            </div>
          )}
          {mode === 'help' && (
            <div className="space-y-4">
              <HelpForm skill={{ id: skill.id, name: skill.name }} />
              <Button onClick={() => setMode('menu')} className="w-full">
                Back
              </Button>
            </div>
          )}
        </Card>
      </div>
      <NextStep href={`#/learner/quiz/${skill.id}`} label="Take the quiz">
        {skill.latest
          ? 'Take the short quiz to see where you are now. Your score is marked for you.'
          : 'Take the short quiz to get your first score. It takes a few minutes.'}
      </NextStep>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-field bg-sunken p-2">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="font-mono text-[18px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
