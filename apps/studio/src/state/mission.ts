// Mission state. reduce() is a pure fold over ledger events and mirrors apply() in web/app.js.
// Feed sentences keep the wording of web/app.js, without the HTML markup.
// The UI renders this state only. It decides no status, number or colour on its own.

import { useEffect, useState } from 'react';
import type {
  ArtifactRef, RunOverrides, Check, FeedItem, HumanQuestion, LedgerEvent, Mission, NodeInfo, NodeState, RunInfo, ScenarioInfo, StageState, Tone,
} from './types';

export type * from './types';

const STAGES = ['goal', 'plan', 'execute', 'verify', 'deliver'] as const;
/** Raw events kept for the inspector. Older events are dropped first. */
export const EVENT_CAP = 5000;

export function initialMission(runId: string | null = null): Mission {
  return {
    runId,
    events: [],
    questions: [],
    title: '',
    goalText: '',
    paceMs: 0,
    agents: null,
    planted: [],
    plantedHeading: null,
    deliverables: [],
    unsupported: [],
    goalSource: null,
    goalCheck: null,
    goalDrafts: [],
    sources: [],
    blockedSources: [],
    tasks: [],
    node: {},
    joined: [],
    messages: [],
    modelCalls: [],
    fallbacks: [],
    handoffs: [],
    summaries: {},
    checks: {},
    rounds: [],
    repairs: [],
    reviewRound: 0,
    reviewState: 'idle',
    passed: null,
    files: {},
    stage: { goal: 'idle', plan: 'idle', execute: 'idle', verify: 'idle', deliver: 'idle' },
    feed: [],
    started: null,
    lastTs: null,
    lastSeq: 0,
    stream: 'idle',
    finished: null,
  };
}

const name = (id: string | undefined | null): string => (id === 'M-B' ? 'Mentor B' : String(id ?? ''));

/** Plain sentences describing the planted or changed parts of a scenario (same wording as web/app.js plantedText). */
export function plantedSentences(
  fault: { kind?: string; mentor_id?: string; skill_id?: string } | null | undefined,
  changedConstraints: { mentor_id: string; day: string }[] | null | undefined,
  excludedSources: string[] | null | undefined,
): string[] {
  const bits: string[] = [];
  if (fault?.kind === 'overlap') bits.push(`the Scheduler is set to double-book ${name(fault.mentor_id)} once`);
  if (fault?.kind === 'wrong_aggregate') bits.push(`the Report Writer is set to count missing ${fault.skill_id} scores as zero`);
  for (const u of changedConstraints ?? []) bits.push(`${name(u.mentor_id)} is away on ${u.day}`);
  for (const s of excludedSources ?? []) bits.push(`the ${s} file is withheld`);
  return bits;
}

const plainStrategy = (s: string): string =>
  ({
    reschedule_affected_sessions: 'move only the sessions that break a rule',
    recompute_affected_numbers: 'recompute only the wrong numbers from the raw scores',
    regenerate_from_latest_schedule: 'rewrite drafts from the latest schedule',
    rerun_producer: 're-run the step that made the file',
  } as Record<string, string>)[s] ?? s;

function summarySentence(role: string | null, id: string, s: any): string {
  if (!s) return `${role} finished`;
  switch (id) {
    case 'compute_gaps':
      return `Analyst found ${s.gaps} gaps; ${s.atRisk} learners at risk; ${s.missing} missing scores flagged, not counted as zero`;
    case 'performance_summary':
      return `Report Writer summarised ${s.skills} skills`;
    case 'recommend_interventions':
      return `Support Planner matched ${s.items} support items (${s.mentorSessions} mentor sessions)`;
    case 'mentor_schedule':
      return `Scheduler booked ${s.booked} sessions${s.unscheduled ? `, ${s.unscheduled} could not be placed` : ''}`;
    case 'draft_messages':
      return `Message Writer drafted ${s.drafts} messages. None sent`;
    default:
      return `${role} finished`;
  }
}

function summaryBadge(id: string, s: any): NodeInfo['badge'] {
  if (!s) return undefined;
  const text = (
    {
      compute_gaps: `${s.atRisk} at risk`,
      performance_summary: `${s.skills} skills`,
      recommend_interventions: `${s.items} items`,
      mentor_schedule: `${s.booked} booked`,
      draft_messages: `${s.drafts} drafts`,
    } as Record<string, string>
  )[id];
  return text ? { text, tone: 'plain' } : undefined;
}

