# T.A.C.E — Education Digital Colleague

**Status:** Architecture baseline v0.1 (design, not an implemented application)
**Last reviewed:** 2026-11-10
**Repository purpose:** Durable source of truth for the Colleague Zero project: product definition, agent architecture, design decisions, research, interfaces, tests and development.

> T.A.C.E is the repository name. Its expanded acronym and the public-facing product name are **not yet approved**. SONAR is a working lineage label from BobSwarm, not a confirmed rename.

## North star

Build an **outcome-owning educational digital colleague**, not a generic chatbot or a decorative agent swarm. It takes an educational goal, asks for clarification only when necessary, creates an executable goal contract, retrieves trustworthy context, assembles specialist agents as needed, executes a dependency-aware workflow, checks and repairs its work, produces real artifacts and records verified outcomes.

**Provisional flagship workflow:** learner-success intervention (synthetic assessment/attendance/curriculum inputs → evidence-backed catch-up plans → review and correction → teacher-approved communication drafts and follow-ups). This workflow is proposed, not yet approved as the sole use case.

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