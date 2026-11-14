import { useState } from 'react';
import { Public } from '../components/Public';
import { PinPad } from '../components/PinPad';
import { Button, Notice } from '../components/ui';
import { DEMO_NOTICE } from '../lib/constants';
import { rpc } from '../lib/api';
import { nameValid, pinValid } from '../lib/helpers';
import { go } from '../lib/route';
import { saveSession } from '../lib/session';

export function Create() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = nameValid(name) && pinValid(pin) && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await rpc<{ id: string; token: string }>('lms_create_profile', { p_name: name.trim(), p_pin: pin });
      saveSession({ id: r.id, kind: 'learner', token: r.token });
      go('/learner');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the profile.');
      setBusy(false);
    }
  };

  return (
    <Public back={{ href: '#/', label: 'Back' }}>
      <header className="mb-6">
        <h1 className="text-[28px] font-bold leading-tight text-ink lg:text-[34px]">Create my own learner profile</h1>
        <p className="mt-2 text-[16px] text-ink-2">A nickname and a PIN. No email or phone number.</p>
      </header>
      <Notice tone="info">{DEMO_NOTICE}</Notice>
      <div className="mt-6 space-y-6">
        <div>
          <label htmlFor="nick" className="mb-2 block text-[15px] font-semibold text-ink">
            Nickname
          </label>
          <input
            id="nick"
            value={name}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            placeholder="For example: Thandi M."
            className="min-h-12 w-full rounded-field border border-line-strong bg-surface px-3 text-[16px] text-ink transition-colors hover:border-accent placeholder:text-ink-3"
          />
          <p className="mt-1 text-right font-mono text-[13px] text-ink-3">{name.length}/40</p>
        </div>
        <div>
          <p className="mb-3 text-[15px] font-semibold text-ink">Choose a PIN (4 to 8 digits)</p>
          <PinPad value={pin} onChange={setPin} onSubmit={submit} />
        </div>
        <div className="mx-auto max-w-xs space-y-3">
          <Button variant="primary" onClick={submit} disabled={!ready} className="w-full">
            {busy ? 'Creating…' : 'Create my profile'}
          </Button>
          {error && <Notice tone="bad">{error}</Notice>}
        </div>
      </div>
    </Public>
  );
}
