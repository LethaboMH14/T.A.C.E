// Raw ledger events for the U8 views. Mission state keeps no per-event timestamps or MODEL_CALL token split,
// so these views read the same SSE stream the reducer reads (/api/runs/:id/events). If the Mission ever carries
// `events`, that list is used instead and no second stream is opened.

import { useEffect, useState } from 'react';
import type { LedgerEvent, Mission } from '@/state';

/** Roles that always sort last in lanes and cards, after the workers. */
export const LAST_ROLES = ['Reviewer', 'Repair'] as const;

/** Stable lane order: first appearance by ledger seq, with Reviewer and Repair last. */
export function orderNames(names: string[]): string[] {
  const seen = [...new Set(names)];
  const rest = seen.filter((n) => !(LAST_ROLES as readonly string[]).includes(n));
  return [...rest, ...LAST_ROLES.filter((r) => seen.includes(r))];
}

export function sortedEvents(events: LedgerEvent[]): LedgerEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq);
}

/** Opens the run's event stream and collects raw events, deduplicated by seq. Does nothing when disabled. */
export function useLedgerEvents(runId: string | null, enabled = true): LedgerEvent[] {
  const [events, setEvents] = useState<LedgerEvent[]>([]);

  useEffect(() => {
    setEvents([]);
    if (!runId || !enabled) return;
    const seen = new Set<number>();
    const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
    es.onmessage = (msg) => {
      let e: LedgerEvent;
      try {
        e = JSON.parse(msg.data) as LedgerEvent;
      } catch {
        return;
      }
      if (seen.has(e.seq)) return;
      seen.add(e.seq);
      setEvents((prev) => [...prev, e]);
    };
    es.addEventListener('end', () => es.close());
    return () => es.close();
  }, [runId, enabled]);

  return events;
}

/** Events for a mission: Mission.events when the state provides it, otherwise the run's own stream. */
export function useRunEvents(mission: Mission): LedgerEvent[] {
  const provided = (mission as Mission & { events?: LedgerEvent[] }).events;
  const own = useLedgerEvents(mission.runId, !provided);
  return provided ?? own;
}

/** One MODEL_CALL, normalised. Split fields are null when the source only has a total. */
export interface UsageCall {
  agent: string;
  provider: string | null;
  model: string | null;
  ok: boolean;
  ms: number;
  total: number;
  prompt: number | null;
  completion: number | null;
  error: string | null;
  ts: number | null;
}

/** MODEL_CALL events when present (they carry the prompt/completion split), else the totals in Mission.modelCalls. */
export function usageCalls(mission: Mission, events: LedgerEvent[]): UsageCall[] {
  const fromEvents = events
    .filter((e) => e.type === 'MODEL_CALL')
    .map((e): UsageCall => {
      const d = e.data ?? {};
      const u = d.usage ?? {};
      return {
        agent: String(d.agent ?? e.role ?? ''),
        provider: d.provider ?? null,
        model: d.model ?? null,
        ok: !!d.ok,
        ms: Number(d.ms ?? 0),
        total: Number(u.total ?? 0),
        prompt: typeof u.prompt === 'number' ? u.prompt : null,
        completion: typeof u.completion === 'number' ? u.completion : null,
        error: d.error ?? null,
        ts: Date.parse(e.ts),
      };
    });
  if (fromEvents.length) return fromEvents;
  return mission.modelCalls.map((c) => ({
    agent: c.agent,
    provider: c.provider ?? null,
    model: c.model ?? null,
    ok: c.ok,
    ms: c.ms,
    total: c.total,
    prompt: null,
    completion: null,
    error: c.error,
    ts: null,
  }));
}
