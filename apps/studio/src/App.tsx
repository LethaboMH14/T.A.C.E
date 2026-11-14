import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Sidebar } from '@/components/shell/Sidebar';
import { PromptBar } from '@/components/shell/PromptBar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { MissionWorkspace } from '@/components/shell/MissionWorkspace';
import { go, parseRoute, routeHash, routeRunId, type Route } from '@/components/shell/route';
import { MissionsView } from '@/views/MissionsView';
import { ModelsView } from '@/views/ModelsView';
import { AgentsView } from '@/views/AgentsView';
import { EvidenceView } from '@/views/EvidenceView';
import { FilesView } from '@/views/FilesView';
import { LiveView } from '@/views/LiveView';
import { NotificationBell, Toasts } from '@/components/notify/NotificationCentre';
import { UserMenu } from '@/components/auth/UserMenu';
import { Command } from 'lucide-react';
import { api, useMission } from '@/state';
import { useLiveFeed } from '@/state/live';
import { useLmsStatus } from '@/state/lms';
import { useRunNotifications } from '@/state/notifications';

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  // The run the workspace is about. Views without a run in their hash (agents, models, missions) keep it.
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return window.localStorage.getItem('tace.nav.collapsed') === '1'; } catch { return false; }
  });
  const toggleNav = () => setNavCollapsed((c) => {
    try { window.localStorage.setItem('tace.nav.collapsed', c ? '0' : '1'); } catch { /* storage unavailable */ }
    return !c;
  });

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const routeRun = routeRunId(route);
  useEffect(() => {
    if (routeRun) setCurrentRunId(routeRun);
  }, [routeRun]);

  // No hash yet: open the most recent real run, or the empty mission page when there are none.
  useEffect(() => {
    if (route.name !== 'home') return;
    let cancelled = false;
    api
      .runs()
      .then((list) => {
        if (cancelled) return;
        const next: Route = list[0] ? { name: 'mission', runId: list[0].runId } : { name: 'mission', runId: null };
        window.history.replaceState(null, '', routeHash(next));
        setRoute(next);
      })
      .catch(() => {
        if (!cancelled) setRoute({ name: 'mission', runId: null });
      });
    return () => {
      cancelled = true;
    };
    // Runs once on load; later hash changes are handled by the hashchange listener above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRunId = routeRun ?? currentRunId;
  const mission = useMission(activeRunId);
  useRunNotifications(mission);

  // The class feed stays connected on every view once the portal is configured, so the help count in the sidebar is live.
  const { state: lmsStatus, reload: reloadLms } = useLmsStatus();
  const lmsReady = lmsStatus.kind === 'ready' ? lmsStatus.status : null;
  const feedAvailable = !!lmsReady && lmsReady.configured && !lmsReady.error && !!lmsReady.counts
    && !(lmsReady.counts.attempts_live === null && lmsReady.counts.help === null);
  const live = useLiveFeed(feedAvailable);
  const helpCount = feedAvailable ? (live.counts?.help ?? lmsReady?.counts?.help ?? null) : null;

  return (
    <>
      <AppShell
        sidebar={<Sidebar route={route} mission={mission} helpCount={helpCount} collapsed={navCollapsed} onToggleCollapsed={toggleNav} />}
        topbar={
          <>
            <div className="min-w-0 flex-1">
              <PromptBar onRunStarted={(runId: string) => go({ name: 'mission', runId })} />
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="mono inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-field border border-line-strong bg-surface px-2.5 text-[13px] text-ink-2 hover:bg-sunken"
            >
              <Command className="h-3.5 w-3.5" aria-hidden />
              K
            </button>
            <NotificationBell />
            <UserMenu />
          </>
        }
      >
        {route.name === 'mission' || route.name === 'home' ? (
          <MissionWorkspace key={activeRunId ?? 'none'} mission={mission} runId={activeRunId} />
        ) : route.name === 'live' ? (
          <LiveView status={lmsStatus} onRetry={reloadLms} live={live} feedAvailable={feedAvailable} />
        ) : route.name === 'missions' ? (
          <MissionsView mission={mission} />
        ) : route.name === 'agents' ? (
          <AgentsView mission={mission} />
        ) : route.name === 'evidence' ? (
          <EvidenceView mission={mission} />
        ) : route.name === 'files' ? (
          <FilesView mission={mission} />
        ) : (
          <ModelsView />
        )}
      </AppShell>
      <Toasts />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} currentRunId={activeRunId} />
    </>
  );
}
