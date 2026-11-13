// Pure selectors for the Inspector. Every value comes from ledger events (Mission.events) or from
// Mission fields that the reducer already built from those events. No randomness, no clock, no fetch.
import type { ArtifactRef, Check, LedgerEvent, Mission, NodeState } from './types';

export type NodeKind = 'model' | 'code' | 'independent';

/**
 * Prices in USD per 1M tokens, keyed by the provider name the ledger writes in MODEL_CALL.provider.
 * Source: engine/providers.mjs (PROVIDERS.meta.price = { inPerM: 1.25, outPerM: 4.25 }) and
 * engine/model.mjs (PROVIDER = 'meta-model-api', the name the ledger records for that provider).
 * Meta docs 13 Nov. A provider not listed here has no published price: the UI says so, never guesses.
 */
export const PROVIDER_PRICE_PER_M: Readonly<Record<string, { inPerM: number; outPerM: number }>> = Object.freeze({
  'meta-model-api': { inPerM: 1.25, outPerM: 4.25 },
});

/** USD = (prompt x inPerM + completion x outPerM) / 1e6, or null when the provider has no published price. */
export function usdFor(provider: string | undefined, usage: { prompt: number; completion: number }): number | null {
  const p = provider ? PROVIDER_PRICE_PER_M[provider] : undefined;
  if (!p) return null;
  return (usage.prompt * p.inPerM + usage.completion * p.outPerM) / 1e6;
}

export interface TimelineItem { seq: number; ts: string; type: string; text: string }
export interface InputItem { artifact: string; version: number; digest: string; from: string; seq: number }
export interface OutputItem { name: string; version: number; file: string; bytes: number; digest: string; seq: number; ref: ArtifactRef }
export interface DecisionItem { seq: number; ts: string; kind: 'message' | 'joined'; from: string; to: string; type: string; text: string }
export interface ModelCallItem {
  seq: number; ts: string; provider: string; model: string; ok: boolean; ms: number;
  prompt: number; completion: number; total: number; usd: number | null; error: string | null;
}
export interface FallbackItem { seq: number; from: string; to: string; reason: string }
export interface CheckItem { id: string; title: string; artifact: string; status: Check['status']; round: number; seq: number }
export interface RoundItem { round: number; outcome: 'passed' | 'failed' | 'open'; failed: string[]; messages: string[]; seq: number }
export interface RepairItem { seq: number; from: string; to: string; strategy: string; changes: number; changeList: unknown[] }

export interface NodeDetail {
  id: string;
  role: string;               // display role: the task role, or the fixed role of a fixed node
  kind: NodeKind | null;      // null for fixed nodes that run no agent
  label: string;
  state: NodeState | 'pending';
  timeline: TimelineItem[];   // real timestamps, in seq order
  inputs: InputItem[];
  outputs: OutputItem[];
  summary: unknown | null;
  decisions: DecisionItem[];
  modelCalls: ModelCallItem[];
  fallbacks: FallbackItem[];
  checks: CheckItem[];
  // Fixed nodes only
  rounds: RoundItem[];
  repairs: RepairItem[];
  runFinished: { status: string; checksPassed: number; checksTotal: number; repairs: number; reason: string | null; seq: number } | null;
  goalDrafts: { seq: number; attempt: number; ok: boolean; code: string | null }[];
  goalValidated: { seq: number; status: string; code: string | null; source: string | null } | null;
  sourcesAdmitted: { seq: number; sourceId: string; file: string; rows: number; digest: string }[];
  sourcesBlocked: { seq: number; sourceId: string; code: string }[];
}

export const FIXED_NODES = ['goal', 'sources', 'review', 'repair', 'deliver', 'blocked'] as const;
export type FixedNodeId = (typeof FIXED_NODES)[number];
export const isFixedNode = (id: string): id is FixedNodeId => (FIXED_NODES as readonly string[]).includes(id);

const FIXED_ROLE: Record<FixedNodeId, { role: string; label: string }> = {
  goal: { role: 'Goal Reader', label: 'Reads the goal and drafts the contract' },
  sources: { role: 'Sources', label: 'Admits the input files' },
  review: { role: 'Reviewer', label: 'Recomputes from the raw files' },
  repair: { role: 'Repair', label: 'Fixes only what failed' },
  deliver: { role: 'Deliver', label: 'Verified files and manifest' },
  blocked: { role: 'Stopped', label: 'Needs the missing input' },
};

/** The role a node is known by in AGENT_JOINED, AGENT_MESSAGE and MODEL_CALL. */
export function roleOf(m: Mission, id: string): string {
  if (isFixedNode(id)) return FIXED_ROLE[id].role;
  return m.tasks.find((t) => t.id === id)?.role ?? id;
}

/** The scenario id the run was started from (RUN_STARTED.data.scenarioId), or null before the first event. */
export function scenarioIdOf(events: LedgerEvent[]): string | null {
  const start = events.find((e) => e.type === 'RUN_STARTED');
  const id = start?.data?.scenarioId;
  return typeof id === 'string' ? id : null;
}

