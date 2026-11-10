# T.A.C.E — Universal Goal-to-Execution Engine

**Status:** Gate 01 design requirements complete; Gate 02 in research; no working universal multi-agent engine
**Last reviewed:** 2026-11-10
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
