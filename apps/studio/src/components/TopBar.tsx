import { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/state';
import type { RunInfo, ScenarioInfo } from '@/state';

interface TopBarProps {
  runId: string | null;
  onRunChange: (runId: string) => void;
}

export function TopBar({ runId, onRunChange }: TopBarProps) {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [scenario, setScenario] = useState<string>('inject_overlap');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRuns = useCallback(() => {
    api
      .runs()
      .then((list) => setRuns(list))
      .catch(() => setRuns([]));
  }, []);

  // First load: scenarios, and the most recent run when the URL names none.
  useEffect(() => {
    api
      .scenarios()
      .then((list) => {
        setScenarios(list);
        if (list.some((s) => s.id === 'inject_overlap')) setScenario('inject_overlap');
        else if (list[0]) setScenario(list[0].id);
      })
      .catch((e: Error) => setError(`Could not load scenarios: ${e.message}`));
    api
      .runs()
      .then((list) => {
        setRuns(list);
        if (!runId && list[0]) onRunChange(list[0].runId);
      })
      .catch(() => setRuns([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A run's status changes while it runs, so re-read the list whenever the open run changes.
  useEffect(() => {
    refreshRuns();
  }, [runId, refreshRuns]);

  async function startRun() {
    setBusy(true);
    setError(null);
    try {
      const { runId: next } = await api.start(scenario);
      onRunChange(next);
      refreshRuns();
    } catch (e) {
      setError(`Could not start the run: ${(e as Error).message}`);
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  }

  const knownRun = runs.some((r) => r.runId === runId);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white/85 px-6 py-2.5 backdrop-blur-md max-[860px]:px-4">
      <a href="/" aria-label="T.A.C.E Mission Studio home" className="flex items-center gap-2.5 text-ink no-underline">
        <svg className="h-[26px] w-[26px]" viewBox="0 0 32 32" aria-hidden="true">
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
        <span className="font-display text-[17px] font-bold leading-none tracking-[0.02em]">T.A.C.E</span>
        <span className="border-l border-line pl-2.5 text-[13px] text-ink-3 max-[860px]:hidden">Mission Studio</span>
      </a>

      <form
        className="flex items-center gap-2 max-[860px]:w-full max-[860px]:flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && scenario) void startRun();
        }}
      >
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger aria-label="Scenario" className="w-[340px] whitespace-nowrap [&>span]:truncate max-w-[360px] max-[860px]:flex-1 max-[860px]:max-w-none">
            <SelectValue placeholder={scenarios.length ? 'Choose a scenario' : 'Loading scenarios'} />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" disabled={busy || !scenario} className="max-[860px]:flex-1">
          <Play className="h-[15px] w-[15px] fill-current" aria-hidden />
          <span>Run mission</span>
        </Button>

        <Select value={knownRun ? (runId ?? '') : ''} onValueChange={(id) => onRunChange(id)}>
          <SelectTrigger aria-label="Open an earlier run" className="w-[220px] whitespace-nowrap [&>span]:truncate max-w-[220px] text-ink-2 max-[860px]:max-w-none max-[860px]:flex-1">
            <SelectValue placeholder="Earlier runs" />
          </SelectTrigger>
          <SelectContent>
            {runs.slice(0, 30).map((r) => (
              <SelectItem key={r.runId} value={r.runId}>
                {`${r.title || r.runId}${r.status ? ` · ${r.status}` : ''}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {error ? (
          <p role="alert" className="w-full text-[13px] text-bad">
            {error}
          </p>
        ) : null}
      </form>
    </header>
  );
}