/** Base name of "name@vN" (or the name itself). */
export const baseName = (artifact: string): string => artifact.split('@')[0] ?? artifact;

/**
 * Everything the Node inspector shows for one graph node, derived from events and mission fields.
 * Task nodes match on taskId. Fixed nodes match on their event types.
 */
export function nodeDetail(m: Mission, id: string): NodeDetail {
  const events = m.events;
  const fixed = isFixedNode(id);
  const role = roleOf(m, id);
  const task = fixed ? undefined : m.tasks.find((t) => t.id === id);
  const label = fixed ? FIXED_ROLE[id].label : task?.label ?? id;
  const onTask = (e: LedgerEvent) => !fixed && e.taskId === id;

  // Model calls, fallbacks and decisions are matched by role (fixed nodes included: Goal Reader).
  const modelCalls: ModelCallItem[] = events
    .filter((e) => e.type === 'MODEL_CALL' && e.data?.agent === role)
    .map((e) => {
      const prompt = Number(e.data?.usage?.prompt ?? 0);
      const completion = Number(e.data?.usage?.completion ?? 0);
      return {
        seq: e.seq,
        ts: e.ts,
        provider: String(e.data?.provider ?? ''),
        model: String(e.data?.model ?? ''),
        ok: !!e.data?.ok,
        ms: Number(e.data?.ms ?? 0),
        prompt,
        completion,
        total: Number(e.data?.usage?.total ?? prompt + completion),
        usd: usdFor(e.data?.provider, { prompt, completion }),
        error: e.data?.error ?? null,
      };
    });

  const decisions: DecisionItem[] = [];
  for (const e of events) {
    if (e.type === 'AGENT_MESSAGE' && (e.data?.from === role || e.data?.to === role)) {
      decisions.push({ seq: e.seq, ts: e.ts, kind: 'message', from: String(e.data.from), to: String(e.data.to), type: String(e.data.type), text: String(e.data.reason ?? '') });
    }
    if (e.type === 'AGENT_JOINED' && (e.data?.agent === role || (!fixed && e.data?.capabilityId === id))) {
      decisions.push({ seq: e.seq, ts: e.ts, kind: 'joined', from: String(e.data.by ?? ''), to: String(e.data.agent), type: 'JOINED', text: String(e.data.reason ?? '') });
    }
  }

  const fallbacks: FallbackItem[] = events
    .filter((e) => e.type === 'MODEL_FALLBACK' && e.data?.agent === role)
    .map((e) => ({ seq: e.seq, from: String(e.data.from), to: String(e.data.to), reason: String(e.data.reason) }));

  // Timeline: task lifecycle for task nodes, the defining event types for fixed nodes.
  const timeline: TimelineItem[] = [];
  if (!fixed) {
    const names: Record<string, string> = { TASK_READY: 'READY', TASK_STARTED: 'STARTED', TASK_COMPLETED: 'COMPLETED', TASK_FAILED: 'FAILED', TASK_RERUN: 'RERUN', TASK_SKIPPED: 'SKIPPED' };
    for (const e of events) {
      if (!onTask(e) || !names[e.type]) continue;
      const text = e.type === 'TASK_RERUN' ? `re-run: ${e.data?.reason ?? ''}` : e.type === 'TASK_FAILED' ? String(e.data?.message ?? '') : '';
      timeline.push({ seq: e.seq, ts: e.ts, type: names[e.type], text });
    }
  } else {
    const want: Record<FixedNodeId, string[]> = {
      goal: ['GOAL_DRAFTED', 'GOAL_VALIDATED', 'GOAL_REJECTED'],
      sources: ['SOURCE_ADMITTED', 'SOURCE_BLOCKED'],
      review: ['REVIEW_STARTED', 'CHECK_RESULT', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED'],
      repair: ['REPAIR_SCHEDULED', 'ARTIFACT_REPAIRED'],
      deliver: ['RUN_FINISHED'],
      blocked: ['SOURCE_BLOCKED', 'RUN_FINISHED'],
    };
    for (const e of events) if (want[id].includes(e.type)) timeline.push({ seq: e.seq, ts: e.ts, type: e.type, text: '' });
  }

  // Outputs: ARTIFACT_WRITTEN with this task id. Inputs: HANDOFF to this task.
  const outputs: OutputItem[] = events
    .filter((e) => e.type === 'ARTIFACT_WRITTEN' && onTask(e))
    .map((e) => {
      const d = e.data as ArtifactRef;
      return { name: d.name, version: d.version, file: d.file, bytes: d.bytes, digest: d.digest, seq: e.seq, ref: d };
    });
  const inputs: InputItem[] = events
    .filter((e) => e.type === 'HANDOFF' && !fixed && e.data?.to === id)
    .map((e) => {
      const [artifact = '', v = ''] = String(e.data.artifact ?? '').split('@');
      return { artifact, version: Number(v.replace(/^v/, '')) || 0, digest: String(e.data.digest ?? ''), from: String(e.data.from ?? ''), seq: e.seq };
    });

  const summaryEvent = [...events].reverse().find((e) => e.type === 'TASK_COMPLETED' && onTask(e));
  const summary = summaryEvent?.data?.summary ?? null;

  // Checks touching this node's outputs: the latest result per check id, with its round.
  const outNames = new Set(outputs.map((o) => o.name));
  const checks: CheckItem[] = Object.values(m.checks)
    .filter((c) => outNames.has(baseName(c.artifact)))
    .map((c) => ({ id: c.id, title: c.title, artifact: c.artifact, status: c.status, round: c.round, seq: c.seq }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Review: one row per REVIEW_STARTED round, with the outcome from VERIFICATION_*.
  const rounds: RoundItem[] = [];
  if (id === 'review') {
    const byRound = new Map<number, RoundItem>();
    for (const e of events) {
      if (e.type === 'REVIEW_STARTED') byRound.set(Number(e.data.round), { round: Number(e.data.round), outcome: 'open', failed: [], messages: [], seq: e.seq });
      if (e.type === 'VERIFICATION_FAILED') byRound.set(Number(e.data.round), { round: Number(e.data.round), outcome: 'failed', failed: e.data.failed ?? [], messages: e.data.messages ?? [], seq: e.seq });
      if (e.type === 'VERIFICATION_PASSED') byRound.set(Number(e.data.round), { round: Number(e.data.round), outcome: 'passed', failed: [], messages: [], seq: e.seq });
    }
    rounds.push(...[...byRound.values()].sort((a, b) => a.round - b.round));
  }

  // Repair: one row per ARTIFACT_REPAIRED, with the strategies of its changes.
  const repairs: RepairItem[] = [];
  if (id === 'repair') {
    for (const e of events) {
      if (e.type !== 'ARTIFACT_REPAIRED') continue;
      const changes: unknown[] = Array.isArray(e.data?.changes) ? e.data.changes : [];
      const strategies = [...new Set(changes.map((c) => String((c as { strategy?: unknown }).strategy ?? '')).filter(Boolean))];
      repairs.push({ seq: e.seq, from: String(e.data.from), to: String(e.data.to), strategy: strategies.join(', '), changes: changes.length, changeList: changes });
    }
  }

  const finished = [...events].reverse().find((e) => e.type === 'RUN_FINISHED');
  const runFinished =
    (id === 'deliver' || id === 'blocked') && finished
      ? { status: String(finished.data.status), checksPassed: Number(finished.data.checksPassed), checksTotal: Number(finished.data.checksTotal), repairs: Number(finished.data.repairs ?? 0), reason: finished.data.reason ?? null, seq: finished.seq }
      : null;

  const goalDrafts = id === 'goal' ? events.filter((e) => e.type === 'GOAL_DRAFTED').map((e) => ({ seq: e.seq, attempt: Number(e.data.attempt), ok: !!e.data.ok, code: e.data.code ?? null })) : [];
  const gv = id === 'goal' ? [...events].reverse().find((e) => e.type === 'GOAL_VALIDATED') : undefined;
  const goalValidated = gv ? { seq: gv.seq, status: String(gv.data.status), code: gv.data.code ?? null, source: gv.data.source ?? null } : null;
  const sourcesAdmitted = id === 'sources' ? events.filter((e) => e.type === 'SOURCE_ADMITTED').map((e) => ({ seq: e.seq, sourceId: String(e.data.sourceId), file: String(e.data.file), rows: Number(e.data.rows), digest: String(e.data.digest) })) : [];
  const sourcesBlocked = id === 'sources' || id === 'blocked' ? events.filter((e) => e.type === 'SOURCE_BLOCKED').map((e) => ({ seq: e.seq, sourceId: String(e.data.sourceId), code: String(e.data.code) })) : [];

  // "model" when the node made a model call; "independent" for the Reviewer; "code" otherwise.
  let kind: NodeKind | null = null;
  if (fixed) kind = id === 'review' ? 'independent' : modelCalls.length ? 'model' : null;
  else if (role === 'Reviewer') kind = 'independent';
  else kind = modelCalls.length ? 'model' : 'code';

  return {
    id,
    role,
    kind,
    label,
    state: m.node[id]?.state ?? 'pending',
    timeline: timeline.sort((a, b) => a.seq - b.seq),
    inputs,
    outputs,
    summary,
    decisions: decisions.sort((a, b) => a.seq - b.seq),
    modelCalls,
    fallbacks,
    checks,
    rounds,
    repairs,
    runFinished,
    goalDrafts,
    goalValidated,
    sourcesAdmitted,
    sourcesBlocked,
  };
}

/** Versions of one file name, oldest first, each with the seq and the role that wrote it. */
export function fileVersions(m: Mission, name: string): (ArtifactRef & { seq: number; by: string })[] {
  return [...(m.files[name]?.versions ?? [])].sort((a, b) => a.version - b.version);
}
