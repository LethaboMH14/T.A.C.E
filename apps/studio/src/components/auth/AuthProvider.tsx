import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { Loader2, ServerOff } from 'lucide-react';
import {
  authApi, authReducer, gate, initialAuth, onAuthRequired, wrapFetch, type Staff,
} from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { SignIn } from './SignIn';

interface AuthContextValue {
  /** The signed-in staff member, or null when the server does not require sign-in. */
  staff: Staff | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ staff: null, signOut: async () => {} });

export const useAuth = (): AuthContextValue => useContext(AuthContext);

/**
 * Asks the server who is signed in, and shows the app only when the server is satisfied.
 * Every /api/* call is wrapped so a 401 AUTH_REQUIRED returns the person to the sign-in screen.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuth);

  const load = useCallback(() => {
    dispatch({ type: 'retry' });
    authApi
      .me()
      .then((me) => dispatch({ type: 'loaded', me }))
      .catch((e: Error) => dispatch({ type: 'failed', message: e.message }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = wrapFetch(original.bind(window), () => dispatch({ type: 'auth-required' }));
    const off = onAuthRequired(() => dispatch({ type: 'auth-required' }));
    return () => {
      window.fetch = original;
      off();
    };
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => {});
    dispatch({ type: 'signed-out' });
  }, []);

  const staff = state.kind === 'ready' ? state.me.staff : null;
  const value = useMemo(() => ({ staff, signOut }), [staff, signOut]);
  const screen = gate(state);

  if (screen === 'loading') {
    return (
      <div role="status" className="flex h-screen items-center justify-center gap-2 bg-bg text-[14px] text-ink-2">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        Checking sign-in…
      </div>
    );
  }
  if (screen === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-6">
        <div role="alert" className="flex max-w-[420px] flex-col items-start gap-3 rounded-card border border-bad-line bg-surface p-5 shadow-card">
          <p className="m-0 flex items-center gap-2 text-[15px] font-semibold text-bad">
            <ServerOff className="h-4 w-4" aria-hidden />
            Can’t reach the server
          </p>
          <p className="m-0 text-[14px] text-ink-2">{state.kind === 'error' ? state.message : ''}</p>
          <Button onClick={load}>Try again</Button>
        </div>
      </div>
    );
  }
  if (screen === 'signin') {
    return <SignIn onSignedIn={(s) => dispatch({ type: 'signed-in', staff: s })} />;
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
