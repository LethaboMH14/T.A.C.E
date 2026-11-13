import type { Mission } from '@/state';

export interface AgentUsage {
  agent: string;
  calls: number;
  failures: number;
  ms: number;
  tokens: number;
}

/** Sums MODEL_CALL events per agent. Rows keep first-appearance order, which the ledger fixes. */
export function aggregateModelCalls(calls: Mission['modelCalls']): AgentUsage[] {
  const byAgent = new Map<string, AgentUsage>();
  for (const c of calls) {
    const row = byAgent.get(c.agent) ?? { agent: c.agent, calls: 0, failures: 0, ms: 0, tokens: 0 };
    row.calls += 1;
    if (!c.ok) row.failures += 1;
    row.ms += c.ms;
    row.tokens += c.total;
    byAgent.set(c.agent, row);
  }
  return [...byAgent.values()];
}

const n = (x: number): string => x.toLocaleString('en-US');

/** provider:model pairs that returned a successful answer, in first-seen order. */
export function servedBy(calls: Mission['modelCalls']): string[] {
  const seen: string[] = [];
  for (const c of calls) {
    if (!c.ok || !c.provider) continue;
    const k = `${c.provider}:${c.model ?? '?'}`;
    if (!seen.includes(k)) seen.push(k);
  }
  return seen;
}

export function ModelMeter({ mission }: { mission: Mission }) {
  const agents = mission.agents;
  const rows = aggregateModelCalls(mission.modelCalls);
  const total = rows.reduce(
    (t, r) => ({ calls: t.calls + r.calls, failures: t.failures + r.failures, ms: t.ms + r.ms, tokens: t.tokens + r.tokens }),
    { calls: 0, failures: 0, ms: 0, tokens: 0 },
  );

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card" aria-labelledby="h-meter">
      <h2 id="h-meter" className="mb-2.5 text-[15px] font-semibold tracking-[-0.005em]">
        Model use
      </h2>

      {agents?.mode === 'model' ? (
        <>
          <p className="mono m-0 mb-3 text-[12.5px] text-ink-3">
            {agents.provider ?? 'provider unknown'} · {agents.model ?? 'model unknown'}
          </p>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-ink-3">
                    <th scope="col" className="border-b border-line-strong py-1.5 pr-2 font-medium">Agent</th>
                    <th scope="col" className="border-b border-line-strong py-1.5 pr-2 text-right font-medium">Calls</th>
                    <th scope="col" className="border-b border-line-strong py-1.5 pr-2 text-right font-medium">Failed</th>
                    <th scope="col" className="border-b border-line-strong py-1.5 pr-2 text-right font-medium">ms</th>
                    <th scope="col" className="border-b border-line-strong py-1.5 text-right font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.agent} className="border-b border-line">
                      <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink">{r.agent}</th>
                      <td className="mono py-1.5 pr-2 text-right">{n(r.calls)}</td>
                      <td className={`mono py-1.5 pr-2 text-right ${r.failures ? 'text-bad' : ''}`}>{n(r.failures)}</td>
                      <td className="mono py-1.5 pr-2 text-right">{n(r.ms)}</td>
                      <td className="mono py-1.5 text-right">{n(r.tokens)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium text-ink">
                    <th scope="row" className="py-1.5 pr-2 text-left">Total</th>
                    <td className="mono py-1.5 pr-2 text-right">{n(total.calls)}</td>
                    <td className={`mono py-1.5 pr-2 text-right ${total.failures ? 'text-bad' : ''}`}>{n(total.failures)}</td>
                    <td className="mono py-1.5 pr-2 text-right">{n(total.ms)}</td>
                    <td className="mono py-1.5 text-right">{n(total.tokens)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-0 text-[13.5px] text-ink-3">No model calls yet.</p>
          )}
          {servedBy(mission.modelCalls).length > 0 && (
            <p className="m-0 mt-3 text-[12.5px] text-ink-3">
              Answered by: <span className="mono">{servedBy(mission.modelCalls).join(' · ')}</span>
            </p>
          )}
          {(mission.fallbacks ?? []).length > 0 && (
            <ul className="m-0 mt-2 list-none space-y-1 p-0">
              {mission.fallbacks.map((f, i) => (
                <li key={i} className="rounded-md bg-accent-weak px-2.5 py-1.5 text-[12.5px] text-accent-ink">
                  {f.agent} switched <span className="mono">{f.from}</span> → <span className="mono">{f.to}</span> ({f.reason === 'MODEL_HTTP_429' ? 'rate limit' : f.reason})
                </li>
              ))}
            </ul>
          )}
        </>
      ) : agents?.mode === 'code' ? (
        <p className="m-0 text-[13.5px] text-ink-2">Code only. No model key configured, so no model calls were made.</p>
      ) : (
        <p className="m-0 text-[13.5px] text-ink-3">Waiting for the run to start.</p>
      )}
    </section>
  );
}
