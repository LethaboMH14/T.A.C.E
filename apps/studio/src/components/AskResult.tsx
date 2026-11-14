// Shows one /api/ask answer. Pure display: the kind, reason, answer and cites all come from the server.

export type AskKind = 'mission' | 'question' | 'off_topic';

export interface AskResponse {
  kind: AskKind | null;
  reason?: string;
  answer?: string;
  cites?: string[];
  runId?: string;
  error?: string;
  provider?: string | null;
  model?: string | null;
}

export interface Cite {
  label: string;   // "gap-analysis.csv@v1"
  name: string;    // "gap-analysis.csv"
  version: number; // 1
}

/** Splits "name@vN" into its parts. Returns null for anything else. */
export function parseCite(label: string): Cite | null {
  const m = /^([a-z0-9][a-z0-9._-]*)@v(\d{1,6})$/.exec(label);
  if (!m) return null;
  return { label, name: m[1], version: Number(m[2]) };
}

/** Where a cite chip leads: the run's Files view. */
export function filesHash(runId: string): string {
  return `#/files/${encodeURIComponent(runId)}`;
}

const PILL: Record<AskKind, { text: string; cls: string }> = {
  mission: { text: 'Mission', cls: 'bg-run-weak text-run-line' },
  question: { text: 'Question', cls: 'bg-ok-weak text-ok' },
  off_topic: { text: 'Off topic', cls: 'bg-sunken text-ink-3' },
};

interface Props {
  result: AskResponse;
}

export function AskResult({ result }: Props) {
  const pill = result.kind ? PILL[result.kind] : null;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-line bg-surface p-3 text-[14px] text-ink" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        {pill && (
          <span data-testid="ask-kind" className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${pill.cls}`}>{pill.text}</span>
        )}
        {result.reason && <span className="text-ink-3">{result.reason}</span>}
      </div>

      {result.error && (
        <p role="alert" className="text-bad">{result.error}</p>
      )}

      {result.kind === 'mission' && result.runId && (
        <p className="text-ink-2">Started run <code className="font-mono text-[13px]">{result.runId}</code>. The mission view is open below.</p>
      )}

      {result.answer && (
        <p data-testid="ask-answer" className="whitespace-pre-wrap leading-relaxed">{result.answer}</p>
      )}

      {result.cites && result.cites.length > 0 && result.runId && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
          {result.cites.map((c) => {
            const parsed = parseCite(c);
            if (!parsed) return null;
            return (
              <li key={c}>
                <a
                  href={filesHash(result.runId as string)}
                  data-testid="ask-cite"
                  className="inline-flex items-center rounded-md border border-line-strong bg-sunken px-2 py-0.5 font-mono text-[12px] text-ink-2 hover:text-ink"
                  title={`Open ${parsed.name} (version ${parsed.version}) in Files`}
                >
                  {parsed.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {result.runId && result.kind === 'question' && (
        <p className="text-[12px] text-ink-3">Answered from run <code className="font-mono">{result.runId}</code>{result.provider ? ` · ${result.provider}` : ''}</p>
      )}
    </div>
  );
}
