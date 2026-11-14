import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { AgentMessage, Mission } from '@/state';

const TYPE_STYLE: Record<AgentMessage['type'], string> = {
  REQUEST: 'bg-[color-mix(in_srgb,var(--blue)_22%,transparent)] text-ink',
  RESULT: 'bg-ok-weak text-ok',
  CHALLENGE: 'bg-run-weak text-run',
  DECISION: 'bg-accent-weak text-accent-ink',
  ESCALATE: 'bg-bad-weak text-bad',
};

const NEAR_BOTTOM_PX = 48;

export function AgentRoom({ mission }: { mission: Mission }) {
  const messages = mission.messages;
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const emptyText =
    mission.agents?.mode === 'code' ? 'Code-only run: no model agents took part.' : 'Messages appear as agents talk.';

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card" aria-labelledby="h-room">
      <h2 id="h-room" className="text-[15px] font-semibold tracking-[-0.005em]">
        Agent room
      </h2>
      <p className="mb-2.5 mt-0.5 text-[13px] text-ink-3">Typed messages between agents, straight from the ledger.</p>

      {messages.length === 0 ? (
        <p className="m-0 rounded-field bg-sunken px-3 py-2.5 text-[13.5px] text-ink-3">{emptyText}</p>
      ) : (
        <ol
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-label="Agent messages"
          className="m-0 max-h-[360px] list-none overflow-y-auto p-0 pr-1"
        >
          {messages.map((m) => (
            <li key={m.id} className="grid gap-1 border-b border-line py-2.5 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px] font-medium', TYPE_STYLE[m.type])}>
                  {m.type}
                </span>
                <span className="min-w-0 text-[13px] text-ink-2 [overflow-wrap:anywhere]">
                  {m.from} → {m.to}
                </span>
                <span className="mono ml-auto text-[11.5px] text-ink-3">{m.id}</span>
              </div>
              <p className="m-0 text-[13.5px] leading-[1.45] text-ink [overflow-wrap:anywhere]">{m.reason}</p>
              {m.about?.artifact || m.about?.checkId ? (
                <div className="flex flex-wrap gap-1.5">
                  {m.about.artifact ? (
                    <span className="mono rounded-full bg-accent-weak px-2 py-0.5 text-[11.5px] text-accent-ink">
                      {m.about.artifact}
                    </span>
                  ) : null}
                  {m.about.checkId ? (
                    <span className="mono rounded-full bg-sunken px-2 py-0.5 text-[11.5px] text-ink-2">
                      {m.about.checkId}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
