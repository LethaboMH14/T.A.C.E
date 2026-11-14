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

  useEffect(() => {
    rpc<Profile[]>('lms_list_profiles')
      .then((all) => setProfiles(all.filter((p) => p.kind === kind)))
      .catch((e: Error) => setError(e.message));
  }, [kind]);

  // After a session ends, the profile to re-enter comes first and is highlighted.
  const preselect = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('preselect');
  const shown = (profiles ?? [])
    .filter((p) => `${p.display_name} ${p.id}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.id === preselect) - Number(a.id === preselect));
  const title = kind === 'learner' ? 'Who are you?' : 'Which mentor are you?';

  return (
    <Public back={{ href: '#/', label: 'Back' }}>
      <header className="mb-5">
        <h1 className="text-[28px] font-bold leading-tight text-ink lg:text-[34px]">{title}</h1>
        <p className="mt-2 text-[16px] text-ink-2">Tap your name. Taken names still open with their PIN.</p>
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
        <Empty title={profiles.length === 0 ? 'No profiles in the workspace yet.' : 'No match.'}>
          {profiles.length === 0 ? 'The coordinator has not seeded this workspace. Ask at the front desk.' : 'Try another search.'}
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
                    p.claimed ? 'bg-sunken text-ink-3' : 'bg-ok-weak text-ok'
                  }`}
                >
                  {p.claimed ? 'taken' : 'free'}
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
