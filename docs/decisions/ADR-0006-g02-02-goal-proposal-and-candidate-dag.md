# ADR-0006 — G02.02 versioned goal proposal and candidate outcome DAG

**Date:** 2026-11-10
**Status:** PROPOSED — USER REVIEW PENDING; NOT ACCEPTED
**Scope:** G02.02 only. No model, execution engine or production permission decision.
**Dossier:** [G02.02](../gates/GATE-02-02-GOAL-SCHEMA-AND-DECOMPOSITION.md).
**Predecessor:** [ADR-0005](ADR-0005-g02-01-normalization-and-turn-precedence.md) — G02.01 design ACCEPTED.

## Problem

G02.01 preserves trustworthy turn lineage and a limited interpreter view but does not represent the user's outcome. We need a domain-neutral, typed candidate GoalContract Proposal with bounded decomposition, explicit uncertainty, checkable outcomes and no authority inflation.

## Alternatives considered

1. Free-form model prose or permissive JSON: rejected as difficult to validate, diff and test.
2. An executable planner DAG generated at intake: deferred to G04/G05; a candidate outcome DAG can express dependencies without promising capability.
3. A flat goal only: simpler but loses mixed-domain deliverable dependencies.
4. Provider-specific function-call schema: defer until model/provider evidence is available.
5. Strict versioned JSON Schema + dependency-free deterministic validator + bounded **candidate** outcome DAG: **recommended**.

## Proposed decision

- Versioned `g02-goal-proposal-v0.1` contract with intent modes, deliverables, candidate subgoals, source slots, capability needs, effect claims, acceptance criteria, uncertainties and claimed correction relation.
- Server binds the validated result to G02.01 `goalId`, `turnId`, `revision`; the model cannot provide actor, tenant, source handles, approvals or receipts.
- Limit 8 deliverables, 12 candidate subgoals, 24 source slots, 12 capability needs, 8 effect claims, 16 acceptance criteria and 12 uncertainties. Require acyclic dependencies, existing references, and at least one check per deliverable.
- Strict unknown-field and malformed Unicode rejection, no arbitrary JSON parsing/repair in this subsection; validated output copied and frozen.
- `PROPOSAL_VALID` means **structural proposal valid only**. Blocking uncertainty/unknown effect → NEEDS_CLARIFICATION. Shared write/send claim → POLICY_REVIEW_REQUIRED. Destructive effect claim → REJECTED_PROPOSAL. **No result grants execution.**
- For new turns, compare trusted lineage, invalidate/recheck approvals and dependent plans; model's CORRECTION/REFINEMENT label is only advisory.
- Keep model, prompting, capability matching, actual policy, graph execution, semantic accuracy and memory choices open for subsequent gates.

## Risks and trade-offs

The proposal may be structurally valid but factually wrong, omit a dangerous action, or falsely claim an effect is read-only. Only G07 can enforce actual action policy from the selected tool. The source-slot approach reduces direct handle leakage but does not authorize access. Frozen copies reduce in-process mutation but do not prevent replay or transport tampering. A hand-maintained validator may drift from JSON Schema; tests should detect known drift, and production should adopt a full schema validator if needed. The candidate DAG is not an executable plan.

## Evidence and status

**Verified evidence:** [GitHub Actions run 42870978038](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42870978038) completed successfully at commit `11cdbe7e34f1c3a412fcffd602edd7f350cbb79f`: 142 pass, 0 fail, 0 skipped (88 G02.02 + 54 G02.01). [Editable Figma page 05](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2) synchronized. These are structural unit tests, not real-world interpretation, authorization or execution tests. **Owner approval required before marking G02.02 DESIGN_ACCEPTED or starting G02.03.** G02.01 acceptance does not approve this ADR.
