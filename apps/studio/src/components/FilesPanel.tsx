import { useState } from 'react';
import { Check, FileText, X } from 'lucide-react';
import { FileDrawer, type DrawerTarget } from '@/components/FileDrawer';
import { cn } from '@/lib/utils';
import type { ArtifactRef, Mission } from '@/state';

/** Same order as web/app.js ORDER. Unknown names sort after these, by name. */
export const FILE_ORDER = [
  'gap-analysis.csv',
  'performance-summary.md',
  'performance-summary.json',
  'improvement-plan.md',
  'improvement-plan.json',
  'mentor-schedule.csv',
  'unsent-message-drafts.md',
  'unsent-message-drafts.json',
  'gaps.json',
  'evidence-checks.json',
  'repair-history.json',
  'final-manifest.json',
];

/** Records of the run itself. They are never shown as verified deliverables (same rule as web/app.js). */
export const RECORD_FILES = new Set(['evidence-checks.json', 'repair-history.json', 'final-manifest.json']);

export function sortFileNames(names: string[]): string[] {
  const rank = (n: string): number => {
    const i = FILE_ORDER.indexOf(n);
    return i < 0 ? FILE_ORDER.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Ledger sequence at which the mission passed review, or null.
 * Mission.passed carries no seq, so this uses the passing round's CHECK_RESULT events.
 * Every check of that round is emitted after the last file write and before VERIFICATION_PASSED,
 * so the smallest such seq marks the same boundary.
 */
export function verifiedSeq(m: Pick<Mission, 'passed' | 'checks'>): number | null {
  if (!m.passed) return null;
  const round = m.passed.round;
  const seqs = Object.values(m.checks)
    .filter((c) => c.round === round)
    .map((c) => c.seq);
  return seqs.length ? Math.min(...seqs) : null;
}

/** The latest version is verified when it was written before the passing round's checks, and it is a deliverable. */
export function isVerifiedLatest(name: string, latestSeq: number, verified: number | null): boolean {
  return verified !== null && latestSeq < verified && !RECORD_FILES.has(name);
}

/** File base names that a failing check targeted. Rounds store check ids only, so this is name-level. */
export function failedFileNames(m: Pick<Mission, 'rounds' | 'checks'>): Set<string> {
  const out = new Set<string>();
  for (const r of m.rounds) {
    for (const id of r.failed) {
      const artifact = m.checks[id]?.artifact;
      if (artifact) out.add(artifact.split('@')[0]);
    }
  }
  return out;
}

type Version = ArtifactRef & { seq: number; by: string };

export function FilesPanel({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState<DrawerTarget | null>(null);
  const names = sortFileNames(Object.keys(mission.files));
  const verified = verifiedSeq(mission);
  const failed = failedFileNames(mission);

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.005em]">Files</h2>
        <span className="mono text-[12px] text-ink-3">{names.length} on record</span>
      </div>

      {names.length === 0 ? (
        <p className="m-0 text-[13.5px] text-ink-3">Files appear as each worker saves them.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5 p-0">
          {names.map((name) => {
            const file = mission.files[name];
            const versions: Version[] = file.versions;
            const latest = versions[versions.length - 1];
            const isVerified = isVerifiedLatest(name, latest.seq, verified);
            return (
              <li
                key={name}
                className="grid content-start gap-2 rounded-field border border-line bg-surface p-3 transition-[border-color] duration-200 hover:border-line-strong"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold [overflow-wrap:anywhere]">{name}</div>
                    <div className="text-[12px] text-ink-3">by {latest.by}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {versions.map((v) => {
                    const isOld = v !== latest && failed.has(name);
                    const isOk = v === latest && isVerified;
                    const title = isOld
                      ? 'Failed review; kept for the record'
                      : isOk
                        ? 'Passed independent review'
                        : 'Open this version';
                    return (
                      <button
                        key={`${v.version}-${v.seq}`}
                        type="button"
                        title={title}
                        aria-label={`${name} version ${v.version}. ${title}`}
                        onClick={() => setOpen({ name, file: v.file, version: v.version, digest: v.digest })}
                        className={cn(
                          'mono inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium',
                          isOld
                            ? 'border-bad-line bg-bad-weak text-bad line-through'
                            : isOk
                              ? 'border-ok-line bg-ok-weak text-ok'
                              : 'border-line bg-sunken text-ink-2 hover:border-line-strong',
                        )}
                      >
                        {isOk ? <Check className="h-3 w-3" strokeWidth={2.6} aria-hidden /> : null}
                        {isOld ? <X className="h-3 w-3" strokeWidth={2.6} aria-hidden /> : null}
                        v{v.version}
                      </button>
                    );
                  })}
                </div>

                <div className="mono text-[11.5px] text-ink-3" title={`sha256 ${latest.digest}`}>
                  sha256 {latest.digest.slice(0, 16)}… · {latest.bytes.toLocaleString('en-US')} B
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FileDrawer runId={mission.runId} target={open} onClose={() => setOpen(null)} />
    </div>
  );
}
