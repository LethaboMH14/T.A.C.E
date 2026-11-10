# ADR-0004 — Gate 01 requirements baseline complete; Gate 02 research may start

**Date:** 2026-11-10
**Decision:** ACCEPTED as **scoped design/requirements signoff**, NOT as runtime acceptance
**Authority:** User directive: “lets document impact and test pending and then is there security that needs to be thought of and implemented and then any edge cases then full gate01 then we can move on to gate 2”
**Predecessors:** ADR-0002 universal engine; ADR-0003 approved problem wording.
**Gate status:** G01 **DESIGN_COMPLETE / CLOSED_FOR_G02**; G02 **IN_RESEARCH**. G03–G12 remain blocked until their dependencies are reviewed.

## Accepted decisions

1. T.A.C.E is a **domain-neutral, API-first, goal-to-verified-outcome system**. EdTech is a competition proof, not a mandatory input classifier or a single-purpose product.
2. The approved formal/simple problem wording is frozen under ADR-0003. The fourth evidence strand is fragmented/interoperability-limited education systems; downstream harm is labelled plausible risk, not measured causation.
3. Representative actor: adult teacher, mentor or coordinator; no real student records for the judged demo.
4. The **Education Recovery Mission** is the **reference integration fixture** (synthetic 36 trainees / 3 mentors, constraints, learning-gap support, bilingual draft, documents and scheduling), contrasted with minimal syllabus-to-table extraction. This does **not** make an educational prompt hardcoded and the user may change the demo later.
5. Goal boundary must express raw goal, server-stamped actor, source/connector refs, constraints, output contract, missing facts, permissions/effect class, success checks and terminal status.
6. Sources may be uploaded, publicly retrieved or authenticated through a connected app. **Arbitrary requested formats are not equivalent to arbitrary executed formats.** No implicit app connections, no fabricated records or sends.
7. **Deny by default** on private data, plugins, external side effects, unknown tools and consequential academic decisions. Human approval must bind to an exact immutable action; a model cannot approve itself.
8. Independent reviewer/repair, retry limits, data provenance, cost, cancellation and read-back receipts are non-negotiable successor-gate requirements.
9. Impact, validation and security tests are explicitly **PENDING**. A design signoff does not assert time saved, improved education results, agent execution or POPIA compliance.
10. G02 is authorized to research and specify prompt/goal interpretation with its own numbered sub-gates and no invented working features.

## Design signoff checklist

- [x] Exact approved problem statements and sources: ADR-0003.
- [x] Evidence claims separated from hypotheses and downstream risks.
- [x] Representative user, goals, scope and bounded first education fixture.
- [x] Seven adaptive goal families with no-data/mixed-request cases.
- [x] Goal contract structure, result statuses and authority principles.
- [x] File/connector admission, output feasibility and read-back requirements.
- [x] Security/PII/approval threat model documented.
- [x] 48 edge-case and adversarial fixtures specified.
- [x] Impact evaluation protocol and no-unmeasured-benefits rule.
- [x] Editable architecture diagrams and downstream work orders.
- [ ] **NOT A G01 DOCUMENTATION BLOCKER:** actual runtime authorizations, adversarial integration tests, deployment, human validation and impact measurements. **RELEASE BLOCKERS in G07/G09/G11/G12.**

## Accepted technical work remains to be implemented

This ADR contains **no evidence** of live model reasoning, OAuth integration, isolated tool execution, independently validated results, real human review, actual media generation, real-world outcome improvement or production-grade security. Do not imply otherwise in demos or marketing.

## Handoff to Gate 02

Start with [G02 intent and clarification research charter](../gates/GATE-02-INTENT-AND-CLARIFICATION-RESEARCH.md).
Gate 02 must explicitly define a versioned interpreter that emits a constrained, typed **GoalContract Proposal**, a policy-safe clarification decision, verifiable output criteria, source/data needs and explicit uncertainty. It must not authorize an action based on model confidence alone.

## Reversal conditions

If requirements prove contradictory, if the selected fixture cannot be implemented safely in time, or if new legal evidence changes data handling, reopen ADR-0004 with versioned rationale rather than silently changing it.

**Design gate complete; system implementation and results are pending.**
