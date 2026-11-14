// Prompt bar: one line of free text goes to POST /api/ask, which decides mission, question or off topic.
// Suggestion chips come from GET /api/scenarios (real list) and start that scenario through api.start.
import { useEffect, useState, type FormEvent } from 'react';
import { api, type ScenarioInfo } from '@/state';
import { AskResult, type AskResponse } from '@/components/AskResult';

interface Props {
  onRunStarted: (runId: string) => void;
}

async function postAsk(text: string): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = (await res.json().catch(() => ({}))) as AskResponse & { error?: string };
  if (!res.ok && body.error === undefined) return { kind: null, error: `HTTP ${res.status}` };
  return body;
}

export function PromptBar({ onRunStarted }: Props) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.scenarios()
      .then((items) => { if (alive) setScenarios(items); })
      .catch((e: Error) => { if (alive) setScenarioError(e.message); });
    return () => { alive = false; };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || pending) return;
    setPending(true);
    setResult(null);
    try {
      const r = await postAsk(clean);
      setResult(r);
      if (r.kind === 'mission' && r.runId) onRunStarted(r.runId);
    } catch (err) {
      setResult({ kind: null, error: `Could not reach the server (${(err as Error).message}).` });
    } finally {
      setPending(false);
    }
  }

  async function startScenario(s: ScenarioInfo) {
    if (starting) return;
    setStarting(s.id);
    setResult(null);
    try {
      const { runId } = await api.start(s.id);
      onRunStarted(runId);
    } catch (err) {
      setResult({ kind: null, error: `Could not start "${s.title}": ${(err as Error).message}` });
    } finally {
      setStarting(null);
    }
  }

  return (
    <section aria-label="Ask T.A.C.E" className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor="prompt-bar" className="sr-only">Describe a goal or ask about the latest results</label>
        <input
          id="prompt-bar"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Describe a goal or ask about the latest results…"
          disabled={pending}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius)] border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || text.trim() === ''}
          className="h-10 shrink-0 rounded-[var(--radius)] bg-accent px-4 text-[14px] font-medium text-accent-ink disabled:opacity-50"
        >
          Run
        </button>
      </form>

      {pending && (
        <p role="status" className="text-[13px] text-ink-3">Reading your request…</p>
      )}

      {result && <AskResult result={result} />}

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Suggested scenarios">
        {scenarioError && <span className="text-[12px] text-bad">Scenarios could not load ({scenarioError}).</span>}
        {scenarios === null && !scenarioError && <span className="text-[12px] text-ink-3">Loading scenarios…</span>}
        {scenarios?.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => startScenario(s)}
            disabled={starting !== null}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink disabled:opacity-50"
          >
            {starting === s.id ? 'Starting…' : s.title}
          </button>
        ))}
      </div>
    </section>
  );
}
