// Coordinator sign-in. The server decides whether sign-in is required (GET /api/auth/me).
// Pure parts (state machine, fetch wrapper) are exported for tests; the React provider is in components/auth.

export interface Staff {
  id: string;
  email: string;
  display_name: string;
}

export interface AuthMe {
  required: boolean;
  staff: Staff | null;
}

export type AuthPhase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; me: AuthMe };

export type AuthAction =
  | { type: 'loaded'; me: AuthMe }
  | { type: 'failed'; message: string }
  | { type: 'signed-in'; staff: Staff }
  | { type: 'signed-out' }
  | { type: 'auth-required' }
  | { type: 'retry' };

export type Gate = 'loading' | 'error' | 'signin' | 'app';

export const initialAuth: AuthPhase = { kind: 'loading' };

export function authReducer(state: AuthPhase, action: AuthAction): AuthPhase {
  switch (action.type) {
    case 'loaded':
      return { kind: 'ready', me: action.me };
    case 'failed':
      return { kind: 'error', message: action.message };
    case 'retry':
      return { kind: 'loading' };
    case 'signed-in':
      return { kind: 'ready', me: { required: true, staff: action.staff } };
    case 'signed-out':
    case 'auth-required':
      // The server said so (or the person signed out): the app is not shown until a new sign-in succeeds.
      return { kind: 'ready', me: { required: true, staff: null } };
    default:
      return state;
  }
}

/** Which screen to show. The app is shown only when sign-in is not required, or a staff member is signed in. */
export function gate(state: AuthPhase): Gate {
  if (state.kind === 'loading') return 'loading';
  if (state.kind === 'error') return 'error';
  return state.me.required && !state.me.staff ? 'signin' : 'app';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

// ---- network

async function body<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

export class LoginError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const authApi = {
  me: async (): Promise<AuthMe> => {
    const res = await fetch('/api/auth/me');
    const b = await body<Partial<AuthMe>>(res);
    if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
    return { required: !!b.required, staff: b.staff ?? null };
  },
  login: async (email: string, password: string): Promise<Staff> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const b = await body<{ staff?: Staff }>(res);
    if (!res.ok || !b.staff) throw new LoginError(b.error ?? `Sign-in failed (HTTP ${res.status})`, res.status);
    return b.staff;
  },
  logout: async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' });
  },
};

// ---- 401 handling for every /api/* call

const AUTH_EVENT = 'tace:auth-required';

/** Tell the app that the server wants a sign-in (a 401 AUTH_REQUIRED, or an event stream that was refused). */
export function announceAuthRequired(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthRequired(fn: () => void): () => void {
  window.addEventListener(AUTH_EVENT, fn);
  return () => window.removeEventListener(AUTH_EVENT, fn);
}

type FetchFn = typeof fetch;

/** Wraps fetch: a 401 with {code:'AUTH_REQUIRED'} from /api/* calls onRequired. The response is returned untouched. */
export function wrapFetch(base: FetchFn, onRequired: () => void): FetchFn {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await base(input, init);
    if (res.status === 401) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      if (url.startsWith('/api/') && !url.startsWith('/api/auth/login')) {
        const b = (await res.clone().json().catch(() => null)) as { code?: string } | null;
        if (b?.code === 'AUTH_REQUIRED') onRequired();
      }
    }
    return res;
  }) as FetchFn;
}

/** An event stream cannot show a status code. After it fails, ask the server whether the cause is a missing sign-in. */
export async function probeAuth(): Promise<void> {
  try {
    const me = await authApi.me();
    if (me.required && !me.staff) announceAuthRequired();
  } catch {
    /* server unreachable: not an auth problem */
  }
}
