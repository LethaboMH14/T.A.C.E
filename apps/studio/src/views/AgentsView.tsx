import NumberFlow from '@number-flow/react';
import { iconFor } from '@/components/graph/roles';
import { formatUsd, sumUsd } from '@/lib/cost';
import { orderNames, usageCalls, useRunEvents, type UsageCall } from '@/lib/ledger';
import type { LedgerEvent, Mission } from '@/state';

export type AgentKind = 'code' | 'model' | 'independent';

export interface AgentCard {
  name: string;
  kind: AgentKind;
  steps: number;
  files: string[];
  calls: number;
  tokens: number;
  usdText: string;
  sent: number;
  received: number;
  lastDecision: string | null;
}

/** One card per agent seen in the run: joined agents, Reviewer, Repair, and every model agent. */
export function buildAgents(mission: Mission, events: LedgerEvent[]): AgentCard[] {
  if (!mission.runId) return [];
  const calls: UsageCall[] = usageCalls(mission, events);
  const names = orderNames([
    ...mission.joined.map((j) => j.agent),
    'Reviewer',
    'Repair',
    ...calls.map((c) => c.agent),
  ]);

  return names.map((name) => {
    const mine = calls.filter((c) => c.agent === name);
    const taskStarts = events.filter((e) => e.type === 'TASK_STARTED' && e.role === name).length;
    const reviewRounds = name === 'Reviewer' ? events.filter((e) => e.type === 'REVIEW_STARTED').length : 0;
    const repairRounds = name === 'Repair' ? events.filter((e) => e.type === 'REPAIR_SCHEDULED').length : 0;
    // A model agent with no task events is stepped once per model call.
    const steps = taskStarts + reviewRounds + repairRounds || (mine.length && !taskStarts ? mine.length : 0);
    const written = events.filter((e) => e.type === 'ARTIFACT_WRITTEN' && e.role === name).map((e) => String(e.data?.name ?? ''));
    const sent = mission.messages.filter((m) => m.from === name);
    const received = mission.messages.filter((m) => m.to === name);
    const decision = [...sent].reverse().find((m) => m.type === 'DECISION') ?? [...sent].reverse()[0];
    const priced = sumUsd(mine);
    const kind: AgentKind = mine.length ? 'model' : name === 'Reviewer' ? 'independent' : 'code';
    return {
      name,
      kind,
      steps,
      files: [...new Set(written)],
      calls: mine.length,
      tokens: mine.reduce((t, c) => t + c.total, 0),
      usdText: formatUsd(priced, mine.length),
      sent: sent.length,
      received: received.length,
      lastDecision: decision ? decision.reason : null,
    };
  });
}

const KIND_LABEL: Record<AgentKind, string> = { code: 'code', model: 'model', independent: 'independent' };

export function AgentsView({ mission }: { mission: Mission }) {
  const events = useRunEvents(mission);

  if (!mission.runId) {
    return (
      <section className="rounded-card border border-line bg-surface p-5 text-[14px] text-ink-3" aria-label="Agents">
        Select a run to see the agents that took part in it.
      </section>
    );
  }

  const cards = buildAgents(mission, events);
  if (!cards.length) {
    return <section className="rounded-card border border-line bg-surface p-5 text-[14px] text-ink-3">No agents have joined this run yet.</section>;
  }

  return (
    <section aria-label="Agents" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const Icon = iconFor(c.name);
        return (
          <article key={c.name} className="grid content-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
            <header className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <h3 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold">{c.name}</h3>
              <span className="mono rounded-full border border-line-strong px-2 py-0.5 text-[11.5px] text-ink-2">{KIND_LABEL[c.kind]}</span>
            </header>

            <dl className="m-0 grid grid-cols-3 gap-x-3 gap-y-2 text-[12.5px]">
              <Stat label="Steps run" value={c.steps} />
              <Stat label="Files written" value={c.files.length} />
              <Stat label="Model calls" value={c.calls} />
              <Stat label="Tokens" value={c.tokens} />
              <div className="grid">
                <dt className="text-ink-3">USD</dt>
                <dd className="mono m-0 text-ink">{c.usdText}</dd>
              </div>
              <div className="grid">
                <dt className="text-ink-3">Messages</dt>
                <dd className="mono m-0 text-ink">
                  {c.sent} sent · {c.received} in
                </dd>
              </div>
            </dl>

            {c.files.length ? (
              <p className="m-0 flex flex-wrap gap-1.5 text-[12px] text-ink-2">
                {c.files.map((f) => (
                  <span key={f} className="mono rounded-full bg-sunken px-2 py-0.5">{f}</span>
                ))}
              </p>
            ) : null}

            <p className="m-0 border-t border-line pt-2.5 text-[13px] leading-snug text-ink-2">
              <span className="text-ink-3">Last decision: </span>
              {c.lastDecision ?? 'No decision recorded yet.'}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid">
      <dt className="text-ink-3">{label}</dt>
      <dd className="mono m-0 text-ink">
        <NumberFlow value={value} respectMotionPreference />
      </dd>
    </div>
  );
}
