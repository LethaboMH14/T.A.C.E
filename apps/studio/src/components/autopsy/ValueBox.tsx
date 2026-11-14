export function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

export function ValueBox({ label, value, bad = false }: { label: string; value: unknown; bad?: boolean }) {
  return (
    <div className="min-w-0 rounded-field bg-sunken px-2.5 py-2">
      <small className="block text-[11.5px] text-ink-3">{label}</small>
      <b className={`block break-all font-mono text-[15px] font-medium ${bad ? 'text-bad' : 'text-ink'}`}>{fmtValue(value)}</b>
    </div>
  );
}

/** Expected (recomputed from sources) against observed (found in the saved file), with the field name. */
export function MismatchBoxes({ mismatch, artifact }: { mismatch: { field?: unknown; expected?: unknown; observed?: unknown }; artifact: string | null }) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <ValueBox label="Recomputed from sources" value={mismatch.expected} />
        <ValueBox label={`Found in ${artifact ?? 'the saved file'}`} value={mismatch.observed} bad />
      </div>
      {mismatch.field !== undefined && <p className="m-0 break-all font-mono text-[12px] text-ink-3">{fmtValue(mismatch.field)}</p>}
    </div>
  );
}