function withNode(m: Mission, id: string, state: NodeState, badge?: { text: string; tone: Tone }): Mission {
  const info: NodeInfo = badge ? { state, badge } : { state };
  return { ...m, node: { ...m.node, [id]: info } };
}

function withStage(m: Mission, stage: (typeof STAGES)[number], state: StageState): Mission {
  return { ...m, stage: { ...m.stage, [stage]: state } };
}

function addFeed(m: Mission, text: string, tone: FeedItem['tone'] = ''): Mission {
  const t = m.lastTs !== null && m.started !== null ? (m.lastTs - m.started) / 1000 : 0;
  return { ...m, feed: [...m.feed, { t, text, tone }] };
}

/**
 * Execute is green only when every task is done. Any FAILED, SKIPPED or BLOCKED task makes it bad
 * (the run then has to say so, not look green). Stays as it was while tasks are still running.
 */
function executeStage(m: Mission): StageState {
  const states = m.tasks.map((t) => m.node[t.id]?.state);
  if (states.some((s) => s === 'failed' || s === 'skipped' || s === 'blocked')) return 'bad';
  if (states.length && states.every((s) => s === 'done')) return 'done';
  return m.stage.execute === 'idle' ? 'idle' : 'active';
}

/** The repair node spins only while a repair is really scheduled. A later review round ends it. */
function settleRepair(m: Mission): Mission {
  if (m.node.repair?.state !== 'repairing') return m;
  return { ...m, node: { ...m.node, repair: { ...m.node.repair, state: 'done' } } };
}

