import { useState, type FormEvent } from 'react';
import { CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authApi, LoginError, type Staff } from '@/lib/auth';
import { Button } from '@/components/ui/button';

const FIELD =
  'h-10 w-full rounded-field border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60';

/** What the person reads after a failed sign-in. Server text wins; a 401 without text is a wrong email or password. */
export function loginErrorText(e: unknown): string {
  if (e instanceof LoginError) {
    if (e.message && !/^Sign-in failed \(HTTP/.test(e.message)) return e.message;
    return e.status === 401 ? 'Email or password is not right.' : e.message;
  }
  return 'Can’t reach the server. Check the connection and try again.';
}

export function SignIn({ onSignedIn }: { onSignedIn: (staff: Staff) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await authApi.login(email.trim(), password));
    } catch (err) {
      setError(loginErrorText(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4 font-sans text-ink">
      <div className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 shadow-card max-[420px]:p-5">
        <div className="mb-5 flex items-center gap-2.5">
          <svg className="h-[26px] w-[26px] shrink-0" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <linearGradient id="tace-mark-signin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7D9EFA" />
                <stop offset=".55" stopColor="#DB61E6" />
                <stop offset="1" stopColor="#8F66ED" />
              </linearGradient>
            </defs>
            <path d="M16 3 29 27H3z" fill="url(#tace-mark-signin)" />
            <path d="M16 12.5 21.6 23H10.4z" fill="#fff" />
          </svg>
          <span className="font-display text-[17px] font-bold leading-none tracking-[0.02em]">T.A.C.E</span>
        </div>
        <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">Sign in</h1>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signin-email" className="text-[13px] font-medium text-ink-2">Email</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'signin-error' : undefined}
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signin-password" className="text-[13px] font-medium text-ink-2">Password</label>
            <div className="relative">
              <input
                id="signin-password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'signin-error' : undefined}
                className={`${FIELD} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="absolute right-1 top-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-field text-ink-2 hover:bg-sunken"
              >
                {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>

          {error ? (
            <p id="signin-error" role="alert" className="m-0 flex items-start gap-2 text-[13.5px] leading-[1.45] text-bad">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy || !email.trim() || !password} className="h-10 w-full">
            {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
