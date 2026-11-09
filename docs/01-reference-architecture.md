# 01 — System reference architecture

**Status:** High-level boundaries ACCEPTED; implementation choices PROPOSED.
**Version:** 0.1 / 2026-11-10.

## Design principle

**The graph owns transitions and permissions. The agents own bounded reasoning and work.** No agent may bypass the runtime by claiming its own tools ran, enlarging its permission scope, silently changing the acceptance criteria, or treating retrieved text as authoritative instructions.

## Logical architecture

~~~mermaid
flowchart TD
 U[User: educational outcome] --> UI[Mission Console: goal + artifacts + live trace]
 UI --> API[Application API and run service]
 API --> I[Intent / ambiguity gate]
 I --> C[Validated GoalContract]
 C --> X[Context Compiler]
 X --> P[Planner + Capability Registry]
 P --> G[Graph Runtime / State and Policies]
 G --> W1[Data / Assessment specialist]
 G --> W2[Curriculum / Research specialist]
 W1 --> M[Evidence and dependency merger]
 W2 --> M
 M --> W3[Intervention / Content specialist]
 W3 --> V[Independent Reviewer + deterministic checks]
 V -->|Failed, remaining budget| R[Repair task with structured critique]
 R --> W3
 V -->|Passed| A{Approval required?}
 A -->|Yes| H[Human approval gate]
 A -->|No| E[Tool executor]
 H -->|Approved| E
 H -->|Rejected| END[Explicit halt / revised contract]
 E --> O[Outcome verifier]
 O -->|Mismatch| G
 O -->|Verified| D[Artifact delivery / report]
 D --> Q[Memory curator + retention checks]
 Q --> DB[(Scoped long-term memory)]
 SRC[(Curriculum / data / policies)] --> X
 DB --> X
 T[MCP / bounded tool gateway] <--> E
 G <--> CHK[(Checkpoint and event store)]
 UI <--> CHK
~~~

**Diagram caution:** This is a logical topology, not proof of working services. Each subsystem below is a design specification awaiting individual review and tests.

## Planes and ownership

| Plane | Components | Owns | Cannot own |
| --- | --- | --- | --- |
| Experience | Mission Console, clarify cards, run/evidence/artifact views | user interaction, approvals, visualization | agent decisions or fabricated events |
| Control | Intent, Contract, Planner, Graph, Policy/Quota, Scheduler | permissions, DAG, retries, checkpoints, routing | tool results it has not verified |
| Intelligence | Role-specific workers and independent reviewer | scoped research, analysis and creation | shared permissions, run completion flag |
| Context | Source registry, parser, retriever, compiler, memory | safe, relevant evidence/recall | promoting untrusted documents to instructions |
| Execution | Tool registry, MCP adapters, filesystem, demo LMS/tasks | authorized external changes, idempotent receipts | deciding its own authority |
| Assurance | Schema validators, policy tests, provenance, output verification | pass/fail and repair requests | asserting subjective accuracy without proof |
| Persistence | DB, object store, checkpoints, audit ledger | continuity, audit, source and artifact versions | indiscriminate indefinite personal-data memory |

## Canonical execution lifecycle

RECEIVED → UNDERSTANDING → CLARIFICATION_REQUIRED (optional) → CONTRACT_VALIDATED → CONTEXT_READY → PLANNED → RUNNING → REVIEWING → REPAIRING (bounded loop) → APPROVAL_REQUIRED (optional) → EXECUTING → VERIFYING → DELIVERED.

Every active state may transition to FAILED or CANCELLED. BLOCKED is a recoverable state with an explicit cause. APPROVAL_REQUIRED must not be auto-advanced. A run is delivered only when its acceptance criteria pass and persisted artifacts/tool outcomes are verified.

## Bounded specialist selection

The planner constructs task nodes from **capabilities**, not keyword hits. The registry records each capability's inputs, outputs, tool whitelist, risk class, cost profile, version and compatibility. Typical roster candidates:
- Intent Engineer (pre-execution contract)
- Data/Assessment Analyst (independent analysis)
- Curriculum Researcher (evidence search)
- Intervention Designer (dependency-consuming synthesizer)
- Quality and Policy Reviewer (independent evaluation)
- Tool Executor / Artifact Builder (actions only when authorized)
- Memory Curator (post-run governance)

