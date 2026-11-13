# T.A.C.E — engineering handover, source of truth, status and scope

**Snapshot date:** 2026-11-13, South Africa (SAST). **Audience:** Claude Code, engineers, reviewers and authorized agents. **Purpose:** Preserve the complete intent, architecture, research, tests and next steps within the repository. This document is a *navigation and fact map*; it does not implement the proposed components.

> **Read root [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md), then this file.** Follow accepted ADRs; verify the current GitHub head before modifying code. Treat historical plans as plans.

## 1. Mission and decisions that must not be lost

**Product:** T.A.C.E, a domain-neutral, API-first system that accepts an authorized user goal, interprets it, clarifies only material ambiguities, discovers feasible sources/tools, designs a bounded goal-specific specialist graph, performs real work, independently checks outputs, repairs mistakes within policy/budget, and returns **usable, evidenced deliverables**. The project name expansion/public brand is not settled.

**First judged proof:** *Autonomous Education Recovery Colleague* to help an adult education coordinator turn **36 synthetic adult trainees'** assessment results and **three fictional mentors'** availability into evidence-backed learning-gap analysis, intervention plans, a non-conflicting support schedule, reports and **unsent** draft communications. The engine must not hardcode education, exact numbers or simulated completion paths. KAIRO reuse is explicitly excluded. The BobSwarm project is *lineage/design inspiration*, not a running T.A.C.E runtime.

**The winning behavior:** Accept one goal → show a real plan and specialist handoffs → generate real files → intentionally encounter a genuine validation failure on synthetic data → independently detect and explain it → target a repair → re-open and re-check the corrected file → deliver verified artifacts with source/receipt provenance. If a problem cannot safely be fixed, report a genuine block instead of claiming success.

**High priority is actual execution and verification, not accumulating more documents.** Existing gates/ADRs should coexist with a scoped hackathon vertical slice, without pretending those future gates are approved.

## 2. Verified and unverified implementation — as observed