/** Pure fold: one ledger event applied to a mission. Events already folded (seq <= lastSeq) are ignored. */
export function reduce(m: Mission, e: LedgerEvent): Mission {
  if (e.seq <= m.lastSeq) return m;
  const ts = Date.parse(e.ts);
  const d = e.data ?? {};
  const base: Mission = {
    ...m,
    events: m.events.length >= EVENT_CAP ? [...m.events.slice(m.events.length - EVENT_CAP + 1), e] : [...m.events, e],
    lastSeq: e.seq,
    started: m.started ?? ts,
    lastTs: ts,
    runId: m.runId ?? e.runId,
  };
  const role = e.role;

  switch (e.type) {
    case 'RUN_STARTED': {
      const planted = plantedSentences(d.plantedFault, d.changedConstraints, d.excludedSources);
      const agents = d.agents
        ? { mode: d.agents.mode === 'model' ? 'model' as const : 'code' as const, provider: d.agents.provider, model: d.agents.model, note: d.agents.note, profile: d.agents.profile ?? null, chain: Array.isArray(d.agents.chain) ? d.agents.chain : [] }
        : null;
      let s: Mission = {
        ...base,
        title: d.title ?? '',
        goalText: d.goalText ?? '',
        paceMs: d.pacedMs ?? 0,
        agents,
        planted,
        plantedHeading: planted.length ? (d.plantedFault ? 'Planted on purpose for this demo' : 'Changed for this scenario') : null,
      };
      s = withStage(s, 'goal', 'active');
      return addFeed(s, 'Mission started');
    }

    case 'GOAL_VALIDATED': {
      let s: Mission = {
        ...base,
        deliverables: d.deliverables ?? [],
        goalSource: d.source === 'model' ? 'model' : d.source === 'fixture' ? 'fixture' : null,
        goalCheck: { status: d.status ?? '', code: d.code ?? null, note: d.note ?? null },
      };
      s = withNode(s, 'goal', 'done');
      s = withStage(withStage(s, 'goal', 'done'), 'plan', 'active');
      return addFeed(s, `Goal checked: ${(d.deliverables ?? []).length} deliverables requested`);
    }

    case 'GOAL_REJECTED': {
      let s = withNode(base, 'goal', 'blocked');
      s = withStage(s, 'goal', 'bad');
      return addFeed(s, `Goal not accepted (${d.code})`, 'bad');
    }

    case 'GOAL_DRAFTED':
      return { ...base, goalDrafts: [...base.goalDrafts, { attempt: d.attempt ?? base.goalDrafts.length + 1, ok: !!d.ok, code: d.code ?? null }] };

    case 'SOURCE_ADMITTED': {
      const s: Mission = {
        ...base,
        sources: [...base.sources, { sourceId: d.sourceId, file: d.file, rows: d.rows, digest: d.digest }],
      };
      return withNode(s, 'sources', s.blockedSources.length ? 'blocked' : 'done');
    }

    case 'SOURCE_BLOCKED': {
      let s: Mission = { ...base, blockedSources: [...base.blockedSources, { sourceId: d.sourceId, code: d.code }] };
      s = withNode(s, 'sources', 'blocked');
      return addFeed(s, `Missing input: ${d.sourceId}. Nothing will be guessed.`, 'bad');
    }

    case 'PLAN_CREATED': {
      const tasks = d.tasks ?? [];
      const unsupported: string[] = d.unsupported ?? [];
      let node: Record<string, NodeInfo> = { ...base.node };
      for (const t of tasks) node[t.id] = { state: 'pending' };
      for (const id of ['review', 'repair', 'deliver']) node[id] = { state: 'pending' };
      let s: Mission = { ...base, tasks, unsupported, node };
      s = withStage(s, 'plan', tasks.length ? 'done' : 'bad');
      if (tasks.length) s = withStage(s, 'execute', 'active');
      const roles = tasks.map((t: { role: string }) => t.role).join(', ');
      s = addFeed(s, tasks.length ? `Plan: ${tasks.length} step${tasks.length > 1 ? 's' : ''}, ${roles}` : 'No step can run without the missing input', tasks.length ? '' : 'bad');
      if (unsupported.length && tasks.length) {
        s = addFeed(s, `Cannot produce: ${unsupported.filter((u) => !u.startsWith('source:')).join(', ')}`, 'bad');
      }
      return s;
    }

    case 'TASK_READY':
      return e.taskId ? withNode(base, e.taskId, base.node[e.taskId]?.state ?? 'pending') : base;

    case 'TASK_STARTED': {
      if (!e.taskId) return base;
      const state: NodeState = base.reviewState === 'repairing' ? 'repairing' : 'running';
      let s = withNode(base, e.taskId, state);
      if (!base.tasks.some((t) => t.id === e.taskId)) return s;
      const label = base.tasks.find((t) => t.id === e.taskId)?.label ?? e.taskId;
      return addFeed(s, `${role} started: ${label}`);
    }

    case 'HANDOFF': {
      const s: Mission = {
        ...base,
        handoffs: [...base.handoffs, { from: d.from, to: d.to, artifact: d.artifact, seq: e.seq }],
      };
      return addFeed(s, `${role} received ${d.artifact}`);
    }

    case 'ARTIFACT_WRITTEN': {
      const ref = d as ArtifactRef;
      const entry = base.files[ref.name] ?? { name: ref.name, versions: [] };
      return {
        ...base,
        files: {
          ...base.files,
          [ref.name]: { name: ref.name, versions: [...entry.versions, { ...ref, seq: e.seq, by: role ?? ref.producer }] },
        },
      };
    }

    case 'TASK_COMPLETED': {
      if (!e.taskId) return base;
      let s: Mission = { ...base, summaries: { ...base.summaries, [e.taskId]: d.summary } };
      s = withNode(s, e.taskId, 'done', summaryBadge(e.taskId, d.summary));
      s = addFeed(s, summarySentence(role, e.taskId, d.summary));
      return withStage(s, 'execute', executeStage(s));
    }

    case 'TASK_FAILED': {
      const s = withStage(e.taskId ? withNode(base, e.taskId, 'failed') : base, 'execute', 'bad');
      return addFeed(s, `${role} failed: ${d.message}`, 'bad');
    }

    case 'TASK_SKIPPED': {
      if (!e.taskId) return base;
      const s = withNode(base, e.taskId, 'skipped');
      return withStage(s, 'execute', executeStage(s));
    }

    case 'TASK_RERUN': {
      if (!e.taskId) return base;
      const s = withNode(base, e.taskId, 'repairing', { text: 're-run', tone: 'redo' });
      return addFeed(s, `${role} re-runs on the repaired file`, 'redo');
    }

    case 'REVIEW_STARTED': {
      let s: Mission = settleRepair({ ...base, reviewRound: d.round, reviewState: 'running' });
      s = withStage(withStage(s, 'execute', executeStage(s)), 'verify', 'active');
      s = withNode(s, 'review', 'running', { text: `round ${d.round}`, tone: 'plain' });
      return addFeed(s, `Reviewer round ${d.round}: re-opening every file`);
    }

    case 'CHECK_RESULT': {
      const c = d as Check;
      const checks = { ...base.checks, [c.id]: { ...c, round: base.reviewRound, seq: e.seq } };
      return { ...base, checks };
    }

    case 'VERIFICATION_FAILED': {
      const msg: string[] = d.messages ?? [];
      const failed: string[] = d.failed ?? [];
      let s: Mission = {
        ...base,
        // The ledger writes each CHECK_RESULT before VERIFICATION_FAILED, so the failing
        // checks are in base.checks right now. Keep a copy: later rounds overwrite base.checks.
        rounds: [...base.rounds, {
          round: d.round, failed, messages: msg,
          checks: failed.map((id) => base.checks[id]).filter((c): c is NonNullable<typeof c> => !!c && c.status !== 'PASS'),
        }],
        reviewState: 'failed',
      };
      s = withNode(s, 'review', 'failed', { text: `${failed.length} failed`, tone: 'bad' });
      s = withStage(s, 'verify', 'bad');
      return addFeed(s, `Reviewer caught a problem: ${msg[0] ?? failed.join(', ')}`, 'bad');
    }

    case 'REPAIR_SCHEDULED': {
      let s: Mission = { ...base, reviewState: 'repairing' };
      s = withNode(s, 'repair', 'repairing', { text: `round ${d.round}`, tone: 'redo' });
      return addFeed(s, `Repair: ${plainStrategy(d.strategy)}`, 'redo');
    }

    case 'ARTIFACT_REPAIRED': {
      const changes: any[] = d.changes ?? [];
      const repairs = [...base.repairs, { round: d.round, from: d.from, to: d.to, changes, checkIds: d.checkIds ?? [] }];
      let s: Mission = { ...base, repairs };
      s = withNode(s, 'repair', 'done', { text: `${changes.length} change${changes.length === 1 ? '' : 's'}`, tone: 'redo' });
      return addFeed(
        s,
        `Repair wrote ${d.to}, ${changes.length} change${changes.length === 1 ? '' : 's'}; ${d.from} kept`,
        'redo',
      );
    }

    case 'VERIFICATION_PASSED': {
      let s: Mission = { ...base, passed: { round: d.round, passed: d.passed, total: d.total }, reviewState: 'passed' };
      s = withNode(s, 'review', 'done', { text: `${d.passed}/${d.total}`, tone: 'ok' });
      s = withStage(s, 'verify', 'done');
      return addFeed(s, `Reviewer round ${d.round}: ${d.passed} of ${d.total} checks passed`, 'ok');
    }

    case 'RUN_FINISHED': {
      let s: Mission = {
        ...base,
        finished: {
          status: d.status,
          checksPassed: d.checksPassed,
          checksTotal: d.checksTotal,
          repairs: d.repairs ?? 0,
          reason: d.reason ?? null,
        },
      };
      s = settleRepair(s);
      // Deliver is green only on VERIFIED. PARTIAL and BLOCKED are shown as bad.
      s = withStage(s, 'deliver', d.status === 'VERIFIED' ? 'done' : 'bad');
      if (d.status === 'VERIFIED') {
        s = withNode(s, 'deliver', 'done', { text: `${d.checksPassed}/${d.checksTotal} checks`, tone: 'ok' });
      } else if (d.status === 'PARTIAL') {
        s = withNode(s, 'deliver', 'failed', { text: `${d.checksPassed}/${d.checksTotal} checks`, tone: 'bad' });
      } else {
        s = withNode(s, 'blocked', 'blocked');
      }
      const reps = d.repairs ? ` after ${d.repairs} repair${d.repairs > 1 ? 's' : ''}` : '';
      const why = d.reason ? `: ${d.reason}` : '';
      return addFeed(s, `Mission ${d.status}${reps}${why}`, d.status === 'VERIFIED' ? 'ok' : 'bad');
    }

    case 'AGENT_JOINED':
      return {
        ...base,
        joined: [...base.joined, { agent: d.agent, capabilityId: d.capabilityId, reason: d.reason, by: d.by }],
      };

    case 'AGENT_MESSAGE':
      return { ...base, messages: [...base.messages, d] };

    case 'MODEL_CALL':
      return {
        ...base,
        modelCalls: [
          ...base.modelCalls,
          { agent: d.agent, ok: !!d.ok, ms: d.ms ?? 0, total: d.usage?.total ?? 0, error: d.error ?? null, provider: d.provider, model: d.model },
        ],
      };

    case 'MODEL_FALLBACK': {
      const why = d.reason === 'MODEL_HTTP_429' ? 'rate limit' : d.reason === 'auth' ? 'key refused' : String(d.reason ?? '').replace(/^MODEL_/, '').toLowerCase();
      const s: Mission = { ...base, fallbacks: [...(base.fallbacks ?? []), { agent: d.agent, from: d.from, to: d.to, reason: d.reason }] };
      return addFeed(s, `${d.agent} switched model ${d.from} → ${d.to} (${why})`, 'redo');
    }

    case 'HUMAN_QUESTION': {
      const options = (d.options ?? []).map((o: unknown) =>
        typeof o === 'string' ? { id: o, label: o } : { id: String((o as { id?: unknown }).id ?? ''), label: String((o as { label?: unknown }).label ?? '') },
      );
      const q: HumanQuestion = {
        id: String(d.id ?? `Q-${base.questions.length + 1}`),
        question: String(d.question ?? ''),
        whyAsked: d.whyAsked ?? null,
        options,
        answered: false,
        answer: null,
        seq: e.seq,
      };
      return addFeed({ ...base, questions: [...base.questions, q] }, `Goal Reader asks: ${q.question}`, 'redo');
    }

    case 'HUMAN_ANSWER': {
      const answer = String(d.answer ?? '');
      const questions = base.questions.map((q) => (q.id === d.id && !q.answered ? { ...q, answered: true, answer } : q));
      return addFeed({ ...base, questions }, `Coordinator answered: ${answer}`, 'ok');
    }

    default:
      // Unknown event types: no state change.
      return base;
  }
}

