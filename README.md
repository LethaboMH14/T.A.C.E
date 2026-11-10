# T.A.C.E — Universal Goal-to-Execution Engine

**Status:** Architecture baseline v0.2 (research/design only; no working universal engine)
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

The core can accept any natural-language goal for **capability assessment**. It executes only supported, authorized tasks; missing models, tools, approvals or sources result in a clear blocker or partial deliverable rather than false claims. Simple goals need not spawn a swarm. More involved goals can create dynamic typed graphs and use appropriate agents, tools and outputs. **Gate 01 remains IN RESEARCH; Gate 02 remains BLOCKED.**
