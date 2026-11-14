// Calls to the live class endpoints. Every value returned is shown as the server sent it.

import { useCallback, useEffect, useState } from 'react';

export interface LmsStatus {
  configured: boolean;
  url: string | null;
  portalUrl: string | null;
  counts: { profiles: number | null; claimed: number | null; attempts_live: number | null; help: number | null } | null;
  notify: { email: { connected: boolean }; sms: { connected: boolean } };
  error?: string;
}

export interface RunSnapshot {
  files: { name: string; rows: number; digest: string }[];
  learners: number;
  helpRequests: number;
}

export interface DeliverResult {
  delivered: number;
  remembered: number;
  learners: number;
  mentors: number;
  notify?: { email?: { sent?: number; failed?: number } | boolean; sms?: { sent?: number; failed?: number } | boolean; counts?: unknown } | null;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function read<T>(res: Response): Promise<T> {
  const b = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new ApiError(typeof b.error === 'string' && b.error ? b.error : `HTTP ${res.status}`, res.status);
  return b as T;
}

const post = (url: string, body: unknown): Promise<Response> =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Fills in what an older or partial status response leaves out, without inventing a connected channel. */
export function normalizeStatus(raw: Partial<LmsStatus> & { error?: string }): LmsStatus {
  return {
    configured: !!raw.configured,
    url: raw.url ?? null,
    portalUrl: typeof raw.portalUrl === 'string' && raw.portalUrl ? raw.portalUrl : null,
    counts: raw.counts ?? null,
    notify: {
      email: { connected: !!raw.notify?.email?.connected },
      sms: { connected: !!raw.notify?.sms?.connected },
    },
    ...(raw.error ? { error: raw.error } : {}),
  };
}

export const lmsApi = {
  status: async (): Promise<LmsStatus> => {
    const res = await fetch('/api/lms/status');
    const b = (await res.json().catch(() => ({}))) as Partial<LmsStatus> & { error?: string };
    // 502 still carries configured/url/error: the portal is configured but unreachable.
    if (!res.ok && !('configured' in b)) throw new ApiError(b.error ?? `HTTP ${res.status}`, res.status);
    return normalizeStatus(b);
  },
  run: (goal: string): Promise<{ runId: string; snapshot: RunSnapshot }> =>
    post('/api/lms/run', goal.trim() ? { goal: goal.trim() } : {}).then((r) => read(r)),
  deliver: (runId: string, notify: boolean): Promise<DeliverResult> =>
    post(`/api/runs/${encodeURIComponent(runId)}/deliver`, { confirm: true, notify }).then((r) => read(r)),
};

export type StatusState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: LmsStatus };

export function useLmsStatus(): { state: StatusState; reload: () => void } {
  const [state, setState] = useState<StatusState>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }));
    lmsApi
      .status()
      .then((status) => alive && setState({ kind: 'ready', status }))
      .catch((e: Error) => alive && setState({ kind: 'error', message: e.message }));
    return () => {
      alive = false;
    };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
