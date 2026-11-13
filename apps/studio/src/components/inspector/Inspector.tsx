import { useEffect, useState } from 'react';
import type { Mission } from '@/state';
import { CheckInspector } from './CheckInspector';
import { FileInspector } from './FileInspector';
import { NodeInspector, type OpenTarget } from './NodeInspector';
import { RunAgainForm } from './RunAgainForm';

export type InspectorSelection = { type: 'node' | 'check' | 'file'; id: string } | null;

const TITLE: Record<'node' | 'check' | 'file', string> = { node: 'Step', check: 'Check', file: 'File' };

/**
 * Side panel for a selected graph node, check or file. Everything shown is derived from the run's
 * ledger events and files. Clicking an output or a check opens it here without leaving the panel.
 */
export function Inspector({ mission, selection, onClose }: { mission: Mission; selection: InspectorSelection; onClose: () => void }) {
  // Local drill-down (output file, check) on top of the parent's selection. Reset when the parent changes it.
  const [local, setLocal] = useState<InspectorSelection>(selection);
  const [again, setAgain] = useState(false);
  useEffect(() => {
    setLocal(selection);
  }, [selection]);

  const sel = local;
  const open = (t: OpenTarget) => setLocal({ type: t.type, id: t.id });

  return (
    <aside
      aria-label="Inspector"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            {sel ? TITLE[sel.type] : 'Inspector'}
          </p>
          <h2 className="m-0 truncate text-[15px] font-semibold text-ink">{sel ? titleOf(mission, sel) : 'Nothing selected'}</h2>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {mission.runId ? (
            <button
              type="button"
              aria-expanded={again}
              onClick={() => setAgain((v) => !v)}
              className="cursor-pointer rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-semibold text-ink hover:border-line-strong"
            >
              {again ? 'Hide re-run' : 'Run again with a change'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close inspector" className="cursor-pointer rounded-md px-2 py-1 text-[13px] text-ink-3 hover:text-ink">
            Close
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {again ? (
          <div className="mb-4 rounded-card border border-line bg-sunken p-3">
            <RunAgainForm mission={mission} />
          </div>
        ) : null}

        {!sel ? <p className="m-0 text-[13.5px] text-ink-3">Select a step in the graph, a check or a file to see what it read, wrote and decided.</p> : null}
        {sel?.type === 'node' ? <NodeInspector mission={mission} id={sel.id} onOpen={open} /> : null}
        {sel?.type === 'check' ? <CheckInspector mission={mission} id={sel.id} /> : null}
        {sel?.type === 'file' ? <FileInspector mission={mission} name={sel.id} /> : null}
      </div>
    </aside>
  );
}

function titleOf(m: Mission, sel: NonNullable<InspectorSelection>): string {
  if (sel.type === 'node') {
    const t = m.tasks.find((x) => x.id === sel.id);
    return t ? t.role : sel.id;
  }
  if (sel.type === 'check') return m.checks[sel.id]?.title ?? sel.id;
  return sel.id;
}
