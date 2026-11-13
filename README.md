# T.A.C.E — Universal Goal-to-Execution Engine

**Status:** One synthetic education mission now runs end to end: goal → plan → real files → independent review → targeted repair → re-check. The workers are deterministic code (no language model in the runtime yet). The universal engine, auth, real connectors and sending are not built.
**Last reviewed:** 2026-11-13 (verify live branch/CI before acting)

## Run the demo (Node ≥ 22.13, no install step, no internet, no keys)

```sh
npm test                                  # 383 tests: engine, education pack, end-to-end, existing G01/G02 gates
node cli/tace.mjs list                    # the six scenarios
npm run demo:inject_overlap               # the Scheduler double-books Mentor B; the Reviewer catches it; Repair moves 1 session
npm run studio                            # Mission Studio at http://localhost:4173 (start runs, watch them live)
```

| Scenario | What happens (measured on 2026-11-13) | Exit |
|---|---|---|
| `baseline` | 5 steps, 36 learners, 57 gaps, 14 at risk, 14 sessions booked, 17 unsent drafts; 13/13 checks | VERIFIED |
| `report_only` | Smaller goal → planner picks 2 steps only; 5/5 checks | VERIFIED |
| `inject_overlap` | Planted fault: Mentor B booked twice Tue 09:00. Reviewer C04 fails → Repair writes `mentor-schedule.v2.csv` (1 session moved, v1 kept) → drafts re-run from v2 → 13/13 | VERIFIED after 1 repair |
| `inject_wrong_aggregate` | Planted fault: S3 mean counts missing scores as zero (60.9). Reviewer recomputes 64.5 → Repair writes v2; its sha256 equals the correct baseline file | VERIFIED after 1 repair |
| `mentor_unavailable` | Mentor B away Thursday → schedule re-planned, still 14 booked | VERIFIED |
| `missing_source` | No assessment file → nothing guessed, nothing produced | BLOCKED |

Each run writes `runs/<runId>/`: versioned `artifacts/` (old versions kept), `events.jsonl` + `ledger.sqlite` (append-only), `evidence-checks.json`, `repair-history.json` and `final-manifest.json` (sha256 of every input and output).

**How it is built:** `engine/` is domain-neutral (contracts, source admission, planner, graph runner, artifact store with read-back, SQLite ledger, run loop). `domains/education/` is the first domain pack (analyst, support planner, scheduler, writer, **independent reviewer that imports no worker code**, targeted repair). Goal proposals pass the accepted G02 validators before planning. Decision record: [ADR-0008](docs/decisions/ADR-0008-runtime-slice.md). Reviews: [wave 1](docs/reviews/WAVE1-REVIEW-20261113.md), [wave 2](docs/reviews/WAVE2-REVIEW-20261113.md).

**Honest limits:**
- Workers are code, not LLM agents.
- Synthetic data only.
- Faults in the two self-correction scenarios are planted on purpose. They are declared in the scenario file and in the ledger (`plantedFault`).
- Mission Studio paces runs to about 0.65 s per step so people can follow them. The work itself takes milliseconds.
- No auth or tenant layer. Nothing can be sent.
- Impact on coordinators is not measured.

## Claude Code / engineering handover — START HERE

The complete, navigable project architecture, existing research, decisions, technical execution contracts, security boundaries, UI stack, and prioritized implementation backlog are now documented **inside this repository**. **No new runtime capability is claimed by adding these documents.**

