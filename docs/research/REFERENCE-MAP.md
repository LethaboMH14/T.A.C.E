# T.A.C.E — complete research, decision, source and design map

**Updated 2026-11-13.** This is an index of **research already saved in the repository**, plus candidate libraries and design references. It does **not** imply every idea has been empirically tested. For authoritative design approval use ADRs; for running behavior use code and CI.

## Decision trail / immutable principles

| Resource | Why Claude must read it |
|---|---|
| [ADR-0001](../decisions/ADR-0001-foundation.md) | Project foundation and early constraints |
| [ADR-0002](../decisions/ADR-0002-universal-engine-education-demo.md) | Domain-neutral engine, EdTech demonstration, KAIRO excluded |
| [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md) | Approved educator problem statement, preserve exactly unless owner supersedes |
| [ADR-0004](../decisions/ADR-0004-g01-requirements-signoff-and-g02-handoff.md) | G01 design signoff and scope limits |
| [ADR-0005](../decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md) | Accepted G02.01 hardened intake v0.2, exact user/turn/source handling |
| [ADR-0006](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md) | Accepted G02.02 proposal v0.2; candidate DAG cannot grant tools |
| [ADR-0007](../decisions/ADR-0007-g02-03-prompt-trust-architecture.md) | **PROPOSED**, provider-neutral prompt/data boundaries; no model security claim |
| [Decision register](../decisions/DECISION-REGISTER.md) | Older decisions and amendments: check exact status addenda |

## Engineering foundation and gates

