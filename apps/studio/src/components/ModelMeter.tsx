import type { Mission } from '@/state';
import { formatUsd, sumUsd } from '@/lib/cost';
import { usageCalls, useRunEvents, type UsageCall } from '@/lib/ledger';

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

/** Fallback reason in plain words. Unknown codes are lower-cased with the MODEL_ prefix removed. */
export function plainReason(code: string | null | undefined): string {
  const c = String(code ?? '');
  if (c === 'MODEL_HTTP_429') return 'rate limit';
  if (/^MODEL_HTTP_5\d\d$/.test(c)) return 'service error';
  if (c === 'MODEL_HTTP_402') return 'out of credit';
  if (c === 'MODEL_HTTP_404' || c === 'MODEL_HTTP_410') return 'model retired';
  if (c === 'auth' || c === 'MODEL_HTTP_401' || c === 'MODEL_HTTP_403') return 'key refused';
  if (!c) return 'unknown reason';
  return c.replace(/^MODEL_/, '').replace(/_/g, ' ').toLowerCase();
}

interface Row {
  agent: string;
  calls: number;
  failures: number;
  ms: number;
  tokens: number;
  usd: string;
}

function rowsFor(calls: UsageCall[]): Row[] {
  const agents = [...new Set(calls.map((c) => c.agent))];
  return agents.map((agent) => {
    const mine = calls.filter((c) => c.agent === agent);
    return {
      agent,
      calls: mine.length,
      failures: mine.filter((c) => !c.ok).length,
      ms: mine.reduce((t, c) => t + c.ms, 0),
      tokens: mine.reduce((t, c) => t + c.total, 0),
      usd: formatUsd(sumUsd(mine), mine.length),
    };
  });
}

export function ModelMeter({ mission }: { mission: Mission }) {
  const events = useRunEvents(mission);
  const agents = mission.agents;
  const calls = usageCalls(mission, events);
  const rows = rowsFor(calls);
  const total = rows.reduce(
    (t, r) => ({ calls: t.calls + r.calls, failures: t.failures + r.failures, ms: t.ms + r.ms, tokens: t.tokens + r.tokens }),
    { calls: 0, failures: 0, ms: 0, tokens: 0 },
  );
  const totalUsd = sumUsd(calls);
  const served = servedBy(mission.modelCalls);

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
                    <th scope="col" className="border-b border-line-strong py-1.5 pr-2 text-right font-medium">Tokens</th>
                    <th scope="col" className="border-b border-line-strong py-1.5 text-right font-medium">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.agent} className="border-b border-line">
                      <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink">{r.agent}</th>
                      <td className="mono py-1.5 pr-2 text-right">{n(r.calls)}</td>
                      <td className={`mono py-1.5 pr-2 text-right ${r.failures ? 'text-bad' : ''}`}>{n(r.failures)}</td>
                      <td className="mono py-1.5 pr-2 text-right">{n(r.ms)}</td>
                      <td className="mono py-1.5 pr-2 text-right">{n(r.tokens)}</td>
                      <td className="mono py-1.5 text-right">{r.usd}</td>
                    </tr>
                  ))}
                  <tr className="font-medium text-ink">
                    <th scope="row" className="py-1.5 pr-2 text-left">Total</th>
                    <td className="mono py-1.5 pr-2 text-right">{n(total.calls)}</td>
                    <td className={`mono py-1.5 pr-2 text-right ${total.failures ? 'text-bad' : ''}`}>{n(total.failures)}</td>
                    <td className="mono py-1.5 pr-2 text-right">{n(total.ms)}</td>
                    <td className="mono py-1.5 pr-2 text-right">{n(total.tokens)}</td>
                    <td className="mono py-1.5 text-right">{formatUsd(totalUsd, calls.length)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-0 text-[13.5px] text-ink-3">No model calls yet.</p>
          )}
          {served.length > 0 && (
            <p className="m-0 mt-3 text-[12.5px] text-ink-3">
              Answered by: <span className="mono">{served.join(' · ')}</span>
            </p>
          )}
          {(mission.fallbacks ?? []).length > 0 && (
            <ul className="m-0 mt-2 list-none space-y-1 p-0">
              {mission.fallbacks.map((f, i) => (
                <li key={i} className="rounded-md bg-accent-weak px-2.5 py-1.5 text-[12.5px] text-accent-ink">
                  {f.agent} switched <span className="mono">{f.from}</span> → <span className="mono">{f.to}</span> ({plainReason(f.reason)})
                </li>
              ))}
            </ul>
          )}
        </>
      ) : agents?.mode === 'code' ? (
        <p className="m-0 text-[13.5px] text-ink-2">{agents.note ?? 'Code only. No model calls were made.'}</p>
      ) : (
        <p className="m-0 text-[13.5px] text-ink-3">Waiting for the run to start.</p>
      )}
    </section>
  );
}