| Component | Actual present code or evidence | Owner/governance status | What is still absent |
|---|---|---|---|
| G01 goal admission | `tools/gate01/goal-boundary.mjs`; local/CI regression tests | G01 design accepted ADR-0004 | Real auth and production API |
| G02.01 intake/revision | `tools/gate02/normalize-turn.mjs`, tests, server-fixture lineage and restricted interpreter projection | Hardened **design** accepted ADR-0005 | Authenticated server, atomic revision ledger, real source ownership |
| G02.02 goal proposal | `goal-proposal.schema.json`, `goal-proposal.mjs`, tests, candidate DAG/effect/source mapping and consistency checks | Hardened **design** accepted ADR-0006 | Semantic model interpreter, real execution DAG, actual policy |
| G02.03 prompt roles | `tools/gate02/prompt-assembly.mjs`, tests, provider-neutral system/developer/user envelope | ADR-0007 **PROPOSED** | Live model, secured context ingestion, provider integration and semantic attack evaluation |
| G02.03 hardening | Draft [PR #8](https://github.com/LethaboMH14/T.A.C.E/pull/8), added 10 adversarial tests | **UNMERGED** as of snapshot | Owner ADR-0007 acceptance, integration |
| AG-UI adapter | `tools/integrations/agui/tace-clarification-events.mjs`, tests | **Isolated research evaluation** | Connected UI runtime, authenticated answer commits |
| Three-question UI | Draft PR #8 `tools/integrations/agui/demo/`, source + tests + pinned protocol-schema check | **UNMERGED / SYNTHETIC DEMO** | G02.04 policy, live CopilotKit/OpenDots/OpenBot |
| G03–G12 | Diagrams, charters, research/engineering specs only | **NOT ACCEPTED / BLOCKED** except authorized parallel evaluation | Actual source retrieval, graph runtime, swarms, tools, memory, independent repair, live console and E2E proof |
| 110-point demo strategy | `docs/hackathon/COLLEAGUE-ZERO-110-POINT-EXECUTION-PLAYBOOK.md` | Target plan only | Real empirical demo, measured rubric evidence |

**CI evidence (not autonomous E2E):** At PR #8 head `da96575896d1683d53f855ae1fcaf3afe46bdea7`, 2026-11-13 GitHub Actions showed passing `gate02-prompt-assembly`, `agui-clarification-eval`, `gate02-proposal` and `gate02-intake` checks. Historical run numbers: [241 core deterministic checks](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625179) (54+143+44) and [48 UI/adapter tests](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625949) (30+18) with [upstream AG-UI schema conformance](../reviews/G02-03-PROMPT-AND-AGUI-CRITICAL-REVIEW-20261113.md) in PR #8. Counts demonstrate specific bounded assertions, **not** live agent execution or tool security.

**Main versus PR:** On inspection, main was `16a08a11ca4e38053a2e52932a7fb5b4c4e3321b` before these handover commits; PR #8 branch `review/g02-03-agui-next-20261112` was open, **draft and unmerged**. Before any implementation, compare branch heads and decide explicitly whether to extend/merge PR #8; do not silently copy code from the PR onto main.

## 3. What is approved, proposed or undecided

| Decision | State | Source |
|---|---|---|
| Universal engine, EdTech first demonstration, no KAIRO | **Approved design** | [ADR-0002](../decisions/ADR-0002-universal-engine-education-demo.md), [G01 final](../gates/GATE-01-FINAL-SPECIFICATION.md) |
| Exact educator problem statement | **Approved / freeze** | [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md) |
| G01 requirements handoff | **DESIGN_COMPLETE** | [ADR-0004](../decisions/ADR-0004-g01-requirements-signoff-and-g02-handoff.md) |
| G02.01 hardened intake v0.2 | **DESIGN_ACCEPTED** | [ADR-0005](../decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md) |
| G02.02 hardened proposal v0.2 | **DESIGN_ACCEPTED** | [ADR-0006](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md) |
| G02.03 prompt assembly | **PROPOSED, tested prototype** | [ADR-0007](../decisions/ADR-0007-g02-03-prompt-trust-architecture.md), [PR #8](https://github.com/LethaboMH14/T.A.C.E/pull/8) |
| G02.04 adaptive/Guided/Quick clarification | **User requirement approved for research; policy not implemented/accepted** | [OpenDots + clarification research](../research/OPENDOTS-ADOPTION-AND-CLARIFICATION-UX-20261110.md) |
| CopilotKit/AG-UI/OpenDots/OpenBot | **EVALUATION_APPROVED; NOT adopted/deployed** | [Issue #7](https://github.com/LethaboMH14/T.A.C.E/issues/7), [research](../research/OPENDOTS-ADOPTION-AND-CLARIFICATION-UX-20261110.md) |
| React/Vite/FastAPI/LangGraph/Pydantic/SQLite etc. | **Candidates, not final stack** | [Technology options](../04-technology-options.md) |
| Real tool permissions, self-repair, learner data | **Design targets / implementation blocked** | [G01 security threat model](../gates/GATE-01-SECURITY-THREAT-MODEL.md), G07/G09/G11 |

**Interpretation of discrepancies:** Some older docs still say ADR-0006 proposed or that G02.03 is not implemented. Those are historical snapshots. Use **explicit latest owner-approved ADR addenda** for decisions and **the current Git tree and observed tests** for implementation facts; do not rewrite history to imply everything is accepted.

## 4. Exact repo entry points

- Product/context: [charter](../00-product-charter.md), [reference architecture](../01-reference-architecture.md), [contracts](../02-contracts-and-protocols.md), [technology options](../04-technology-options.md), [delivery](../06-delivery-plan.md).
- Deep source map: [research and diagrams index](../research/REFERENCE-MAP.md).
- Numbered gates and 15 G02 research subsections: [Gate index](../gates/GATE-INDEX.md), [G02 research charter](../gates/GATE-02-INTENT-AND-CLARIFICATION-RESEARCH.md).
- Trust/POPIA/permissions: [G01 security](../gates/GATE-01-SECURITY-THREAT-MODEL.md), [connector capability requirements](../gates/GATE-01-CONNECTOR-CAPABILITIES.md).
- UI and Figma: [Mission Console design](../architecture/MISSION-CONSOLE-UX-DESIGN-SYSTEM.md) and [editable Figma file](https://www.figma.com/design/28egBAkhQHExkqUinyimtM).
- Engine runtime and data contracts: [system blueprint](../architecture/COMPLETE-SYSTEM-BLUEPRINT.md), [API/state/contracts](../architecture/CONTRACTS-STATE-MACHINE-AND-APIS.md).
- Executable work: [implementation brief](CLAUDE-IMPLEMENTATION-BRIEF.md), [full backlog and acceptance](../architecture/EXECUTION-BACKLOG-AND-ACCEPTANCE-TESTS.md), [110/110 playbook](../hackathon/COLLEAGUE-ZERO-110-POINT-EXECUTION-PLAYBOOK.md).

## 5. Recommended minimal implementation contract (proposed)

**Core domain-neutral types:** NormalizedIntake, GoalContractProposal, GoalContract (after trusted policy binding), ClarificationRequest/Answer, SourceRef+Provenance, CapabilityDescriptor, ToolEffect, ActionProposal, ApprovalDecision, TaskNode/DAG, AgentHandoff, RunEvent, RunSnapshot, EvidenceCheck, ArtifactManifest, ExecutionReceipt, MemoryRecord. Existing G02.01/G02.02 types must be **reused or explicitly version-migrated**, not silently replaced by a different schema.

**Execution ownership:** authenticated API/ledger → validator/policy → planner/capability registry → durable DAG → scoped workers/tool gateway → independent verifier/repair → artifact manifests/read-back receipts → UI events. Agent messages and model text are never authoritative state transitions.

**First deliverables:** real gap-analysis table, performance summary, intervention plan, conflict-free mentor schedule, unsent messages, correction history and independently checkable evidence. Data synthetic; no invented connectors or grading/send rights.

## 6. When a new Claude coding session starts

1. Fetch latest main + PR #8 state and compare docs with source; check missing dependencies and actual CI.
2. Read accepted ADRs and the complete blueprint **before adding new architecture**.
3. Choose an explicitly scoped work package from the [execution backlog](../architecture/EXECUTION-BACKLOG-AND-ACCEPTANCE-TESTS.md).
4. For each component, write typed interfaces, tests and at least one negative case first; implement, run locally, then CI.
5. Produce actual fixtures and files, not screenshots or simulated reports of unseen work.
6. For security-sensitive actions, stop at proposals until independent server policy and human approval exist.
7. Report exact changes, code paths, test results, unavailable dependencies, remaining risks and decision requests. No automatic merge or secret/API access by implication.

**Ultimate success:** a judge or new engineer can clone the repo, follow a documented command, run a synthetic education mission, inspect each produced artifact and verify a real fail → repair → recheck trace without private credentials or hidden manual intervention. **That end-to-end behavior is still a work item, not a completed feature.**
