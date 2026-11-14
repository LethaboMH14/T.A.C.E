import { Home, Inbox, LifeBuoy, LogOut, Target, User, CalendarDays, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { go } from '../lib/route';
import { rpc, isRelogin } from '../lib/api';
import { PortalContext, type PortalCtx } from '../lib/ctx';
import { clearSession, getSession, setFlash, type Session } from '../lib/session';
import type { Kind, Me, Message } from '../lib/types';
import { HelpPage } from '../screens/HelpPage';
import { InboxPage } from '../screens/InboxPage';
import { LearnerHome, SkillsPage } from '../screens/LearnerHome';
import { MePage } from '../screens/MePage';
import { MentorAvailability } from '../screens/MentorAvailability';
import { MentorHome } from '../screens/MentorHome';
import { Quiz } from '../screens/Quiz';
import { SkillSheet } from '../screens/SkillSheet';
import { Button } from './ui';

const POLL_MS = 4000;

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  phone: boolean; // shown in the bottom tab bar on phones
}

export function Portal({ kind, sub }: { kind: Kind; sub: string[] }) {
  const [session] = useState<Session | null>(() => getSession());
  if (!session || session.kind !== kind) return <Redirect kind={kind} />;
  return <Shell kind={kind} session={session} sub={sub} />;
}

function Redirect({ kind }: { kind: Kind }) {
  useEffect(() => {
    setFlash('Choose your profile and enter your PIN to continue.');
    go(`/pick/${kind}`);
  }, [kind]);
  return <p className="p-8 text-center text-ink-3">Taking you to sign in…</p>;
}