- **[CLAUDE.md](CLAUDE.md)** — required starting point for Claude: what is approved, what runs, current PR #8, engineering rules and the build mission.
- **[AGENTS.md](AGENTS.md)** — repository-wide, tool-neutral contributor conventions and security/approval limits.
- **[START-HERE](docs/handover/START-HERE.md)** — dated factual status and entry points to verified source and proposed work.
- **[Complete system blueprint](docs/architecture/COMPLETE-SYSTEM-BLUEPRINT.md)** — G01–G12, full goal→plan→agents→tools→checks→repair→delivery lifecycle.
- **[Contracts, state machine and API](docs/architecture/CONTRACTS-STATE-MACHINE-AND-APIS.md)** — versioned schemas, endpoints, typed events, exact approval and receipts (future runtime design).
- **[Security, tools, skills and memory](docs/architecture/SECURITY-MEMORY-AND-TOOL-BOUNDARIES.md)** — all 20 G01 risk controls, source and tool policies, POPIA and governance.
- **[Mission Console UI/UX](docs/architecture/MISSION-CONSOLE-UX-DESIGN-SYSTEM.md)** — screens, interactions, open-source stack, Figma and AG-UI/OpenDots evaluation.
- **[Execution backlog and 25 E2E tests](docs/architecture/EXECUTION-BACKLOG-AND-ACCEPTANCE-TESTS.md)** — first real synthetic education mission, actual self-repair, CI/evidence and build order.
- **[Research and reference map](docs/research/REFERENCE-MAP.md)** — all relevant primary project documents, accepted ADRs, source code, Figma and candidate technologies.
- **[Claude implementation brief](docs/handover/CLAUDE-IMPLEMENTATION-BRIEF.md)** — actionable task sequence for a new Claude coding session.
- **[Mermaid execution flow](diagrams/TACE-EXECUTION-END-TO-END.mmd)** and **[run state machine](diagrams/TACE-RUN-LIFECYCLE.mmd)** — editable architecture diagrams.

