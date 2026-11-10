# ADR-0007 — G02.03 provider-neutral prompt assembly and trust boundaries

**Date:** 2026-11-10  
**Status:** PROPOSED — G02.03 IN_RESEARCH, OWNER APPROVAL NOT REQUESTED YET  
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
- **G02.03:** initial research specification and threat/negative-test plan only. **0 G02.03 implementation tests executed.**
- **Pending:** typed assembler, independent test fixtures, Figma architecture review, provider and model comparison, security and semantic evaluation.

## Exit and approval

G02.03 requires a reviewed typed prompt assembly contract, fail-closed threat-driven prototype, unit and negative tests, simple/complex domain-neutral examples, downstream handoff and explicit owner approval. Until then, **ADR-0007 is PROPOSED and G02.04 remains BLOCKED**. This decision does not select a model/provider or authorize production deployment.
