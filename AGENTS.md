# T.A.C.E — repository-wide agent engineering conventions

This document provides **project-level coding conventions and safety constraints** for coding assistants. It is not a runtime agent skill, tool permission, system-policy override, or authorization to deploy/merge. See [CLAUDE.md](CLAUDE.md) for full handover and [docs/handover/START-HERE.md](docs/handover/START-HERE.md) for live-state pointers.

## Scope and decisions
- Universal outcome-owning engine; first scoped synthetic EdTech proof. KAIRO is excluded. Do not rename T.A.C.E or infer that the acronym expansion is approved.
- Main G01, G02.01 and G02.02 **design** decisions are accepted; G02.03 ADR-0007 is proposed; G02.04 onward lacks design acceptance. PR #8 holds additional unmerged prototype changes.
- Preserve the gate-based design review flow; do not advance, merge or label accepted based only on one passing test suite.

## Engineering discipline
- Read the current file, README, relevant ADR and tests before editing it. Avoid duplicate implementations or overwriting concurrent branch work.
- Keep schemas versioned and validate unknown properties; treat user/model/source/AG-UI data as untrusted.
- Make each task small and independently testable; add negative cases for malformed data, tenancy, identity, revisions, failed or duplicate effects, stale approvals and prompt injection.
- Use domain-neutral modules; put EdTech logic into fixture/domain adapters, not the core interpreter/orchestrator.
- Record tests and commits truthfully. CI success only proves the assertions covered, not live-model accuracy or completed integration.
- Use pinned, licensed, reviewed dependencies. Avoid a large framework installation merely to decorate the project. Never commit credentials or private learner data.
- Distinguish `PROPOSED`, `DESIGN_ACCEPTED`, `IMPLEMENTED`, `UNIT_VERIFIED`, `INTEGRATION_VERIFIED`, `PRODUCTION_VERIFIED`; never use `complete` for a draft/report without evidence.
- The authoritative record of execution is the **server event/receipt ledger**, not model narration, chat content or UI state.
- External effects require independently classified tool/action risk, live principal/tenant authorization, idempotency and exact expiry-bound human approval when consequential; model and MCP descriptors have no authority.
- Preserve auditability without logging secret/raw private prompts by default. Require real delete/retention policy before handling sensitive data.
- On any correction, recompute the current goal's revision and invalidate/recheck stale plans/approvals.
- Keep the UI accessible, responsive and usable; graphs, badges and animations represent *real* states. Figma designs are references, not proof of working features.

## Review handoff template for each PR
1. What changed and why; specific gate/ADR/issue.
2. Implementation status and what remains not implemented.
3. Exact files, commands and CI run URLs, including known failures.
4. Positive, negative, revision/concurrency/security tests.
5. Real external calls, costs and permissions (or explicitly **none**).
6. UI, Figma, docs and schema synchronization.
7. Unresolved P0/P1 risks, safe fallback, rollback.
8. Whether this PR is draft/review-only or authorized to merge.

## Safe first work
Start with [docs/handover/CLAUDE-IMPLEMENTATION-BRIEF.md](docs/handover/CLAUDE-IMPLEMENTATION-BRIEF.md) and [docs/architecture/EXECUTION-BACKLOG-AND-ACCEPTANCE-TESTS.md](docs/architecture/EXECUTION-BACKLOG-AND-ACCEPTANCE-TESTS.md). If a request conflicts with an accepted decision, ask for explicit supersession instead of silently deviating.
