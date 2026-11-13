// T.A.C.E runtime slice — shared contracts (types, constants). NO LOGIC lives here.
// Every module codes against these shapes. Changing a shape needs a note in ADR-0008.
//
// Honesty rules every module must follow (see CLAUDE.md):
//  - Nothing is "done" unless a real file was written, re-opened and its sha256 re-checked.
//  - Workers are deterministic code. Never call them "AI" in output text.
//  - No wall-clock time inside artifact CONTENT (so two runs give identical digests).
//    Timestamps belong only in ledger events.
//  - Synthetic data only. No real names, emails or phone numbers.

export const CONTRACT_VERSION = 'tace-runtime-v0.1';

/** Ledger event types, in the order they normally occur. */
export const EVENT = Object.freeze({
  RUN_STARTED: 'RUN_STARTED',             // data: {scenarioId, goalText, pacedMs}
  GOAL_VALIDATED: 'GOAL_VALIDATED',       // data: {status, code, deliverables:[id]}
  GOAL_REJECTED: 'GOAL_REJECTED',         // data: {status, code}
  SOURCE_ADMITTED: 'SOURCE_ADMITTED',     // data: {sourceId, file, version, digest, rows}
  SOURCE_BLOCKED: 'SOURCE_BLOCKED',       // data: {sourceId, code, message}
  PLAN_CREATED: 'PLAN_CREATED',           // data: {tasks:[Task], unsupported:[kind]}
  TASK_READY: 'TASK_READY',               // taskId set
  TASK_STARTED: 'TASK_STARTED',           // taskId, role set
  TASK_COMPLETED: 'TASK_COMPLETED',       // data: {artifacts:[name@vN], summary}
  TASK_FAILED: 'TASK_FAILED',             // data: {code, message, attempt}
  TASK_SKIPPED: 'TASK_SKIPPED',           // data: {reason}
  HANDOFF: 'HANDOFF',                     // data: Handoff
  ARTIFACT_WRITTEN: 'ARTIFACT_WRITTEN',   // data: ArtifactRef
  REVIEW_STARTED: 'REVIEW_STARTED',       // data: {round}
  CHECK_RESULT: 'CHECK_RESULT',           // data: Check
  VERIFICATION_FAILED: 'VERIFICATION_FAILED', // data: {round, failed:[checkId]}
  VERIFICATION_PASSED: 'VERIFICATION_PASSED', // data: {round, passed, total}
  REPAIR_SCHEDULED: 'REPAIR_SCHEDULED',   // data: {round, checkIds, artifact, strategy}
  ARTIFACT_REPAIRED: 'ARTIFACT_REPAIRED', // data: {from: name@vN, to: name@vN+1, changes:[...]}
  TASK_RERUN: 'TASK_RERUN',               // data: {reason, because: name@vN}
  RUN_FINISHED: 'RUN_FINISHED',           // data: {status, checksPassed, checksTotal, repairs}
  // ---- agent layer (see engine/AGENTS-SPEC.md) ----
  MODEL_CALL: 'MODEL_CALL',               // data: {agent, provider, model, ok, ms, usage:{prompt,completion,total}, error?}  (never the key, never full prompts)
  MODEL_FALLBACK: 'MODEL_FALLBACK',       // data: {agent, from:'prov:model', to:'prov:model', reason}  (router switched provider)
  AGENT_MESSAGE: 'AGENT_MESSAGE',         // data: AgentMessage (typed, validated with zod)
  AGENT_JOINED: 'AGENT_JOINED',           // data: {agent, capabilityId, reason, by}
  GOAL_DRAFTED: 'GOAL_DRAFTED',           // data: {attempt, ok, code, deliverables}
  HUMAN_QUESTION: 'HUMAN_QUESTION',       // data: {id, question, options:[{id,label}], whyAsked}
  HUMAN_ANSWER: 'HUMAN_ANSWER',           // data: {id, answer, by}
});

/** Final run status. */
export const RUN_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',   // every applicable check PASS on the final artifacts
  PARTIAL: 'PARTIAL',     // some deliverables verified, some checks still FAIL/UNKNOWN or work infeasible
  BLOCKED: 'BLOCKED',     // could not start real work (missing source, rejected goal, unsupported deliverable only)
});

export const TASK_STATE = Object.freeze({
  PENDING: 'PENDING', READY: 'READY', RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED', FAILED: 'FAILED', SKIPPED: 'SKIPPED',
});

export const CHECK_STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', UNKNOWN: 'UNKNOWN' });

/** Max repair rounds per run. After this, status is PARTIAL with the unresolved checks. */
export const REPAIR_BUDGET = 2;

/**
 * Artifact kinds. A "kind" is what planners and workers talk about; a file is one version of a kind.
 * Kinds starting with "source:" are admitted inputs, always available after admission.
 */
