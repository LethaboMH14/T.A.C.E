// Shapes the studio renders. Mirrors engine/contracts.mjs and engine/AGENTS-SPEC.md section 2.
// Nothing here is decided by the UI: every field comes from a ledger event or a run file.

export interface LedgerEvent {
  seq: number;
  runId: string;
  ts: string;
  type: string;
  taskId: string | null;
  role: string | null;
  data: any;
}

export interface ArtifactRef {
  kind: string;
  name: string;            // base name without version, e.g. "mentor-schedule.csv"
  version: number;
  file: string;            // relative to the run dir, e.g. "artifacts/mentor-schedule.v1.csv"
  digest: string;          // sha256 hex
  bytes: number;
  mime: string;
  producer: string;
  inputs: { name: string; version: number | string; digest: string }[];
}

export interface Check {
  id: string;              // e.g. "C04_schedule_no_overlap"
  title: string;
  artifact: string;        // "name@vN"
  kind: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  expected: string | number | null;
  observed: string | number | null;
  evidence: { sourceId: string; row: number }[];
  detail?: any;
  message: string;
}

export interface AgentMessage {
  id: string;
  type: 'REQUEST' | 'RESULT' | 'CHALLENGE' | 'DECISION' | 'ESCALATE';
  from: string;
  to: string;
  about?: { artifact?: string; digest?: string; checkId?: string };
  reason: string;
  body?: unknown;
}

export interface Task {
  id: string;
  capabilityId: string;
  role: string;
  label: string;
  dependsOn: string[];
  consumes: string[];
  produces: string[];
}

export type NodeState = 'pending' | 'running' | 'done' | 'failed' | 'repairing' | 'skipped' | 'blocked';
export type Tone = 'ok' | 'bad' | 'redo' | 'plain';

export interface NodeInfo {
  state: NodeState;
  badge?: { text: string; tone: Tone };
}

export type StageState = 'idle' | 'active' | 'done' | 'bad';

export interface FeedItem {
  t: number;               // seconds since RUN_STARTED
  text: string;            // plain sentence, same wording as web/app.js
  tone: '' | 'ok' | 'bad' | 'redo';
}

export interface HumanQuestion {
  id: string;                              // Q-1, Q-2 ... as the engine wrote them
  question: string;
  whyAsked: string | null;
  options: { id: string; label: string }[];
  answered: boolean;
  answer: string | null;                   // HUMAN_ANSWER.answer, once it arrives
  seq: number;
}

export interface Mission {
  runId: string | null;
  questions: HumanQuestion[];              // HUMAN_QUESTION / HUMAN_ANSWER, in order
  title: string;
  goalText: string;
  paceMs: number;
  agents: { mode: 'model' | 'code'; provider?: string; model?: string; note?: string } | null;
  planted: string[];                       // plain sentences from RUN_STARTED
  plantedHeading: string | null;           // "Planted on purpose for this demo" | "Changed for this scenario"
  deliverables: string[];
  unsupported: string[];
  goalSource: 'model' | 'fixture' | null;
  goalCheck: { status: string; code: string | null; note: string | null } | null;
  goalDrafts: { attempt: number; ok: boolean; code: string | null }[];
  sources: { sourceId: string; file: string; rows: number; digest: string }[];
  blockedSources: { sourceId: string; code: string }[];
  tasks: Task[];
  node: Record<string, NodeInfo>;          // task ids + 'goal','sources','review','repair','deliver','blocked'
  joined: { agent: string; capabilityId: string; reason: string; by: string }[];
  messages: AgentMessage[];
  modelCalls: { agent: string; ok: boolean; ms: number; total: number; error: string | null; provider?: string; model?: string }[];
  fallbacks: { agent: string; from: string; to: string; reason: string }[];   // MODEL_FALLBACK: the router switched provider
  handoffs: { from: string; to: string; artifact: string; seq: number }[];
  summaries: Record<string, any>;          // TASK_COMPLETED summary by task id
  checks: Record<string, Check & { round: number; seq: number }>;   // latest per id
  // VERIFICATION_FAILED; `checks` = the failing checks exactly as the ledger had them at that moment
  rounds: { round: number; failed: string[]; messages: string[]; checks: (Check & { round: number; seq: number })[] }[];
  repairs: { round: number; from: string; to: string; changes: any[]; checkIds: string[] }[];
  reviewRound: number;
  reviewState: 'idle' | 'running' | 'failed' | 'repairing' | 'passed';
  passed: { round: number; passed: number; total: number } | null;
  files: Record<string, { name: string; versions: (ArtifactRef & { seq: number; by: string })[] }>;
  stage: Record<'goal' | 'plan' | 'execute' | 'verify' | 'deliver', StageState>;
  feed: FeedItem[];
  started: number | null;                  // epoch ms of the first event
  lastTs: number | null;                   // epoch ms of the latest event
  lastSeq: number;                         // highest ledger seq folded (dedupes SSE replays)
  finished: {
    status: 'VERIFIED' | 'PARTIAL' | 'BLOCKED';
    checksPassed: number;
    checksTotal: number;
    repairs: number;
    reason: string | null;
  } | null;
}

export interface ScenarioInfo {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface RunInfo {
  runId: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
}