// ----------------------------------------------------------------- hook

export function useMission(runId: string | null): Mission {
  const [m, setM] = useState<Mission>(() => initialMission(runId));

  useEffect(() => {
    setM(initialMission(runId));
    if (!runId) return;
    const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
    let finishedSeen = false;
    es.onopen = () => setM((prev) => (prev.finished ? prev : { ...prev, stream: 'live' }));
    es.onmessage = (msg) => {
      let e: LedgerEvent;
      try {
        e = JSON.parse(msg.data) as LedgerEvent;
      } catch {
        return;
      }
      if (e.type === 'RUN_FINISHED') finishedSeen = true;
      setM((prev) => ({ ...reduce(prev, e), stream: 'live' }));
    };
    es.addEventListener('end', () => {
      finishedSeen = true;
      es.close();
      setM((prev) => ({ ...prev, stream: prev.finished ? 'ended' : 'stopped' }));
    });
    es.onerror = () => {
      // EventSource retries on its own while CONNECTING. CLOSED means the server ended the stream.
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        setM((prev) => ({ ...prev, stream: prev.finished || finishedSeen ? 'ended' : 'stopped' }));
      } else {
        setM((prev) => (prev.finished ? prev : { ...prev, stream: 'lost' }));
      }
    };
    return () => es.close();
  }, [runId]);

  return m;
}

// ----------------------------------------------------------------- api

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  scenarios: (): Promise<ScenarioInfo[]> => fetch('/api/scenarios').then((r) => json<ScenarioInfo[]>(r)),
  runs: (): Promise<RunInfo[]> => fetch('/api/runs').then((r) => json<RunInfo[]>(r)),
  /** Starts a REAL new run. overrides: {unavailable?, profile?, provider?}; model 'off' turns the model layer off. */
  start: (scenario: string, overrides?: RunOverrides, model?: 'off'): Promise<{ runId: string }> => {
    const body: Record<string, unknown> = { scenario };
    if (model) body.model = model;
    if (overrides && Object.keys(overrides).length) body.overrides = overrides;
    return fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<{ runId: string }>(r));
  },
  fileText: (runId: string, path: string): Promise<string> =>
    fetch(`/api/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(path)}`).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    }),
  answer: (runId: string, id: string, answer: string): Promise<{ ok: boolean }> =>
    fetch(`/api/runs/${encodeURIComponent(runId)}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, answer }),
    }).then((r) => json<{ ok: boolean }>(r)),
  sourceLines: (file: string): Promise<string> =>
    fetch(`/api/sources/${encodeURIComponent(file)}`).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    }),
};
