import { Activity, Bot, Cpu, FileCheck, FolderOpen, LayoutList, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/state';
import { go, type Route } from './route';

type NavName = 'mission' | 'missions' | 'agents' | 'evidence' | 'files' | 'models';

const NAV: { name: NavName; label: string; icon: typeof Activity }[] = [
  { name: 'mission', label: 'Mission', icon: Workflow },
  { name: 'missions', label: 'Missions', icon: LayoutList },
  { name: 'agents', label: 'Agents', icon: Bot },
  { name: 'evidence', label: 'Evidence', icon: FileCheck },
  { name: 'files', label: 'Files', icon: FolderOpen },
  { name: 'models', label: 'Models', icon: Cpu },
];

/** The run the footer describes. Its numbers come only from that run's RUN_STARTED and MODEL_CALL events. */
export function footerLines(m: Mission | null): { headline: string; detail: string | null } {
  if (!m || !m.runId) return { headline: 'No run open', detail: 'Start a mission from the prompt bar.' };
  const a = m.agents;
  if (!a) return { headline: 'Waiting for the run to start', detail: null };
  if (a.mode === 'code') return { headline: 'Code only', detail: a.note ?? 'No model in this run' };
  const tokens = m.modelCalls.reduce((n, c) => n + (c.total || 0), 0);
  const answered = [...new Set(m.modelCalls.filter((c) => c.ok && c.provider).map((c) => c.provider as string))];
  const chain = a.chain && a.chain.length ? a.chain.join(' → ') : (a.provider ?? 'no provider');
  return {
    headline: `Profile ${a.profile ?? 'n/a'}`,
    detail: `Chain ${chain} · ${tokens.toLocaleString('en-GB')} tokens so far · answered by ${answered.length ? answered.join(', ') : 'nobody yet'}`,
  };
}

export function Sidebar({ route, mission }: { route: Route; mission: Mission | null }) {
  const active = route.name === 'home' ? 'mission' : route.name;
  const foot = footerLines(mission);
  return (
    <aside
      aria-label="Workspace navigation"
      className="flex w-[232px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 py-4 max-[999px]:w-[64px] max-[999px]:px-2 max-[719px]:w-full max-[719px]:flex-row max-[719px]:flex-wrap max-[719px]:items-center max-[719px]:gap-1 max-[719px]:border-b max-[719px]:border-r-0 max-[719px]:px-3 max-[719px]:py-2"
    >
      <div className="mb-4 flex items-center gap-2.5 px-2 max-[999px]:justify-center max-[999px]:px-0 max-[719px]:mb-0 max-[719px]:mr-2">
        <svg className="h-[26px] w-[26px] shrink-0" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id="tace-mark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7D9EFA" />
              <stop offset=".55" stopColor="#DB61E6" />
              <stop offset="1" stopColor="#8F66ED" />
            </linearGradient>
          </defs>
          <path d="M16 3 29 27H3z" fill="url(#tace-mark)" />
          <path d="M16 12.5 21.6 23H10.4z" fill="#fff" />
        </svg>
        <span className="font-display text-[17px] font-bold leading-none tracking-[0.02em] max-[999px]:hidden">T.A.C.E</span>
      </div>

      <nav className="flex flex-col gap-0.5 max-[719px]:flex-row max-[719px]:flex-wrap" aria-label="Views">
        {NAV.map((item) => {
          const Icon = item.icon;
          const on = active === item.name;
          return (
            <a
              key={item.name}
              href={item.name === 'mission' ? (mission?.runId ? `#/mission/${encodeURIComponent(mission.runId)}` : '#/mission') : undefined}
              aria-current={on ? 'page' : undefined}
              title={item.label}
              onClick={(e) => {
                e.preventDefault();
                if (item.name === 'mission') go(mission?.runId ? { name: 'mission', runId: mission.runId } : { name: 'mission', runId: null });
                else if (item.name === 'evidence' || item.name === 'files') go({ name: item.name, runId: mission?.runId ?? null });
                else go({ name: item.name });
              }}
              className={cn(
                'flex h-9 cursor-pointer items-center gap-2.5 rounded-field px-2.5 text-[14px] font-medium text-ink-2 no-underline hover:bg-sunken hover:text-ink max-[999px]:justify-center max-[999px]:px-0',
                on && 'bg-accent-weak text-accent-ink',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} aria-hidden />
              <span className="max-[999px]:sr-only">{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-3 text-[12.5px] leading-[1.45] text-ink-2 max-[999px]:hidden max-[719px]:hidden" data-testid="sidebar-footer">
        <p className="m-0 font-semibold text-ink">{foot.headline}</p>
        {foot.detail ? <p className="m-0 mt-0.5 text-ink-3">{foot.detail}</p> : null}
      </div>
    </aside>
  );
}
