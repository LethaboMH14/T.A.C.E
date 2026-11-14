import { useEffect, useState } from 'react';
import { Public } from '../components/Public';
import { Notice } from '../components/ui';
import { isRelogin, rpc } from '../lib/api';
import { go } from '../lib/route';
import { clearSession, setFlash, type Session } from '../lib/session';

// On load with a saved token: check it with lms_me and resume. An invalid token goes to the picker, profile preselected.
export function Resume({ session }: { session: Session }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc('lms_me', { p_token: session.token })
      .then(() => go(`/${session.kind}`))
      .catch((e: unknown) => {
        if (isRelogin(e)) {
          clearSession(session.id);
          setFlash('Please log in again. Enter your PIN and your earlier data comes back.');
          go(`/pick/${session.kind}?preselect=${encodeURIComponent(session.id)}`);
        } else {
          setError(e instanceof Error ? e.message : 'Could not reach the workspace.');
        }
      });
  }, [session]);

  return (
    <Public>
      {error ? (
        <div className="space-y-3">
          <Notice tone="bad">{error}</Notice>
          <a href={`#/${session.kind}`} className="inline-block text-accent-ink underline">
            Try again
          </a>
        </div>
      ) : (
        <p className="py-12 text-center text-[16px] text-ink-3">Resuming your session…</p>
      )}
    </Public>
  );
}
