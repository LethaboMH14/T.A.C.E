import { useEffect, useMemo, useState } from 'react';
import { api, type Mission } from '@/state';
import { fileVersions } from '@/state/selectors-node';
import { parseCsv } from '../FileDrawer';

type Loaded = { version: number; text: string | null; error: string | null } | null;

/** Every version of one artifact file, with the chosen version opened through api.fileText. */
export function FileInspector({ mission, name }: { mission: Mission; name: string }) {
  const versions = useMemo(() => fileVersions(mission, name), [mission, name]);
  const latest = versions[versions.length - 1]?.version ?? null;
  const [chosen, setChosen] = useState<number | null>(latest);
  const [loaded, setLoaded] = useState<Loaded>(null);

  // A new version arrived (or another file was selected): show the latest one.
  useEffect(() => {
    setChosen(latest);
  }, [name, latest]);

  const ref = versions.find((v) => v.version === chosen) ?? null;
  const file = ref?.file ?? null;
  const runId = mission.runId;

  useEffect(() => {
    if (!runId || !file || chosen === null) return;
    let alive = true;
    setLoaded(null);
    api
      .fileText(runId, file)
      .then((t) => alive && setLoaded({ version: chosen, text: t, error: null }))
      .catch((e: unknown) => alive && setLoaded({ version: chosen, text: null, error: e instanceof Error ? e.message : 'could not open' }));
    return () => {
      alive = false;
    };
  }, [runId, file, chosen]);

  if (versions.length === 0) {
    return <p className="m-0 text-[13.5px] text-ink-3">No version of {name} has been written in this run.</p>;
  }

  const current = loaded && loaded.version === chosen ? loaded : null;

  return (
    <div className="grid gap-3 text-[13.5px]">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Versions">
        {versions.map((v) => (
          <button
            key={v.version}
            type="button"
            aria-pressed={v.version === chosen}
            onClick={() => setChosen(v.version)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[12.5px] ${
              v.version === chosen ? 'border-accent bg-accent-weak font-semibold text-ink' : 'border-line bg-surface text-ink-2'
            }`}
          >
            v{v.version} · by {v.by}
          </button>
        ))}
      </div>

      {ref ? (
        <dl className="m-0 grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 font-mono text-[12px] text-ink-2">
          <dt className="font-sans text-ink-3">File</dt>
          <dd className="m-0 break-all">{ref.file}</dd>
          <dt className="font-sans text-ink-3">Bytes</dt>
          <dd className="m-0">{ref.bytes}</dd>
          <dt className="font-sans text-ink-3">sha256</dt>
          <dd className="m-0 break-all">{ref.digest}</dd>
          <dt className="font-sans text-ink-3">Inputs</dt>
          <dd className="m-0 break-all">{ref.inputs.map((i) => `${i.name}@${typeof i.version === 'number' ? `v${i.version}` : i.version}`).join(', ') || 'none'}</dd>
        </dl>
      ) : null}

      {!current ? <p className="m-0 text-ink-3">Loading file…</p> : null}
      {current && current.text === null ? <p className="m-0 text-bad">This file could not be opened{current.error ? `: ${current.error}` : '.'}</p> : null}
      {current && current.text !== null ? <FileBody name={name} text={current.text} /> : null}
    </div>
  );
}

function FileBody({ name, text }: { name: string; text: string }) {
  if (name.endsWith('.csv')) {
    const { header, rows } = parseCsv(text);
    return (
      <div className="max-h-[420px] overflow-auto rounded-md border border-line">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr>
              {header.map((h) => (
                <th key={h} scope="col" className="sticky top-0 border-b border-line-strong bg-surface px-2 py-1 text-left font-medium text-ink-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {header.map((h) => (
                  <td key={h} className="whitespace-nowrap border-b border-line px-2 py-1">
                    {r[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  let pretty = text;
  if (name.endsWith('.json')) {
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // Not valid JSON: show the file exactly as written.
    }
  }
  return <pre className="m-0 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-sunken p-2.5 font-mono text-[12px] leading-[1.6] text-ink">{pretty}</pre>;
}