| Resource | Covers |
|---|---|
| [Charter](../00-product-charter.md) | Users, outcomes, education reference and non-goals |
| [Reference architecture](../01-reference-architecture.md) | Planes, lifecycle, graph, orchestration and API proposal |
| [Contract prototypes](../02-contracts-and-protocols.md) | Historical GoalContract, TaskNode, Message, RunState, receipt/event/memory examples; some predate G02.02 v0.2 |
| [Review playbook](../03-review-playbook.md) | Status vocabulary, review/approval procedure and definition of done |
| [Technology alternatives](../04-technology-options.md) | Python/TS, LangGraph, FastAPI, Pydantic, SQLite, RAG, UI options; not locked dependencies |
| [BobSwarm lineage](../05-bobswarm-lineage.md) | Legitimate inspiration, bounded tools, UI; no unreviewed source reuse |
| [Delivery plan](../06-delivery-plan.md) | Two lanes, thin slice, evaluation stages |
| [Gate registry](../gates/GATE-INDEX.md) | G01–G12 governance/status |
| [G01 final requirements](../gates/GATE-01-FINAL-SPECIFICATION.md) | Universal goal feasibility, target domains, EdTech proof and acceptance conditions |
| [G01 EdTech problem research](../gates/GATE-01-PROBLEM-STATEMENT.md) | Research-backed educational coordination problem, sources and evidence separation |
| [G01 edge-case matrix](../gates/GATE-01-EDGE-CASE-MATRIX.md) | 48 scenarios / risks and test cases; not all executed |
| [G01 security](../gates/GATE-01-SECURITY-THREAT-MODEL.md) | Threats SEC-01–SEC-20, policies, POPIA and approval boundaries |
| [G01 connectors](../gates/GATE-01-CONNECTOR-CAPABILITIES.md) | Required actual discovery/effect/auth/receipt fields; named app is not a connection |
| [G01 impact plan](../gates/GATE-01-IMPACT-EVALUATION-PLAN.md) | Benchmark protocol and hypotheses; no measured impact yet |
| [G02 subsections](../gates/GATE-02-INTENT-AND-CLARIFICATION-RESEARCH.md) | G02.01–G02.15 topics, alternatives, exit conditions |
| [G02.01 hardening](../gates/GATE-02-01-INPUT-NORMALIZATION.md) | Dual text, source slots, revisions, model projection and security fixes |
| [G02.02 hardening](../gates/GATE-02-02-GOAL-SCHEMA-AND-DECOMPOSITION.md) | Versioned schema, candidate DAG, mapped effects/sources, 143 tests and risks |
| [G02.03 research](../gates/GATE-02-03-PROMPT-ARCHITECTURE-RESEARCH.md) | Trusted role hierarchy, prompt/skill/memory injection, build plan |
| [G02.03/AG-UI parallel checkpoint](G02-03-AND-AGUI-PARALLEL-SPIKE-20261111.md) | Core and UI adapter lanes, CI truth limits |
| [Critical review PR #8](https://github.com/LethaboMH14/T.A.C.E/blob/review/g02-03-agui-next-20261112/docs/reviews/G02-03-PROMPT-AND-AGUI-CRITICAL-REVIEW-20261113.md) | Hardened PR changes; branch may change, do not treat as merged |
| [OpenDots + clarification research](OPENDOTS-ADOPTION-AND-CLARIFICATION-UX-20261110.md) | Adaptive/Guided/Quick requirements; OpenDots/OpenBot feature, license and safety audit |
| [Competition 110-point playbook](../hackathon/COLLEAGUE-ZERO-110-POINT-EXECUTION-PLAYBOOK.md) | Precise judging narrative, demo acceptance and failure-repair proof |

## Existing actual code and tests

- G01: [goal boundary](../../tools/gate01/goal-boundary.mjs) / [tests](../../tools/gate01/goal-boundary.test.mjs).
- G02.01: [normalized intake](../../tools/gate02/normalize-turn.mjs) / [tests](../../tools/gate02/normalize-turn.test.mjs).
- G02.02: [strict JSON schema](../../tools/gate02/goal-proposal.schema.json), [deterministic candidate validator](../../tools/gate02/goal-proposal.mjs), [tests](../../tools/gate02/goal-proposal.test.mjs).
- G02.03: [prompt assembly](../../tools/gate02/prompt-assembly.mjs), [tests](../../tools/gate02/prompt-assembly.test.mjs). No live model/provider.
- AG-UI: [adapter](../../tools/integrations/agui/tace-clarification-events.mjs), [tests](../../tools/integrations/agui/tace-clarification-events.test.mjs).
- **Unmerged PR #8:** [browser clarification demo](https://github.com/LethaboMH14/T.A.C.E/tree/review/g02-03-agui-next-20261112/tools/integrations/agui/demo), [upstream protocol schema test tooling](https://github.com/LethaboMH14/T.A.C.E/tree/review/g02-03-agui-next-20261112/tools/integrations/agui), [draft PR](https://github.com/LethaboMH14/T.A.C.E/pull/8).
- CI: [G02.03 PR test run](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43390724225), [AG-UI PR test run](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43390724153); compare specific test counts and SHA with workflow logs.

## Editable design sources

- [Figma master file](https://www.figma.com/design/28egBAkhQHExkqUinyimtM) — existing editable pages:
  - 01 — Intent & Trust Architecture
  - 02 — Mission Console Concept
  - 03 — Skills & Memory Policy
  - [04 — G02.01 Intake & Corrections](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=6-2)
  - [05 — G02.02 Goal Proposal & Candidate DAG](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2)
  - [06 — G02.03 Prompt Trust Architecture](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=18-2)
  - [07 — Parallel AG-UI/OpenDots Evaluation](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=29-2)
  - [08 — Guided Alignment Wizard working UI reference](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=35-2)
- [Gate 01 FigJam architecture](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi)
- [Editable diagrams.net multi-page source](../../diagrams/TACE-Architecture.drawio), [system gates Mermaid](../../diagrams/TACE-system-gates.mmd), [education goal Mermaid](../../diagrams/GATE-01-education-goal.mmd).
- Additional proposed [system execution Mermaid](../../diagrams/TACE-EXECUTION-END-TO-END.mmd) and [run lifecycle Mermaid](../../diagrams/TACE-RUN-LIFECYCLE.mmd).

## External open-source candidates — evaluate, do not assert adopted

| Candidate/source | What to evaluate | Important caveat |
|---|---|---|
| [CopilotKit](https://github.com/CopilotKit/CopilotKit) + [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui) | Event-backed human-in-the-loop UI, chat, clarification, mission state | The local AG-UI adapter is a partial shape spike; not a connected CopilotKit frontend |
| [OpenDots](https://github.com/CopilotKit/OpenDots) | Specialist workspaces, editable pages, chat, approval cards, computers and memory UX | MIT template; described as alpha/single-owner; CopilotKit Intelligence runtime separately governed/licensed |
| [OpenBot](https://github.com/CopilotKit/OpenBot) | Governed app/runtimes, permissions, OpenDots skin | Architecture/code/licensing/integration requires separate review; not deployed |
| [React Flow / xyflow](https://github.com/xyflow/xyflow) | Interactive DAG, agent workflow and evidence selections | UI tool; server graph state remains authoritative |
| [shadcn/ui](https://github.com/shadcn-ui/ui), [Radix](https://github.com/radix-ui/primitives), [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | Visual component system, accessible dialog/forms, layout | Proposed UI stack, not installed |
| [TanStack Table](https://github.com/TanStack/table) | Evidence/assessment/receipt tables | UI table does not prove underlying evidence |
| [Tiptap](https://github.com/ueberdosis/tiptap) | Editable report/draft documents | Confirm selected package licenses and persistence |
| [Motion](https://github.com/motiondivision/motion) | Purposeful live-state animation | Must respect reduced motion; never animate fake execution |
| [LangGraph](https://github.com/langchain-ai/langgraph), [PydanticAI](https://github.com/pydantic/pydantic-ai), [AutoGen](https://github.com/microsoft/autogen), [CrewAI](https://github.com/crewAIInc/crewAI), [smolagents](https://github.com/huggingface/smolagents) | Orchestration alternatives | Benchmark narrow task; never assume swarms improve correctness |
| [Pydantic](https://github.com/pydantic/pydantic), [Zod](https://github.com/colinhacks/zod), [FastAPI](https://github.com/fastapi/fastapi) | Runtime validation and API | Selection pending, existing JS prototypes must remain compatible |
| [MCP specification](https://github.com/modelcontextprotocol/specification), [A2A](https://github.com/a2aproject/A2A) | External tools/agent interoperability | Metadata is not permission; G07 enforcement mandatory |
| [Docling](https://github.com/docling-project/docling), [LlamaIndex](https://github.com/run-llama/llama_index), [Haystack](https://github.com/deepset-ai/haystack) | Safe parsing, retrieval/context | Avoid untrusted binary/network ingestion in first synthetic demo |
| [SQLite](https://www.sqlite.org/), [PostgreSQL](https://www.postgresql.org/), [Qdrant](https://github.com/qdrant/qdrant), pgvector | Event/artifact/knowledge storage | Choose on measured workload, auth and retention need |
| [Langfuse](https://github.com/langfuse/langfuse), [Arize Phoenix](https://github.com/Arize-ai/phoenix), OpenTelemetry | Tracing and evaluation | Redact sensitive payloads; logs not success evidence by themselves |
| [Mem0](https://github.com/mem0ai/mem0), [Letta](https://github.com/letta-ai/letta), [Zep/Graphiti](https://github.com/getzep/graphiti) | Scoped memory candidates | Consent, TTL, tenant isolation, correction and deletion before adoption |
| [Honcho](https://github.com/plastic-labs/honcho), Obsidian-like notes | Optional agent/user memory workflows | Not installed; never treat memory notes as policy |
| [Temporal](https://github.com/temporalio/temporal), [Inngest](https://github.com/inngest/inngest), Trigger.dev | Durable retries/long-running tasks | Compare complexity and license/hosting before switching from minimal state machine |
| [promptfoo](https://github.com/promptfoo/promptfoo), DeepEval/Ragas/Giskard | Adversarial/model eval | Offline deterministic tests are insufficient for semantic claims |

**Research discipline:** Dependencies and licenses can change. Review current upstream docs/commit/version, vulnerability scans, operational costs and compatibility at the point of actual adoption. Do not lift copyrighted screenshots/assets or unlicensed code. Open-source source code ≠ free hosted inference or enterprise features. The repository's existing OpenDots audit is the historical basis; independently reverify before connecting accounts.

## What has NOT been researched to completion

G02.04–G02.15 (clarification, success criteria, effect classification, capability discovery, agent selection, confidence, repair, language, injection, eval, API, final signoff) remain numbered future gates. G03–G12 are design/implementation work, not live modules. There is **no verified end-to-end agent mission, no real independent self-repair loop, no measured EdTech impact, no production tool permission system and no connected OpenDots/OpenBot**. Do not merge inferred facts into the evidence record.
