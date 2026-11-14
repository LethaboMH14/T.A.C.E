import type { ReactNode } from 'react';
import type { Mission } from '@/state';
import { nodeDetail, type NodeDetail } from '@/state/selectors-node';

export interface OpenTarget {
  type: 'file' | 'check';
  id: string;
}

const KIND_TEXT: Record<string, string> = {
  model: 'Model-backed',
  code: 'Deterministic code',
  independent: 'Independent check',
};

const fmtTime = (ts: string): string => ts.replace('T', ' ').replace(/\.\d+Z$/, 'Z');

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-line pt-3">
      <h3 className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {title}
        {count !== undefined ? <span className="ml-1.5 font-normal normal-case tracking-normal">({count})</span> : null}
      </h3>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="m-0 text-[13px] text-ink-3">{children}</p>;

const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-[12px] text-ink-2">{children}</span>;

export function NodeInspector({ mission, id, onOpen }: { mission: Mission; id: string; onOpen: (t: OpenTarget) => void }) {
  const d: NodeDetail = nodeDetail(mission, id);
  const modelTotal = d.modelCalls.reduce((n, c) => n + c.total, 0);
  const usdKnown = d.modelCalls.filter((c) => c.usd !== null);
  const usdTotal = usdKnown.reduce((n, c) => n + (c.usd ?? 0), 0);
  const hasPrice = d.modelCalls.length > 0 && usdKnown.length === d.modelCalls.length;

  return (
    <div className="grid gap-3 text-[13.5px]">
      <p className="m-0 text-ink-2">{d.label}</p>
      <dl className="m-0 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-ink-3">Role</dt>
        <dd className="m-0 text-ink">{d.role}</dd>
        <dt className="text-ink-3">Kind</dt>
        <dd className="m-0 text-ink">{d.kind ? KIND_TEXT[d.kind] : 'Fixed step, no agent'}</dd>
        <dt className="text-ink-3">State</dt>
        <dd className="m-0 text-ink">{d.state}</dd>
      </dl>

      <Section title="Timeline" count={d.timeline.length}>
        {d.timeline.length === 0 ? (
          <Empty>No ledger events for this step yet.</Empty>
        ) : (
          <ol className="m-0 grid list-none gap-1 p-0">
            {d.timeline.map((t) => (
              <li key={t.seq} className="grid grid-cols-[150px_1fr] gap-2">
                <Mono>{fmtTime(mission.events.find((e) => e.seq === t.seq)?.ts ?? '')}</Mono>
                <span className="text-ink">
                  <b className="font-semibold">{t.type}</b>
                  {t.text ? <span className="text-ink-2"> · {t.text}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Inputs" count={d.inputs.length}>
        {d.inputs.length === 0 ? (
          <Empty>{d.id === 'goal' || d.id === 'sources' ? 'Reads the goal and the admitted files directly.' : 'No handoff reached this step.'}</Empty>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {d.inputs.map((i) => (
              <li key={i.seq} className="grid gap-0.5">
                <span className="text-ink">
                  <Mono>{`${i.artifact}@v${i.version}`}</Mono> from <b className="font-semibold">{i.from}</b>
                </span>
                <Mono>sha256 {i.digest.slice(0, 16)}…</Mono>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Outputs" count={d.outputs.length}>
        {d.outputs.length === 0 ? (
          <Empty>Writes no file.</Empty>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {d.outputs.map((o) => (
              <li key={o.seq}>
                <button
                  type="button"
                  onClick={() => onOpen({ type: 'file', id: o.name })}
                  className="grid w-full cursor-pointer gap-0.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left hover:border-line-strong"
                >
                  <span className="font-medium text-ink">
                    {o.name} <Mono>v{o.version}</Mono>
                  </span>
                  <Mono>
                    {o.file} · {o.bytes} bytes · sha256 {o.digest.slice(0, 16)}…
                  </Mono>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {d.summary ? (
        <Section title="Summary">
          <pre className="m-0 whitespace-pre-wrap rounded-md bg-sunken p-2 font-mono text-[12px] text-ink-2">{JSON.stringify(d.summary, null, 2)}</pre>
        </Section>
      ) : null}

      {d.id === 'goal' ? (
        <Section title="Goal">
          {d.goalDrafts.length === 0 && !d.goalValidated ? <Empty>No goal draft yet.</Empty> : null}
          {d.goalDrafts.map((g) => (
            <p key={g.seq} className="m-0 text-ink-2">
              Draft {g.attempt}: {g.ok ? 'accepted' : 'rejected'}
              {g.code ? <Mono> {g.code}</Mono> : null}
            </p>
          ))}
          {d.goalValidated ? (
            <p className="m-0 text-ink-2">
              Validated: <Mono>{d.goalValidated.status}</Mono> · source {d.goalValidated.source ?? 'unknown'}
            </p>
          ) : null}
        </Section>
      ) : null}

      {d.id === 'sources' ? (
        <Section title="Admitted files" count={d.sourcesAdmitted.length}>
          {d.sourcesAdmitted.length === 0 && d.sourcesBlocked.length === 0 ? <Empty>No file admitted yet.</Empty> : null}
          {d.sourcesAdmitted.map((s) => (
            <p key={s.seq} className="m-0 text-ink-2">
              <Mono>{s.file}</Mono> · {s.rows} rows · sha256 {s.digest.slice(0, 12)}…
            </p>
          ))}
          {d.sourcesBlocked.map((s) => (
            <p key={s.seq} className="m-0 text-bad">
              Missing {s.sourceId}: <Mono>{s.code}</Mono>
            </p>
          ))}
        </Section>
      ) : null}

      {d.id === 'review' ? (
        <Section title="Rounds" count={d.rounds.length}>
          {d.rounds.length === 0 ? <Empty>No review round yet.</Empty> : null}
          {d.rounds.map((r) => (
            <div key={r.round} className="grid gap-0.5">
              <span className="text-ink">
                Round {r.round}: <b className={r.outcome === 'failed' ? 'text-bad' : r.outcome === 'passed' ? 'text-ok' : 'text-ink-2'}>{r.outcome}</b>
              </span>
              {r.messages.map((msg) => (
                <span key={msg} className="text-ink-2">
                  {msg}
                </span>
              ))}
            </div>
          ))}
        </Section>
      ) : null}

      {d.id === 'repair' ? (
        <Section title="Repairs" count={d.repairs.length}>
          {d.repairs.length === 0 ? <Empty>No repair was needed.</Empty> : null}
          {d.repairs.map((r) => (
            <div key={r.seq} className="grid gap-0.5">
              <span className="text-ink">
                <Mono>
                  {r.from} → {r.to}
                </Mono>
              </span>
              <span className="text-ink-2">
                {r.changes} change{r.changes === 1 ? '' : 's'}
                {r.strategy ? ` · ${r.strategy}` : ''}
              </span>
            </div>
          ))}
        </Section>
      ) : null}

      {d.runFinished ? (
        <Section title="Run result">
          <p className="m-0 text-ink">
            <b className="font-semibold">{d.runFinished.status}</b> · {d.runFinished.checksPassed}/{d.runFinished.checksTotal} checks · {d.runFinished.repairs} repair
            {d.runFinished.repairs === 1 ? '' : 's'}
          </p>
          {d.runFinished.reason ? <p className="m-0 text-ink-2">{d.runFinished.reason}</p> : null}
        </Section>
      ) : null}

      <Section title="Decision log" count={d.decisions.length}>
        {d.decisions.length === 0 ? (
          <Empty>No message or join decision for this step.</Empty>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {d.decisions.map((x) => (
              <li key={x.seq} className="grid gap-0.5">
                <span className="text-ink-3">
                  <Mono>{fmtTime(mission.events.find((e) => e.seq === x.seq)?.ts ?? '')}</Mono> · {x.type}
                </span>
                <span className="text-ink">
                  {x.kind === 'joined' ? (
                    <>
                      Joined by {x.from || 'planner'}: <span className="text-ink-2">{x.text}</span>
                    </>
                  ) : (
                    <>
                      {x.from} → {x.to}: <span className="text-ink-2">{x.text}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Model calls" count={d.modelCalls.length}>
        {d.modelCalls.length === 0 ? (
          <Empty>{d.kind === 'code' ? 'This step runs as code. No model was called.' : 'No model call for this step.'}</Empty>
        ) : (
          <>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {d.modelCalls.map((c) => (
                <li key={c.seq} className="grid gap-0.5">
                  <span className="text-ink">
                    <Mono>
                      {c.provider}:{c.model}
                    </Mono>{' '}
                    <span className={c.ok ? 'text-ok' : 'text-bad'}>{c.ok ? 'ok' : 'failed'}</span>
                  </span>
                  <span className="text-ink-2">
                    {c.ms} ms · {c.total} tokens ({c.prompt} in, {c.completion} out) ·{' '}
                    {c.usd === null ? 'price not published' : `$${c.usd.toFixed(6)}`}
                  </span>
                  {c.error ? <span className="text-bad">{c.error}</span> : null}
                </li>
              ))}
            </ul>
            <p className="m-0 text-[12.5px] text-ink-3">
              {modelTotal} tokens in total.{' '}
              {hasPrice ? `Cost $${usdTotal.toFixed(6)}.` : 'Cost shown only where the provider price is published.'}
            </p>
          </>
        )}
      </Section>

      <Section title="Fallbacks" count={d.fallbacks.length}>
        {d.fallbacks.length === 0 ? (
          <Empty>No provider switch.</Empty>
        ) : (
          d.fallbacks.map((f) => (
            <p key={f.seq} className="m-0 text-ink-2">
              <Mono>
                {f.from} → {f.to}
              </Mono>{' '}
              ({f.reason})
            </p>
          ))
        )}
      </Section>

      {!['goal', 'sources', 'review', 'repair', 'deliver', 'blocked'].includes(d.id) ? (
        <Section title="Checks on its outputs" count={d.checks.length}>
          {d.checks.length === 0 ? <Empty>No check reads this step's files yet.</Empty> : null}
          <ul className="m-0 grid list-none gap-1 p-0">
            {d.checks.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpen({ type: 'check', id: c.id })}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left hover:border-line-strong"
                >
                  <span className="text-ink">{c.title}</span>
                  <span className={c.status === 'PASS' ? 'font-semibold text-ok' : 'font-semibold text-bad'}>
                    {c.status} · round {c.round}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
