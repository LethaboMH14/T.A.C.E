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
