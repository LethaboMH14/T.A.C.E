import { useEffect, useState } from 'react';
import { Public } from '../components/Public';
import { PinPad } from '../components/PinPad';
import { Button, Loading, Notice } from '../components/ui';
import { rpc } from '../lib/api';
import { pinValid } from '../lib/helpers';
import { go } from '../lib/route';
import { saveSession } from '../lib/session';
import type { Profile } from '../lib/types';

export function Pin({ id }: { id: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc<Profile[]>('lms_list_profiles')
      .then((all) => setProfile(all.find((p) => p.id === id) ?? null))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const submit = async () => {
    if (!profile || !pinValid(pin) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await rpc<string>('lms_login', { p_id: profile.id, p_pin: pin });
      saveSession({ id: profile.id, kind: profile.kind, token });
      go(`/${profile.kind}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      setBusy(false);
    }
  };

  const back = profile ? `#/pick/${profile.kind}` : '#/';

  return (
    <Public back={{ href: back, label: 'Back' }}>
      {profile === undefined && !error && <Loading what="profile" />}
      {profile === null && <Notice tone="bad">No profile called {id} exists in this workspace.</Notice>}
      {profile && (
        <>
          <header className="mb-6">
            <p className="text-[15px] text-ink-3">{profile.display_name}</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight text-ink lg:text-[34px]">
              {profile.claimed ? 'Enter your PIN' : 'Choose a PIN to claim this profile'}
            </h1>
            <p className="mt-2 text-[16px] text-ink-2">
              {profile.claimed
                ? 'Use the PIN you chose the first time.'
                : 'Use 4 to 8 digits. Remember it: you need it to come back to this profile.'}
            </p>
          </header>
          <PinPad value={pin} onChange={setPin} onSubmit={submit} />
          <div className="mx-auto mt-6 max-w-xs space-y-3">
            <Button variant="primary" onClick={submit} disabled={!pinValid(pin) || busy} className="w-full">
              {busy ? 'Checking…' : profile.claimed ? 'Log in' : 'Claim this profile'}
            </Button>
            {error && <Notice tone="bad">{error}</Notice>}
          </div>
        </>
      )}
      {profile === undefined && error && <Notice tone="bad">{error}</Notice>}
    </Public>
  );
}
