# ADR-0007 — G02.03 provider-neutral prompt assembly and trust boundaries

**Date:** 2026-11-10  
**Status:** PROPOSED — G02.03 DETERMINISTIC PROTOTYPE TESTED, DESIGN REVIEW PENDING; NOT ACCEPTED  
**Scope:** G02.03 only. No production model, live tool invocation, semantic accuracy or policy approval.  
**Predecessor:** [ADR-0006 — G02.02 hardened v0.2 DESIGN_ACCEPTED](ADR-0006-g02-02-goal-proposal-and-candidate-dag.md)  
**Dossier:** [G02.03 prompt architecture research](../gates/GATE-02-03-PROMPT-ARCHITECTURE-RESEARCH.md)

## Context

The accepted G02.01 intake boundary produces an allowlisted interpreter view. The accepted G02.02 contract validates a domain-neutral, untrusted candidate goal proposal. A provider-neutral prompt assembly layer must connect them without allowing model-generated text, retrieved sources, skill instructions or memory to change server-enforced roles, policy, permissions or schema.

The project requires a universal engine with education as a synthetic reference demonstration, not a fixed education-only prompt. Real authenticated user identity, source authorization, effect classification and external action approval remain outside G02.03.

## Alternatives

1. **Single concatenated prompt** — simple but obscures source trust and message role boundaries. Reject.
2. **Provider-specific system prompt and function-calling API** — possible later, but no provider/model is selected. Defer.
3. **Versioned, provider-neutral deterministic assembly contract** with server-owned role construction, G02.01 projection, bounded source data, G02.02 strict output schema, and non-sensitive audit metadata. **Recommend for research.**
4. **Auto-load skill/memory files as high-priority instructions** — rejects authority separation and risks cross-tenant data leakage. Reject.
5. **Deterministic grammar-only interpretation** — preserve as evaluation baseline/fallback, not assume it handles all user goals.

## Proposed decision (not accepted)

- Construct ordered system/developer/user/context roles **only from server-owned code**, never from strings in goals, sources, `AGENTS.md`, `RULES.md`, `SKILL.md` or `MEMORY.md`.
- Bind reviewed template ID/version/digest and exact `g02-goal-proposal-v0.2` schema version. Reject mismatches.
- Feed only the allowlisted G02.01 interpreter view; never include raw intake audit text, actor/tenant IDs, connector handles, auth tokens, approvals or private memory.
- Future G03 source excerpts must be independently authorized and labelled as untrusted data with provenance, scope and bounded context; G02.03 does not grant read permissions.
- Enforce request/context/output byte limits, provider-specific token budgets when chosen, cancellation, typed errors and no silent truncation of critical constraints.
- Treat model output as **non-authoritative** and run the existing G02.02 deterministic validator; G02.04/G07 decide clarification and policy respectively.
- No chain-of-thought extraction or logging, no prompt text in telemetry by default, no hidden tool calls and no "verification succeeded" claims.
- Use adversarial negative cases and held-out semantic evaluations before recommending approval; do not claim injection-proof prompting.

## Evidence status

- **Verified predecessor:** [G02.02 v0.2 CI run 42882371606](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42882371606): 197/197 combined structural tests at commit `315357c2a9583bee84a480489e98ce2dfaf773e5`. **This is not evidence that G02.03 works.**
- **G02.03:** 34 role-boundary tests verified as part of 231 combined deterministic tests; not model-semantic or integration evidence.
- **Completed in prototype:** typed assembler, 34 isolated unit tests and CI. **Pending:** Figma sync of new code status, provider/model comparison, actual live-model semantics, security and operational evaluation.

## Exit and approval

G02.03 requires a reviewed typed prompt assembly contract, fail-closed threat-driven prototype, unit and negative tests, simple/complex domain-neutral examples, downstream handoff and explicit owner approval. Until then, **ADR-0007 is PROPOSED and G02.04 remains BLOCKED**. This decision does not select a model/provider or authorize production deployment.


## Prototype implementation and critical-review amendment — 2026-11-11

**Verified code:** [provider-neutral prompt assembler](../../tools/gate02/prompt-assembly.mjs), [34 unit tests](../../tools/gate02/prompt-assembly.test.mjs) and [GitHub Actions run 42930397995](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42930397995). **231/231 total combined tests** = 54 G02.01 + 143 G02.02 + 34 new G02.03, 0 failures, 0 skipped.

**Technical decision proposed for review:** Keep server-owned static roles and schema-bound model-output expectations; only input projected G02.01 goal/hints and slot descriptors; reject any G03 context content pending authorization; bound serialized messages by bytes; expose no raw source handles/actor/tenant IDs from internal fields; do not call model or tools in this layer. The `g02-prompt-assembly-v0.1` envelope is a research protocol, not a deployed API.

**Review warnings:** role separation is *structural* only, no guarantee against semantic prompt injection; interpretation text can still contain sensitive data; schema digest is not externally signed or independently pinned; no model-provider token/cost/timeout budget, semantic evaluation, authenticated gateway or safe source ingestion has been verified. G02.03 cannot be called security-complete or production-ready.

**Owner action still needed:** review the accepted/rejected alternatives and remaining gaps; explicit G02.03 **design-only** signoff before G02.04 implementation. The AG-UI/OpenDots lane [Issue #7](https://github.com/LethaboMH14/T.A.C.E/issues/7) runs separately under evaluation authorization, not production dependency approval.
s=>s+"\n\n## Draft PR #8 critical review evidence — 2026-11-13\n\n[Critical review dossier](../reviews/G02-03-PROMPT-AND-AGUI-CRITICAL-REVIEW-20261113.md) describes changes on the **review branch**, not merged main. Hardened G02.03 assembler validates full intake shape, Unicode/flags and duplicate sources, and avoids implying a caller-supplied fixture is already authenticated. **Verified [G02.03 CI run 43126625179](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625179): 241 passed** (54 G02.01 + 143 G02.02 + **44 G02.03**), zero failed/skipped. AG-UI evaluation [run 43126625949](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625949): 48 passing state tests and independent pinned AG-UI 1.0 schema envelope verification (3 valid, 4 invalid). Editable [Figma three-question wizard page 08](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=35-2).\n\n**ADR-0007 remains PROPOSED.** Missing live-model semantic adversarial checks, real authenticated turn ledger, signed release manifest, external capability/approval enforcement, independent data privacy review and runtime model/provider cost/time guards remain intentionally unapproved. This is a design-only review checkpoint, not deployment or G02.04 approval.\n"