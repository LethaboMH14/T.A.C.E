// Polls a run's ledger (GET /api/runs/:id/poll?after=seq) instead of holding an SSE stream open.
// Proxies such as Cloudflare tunnels buffer SSE until the response ends, which made a live run look frozen
// until it finished. Polling returns the same ledger events, works through any proxy, and resumes by seq.

import type { LedgerEvent } from '@/state';

export type PollState = 'live' | 'lost' | 'stopped' | 'ended';

interface PollBody {
  events: LedgerEvent[];
  finished: boolean;
  running: boolean;
}

const INTERVAL_MS = 1000;
const MAX_BACKOFF_MS = 5000;

/** Starts polling. onEvents gets new events in ledger order, each seq once. Returns a stop function. */
export function pollRun(
  runId: string,
  onEvents: (events: LedgerEvent[]) => void,
  onState: (state: PollState) => void,
): () => void {
  let after = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let delay = INTERVAL_MS;

  const tick = async () => {
    if (stopped) return;
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/poll?after=${after}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as PollBody;
      if (stopped) return;
      const fresh = body.events.filter((e) => e.seq > after).sort((a, b) => a.seq - b.seq);
      if (fresh.length) {
        after = fresh[fresh.length - 1].seq;
        onEvents(fresh);
      }
      delay = INTERVAL_MS;
      if (body.finished) {
        onState('ended');
        return; // finished: nothing more to wait for
      }
      if (!body.running) {
        onState('stopped'); // not finished and no longer running here: the run ended without RUN_FINISHED
        return;
      }
      onState('live');
    } catch {
      if (stopped) return;
      onState('lost');
      delay = Math.min(delay * 2, MAX_BACKOFF_MS);
    }
    timer = setTimeout(tick, delay);
  };

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
