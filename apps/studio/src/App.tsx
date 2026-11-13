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
import { Command } from 'lucide-react';
import { api, useMission } from '@/state';

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  // The run the workspace is about. Views without a run in their hash (agents, models, missions) keep it.
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  return (
    <>
      <AppShell
        sidebar={<Sidebar route={route} mission={mission} />}
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
          </>
        }
      >
        {route.name === 'mission' || route.name === 'home' ? (
          <MissionWorkspace key={activeRunId ?? 'none'} mission={mission} runId={activeRunId} />
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
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} currentRunId={activeRunId} />
    </>
  );
}
