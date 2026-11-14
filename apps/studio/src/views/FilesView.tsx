import { useEffect, useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { FileText } from 'lucide-react';
import { sortFileNames } from '@/components/FilesPanel';
import { api, type ArtifactRef, type Mission } from '@/state';
import { cn } from '@/lib/utils';

export type Version = ArtifactRef & { seq: number; by: string };

export type DiffItem =
  | { type: 'add' | 'del' | 'same'; text: string }
  | { type: 'gap'; count: number; lines: string[] };

/** Unchanged runs longer than this collapse to one "N unchanged lines" row. */
export const COLLAPSE_OVER = 3;

function splitLines(value: string): string[] {
  const lines = value.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Line diff of two texts (jsdiff). Unchanged runs longer than COLLAPSE_OVER become gap items. */
export function buildDiff(a: string, b: string): DiffItem[] {
  const out: DiffItem[] = [];
  for (const part of diffLines(a, b)) {
    const lines = splitLines(part.value);
    if (part.added) for (const text of lines) out.push({ type: 'add', text });
    else if (part.removed) for (const text of lines) out.push({ type: 'del', text });
    else if (lines.length > COLLAPSE_OVER) out.push({ type: 'gap', count: lines.length, lines });
    else for (const text of lines) out.push({ type: 'same', text });
  }
  return out;
}

export function defaultPair(name: string, versions: Version[]): [number, number] | null {
  if (versions.length < 2) return null;
  const first = versions[0].version;
  const last = versions[versions.length - 1].version;
  // mentor-schedule.csv is the file the Reviewer repairs most, so its default is the original against the latest.
  if (name === 'mentor-schedule.csv') return [first, last];
  return [versions[versions.length - 2].version, last];
}

export function FilesView({ mission }: { mission: Mission }) {
  const names = sortFileNames(Object.keys(mission.files));
  const [chosen, setChosen] = useState<string | null>(null);
  const name = chosen && mission.files[chosen] ? chosen : names.includes('mentor-schedule.csv') ? 'mentor-schedule.csv' : (names[0] ?? null);

  if (!mission.runId) {
    return <section className="rounded-card border border-line bg-surface p-5 text-[14px] text-ink-3">Select a run to see its files.</section>;
  }
  if (!name) {
    return <section className="rounded-card border border-line bg-surface p-5 text-[14px] text-ink-3">No files yet. Files appear as each worker saves them.</section>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <ul className="m-0 grid list-none content-start gap-1.5 p-0" aria-label="Files">
        {names.map((n) => {
          const versions = mission.files[n].versions;
          return (
            <li key={n}>
              <button
                type="button"
                aria-pressed={n === name}
                onClick={() => setChosen(n)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-field border px-3 py-2 text-left text-[13.5px]',
                  n === name ? 'border-accent bg-accent-weak text-accent-ink' : 'border-line bg-surface text-ink hover:border-line-strong',
                )}
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{n}</span>
                <span className="mono text-[11.5px] text-ink-3">{versions.length} v</span>
              </button>
            </li>
          );
        })}
      </ul>
      <FileDetail key={name} runId={mission.runId} name={name} versions={mission.files[name].versions} />
    </div>
  );
}

function FileDetail({ runId, name, versions }: { runId: string; name: string; versions: Version[] }) {
  const initial = defaultPair(name, versions);
  const [pair, setPair] = useState<[number, number] | null>(initial);
  const [texts, setTexts] = useState<Record<string, string | null>>({});
  const byVersion = (v: number) => versions.find((x) => x.version === v);

  const fileA = pair ? byVersion(pair[0])?.file ?? null : null;
  const fileB = pair ? byVersion(pair[1])?.file ?? null : null;

  useEffect(() => {
    let alive = true;
    for (const f of [fileA, fileB]) {
      if (!f) continue;
      api
        .fileText(runId, f)
        .then((t) => alive && setTexts((prev) => ({ ...prev, [f]: t })))
        .catch(() => alive && setTexts((prev) => ({ ...prev, [f]: null })));
    }
    return () => {
      alive = false;
    };
  }, [runId, fileA, fileB]);

  const items = useMemo(() => {
    if (!fileA || !fileB) return null;
    const a = texts[fileA];
    const b = texts[fileB];
    if (typeof a !== 'string' || typeof b !== 'string') return null;
    return buildDiff(a, b);
  }, [texts, fileA, fileB]);

  const loadError = (fileA && texts[fileA] === null) || (fileB && texts[fileB] === null);

  return (
    <section className="grid min-w-0 content-start gap-3" aria-label={`${name} versions`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-[16px] font-semibold">{name}</h2>
        {versions.length >= 2 && pair ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <label className="flex items-center gap-1.5">
              From
              <select
                aria-label="Compare from version"
                value={pair[0]}
                onChange={(e) => setPair([Number(e.target.value), pair[1]])}
                className="mono rounded-field border border-line-strong bg-surface px-2 py-1"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>v{v.version}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              To
              <select
                aria-label="Compare to version"
                value={pair[1]}
                onChange={(e) => setPair([pair[0], Number(e.target.value)])}
                className="mono rounded-field border border-line-strong bg-surface px-2 py-1"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>v{v.version}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <span className="text-[13px] text-ink-3">Only one version: nothing to compare.</span>
        )}
      </div>

      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {versions.map((v) => (
          <li key={`${v.version}-${v.seq}`} className="grid gap-1 rounded-field border border-line bg-surface p-3 text-[12.5px]">
            <div className="flex items-center gap-2">
              <span className="mono font-semibold">v{v.version}</span>
              <span className="text-ink-3">by {v.producer || v.by}</span>
              <a
                className="mono ml-auto text-accent-ink underline underline-offset-2"
                href={`/api/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(v.file)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                open raw
              </a>
            </div>
            <div className="mono break-all text-ink-3" title={`sha256 ${v.digest}`}>sha256 {v.digest}</div>
            <div className="mono text-ink-3">{v.bytes.toLocaleString('en-US')} B · {v.file}</div>
          </li>
        ))}
      </ul>

      {loadError ? (
        <p className="m-0 text-[13.5px] text-bad">One of these versions could not be opened.</p>
      ) : pair && versions.length >= 2 ? (
        items ? (
          <DiffView items={items} />
        ) : (
          <p className="m-0 text-[13.5px] text-ink-3">Loading versions…</p>
        )
      ) : null}
    </section>
  );
}

function DiffView({ items }: { items: DiffItem[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const changed = items.filter((i) => i.type === 'add' || i.type === 'del').length;
  if (!changed) {
    return <p className="m-0 rounded-field bg-sunken px-3 py-2 text-[13.5px] text-ink-2">The two versions are identical.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card" aria-label="Line diff">
      <p className="m-0 border-b border-line px-3 py-2 text-[12.5px] text-ink-3">
        <span className="text-bad">{items.filter((i) => i.type === 'del').length} removed</span> ·{' '}
        <span className="text-ok">{items.filter((i) => i.type === 'add').length} added</span>
      </p>
      <div className="font-mono text-[12.5px] leading-[1.55]">
        {items.map((it, i) => {
          if (it.type === 'gap') {
            return open[i] ? (
              it.lines.map((text, j) => (
                <div key={`${i}-${j}`} className="whitespace-pre px-3 text-ink-3"><span className="inline-block w-4 select-none">&nbsp;</span>{text || ' '}</div>
              ))
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [i]: true }))}
                className="block w-full cursor-pointer border-y border-line bg-sunken px-3 py-1 text-left text-[12px] text-ink-3"
              >
                {it.count} unchanged lines
              </button>
            );
          }
          const cls =
            it.type === 'add' ? 'bg-ok-weak text-ok' : it.type === 'del' ? 'bg-bad-weak text-bad line-through' : 'text-ink-2';
          const sign = it.type === 'add' ? '+' : it.type === 'del' ? '−' : ' ';
          return (
            <div key={i} className={cn('whitespace-pre px-3', cls)} data-diff={it.type}>
              <span className="inline-block w-4 select-none">{sign}</span>
              {it.text || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}