export const KIND = Object.freeze({
  SRC_TRAINEES: 'source:trainees',
  SRC_ASSESSMENTS: 'source:assessments',
  SRC_SKILLS: 'source:skills',
  SRC_MENTORS: 'source:mentors',
  SRC_AVAILABILITY: 'source:availability',
  SRC_INTERVENTIONS: 'source:interventions',
  GAPS: 'gaps',                               // gaps.json (internal hand-off)
  GAP_ANALYSIS: 'gap_analysis',               // gap-analysis.csv (deliverable)
  PERFORMANCE_SUMMARY: 'performance_summary', // performance-summary.json + .md
  IMPROVEMENT_PLAN: 'improvement_plan',       // improvement-plan.json + .md
  MENTOR_SCHEDULE: 'mentor_schedule',         // mentor-schedule.csv
  MESSAGE_DRAFTS: 'message_drafts',           // unsent-message-drafts.json + .md
});

/**
 * @typedef {Object} ArtifactRef
 * @property {string} kind        one of KIND
 * @property {string} name        base name without version, e.g. "mentor-schedule.csv"
 * @property {number} version     1, 2, ...
 * @property {string} file        relative path inside the run dir, e.g. "artifacts/mentor-schedule.v1.csv"
 * @property {string} digest      sha256 hex of the bytes on disk (re-checked after write)
 * @property {number} bytes
 * @property {string} mime        "text/csv" | "application/json" | "text/markdown"
 * @property {string} producer    task id that wrote it ("repair" for repaired versions)
 * @property {{name:string,version:number,digest:string}[]} inputs   artifacts/sources it was built from
 */

/**
 * @typedef {Object} AdmittedSource
 * @property {string} sourceId    e.g. "assessments"
 * @property {string} kind        e.g. "source:assessments"
 * @property {string} file        absolute path
 * @property {string} version     fixture version, e.g. "v1"
 * @property {string} digest      sha256 hex
 * @property {string[]} [header]  CSV only
 * @property {Record<string,string>[]} [rows]   CSV only, all values as strings
 * @property {number[]} [rowNumbers]           CSV only: file line number of each row (header is line 1)
 * @property {any} [json]          JSON sources only
 */

/**
 * @typedef {Object} Task
 * @property {string} id            == capability id
 * @property {string} capabilityId
 * @property {string} role          human label of the worker, e.g. "Analyst"
 * @property {string} label         short description
 * @property {string[]} dependsOn   task ids
 * @property {string[]} consumes    kinds
 * @property {string[]} produces    kinds
 */

/**
 * @typedef {Object} Handoff   written to the ledger when task A's output is consumed by task B
 * @property {string} from      task id
 * @property {string} to        task id
 * @property {string} kind
 * @property {string} artifact  "name@vN"
 * @property {string} digest
 * @property {string} status    "READY_FOR_USE"
 */

/**
 * @typedef {Object} Check
 * @property {string} id          e.g. "C04_schedule_no_overlap"
 * @property {string} title       plain words, e.g. "No mentor is booked twice at the same time"
 * @property {string} artifact    "name@vN" that was checked
 * @property {string} kind        artifact kind checked (used to route repair)
 * @property {'PASS'|'FAIL'|'UNKNOWN'} status
 * @property {string|number|null} expected
 * @property {string|number|null} observed
 * @property {{sourceId:string,row:number}[]} evidence   source rows that justify expected
 * @property {any} [detail]       machine-readable specifics (e.g. the conflicting sessions)
 * @property {string} message     one plain sentence
 */

/**
 * Worker context passed to every domain worker:
 * @typedef {Object} WorkerContext
 * @property {Record<string,AdmittedSource>} sources   keyed by sourceId
 * @property {import('./artifacts.mjs').ArtifactStore} store
 * @property {Scenario} scenario
 * @property {(kind:string)=>ArtifactRef|null} latest  latest version of a kind
 */

/**
 * @typedef {Object} Scenario   (fixtures/education-recovery/v1/scenarios/<id>.json)
 * @property {string} id
 * @property {string} title
 * @property {string} goalText
 * @property {object} proposal        g02-goal-proposal-v0.2 object (validated by tools/gate02)
 * @property {string[]} [excludeSources]   sourceIds to treat as missing (missing_source scenario)
 * @property {{mentor_id:string, day:string}[]} [unavailable]  availability windows removed
 * @property {null|{kind:'overlap', mentor_id:string}|{kind:'wrong_aggregate', skill_id:string}} inject
 *           A VISIBLE, deliberate defect for the self-correction demo. Workers read this flag
 *           and reproduce a realistic bug in their FIRST output version only.
 */
