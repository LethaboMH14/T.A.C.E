import { useEffect, useState } from 'react';
import { api, type Mission, type RunOverrides } from '@/state';
import { scenarioIdOf } from '@/state/selectors-node';
import { parseCsv } from '../FileDrawer';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const PROFILES = ['demo', 'free', 'cheap', 'meta'] as const;

interface MentorOption { id: string; name: string }
interface ProviderOption { name: string; configured: boolean }

/** GET /api/providers may be a list or an object with providers. A failure hides the provider select. */
async function loadProviders(): Promise<ProviderOption[] | null> {
  try {
    const res = await fetch('/api/providers');
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const list = Array.isArray(body) ? body : (body as { providers?: unknown }).providers;
    if (!Array.isArray(list)) return null;
    return list
      .map((p) => ({ name: String((p as { name?: unknown }).name ?? ''), configured: !!(p as { configured?: unknown }).configured }))
      .filter((p) => /^[a-z]{2,20}$/.test(p.name));
  } catch {
    return null;
  }
}

async function loadMentors(): Promise<MentorOption[]> {
  const res = await fetch('/api/sources/mentors.csv');
  if (!res.ok) throw new Error(`mentors.csv: HTTP ${res.status}`);
  const { rows } = parseCsv(await res.text());
  return rows.filter((r) => /^M-[A-Z]$/.test(r.mentor_id ?? '')).map((r) => ({ id: r.mentor_id, name: r.display_name || r.mentor_id }));
}

/**
 * Starts a REAL new run from the same scenario with one change. The run this form belongs to stays as it is.
 * The server validates every value (checkOverrides in web/server.mjs) and its 400/409 text is shown as is.
 */
export function RunAgainForm({ mission }: { mission: Mission }) {
  const scenario = scenarioIdOf(mission.events);
  const rerunnable = !!scenario && scenario !== 'custom';

  const [mentors, setMentors] = useState<MentorOption[] | null>(null);
  const [mentorErr, setMentorErr] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);

  const [mentor, setMentor] = useState('');
  const [day, setDay] = useState<string>('Tue');
  const [profile, setProfile] = useState('');
  const [provider, setProvider] = useState('');
  const [modelOff, setModelOff] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadMentors().then(
      (list) => alive && setMentors(list),
      (e: unknown) => alive && setMentorErr(e instanceof Error ? e.message : 'could not load mentors'),
    );
    loadProviders().then((list) => alive && setProviders(list));
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    if (!scenario || busy) return;
    const overrides: RunOverrides = {};
    if (mentor) overrides.unavailable = [{ mentor_id: mentor, day }];
    if (profile) overrides.profile = profile as RunOverrides['profile'];
    if (provider) overrides.provider = provider;
    setBusy(true);
    setError(null);
    try {
      const { runId } = await api.start(scenario, overrides, modelOff ? 'off' : undefined);
      window.location.hash = `#/mission/${encodeURIComponent(runId)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The run could not be started.');
    } finally {
      setBusy(false);
    }
  }

  const selectCls = 'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-ink disabled:opacity-50';

  return (
    <form
      className="grid gap-3 text-[13px]"
      aria-label="Run again with a change"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!rerunnable ? (
        <p className="m-0 text-ink-3">
          {scenario === 'custom'
            ? 'This run came from a free-text goal. Start a new one from the prompt bar to change it.'
            : 'This run has no scenario id in its ledger, so it cannot be run again.'}
        </p>
      ) : null}

      <fieldset className="grid gap-1.5 border-0 p-0" disabled={!rerunnable || busy}>
        <legend className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Constraint</legend>
        <label className="grid gap-1 text-ink-2">
          Mentor unavailable
          {mentorErr ? <span className="text-bad">{mentorErr}</span> : null}
          <select className={selectCls} value={mentor} onChange={(e) => setMentor(e.target.value)} disabled={!mentors}>
            <option value="">No change</option>
            {(mentors ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-ink-2">
          Day away
          <select className={selectCls} value={day} onChange={(e) => setDay(e.target.value)} disabled={!mentor}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid gap-1.5 border-0 p-0" disabled={!rerunnable || busy}>
        <legend className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Model</legend>
        <label className="flex items-center gap-2 text-ink-2">
          <input type="checkbox" checked={modelOff} onChange={(e) => setModelOff(e.target.checked)} />
          Model off (deterministic code only)
        </label>
        <label className="grid gap-1 text-ink-2">
          Profile
          <select className={selectCls} value={profile} onChange={(e) => setProfile(e.target.value)} disabled={modelOff}>
            <option value="">Server default</option>
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {providers && providers.length > 0 ? (
          <label className="grid gap-1 text-ink-2">
            Provider
            <select className={selectCls} value={provider} onChange={(e) => setProvider(e.target.value)} disabled={modelOff}>
              <option value="">Profile order</option>
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.configured ? '' : ' (no key)'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </fieldset>

      {error ? <p className="m-0 rounded-md bg-bad-weak px-2.5 py-2 text-bad">{error}</p> : null}

      <button
        type="submit"
        disabled={!rerunnable || busy}
        className="cursor-pointer rounded-md bg-ink px-3 py-2 text-[13px] font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Run again with this change'}
      </button>
      <p className="m-0 text-[12px] text-ink-3">Starts a new run; this one stays as it is. The new run is a real run and may call a model.</p>
    </form>
  );
}
