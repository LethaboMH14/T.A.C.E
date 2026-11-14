import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Public } from '../components/Public';
import { Empty, Loading, Mono, Notice } from '../components/ui';
import { DEMO_NOTICE } from '../lib/constants';
import { rpc } from '../lib/api';
import type { Kind, Profile } from '../lib/types';

export function Pick({ kind }: { kind: Kind }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  // After a session ends, the profile to re-enter comes first and is highlighted.
  const preselect = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('preselect');
  // 'new': only free profiles, so nobody picks a name someone else already holds.
  // 'back': only taken profiles, for people signing back in with their own PIN.
  const [mode, setMode] = useState<'new' | 'back'>(preselect ? 'back' : 'new');

  useEffect(() => {
    let alive = true;
    const load = () =>
      rpc<Profile[]>('lms_list_profiles')
        .then((all) => { if (alive) { setProfiles(all.filter((p) => p.kind === kind)); setError(null); } })
        .catch((e: Error) => { if (alive) setError(e.message); });
    load();
    const t = window.setInterval(load, 8000); // a name someone else just took drops out of the free list
    return () => { alive = false; window.clearInterval(t); };
  }, [kind]);

  const inMode = (profiles ?? []).filter((p) => (mode === 'new' ? !p.claimed : p.claimed));
  const shown = inMode
    .filter((p) => `${p.display_name} ${p.id}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.id === preselect) - Number(a.id === preselect));
  const title = mode === 'back' ? 'Sign back in' : kind === 'learner' ? 'Who are you?' : 'Which mentor are you?';
  const takenCount = (profiles ?? []).filter((p) => p.claimed).length;
  const freeCount = (profiles ?? []).length - takenCount;

  return (
    <Public back={{ href: '#/', label: 'Back' }}>
      <header className="mb-5">
        <h1 className="text-[28px] font-bold leading-tight text-ink lg:text-[34px]">{title}</h1>
        <p className="mt-2 text-[16px] text-ink-2">
          {mode === 'back' ? 'Find your name and enter the PIN you chose.' : 'Pick a free name and choose a PIN. Names other people have taken are hidden.'}
        </p>
        <button
          type="button"
          onClick={() => { setMode(mode === 'new' ? 'back' : 'new'); setQ(''); }}
          className="mt-3 min-h-11 rounded-field border border-line-strong bg-surface px-4 text-[15px] font-semibold text-accent transition-colors hover:border-accent"
        >
          {mode === 'new' ? `Already joined? Sign back in (${takenCount})` : `New here? Pick a free name (${freeCount})`}
        </button>
      </header>
      <DemoNote />
      <label className="relative mb-4 mt-4 block">
        <span className="sr-only">Search by name</span>
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === 'learner' ? 'Search, e.g. 12' : 'Search'}
          className="min-h-12 w-full rounded-field border border-line-strong bg-surface pl-10 pr-3 text-[16px] text-ink transition-colors hover:border-accent placeholder:text-ink-3"
        />
      </label>
      {error && <Notice tone="bad">{error} Check the connection and reload.</Notice>}
      {!profiles && !error && <Loading what="profiles" />}
      {profiles && shown.length === 0 && (
        <Empty title={profiles.length === 0 ? 'No profiles in the workspace yet.' : inMode.length === 0 ? (mode === 'new' ? 'Every name is taken.' : 'Nobody has joined yet.') : 'No match.'}>
          {profiles.length === 0
            ? 'The coordinator has not seeded this workspace. Ask at the front desk.'
            : inMode.length === 0
              ? (mode === 'new' ? 'Go back and choose “Create my own learner profile”.' : 'Pick a free name to join.')
              : 'Try another search.'}
        </Empty>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <li key={p.id}>
            <a
              href={`#/pin/${encodeURIComponent(p.id)}`}
              className={`flex min-h-20 flex-col justify-between rounded-field border bg-surface p-3 shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-accent hover:shadow-lift ${
                p.id === preselect ? 'border-accent ring-2 ring-accent/30' : 'border-line'
              }`}
            >
              <span className="text-[16px] font-semibold text-ink">{p.display_name}</span>
              <span className="mt-1 flex items-center justify-between">
                <Mono>{p.id}</Mono>
                <span
                  className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                    p.claimed ? 'bg-sunken text-ink-2' : 'bg-ok-weak text-ok'
                  }`}
                >
                  {p.claimed ? 'yours? sign in' : 'free'}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Public>
  );
}

function DemoNote() {
  return <p className="text-[14px] text-ink-3">{DEMO_NOTICE}</p>;
}