The roster is created **per goal**; not all agents spawn for every request. Independent workers can run in parallel. A downstream worker cannot start before its dependency evidence is available. Role-to-role communication goes through typed messages in the run store, not free-form unbounded group chat.

## Prompt and context engineering

- **Intent step:** parse objective, scope, constraints, authority, artifact targets, evidence needs and completion tests. Clarify only ambiguity with material impact, not every unspecified detail.
- **Context Compiler:** for EACH agent call, build an ephemeral context pack containing system policy, role contract, goal ID, relevant graph state, minimal vetted source excerpts, source IDs, dependency outputs, allowed tools and output schema.
- **Retrieval:** source ingestion → structural parsing → chunking with document/page anchors → metadata filter → lexical/vector search (as available) → rerank → conflict/recency check → trust labels.
- **Injection defence:** tool and retrieved content are data. Neither can replace higher-priority instructions, change tool permissions or write memory without validation.
- **Context budget:** task-specific limits and compact checkpoint summaries; refer back to immutable source IDs rather than re-injecting entire documents.
- **Evidence discipline:** every consequential claim carries a source or tool-result reference; contradictions must be surfaced.

## Memory model

1. **Working memory:** current run state; persisted via checkpointer.
2. **Episodic memory:** completed job summaries with actual outcomes, failures and artifacts.
3. **Semantic memory:** permitted, versioned facts with source, owner/scope, TTL and correction path.
4. **Procedural memory:** validated prompts, skills, fixes and successful workflows; tested before promotion.
5. **Evidence archive:** source metadata and tool receipts backing assertions; separate from model-generated summaries.

Only the memory curator can promote memories, following provenance, tenant/learner boundaries, consent, relevance, sensitivity, deduplication and expiry checks. "Learning" means selective retrieval and stored procedures, **not** autonomous foundation-model weight updates.

## Graph reliability controls

- finite task DAG; no cycles without a named, bounded retry edge;
- max repair rounds (proposed 2), capped runtime, model calls and cost;
- checkpoints before irreversible/side-effecting nodes;
- idempotency key per external effect; no duplicate messages/records on replay;
- terminal receipt validation; resume/cancel/pause semantics;
- human approval for grades, communications, external publishing and sensitive changes;
- explicit fail-closed behavior on unknown permission or unsupported source;
- testable state-machine invariants, trace events and recovery after disconnect.

## Proposed deployment boundary

- **UI:** React + TypeScript + Vite; independent implementation informed by BobSwarm's visual patterns.
- **Control API:** FastAPI/Python plus LangGraph as first candidate, subject to technical review.
- **Demo state:** SQLite, with a persistent local artifact directory and optional SQLite lexical search.
- **Scale-up state:** PostgreSQL/pgvector, object storage and hosted queues only when justified.
- **Tools:** bounded Python function adapters first; MCP where it genuinely simplifies integration.
- **Inference:** provider-agnostic adapter, local Ollama or verified hosted endpoint; usage is not necessarily free.
- **Events:** Server-Sent Events or WebSockets; authoritative run state and replay cursors.
- **Telemetry:** structured events first; Phoenix/Langfuse as optional tracing integrations.

Important: BobSwarm's Node MCP server is a useful *architectural reference*, but not an assumed drop-in dependency or permissively licensed source-code package.

## API surface (draft, no implementation claim)

- POST /v1/goals/interpret → proposed GoalContract + material clarification questions
- POST /v1/runs → graph run bound to approved contract; idempotency key
- GET /v1/runs/{id} → authoritative status and artifact links
- GET /v1/runs/{id}/events → cursor-based live/replayable events
- POST /v1/runs/{id}/clarifications → answers to pending questions
- POST /v1/runs/{id}/approvals/{approval_id} → explicit authorized decision
- POST /v1/runs/{id}/cancel → cancellation request and effect boundary
- GET /v1/artifacts/{id} → authorized download
- GET /v1/runs/{id}/evidence → evidence and tool receipt ledger

Auth and scope are required for all endpoints in multi-user deployments.

## Cross-component integration test

With synthetic records: submit vague teacher goal → receive at most essential clarification(s) → approve contract → inspect generated graph → observe independent analysis + curriculum agents → catch unsupported recommendation → repair → create persistent plans and follow-ups → place communication drafts behind approval → reopen final artifacts after reload → verify all evidence, state and tool receipts.