function Shell({ kind, session, sub }: { kind: Kind; session: Session; sub: string[] }) {
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  // Every call carries the session token. A "log in again" answer clears the session and returns to the PIN screen.
  const call = useCallback(
    async <T,>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
      try {
        return await rpc<T>(fn, { p_token: session.token, ...args });
      } catch (e) {
        if (isRelogin(e)) {
          // Token no longer valid: back to the picker with this profile preselected. Its PIN restores all earlier data.
          clearSession(session.id);
          setFlash('Please log in again. Enter your PIN and your earlier data comes back.');
          go(`/pick/${kind}?preselect=${encodeURIComponent(session.id)}`);
        }
        throw e;
      }
    },
    [session, kind],
  );

  const reloadMe = useCallback(async () => {
    try {
      setMe(await call<Me>('lms_me'));
      setMeError(null);
    } catch (e) {
      setMeError(e instanceof Error ? e.message : 'Could not load your profile.');
    }
  }, [call]);

  const refreshInbox = useCallback(async () => {
    try {
      setMessages(await call<Message[]>('lms_inbox'));
      setInboxError(null);
    } catch (e) {
      setInboxError(e instanceof Error ? e.message : 'Could not load the inbox.');
    }
  }, [call]);

  const markRead = useCallback(
    async (id: string) => {
      setMessages((prev) => prev?.map((m) => (m.id === id ? { ...m, read: true } : m)) ?? prev);
      try {
        await call('lms_mark_read', { p_id: id });
      } catch {
        void refreshInbox();
      }
    },
    [call, refreshInbox],
  );

  useEffect(() => {
    void reloadMe();
    void refreshInbox();
  }, [reloadMe, refreshInbox]);

  // Inbox polls every 4 s while the page is visible.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refreshInbox();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshInbox]);

  const logout = useCallback(() => {
    clearSession(session.id);
    go('/');
  }, [session.id]);

  const unread = messages ? messages.filter((m) => !m.read).length : (me?.unread ?? 0);

  const ctx: PortalCtx = useMemo(
    () => ({ kind, session, me, meError, reloadMe, messages, inboxError, refreshInbox, markRead, unread, call, logout }),
    [kind, session, me, meError, reloadMe, messages, inboxError, refreshInbox, markRead, unread, call, logout],
  );

  const tabs: Tab[] =
    kind === 'learner'
      ? [
          { to: '/learner', label: 'Home', icon: Home, phone: true },
          { to: '/learner/skills', label: 'Skills', icon: Target, phone: false },
          { to: '/learner/help', label: 'Help', icon: LifeBuoy, phone: true },
          { to: '/learner/inbox', label: 'Inbox', icon: Inbox, badge: unread, phone: true },
          { to: '/learner/me', label: 'Me', icon: User, phone: true },
        ]
      : [
          { to: '/mentor', label: 'Home', icon: Home, phone: true },
          { to: '/mentor/availability', label: 'Availability', icon: CalendarDays, phone: true },
          { to: '/mentor/inbox', label: 'Inbox', icon: Inbox, badge: unread, phone: true },
        ];

  const here = '/' + [kind, ...sub].join('/');
  const isActive = (to: string) => here === to || (to !== `/${kind}` && here.startsWith(to + '/'));

  return (
    <PortalContext.Provider value={ctx}>
      <div className="min-h-dvh">
        {/* Desktop sidebar (1024px and up) */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
          <div className="gradient-rule" aria-hidden />
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-6 px-2">
              <p className="font-display text-[18px] font-bold text-ink">T.A.C.E Learner Portal</p>
              <p className="text-[13px] text-ink-3">Coding Bootcamp, Week 4</p>
            </div>
            <nav aria-label="Main">
              <ul className="space-y-1">
                {tabs.map((t) => (
                  <li key={t.to}>
                    <SideLink tab={t} active={isActive(t.to)} />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto space-y-3 border-t border-line pt-4">
              <p className="px-2 text-[14px] text-ink-2">
                Signed in as <span className="font-semibold text-ink">{me?.profile.display_name ?? '…'}</span>
              </p>
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 w-full items-center gap-3 rounded-field px-3 text-[15px] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
              >
                <LogOut size={18} aria-hidden /> Log out
              </button>
            </div>
          </div>
        </aside>

        <div className="lg:pl-60">
          {/* Phone header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="min-w-0">
              <p className="truncate font-display text-[16px] font-bold text-ink">T.A.C.E Learner Portal</p>
              <p className="truncate text-[13px] text-ink-3">{me?.profile.display_name ?? 'Loading…'}</p>
            </div>
            <Button variant="ghost" onClick={logout} className="min-h-11 px-3" aria-label="Log out">
              <LogOut size={18} aria-hidden /> Log out
            </Button>
          </header>

          <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 lg:px-10 lg:pb-12 lg:pt-10 xl:max-w-6xl xl:px-12">
            <PageSwitch kind={kind} sub={sub} />
          </main>
        </div>

        {/* Phone bottom tab bar (below 1024px) */}
        <nav
          aria-label="Main"
          className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden`}
        >
          <ul className={`mx-auto grid max-w-md ${kind === 'learner' ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {tabs
              .filter((t) => t.phone)
              .map((t) => (
                <li key={t.to}>
                  <TabLink tab={t} active={isActive(t.to)} />
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </PortalContext.Provider>
  );
}

function badgeNode(n?: number) {
  return n && n > 0 ? (
    <span className="absolute right-2 top-1.5 min-w-5 rounded-full bg-accent px-1.5 text-center font-mono text-[12px] font-semibold leading-5 text-white">
      {n}
    </span>
  ) : null;
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <a
      href={`#${tab.to}`}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition-colors hover:text-accent-ink ${
        active ? 'text-accent-ink' : 'text-ink-3'
      }`}
    >
      <Icon size={22} aria-hidden />
      {tab.label}
      {badgeNode(tab.badge)}
    </a>
  );
}

function SideLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <a
      href={`#${tab.to}`}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-field px-3 text-[15px] font-medium transition-colors ${
        active ? 'bg-accent-weak text-accent-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink'
      }`}
    >
      <Icon size={20} aria-hidden />
      <span className="flex-1">{tab.label}</span>
      {tab.badge && tab.badge > 0 ? <span className="rounded-full bg-accent px-2 font-mono text-[12px] font-semibold text-white">{tab.badge}</span> : null}
    </a>
  );
}

function PageSwitch({ kind, sub }: { kind: Kind; sub: string[] }): ReactNode {
  const [a, b] = sub;
  if (kind === 'learner') {
    if (!a || a === 'home') return <LearnerHome />;
    if (a === 'skills') return <SkillsPage />;
    if (a === 'skill' && b) return <SkillSheet id={b} />;
    if (a === 'quiz' && b) return <Quiz id={b} />;
    if (a === 'help') return <HelpPage />;
    if (a === 'inbox') return <InboxPage />;
    if (a === 'me') return <MePage />;
  } else {
    if (!a) return <MentorHome />;
    if (a === 'availability') return <MentorAvailability />;
    if (a === 'inbox') return <InboxPage />;
  }
  return (
    <div className="py-16 text-center">
      <p className="text-[18px] font-semibold text-ink">This page does not exist.</p>
      <a className="mt-4 inline-block text-accent-ink underline" href={`#/${kind}`}>
        Back to home
      </a>
    </div>
  );
}
