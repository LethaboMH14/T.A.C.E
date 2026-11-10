# ADR-0002 — General-purpose goal-to-execution engine with an EdTech judging deployment

**Date:** 2026-11-10
**Status:** ACCEPTED architecture principle, NOT a Gate 01 sign-off.
**Supersedes:** The education-only interpretation of ADR-0001; retains its prompt/context/swarm/graph, execution, memory and evaluation principles.

## Context

The user clarified that the product is not a fixed learner-support assistant. Any reasonable domain/task may be expressed as a natural-language goal, and the system should select its own needed skills, capabilities, tools, models, number of agents, dependency graph, artifact formats, verification criteria and approval gates. The Colleague Zero competition separately requires that the **demonstrated application** solve a specific educational problem.

## Decision

- **Core = domain-agnostic, API-first engine**; Education = first domain pack and judged demonstration.
- Accept arbitrarily phrased goals, but distinguish accepted intent from **supported, authorized and verified execution**. Do not promise capabilities not connected and tested.
- Graph size and agent roster must be proportional to the task: single worker or deterministic operation for simple requests; dynamic scoped swarm for meaningful independent/dependent subwork.
- Output is task-dependent: structured data, documents, visual diagrams, code, media or authorized external actions **only through available tools** with receipts.
- Skills may be drafted or discovered, but not silently installed or executed without provenance review, tests, sandbox and permissions. No untrusted self-modifying executable skills or credential creation.
- Human intervention is governed by permissions, reversibility and consequences, not model preference. Unknown authority fails closed.
- Dashboard should display authentic agent-to-agent messages and workflow states, a validated editable graph canvas, and persisted outcomes.
- At competition, demonstrate a **complete education-specific workflow** involving real multi-agent collaboration and correction, ideally alongside a smaller education task showing agent-count discretion.
- The chosen education flagship, model stack, goal schema algorithms and deployment remain proposals until their respective gates.

## Tradeoffs

A dedicated education app is easier but needlessly narrows the engine. Promising any task can always be done is unrealistic. Spawning a fixed swarm is wasteful. Fine-tuning models for each goal is unnecessary without evidence that retrieval, tool-use and prompt/context improvements fail.

## Consequences

Revise G01, diagrams, product documentation and decision register. Preserve the earlier education research as a specialized reference. G02 remains blocked until G01 gets its own documented approval.

## Evidence

Official rubric: https://hackathon-26.melsoft.org/
React Flow: https://reactflow.dev/
Graph execution: https://langchain-ai.github.io/langgraph/how-tos/multi-agent-network/
