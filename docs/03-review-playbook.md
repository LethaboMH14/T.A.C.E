# 03 — Architecture design and review playbook

**Purpose:** Every subsystem gets a complete engineering review before we call it designed.

## Status vocabulary

- **LOCKED:** approved architectural principle/contract; may be changed only by a new ADR.
- **PROPOSED:** recommendation awaiting validation and selection.
- **OPEN:** genuine competing options or missing information.
- **REJECTED:** declined with documented reason.
- **IMPLEMENTED:** present in T.A.C.E code and exercised by an actual test.
- **VERIFIED:** implementation checked against acceptance criteria, with evidence.

**LOCKED is not IMPLEMENTED.** Reference diagrams and schemas do not imply running code.

## Review sequence (one section at a time)

| # | Section | Review question | Exit evidence |
| --- | --- | --- | --- |
| 01 | Product and goal boundary | What job does the colleague own, for whom, and what does success look like? | example user journeys + accepted outcomes |
| 02 | Intent / prompt engineering | How is ambiguity measured and clarified without excessive Q&A? | GoalContract schema, risk/ambiguity tests |
| 03 | Context compiler and RAG | What does each agent know, trust and retrieve? | retrieval tests, context bundle spec, trust policy |
| 04 | Planner and capability registry | How are minimal agents and an acyclic task graph chosen? | task planner examples and DAG validator |
| 05 | Graph runtime and execution state | What transitions, checkpoints, budgets and failures are legal? | graph transition tests, replay/cancel tests |
| 06 | Specialist swarm and messages | How do specialists work in parallel and hand off evidence? | typed handoff + concurrency proof |
| 07 | Tool execution and MCP | What actions are allowed; how do we prove an outcome? | sandbox/permissions/idempotency tests |
| 08 | Memory and knowledge governance | What is saved, for how long and under whose scope? | memory policy and retrieval/correction tests |
| 09 | Verification and self-repair | Which checks catch real errors and how are they repaired? | injected-error test with actual repair trace |
| 10 | Interface / live experience | Can the user see, steer, approve and audit the job? | real UI backed by authoritative events |
| 11 | Evaluation, privacy and operations | Does it work safely and repeatedly with measurable results? | fixture test suite, error handling, demo runbook |
| 12 | Full end-to-end integration | Does one learner-success workflow deliver verified artifacts? | recorded test trace, persisted outputs, README |

**Immediate review: #01 then #02.** Do not skip the product/job boundary just because the architecture is interesting.

## Repeatable review template per subsystem

1. **Purpose:** one-sentence responsibility and the user problem.
2. **Inputs/outputs:** typed schemas, sources, data classes, failure outputs.
3. **Method:** algorithm, role of LLM vs deterministic code, decision thresholds and assumptions.
4. **Candidate tools:** 2–3 real choices, license/maintenance/limits, why each fits or fails.
5. **Boundaries:** what it may read/write, tool permissions, privacy and threat model.
6. **Graph interactions:** predecessor nodes, dependencies, events, retry edges, downstream consumers.
7. **Fallbacks:** unavailable model, bad source, timeout, empty response, contradictory evidence.
8. **Tests:** normal path, ambiguity, malicious input, tool failure, recovery, acceptance metric.
9. **Decision:** LOCKED/PROPOSED/OPEN/REJECTED, ADR and specific rationale.
10. **Change impact:** which previous docs and interfaces must be adjusted.

## Required gate

Before moving to the next subsystem, ensure:
- purpose and boundaries are unambiguous;
- sample inputs and outputs validate;
- failure, safety and correction paths exist;
- downstream interfaces and responsibilities are documented;
- alternatives and trade-offs have been evaluated;
- at least one test asserts behavior, not just prompt wording;
- decision is registered with approver and date.

## Persistent design workflow

- Main architecture stays in docs/01-reference-architecture.md and docs/02-contracts-and-protocols.md.
- All decisions live in docs/decisions/; never silently overwrite a locked choice.
- Open questions are tracked in the decision register and an issue.
- Implementation must link to a decision, test and acceptance criterion.
- When later evidence contradicts earlier design, create a superseding ADR rather than hiding the change.
- Keep review history in Git commits and PR discussions.
- No periodic or autonomous worker is assumed: work occurs only when explicitly executed.

## Definition of done

A component is designed when it has a signed-off responsibility, schema, error model, integration edges, risk controls and tests on paper. It is implemented when working code exists. It is verified only when those tests have actually run and results are recorded.