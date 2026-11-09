# ADR-0001 — Architectural foundation and review discipline

**Date:** 2026-11-10
**Status:** ACCEPTED — architectural principles only.
**Scope:** T.A.C.E architecture project and review workflow.
**Not approved by this ADR:** final product name/acronym, flagship use case, exact framework, runtime hosting provider or model.

## Context

The Colleague Zero brief rewards reasoning, self-correction, finished execution, collaboration and a specific educational value. Prior BobSwarm work proved specialist decomposition and observable evidence-driven runs, but used a human Bob handoff and focused on engineering reports. The new project needs an outcome-based runtime and durable documented decisions.

## Decision

Adopt a seven-part foundation:
1. adaptive intent/prompt engineering ending in a machine-validated GoalContract;
2. context engineering with bounded role-specific packs, provenance and scoped retrieval;
3. capability-driven swarm engineering with structured messages and minimum useful specialists;
4. graph engineering as the governing control plane with typed state, checkpoints and bounded repair;
5. permissioned tool execution with idempotent receipts and outcome verification;
6. scoped memory with explicit evidence and safe promotion rules;
7. independent evaluation, safety and a visible user-facing mission experience.

Design the complete topology first, then review one subsystem at a time. Approve changes only after schemas, integrations, alternatives, risks and tests are addressed. Register every later locked choice in a new ADR.

## Alternatives considered

- **Single monolithic assistant:** easier demo, weaker decomposition, more fragile correctness.
- **Permanent large swarm:** expensive, difficult to observe, introduces unnecessary coordination.
- **Natural-language agent-to-agent chat only:** simple but hard to audit and resume.
- **Autonomous agent without explicit graph/policy:** high risk of loops, duplicate effects and permission drift.
- **General-purpose agent framework as public pitch:** weak education specificity.

## Consequences

- A frontloaded investment in schemas, tests and provenance.
- Minimal specialist roster per run, not all roles always active.
- Real completion is derived from persisted artifact/tool checks, not agent narrative.
- Architecture docs do not imply implementation.
- Each open technical choice is explicitly tracked; new evidence can supersede this ADR.

## Verification

Documentation review and contract/schema acceptance are required before code implementation. No implementation test has been run under this ADR yet.