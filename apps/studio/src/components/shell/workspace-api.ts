// Fetch helpers for the workspace pages that are not part of the mission ledger stream.
// Every value shown comes from these responses. Errors are rethrown with the server's message.

export interface ProviderRow {
  name: string;
  tier: string;
  configured: boolean;
  models: { fast: string; strong: string };
  price: { inPerM: number; outPerM: number } | null;
}

export interface ProvidersResponse {
  providers: ProviderRow[];
  profile: string;
  chain: string[];
  budget: { maxTokens: number; maxUsd: number };
}

export interface ProviderCheckRow {
  provider: string;
  model: string;
  text: string;
  schema: string;
  ms: number;
}

export interface ProviderCheckResponse {
  checkedAt: string;
  rows: ProviderCheckRow[];
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const workspaceApi = {
  providers: (): Promise<ProvidersResponse> => fetch('/api/providers').then((r) => json<ProvidersResponse>(r)),
  checkProviders: (): Promise<ProviderCheckResponse> =>
    fetch('/api/providers/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((r) => json<ProviderCheckResponse>(r)),
};

// A "check providers" request from anywhere (command palette) to the Models page. The flag covers the
// case where the page is not mounted yet; the event covers the case where it already is.
const CHECK_EVENT = 'tace:check-providers';
let checkRequested = false;

export function requestProviderCheck(): void {
  checkRequested = true;
  window.dispatchEvent(new Event(CHECK_EVENT));
}

/** True once per request. The Models page calls this on mount. */
export function takeProviderCheckRequest(): boolean {
  const was = checkRequested;
  checkRequested = false;
  return was;
}

export function onProviderCheckRequest(fn: () => void): () => void {
  window.addEventListener(CHECK_EVENT, fn);
  return () => window.removeEventListener(CHECK_EVENT, fn);
}
