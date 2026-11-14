import { Target } from 'lucide-react';
import { PrefsForm } from '../components/PrefsForm';
import { SkillList } from '../components/SkillList';
import { Card, Empty, Loading, NextStep, Notice, PageTitle } from '../components/ui';
import { usePortal } from '../lib/ctx';
import { nextSkill, shortTime } from '../lib/helpers';
import { FLOW_NOTICE } from '../lib/constants';

export function LearnerHome() {
  const { me, meError, messages } = usePortal();
  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="your skills" />;
  const latest = messages?.[0];
  const next = nextSkill(me.skills);
  return (
    <>
      <PageTitle title={`Hi, ${me.profile.display_name}`} lead="Here is where you are with each skill. Pick one to work on today." />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <section aria-labelledby="skills-h">
          <h2 id="skills-h" className="mb-3 text-[20px] font-bold text-ink">
            Your skills
          </h2>
          <p className="mb-4 text-[14px] text-ink-3">The bar shows your latest score. The line in the bar is the pass mark.</p>
          <SkillList skills={me.skills} />
          {next && (
            <NextStep href={`#/learner/skill/${next.id}`} label={next.latest ? `Work on ${next.name}` : `Start ${next.name}`}>
              {next.latest
                ? `${next.name} is the skill that needs most work (${next.latest.score} out of 100, pass mark ${next.threshold}). A short quiz shows where you are.`
                : `${next.name} has no score yet. A short quiz is the quickest way to start.`}
            </NextStep>
          )}
        </section>
        <aside className="mt-8 space-y-4 lg:mt-0" aria-label="Help, inbox and preferences">
          <Card interactive>
            <h2 className="text-[18px] font-bold text-ink">Ask for help</h2>
            <p className="mt-1 text-[15px] text-ink-2">Say what is hard, in your own words. Skill is optional.</p>
            <p className="mt-2 font-mono text-[13px] text-ink-3">{me.help.length} request(s) sent</p>
            <a
              href="#/learner/help"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-field bg-accent px-4 text-[15px] font-semibold text-white transition-colors hover:bg-accent-ink"
            >
              Ask for help
            </a>
          </Card>
          <Card interactive>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-ink">Latest message</h2>
              <a href="#/learner/inbox" className="text-[14px] font-semibold text-accent-ink hover:underline">
                Open inbox
              </a>
            </div>
            {!messages ? (
              <p className="mt-2 text-[15px] text-ink-3">Loading…</p>
            ) : latest ? (
              <div className="mt-2">
                <p className="font-semibold text-ink">{latest.subject}</p>
                <p className="font-mono text-[13px] text-ink-3">{shortTime(latest.at)}</p>
              </div>
            ) : (
              <p className="mt-2 text-[15px] text-ink-3">No messages yet. Plans and session times appear here after the coordinator approves them.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-1 text-[18px] font-bold text-ink">My preferences</h2>
            <p className="mb-4 text-[14px] text-ink-3">{FLOW_NOTICE}</p>
            <PrefsForm />
          </Card>
        </aside>
      </div>
    </>
  );
}

export function SkillsPage() {
  const { me, meError } = usePortal();
  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="skills" />;
  return (
    <>
      <PageTitle title="Skills" lead="Tap a skill to take its quiz, submit a mark or ask for help with it." />
      {me.skills.length === 0 ? (
        <Empty title="No skills yet.">The workspace has no skills. Ask the coordinator.</Empty>
      ) : (
        <SkillList skills={me.skills} />
      )}
      <p className="mt-6 flex items-center gap-2 text-[14px] text-ink-3">
        <Target size={16} aria-hidden /> Quiz scores are marked by the database. Submitted marks are labelled self-reported.
      </p>
    </>
  );
}