**Honest implementation status:** G01, G02.01 and G02.02 are accepted **design** baselines with deterministic code/tests. G02.03 ADR-0007 remains proposed; the next hardening and offline Guided Alignment demo are on open draft [PR #8](https://github.com/LethaboMH14/T.A.C.E/pull/8), **not merged at the last review**. G02.04 and wider execution/security/verification modules remain not deployed. CopilotKit/AG-UI/OpenDots/OpenBot are evaluation-only. The priority is a true synthetic education goal → real artifacts → independent error detection → targeted repair → recheck demonstration, not new architecture for its own sake.


**Repository purpose:** Durable source of truth for the Colleague Zero project: product definition, agent architecture, design decisions, research, interfaces, tests and development.

> T.A.C.E is the repository name. Its expanded acronym and the public-facing product name are **not yet approved**. SONAR is a working lineage label from BobSwarm, not a confirmed rename.

## North star

Build a **domain-agnostic outcome-owning execution engine**. Education is the first domain deployment for Colleague Zero, not a restriction on possible goals. T.A.C.E should make proportional decisions about skills, tools, agents, graph topology, output format, costs, and authorization based on each goal. It takes an educational goal, asks for clarification only when necessary, creates an executable goal contract, retrieves trustworthy context, assembles specialist agents as needed, executes a dependency-aware workflow, checks and repairs its work, produces real artifacts and records verified outcomes.

**Provisional education demo workflow (NOT the universal product):** learner-success intervention (synthetic assessment/attendance/curriculum inputs → evidence-backed catch-up plans → review and correction → teacher-approved communication drafts and follow-ups). This workflow is proposed, not yet approved as the sole use case.

## Agreed architectural principles

1. **Prompt engineering:** adaptive intent analysis, ambiguity checks, constrained clarification, typed goal contracts.
2. **Context engineering:** task- and role-specific retrieval, source provenance, relevance/recency filtering, context budgeting.
3. **Swarm engineering:** capability-based specialist selection, parallel work where independent, structured handoffs, independent review.
4. **Graph engineering:** explicit state transitions, dependencies, budgets, retries, approval gates, checkpoints and recoverability.
5. **Execution engineering:** real bounded tools and verified results, not claimed actions.
6. **Memory engineering:** short-term state and governed persistent memory, with scope and consent.
7. **Evaluation and safety:** objective acceptance tests, traceable evidence, human control of consequential actions.

## Project documents

- [Product charter](docs/00-product-charter.md): users, problem, product outcomes, scope and non-goals.
- [Reference architecture](docs/01-reference-architecture.md): system blocks, runtime graph, data and communication flows.
- [Interfaces and schemas](docs/02-contracts-and-protocols.md): GoalContract, Task, AgentMessage, RunState, Evidence, ToolCall, Review.
- [Subsystem review method](docs/03-review-playbook.md): disciplined design-review order, quality gates and decision criteria.
- [Technology options](docs/04-technology-options.md): proposed tools, trade-offs and verification needs.
- [BobSwarm lineage](docs/05-bobswarm-lineage.md): concept reuse vs. implementation replacement and licensing boundary.
- [Implementation and demo plan](docs/06-delivery-plan.md): ordered build, test cases, judging proof and fallback.
- [Architecture Decision Records](docs/decisions/ADR-0001-foundation.md).
- [Decision register](docs/decisions/DECISION-REGISTER.md): locked, proposed and unresolved items.

## Working agreement

**No architectural choice becomes LOCKED just because it appears on a diagram.** Decisions require a documented rationale, alternatives, downstream impact and an acceptance check. The next subsystem for review is **01 — Intake, Intent and GoalContract**. We review one subsystem at a time, update its contracts and integration notes, then record the decision before advancing.

**No autonomous GitHub workers, schedulers, deployments, external messaging, live grades or real student data are enabled by these design documents.**

## Source projects / references

- Earlier team project: https://github.com/Sibusiso-K/Sonar-BobSwarm-
- LangGraph documentation: https://docs.langchain.com/oss/python/langgraph/overview
- Anthropic context engineering: https://www.anthropic.com/research/effective-context-engineering-for-ai-agents
- MCP: https://modelcontextprotocol.io/

The license in this repository is MIT. That **does not grant permission to copy code from BobSwarm**, which did not declare an explicit repository license at the time of this review. Reuse architectural ideas and independently authored implementations unless rights are confirmed.

## Editable system maps

- **[Editable diagrams.net architecture](diagrams/TACE-Architecture.drawio)** — four pages: 00 Gate Map, 01 Universal Goal Boundary, 02 Mission Console, plus archived prior EdTech concept; open in [diagrams.net](https://app.diagrams.net/) using **File → Open From → GitHub** or import the raw file.
- **[Gate registry](docs/gates/GATE-INDEX.md)** — numbered G01–G12, current approval states and gate outputs.
- **[Gate 01 deep research](docs/gates/GATE-01-EDUCATION-GOAL.md)** — sourced educational problem and proposed goal; no later gates started.

**Current active gate: G01 EDUCATION GOAL (research only).** Downstream gate design remains blocked until G01 exit criteria and a formal approval ADR are met.


## Scope v0.2 — universal engine / education demonstration

- [ADR-0002: universal engine scope](docs/decisions/ADR-0002-universal-engine-education-demo.md)
- [Gate 01: Universal Goal Boundary and Education Proof Case](docs/gates/GATE-01-EDUCATION-GOAL.md)
- [Judge/company evidence](docs/gates/GATE-01-judge-alignment.md)
- [Editable multi-page architecture](diagrams/TACE-Architecture.drawio)

The core can accept any natural-language goal for **capability assessment**. It executes only supported, authorized tasks; missing models, tools, approvals or sources result in a clear blocker or partial deliverable rather than false claims. Simple goals need not spawn a swarm. More involved goals can create dynamic typed graphs and use appropriate agents, tools and outputs. **Gate 01 design complete; Gate 02 in research.**


## Gate 01 v0.3 — any education goal, adaptive capabilities

T.A.C.E accepts widely varying natural-language tasks—not fixed templates—even without attached data. It must assess missing information, retrieve trusted public or connected data when permitted, determine if a swarm is needed, choose real supported output formats, and verify every file/action. Education capability families cover workload, gaps, language access, continuity, cohort rescue, educational truth auditing and administration.

- [Adaptive task catalogue](docs/gates/GATE-01-UNIVERSAL-TASK-CATALOGUE.md)
- [Plugin/app/API integration contracts](docs/gates/GATE-01-CONNECTOR-CAPABILITIES.md)
- [Editable architecture diagrams](diagrams/TACE-Architecture.drawio)

**KAIRO is not part of the current design track.** No external app has been connected to T.A.C.E. Gate 01 remains IN RESEARCH, not an implemented engine; Gate 02 is blocked pending review.


### Evidence-backed education problem (G01 research)

**[Read the APPROVED formal and simple education problem statements, verified research and risks](docs/gates/GATE-01-PROBLEM-STATEMENT.md).** It covers workload, learning gaps, language access and disconnected educational information-to-action workflows, with official OECD, DBE and UNESCO evidence. The proposed T.A.C.E outcome improvement is a hypothesis requiring a measured demo and user validation. Any file format may be requested for intake feasibility, but only tested supported parsers/exporters and authorized connectors may actually execute. KAIRO is not part of this design direction. Gate 01 design is complete.


### G01 problem wording approved / architecture still under research

The formal problem statement, simple human-centred description and concise spoken pitch were explicitly approved on 2026-11-10 and frozen verbatim in [ADR-0003](docs/decisions/ADR-0003-education-problem-statement-approval.md). [Full Gate 01 architecture](docs/gates/GATE-01-PROBLEM-ARCHITECTURE.md) maps evidence, the fourth interoperability issue, the plausible risks if unresolved, universal goal intake, and format/connector boundaries to the downstream gates. [**Editable FigJam architecture and evidence board**](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi). **G01 IN_RESEARCH; G02 BLOCKED.**

## Gate 01 design signoff / Gate 02 opened (10 November 2026)

**Gate 01 DESIGN_COMPLETE (requirements/architecture only)** through [ADR-0004](docs/decisions/ADR-0004-g01-requirements-signoff-and-g02-handoff.md). The accepted education problem wording remains [ADR-0003](docs/decisions/ADR-0003-education-problem-statement-approval.md).

**Gate 02 IN_RESEARCH:** [intent and clarification charter](docs/gates/GATE-02-INTENT-AND-CLARIFICATION-RESEARCH.md) / [issue #3](https://github.com/LethaboMH14/T.A.C.E/issues/3). G01's [complete specification](docs/gates/GATE-01-FINAL-SPECIFICATION.md), [impact plan](docs/gates/GATE-01-IMPACT-EVALUATION-PLAN.md), [security threat model](docs/gates/GATE-01-SECURITY-THREAT-MODEL.md) and [48 edge cases](docs/gates/GATE-01-EDGE-CASE-MATRIX.md) are the source requirements.

**Implementation status:** a narrow [goal-boundary spike](tools/gate01/goal-boundary.mjs) passed 16 **local** tests; this is **not** production authentication or proof of POPIA compliance. Full security implementation [issue #4](https://github.com/LethaboMH14/T.A.C.E/issues/4) and empirical benefit testing [issue #5](https://github.com/LethaboMH14/T.A.C.E/issues/5) remain mandatory release blockers. No measured impact or live multi-agent engine is claimed.

[Editable Figma/FigJam architecture](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi) · [Editable diagrams.net source](diagrams/TACE-Architecture.drawio).


## Current handoff — G02.02 accepted, G02.03 research opened (2026-11-10)

The owner approved the **hardened G02.02 v0.2 design**, recorded in [ADR-0006](docs/decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md). The [197 passing predecessor contract tests](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42882371606) verify **only** G02.01/G02.02 deterministic structural behavior. **G02.03 Prompt Architecture is now IN_RESEARCH**, with a [new trust-boundary dossier](docs/gates/GATE-02-03-PROMPT-ARCHITECTURE-RESEARCH.md), [proposed ADR-0007](docs/decisions/ADR-0007-g02-03-prompt-trust-architecture.md) and [issue #6](https://github.com/LethaboMH14/T.A.C.E/issues/6). G02.04–G02.15 remain blocked pending their own approvals. No production model, authorized tools, external actions or semantic evaluation is claimed.
