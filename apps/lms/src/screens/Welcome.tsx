import { GraduationCap, Users, UserPlus } from 'lucide-react';
import { AI_NOTICE, FLOW_NOTICE } from '../lib/constants';
import { Public } from '../components/Public';
import { Card } from '../components/ui';

export function Welcome() {
  return (
    <Public>
      <header className="mb-6">
        <h1 className="text-[30px] font-bold leading-tight text-ink lg:text-[40px]">T.A.C.E Learner Portal</h1>
        <p className="mt-1 text-[17px] text-ink-2">Coding Bootcamp, Week 4</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <a
          href="#/pick/learner"
          className="flex min-h-24 items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-accent hover:shadow-lift"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent-ink">
            <GraduationCap size={24} aria-hidden />
          </span>
          <span>
            <span className="block text-[20px] font-semibold text-ink">I&rsquo;m a learner</span>
            <span className="text-[15px] text-ink-3">Take a quiz, see your skills, ask for help</span>
          </span>
        </a>
        <a
          href="#/pick/mentor"
          className="flex min-h-24 items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-accent hover:shadow-lift"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent-ink">
            <Users size={24} aria-hidden />
          </span>
          <span>
            <span className="block text-[20px] font-semibold text-ink">I&rsquo;m a mentor</span>
            <span className="text-[15px] text-ink-3">Set your availability, read your sessions</span>
          </span>
        </a>
      </div>
      <Card className="mt-6">
        <p className="text-[16px] leading-relaxed text-ink-2">{FLOW_NOTICE}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-3">{AI_NOTICE}</p>
      </Card>
      <a
        href="#/create"
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-field border border-line-strong bg-surface text-[16px] font-semibold text-ink transition-colors hover:border-accent hover:bg-accent-weak"
      >
        <UserPlus size={20} aria-hidden /> Create my own learner profile
      </a>
    </Public>
  );
}
