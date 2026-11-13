// Command palette (cmdk). Every action is real: it starts a real run, opens a stored run,
// goes to a view, or calls the provider check API. Nothing is a stub.
import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { api, type RunInfo, type ScenarioInfo } from '@/state';
import { go, type Route } from './route';
import { requestProviderCheck } from './workspace-api';

const VIEWS: { label: string; route: Route }[] = [
  { label: 'Go to Missions', route: { name: 'missions' } },
  { label: 'Go to Agents', route: { name: 'agents' } },
  { label: 'Go to Models', route: { name: 'models' } },
];

export function CommandPalette({ open, onOpenChange, currentRunId }: { open: boolean; onOpenChange: (v: boolean) => void; currentRunId: string | null }) {
  const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null);
  const [runs, setRuns] = useState<RunInfo[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Global shortcut: ⌘K on macOS, Ctrl+K elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Load the real lists each time the palette opens.
  useEffect(() => {
    if (!open) return;
    setStatus(null);
    api.scenarios().then(setScenarios).catch((e: Error) => setStatus(`Could not load scenarios: ${e.message}`));
    api.runs().then(setRuns).catch((e: Error) => setStatus(`Could not load runs: ${e.message}`));
  }, [open]);

  const close = () => onOpenChange(false);

  async function runScenario(s: ScenarioInfo) {
    setBusy(true);
    setStatus(`Starting ${s.title}…`);
    try {
      const { runId } = await api.start(s.id);
      close();
      go({ name: 'mission', runId });
    } catch (e) {
      setStatus(`Could not start the run: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-ink/15"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-card border border-line bg-surface shadow-lift"
    >
      <Command.Input
        placeholder="Run a scenario, open a run, go to a view or check providers"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-[15px] text-ink outline-none placeholder:text-ink-3"
      />
      <Command.List className="max-h-[52vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-[14px] text-ink-3">
          {status ?? 'Nothing matches.'}
        </Command.Empty>

        {status && (scenarios || runs) ? <p className="px-3 pb-1 pt-1 text-[12.5px] text-ink-3">{status}</p> : null}

        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3">
          {currentRunId ? (
            <Item onSelect={() => { close(); go({ name: 'mission', runId: currentRunId }); }}>Go to the open mission</Item>
          ) : null}
          {VIEWS.map((v) => (
            <Item key={v.label} onSelect={() => { close(); go(v.route); }}>
              {v.label}
            </Item>
          ))}
          <Item
            onSelect={() => {
              close();
              requestProviderCheck();
              go({ name: 'models' });
            }}
          >
            Check providers (live)
          </Item>
        </Command.Group>

        {scenarios && scenarios.length ? (
          <Command.Group heading="Run a scenario" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3">
            {scenarios.map((s) => (
              <Item key={s.id} disabled={busy} onSelect={() => void runScenario(s)}>
                {s.title}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        {runs && runs.length ? (
          <Command.Group heading="Open a run" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3">
            {runs.slice(0, 12).map((r) => (
              <Item
                key={r.runId}
                value={`${r.title ?? ''} ${r.runId} ${r.status ?? ''}`}
                onSelect={() => { close(); go({ name: 'mission', runId: r.runId }); }}
              >
                <span className="truncate">{r.title || r.runId}</span>
                <span className="mono ml-auto shrink-0 text-[12px] text-ink-3">{r.status ?? ''}</span>
              </Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
    </Command.Dialog>
  );
}

function Item({ children, onSelect, disabled, value }: { children: React.ReactNode; onSelect: () => void; disabled?: boolean; value?: string }) {
  return (
    <Command.Item
      value={value}
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-field px-3 py-2 text-[14px] text-ink-2 data-[selected=true]:bg-accent-weak data-[selected=true]:text-ink data-[disabled=true]:opacity-50"
    >
      {children}
    </Command.Item>
  );
}
