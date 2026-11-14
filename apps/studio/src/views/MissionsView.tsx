import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnFiltersState, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react';
import { api, type Mission, type RunInfo } from '@/state';
import { go } from '@/components/shell/route';
import { cn } from '@/lib/utils';

const STATUSES = ['all', 'RUNNING', 'VERIFIED', 'PARTIAL', 'BLOCKED', 'INCOMPLETE'] as const;
const TONE: Record<string, string> = {
  RUNNING: 'border-run-line bg-run-weak text-run',
  VERIFIED: 'border-ok-line bg-ok-weak text-ok',
  PARTIAL: 'border-bad-line bg-bad-weak text-bad',
  BLOCKED: 'border-bad-line bg-bad-weak text-bad',
  INCOMPLETE: 'border-line bg-sunken text-ink-2',
};

export function StatusPill({ status }: { status: string | undefined }) {
  const s = status ?? 'INCOMPLETE';
  const label = s === 'RUNNING' ? 'Running' : s === 'INCOMPLETE' ? 'Incomplete' : s.charAt(0) + s.slice(1).toLowerCase();
  return (
    <span data-status={s} className={cn('inline-flex h-6 items-center rounded-full border px-2.5 text-[12.5px] font-semibold', TONE[s] ?? TONE.INCOMPLETE)}>
      {label}
    </span>
  );
}

const helper = createColumnHelper<RunInfo>();

const columns = [
  helper.accessor('runId', {
    header: 'Run',
    cell: (c) => (
      <a
        href={`#/mission/${encodeURIComponent(c.getValue())}`}
        className="mono text-[13px] text-accent-ink no-underline hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {c.getValue()}
      </a>
    ),
  }),
  helper.accessor((r) => r.title ?? '', {
    id: 'title',
    header: 'Mission',
    cell: (c) => <span className="block max-w-[46ch] truncate text-ink max-[719px]:max-w-[200px]">{c.getValue() || '—'}</span>,
  }),
  helper.accessor((r) => r.status ?? 'INCOMPLETE', {
    id: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: (c) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <StatusPill status={c.getValue()} />
        {c.row.original.delivered != null ? (
          <span data-delivered className="inline-flex h-6 items-center gap-1 rounded-full border border-ok-line bg-ok-weak px-2 text-[12px] font-semibold text-ok">
            <Inbox className="h-3 w-3" aria-hidden />
            Delivered
          </span>
        ) : null}
      </span>
    ),
  }),
  helper.accessor((r) => r.startedAt ?? '', {
    id: 'started',
    header: 'Started',
    cell: (c) => {
      const v = c.getValue() as string;
      return (
        <span className="mono text-[12.5px] text-ink-2">
          {v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        </span>
      );
    },
  }),
];

const SMALL_HIDDEN = new Set(['runId', 'started']);

export function MissionsView({ mission }: { mission: Mission }) {
  const [runs, setRuns] = useState<RunInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'started', desc: true }]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);

  const load = () => {
    api
      .runs()
      .then((list) => {
        setRuns(list);
        setError(null);
      })
      .catch((e: Error) => setError(`Could not load missions: ${e.message}`));
  };

  useEffect(load, []);
  // When the open mission finishes, its row in the list changes. Re-read the list once.
  useEffect(() => {
    if (mission.finished) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.finished?.status, mission.runId]);

  const data = useMemo(() => runs ?? [], [runs]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const statusFilter = (filters.find((f) => f.id === 'status')?.value as string | undefined) ?? 'all';
  const rows = table.getRowModel().rows;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-5 max-[719px]:overflow-visible max-[719px]:p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.01em] text-ink">Missions</h1>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">
            {runs ? `${runs.length} mission${runs.length === 1 ? '' : 's'}` : error ? '' : 'Loading runs…'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          Status
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => table.getColumn('status')?.setFilterValue(e.target.value === 'all' ? undefined : e.target.value)}
            className="h-9 rounded-field border border-line-strong bg-surface px-2.5 text-[14px] text-ink"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="m-0 text-[14px] text-bad">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line bg-surface shadow-card max-[719px]:overflow-visible">
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="sticky top-0 z-10 bg-sunken text-[12.5px] text-ink-3">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
                      className={cn('border-b border-line px-3 py-2.5 font-medium', SMALL_HIDDEN.has(h.column.id) && 'max-[719px]:hidden')}
                    >
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-ink-3 hover:text-ink"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        ) : dir === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                data-run={row.original.runId}
                onClick={() => go({ name: 'mission', runId: row.original.runId })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') go({ name: 'mission', runId: row.original.runId });
                }}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-sunken focus-visible:bg-accent-weak focus-visible:outline-none"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn('px-3 py-2.5 align-middle', SMALL_HIDDEN.has(cell.column.id) && 'max-[719px]:hidden')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {runs && rows.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-[14px] text-ink-3">
            {runs.length === 0 ? 'No missions yet. Describe a goal above or press ⌘K.' : 'No run has this status.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
