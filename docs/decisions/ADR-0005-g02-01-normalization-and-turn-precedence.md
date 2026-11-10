# ADR-0005 — G02.01 raw preservation, NFC interpretation and revisioned user turns

**Date:** 2026-11-10
**Status:** PROPOSED — USER REVIEW PENDING, NOT ACCEPTED
**Scope:** G02.01 input normalization and turn lineage only.
**Dossier:** [G02.01](../gates/GATE-02-01-INPUT-NORMALIZATION.md).

## Context

Universal goals include math, multilingual input, corrections and optional sources. We must preserve user evidence, avoid inventing facts, and prevent documents/agents from granting themselves user authority. G01 requires authenticated actors, source permissions and no fake external actions.

## Alternatives

1. Store only cleaned text: rejected because raw evidence and important symbols may be lost.
2. NFKC for all natural-language text: rejected because compatibility transformations can alter meaning.
3. Paste chat history into an LLM and rely on its notion of the latest turn: rejected as sole source of truth due to missing authenticated lineage.
4. Preserve raw + derived NFC text, server-versioned turns, opaque source references: **RECOMMENDED**.

## Recommended design

- Real server middleware issues actor, tenant, turn ID, parent and revision; never accept these from client text or model output.
- Preserve exact raw goal in protected storage; derive NFC interpretation text with LF line endings. No global NFKC, auto-translation, spell correction or guessed time zone.
- BCP 47 locale is a **hint**, not evidence of spoken language, access rights or fluency.
- Attachments remain opaque references marked UNVERIFIED_REFERENCE until admitted by G03/G07.
- A new authenticated user turn requires semantic reinterpretation, and prior approvals/dependent plans must be invalidated or rechecked.
- Stale revisions, cross-tenant edits and client-supplied role/approval fields fail closed.
- G02.01 has no tool execution, long-term memory write or production authentication.

## Risks and tradeoffs

Positive: auditable raw evidence, canonical comparison, stable provenance, low vendor dependence. Costs: two text copies to protect, event ledger, conservative approval invalidation and clarification for unresolved time/language. Bidi controls are flagged, not blindly stripped. No POPIA or production-security claim.

## Verification

Limited prototype under [tools/gate02](../../tools/gate02/), deterministic unit tests and CI. This does not test LLM interpretation, actual auth, file safety or integration. See the G02.01 dossier and pending G07/G11 work.

**Approval required before marking ACCEPTED and beginning G02.02.**


## Critical review amendment — v0.2, 2026-11-10

**Status: HARDENED PROPOSAL — OWNER APPROVAL PENDING.**

The original design omitted stable goal-scoped revision identity, had permissive source handles, accepted some explicit nulls as absent, lost client budget hints and lacked a restricted interpreter projection. These were defects in a research prototype, not in a deployed production service.

**Amended technical recommendation:** require server goalId, actor, tenant, turnId, parent and revision; preserve raw decoded goal internally and derive NFC+LF interpretation; validate UTF-8 size, surrogate pairs and controls; accept only unique opaque source handles; preserve a user cost cap as a hint; pass only an allowlisted projection to the model (no rawGoal, actor/tenant/goal/turn IDs or source handles). Every new authenticated turn must recheck prior plans and approvals. The interpretation text may itself contain personal data; no anonymization claim.

**Verified test evidence:** https://github.com/LethaboMH14/T.A.C.E/actions/runs/42867607839 — GitHub Actions success, 54/54 deterministic tests at commit 4c41e29ba4862b23a8e2443b42052b4208626ca4.

**Unresolved P0:** real server authentication, atomic event-ledger replay and concurrency protection, source ownership, authorization, privacy-safe storage and audit. **Not yet approved.**
