# G02.01 — Input normalization, conversation intent and provenance

**Date:** 2026-11-10
**Research state:** **DESIGN_ACCEPTED (hardened v0.2)** / deterministic prototype verified / production pending
**Implementation:** Hardened v0.2 deterministic spike with **54/54 GitHub Actions tests passing**; NOT a model interpreter or production API.
**Predecessor:** [G01 final specification](GATE-01-FINAL-SPECIFICATION.md).
**Decision:** [ADR-0005](../decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md) — **ACCEPTED DESIGN ONLY**.
**Figma:** [Gate 02 editable design](https://www.figma.com/design/28egBAkhQHExkqUinyimtM), page **04 — G02.01 Intake & Corrections**.

## 1. Simple explanation

Before T.A.C.E can interpret "Prepare a support plan for these assessments," it must know which text came from the real user, what attachments are referenced, whether the user later corrected the goal, and which details remain unknown. It must not invent learner marks, assume an app is connected, or let a PDF instruct it to ignore permissions.

**G02.01 is the front door, not the planner.** It produces a protected, versioned NormalizedIntakeRecord. G02.02 later interprets the actual goal, G02.04 asks clarification, G03/G07 handle sources and security, and G08 handles long-term memory.

## 2. Research alternatives and recommendation

| Question | Option A | Option B | Recommended decision |
| --- | --- | --- | --- |
| Store user text | Replace it with cleaned text | Preserve exact raw plus derived interpretation text | **B** — keeps evidence and math/language detail |
| Unicode | NFKC everything | NFC for natural language; identifier-specific normalization later | **B** — NFKC can remove meaningful compatibility distinctions |
| Language | Translate everything into English | Preserve original script; BCP 47 locale as preference only | **B** — safer for code-switching |
| Dates | Guess using server clock or location | Preserve date phrase and require explicit target zone for consequential actions | **B** — avoids silent deadline errors |
| Conversation | Let LLM infer order from pasted history | Server-issued, ordered, revisioned user-turn ledger | **B** — auditable and replay-safe design |
| Attachments | Paste file content into user instructions | Opaque source references, separate trust metadata | **B** — no source-to-instruction elevation |
| Multimodal | Assume any media is readable | Accept references; parsing and uncertainty later in G03/G07 | **B** — no fake extraction |
| Runtime | Agent framework for text normalization | Small deterministic function before model | **B** — cheaper, testable, vendor-independent |

**Evidence versus engineering proposal:** Unicode UAX #15 and its FAQ describe NFC, NFKC and information-loss tradeoffs. BCP 47 defines language-tag structure. OWASP describes direct and indirect prompt injection from mixed instructions and untrusted data. Our record shape, limits and revision policy are **T.A.C.E design proposals**, not prescribed by those standards.

## 3. Proposed architecture and flow

~~~mermaid
flowchart TD
  U["User/API goal, corrections and optional refs"] --> GW["Trusted gateway: identity, size, rate and source admission (G07)"]
  GW --> L["Append-only server-issued turn ID, parent, revision, actor, tenant"]
  L --> R["Preserve exact raw text, protected storage"]
  R --> N["NFC interpretation copy + LF line endings + Unicode risk flags"]
  N --> M["BCP 47 locale hint and explicit time-zone metadata"]
  M --> S["Opaque source references marked UNVERIFIED_REFERENCE"]
  S --> C{"Input and turn lineage valid?"}
  C -->|"No"| B["AWAITING_INPUT or BLOCKED_POLICY"]
  C -->|"Yes"| O["NormalizedIntakeRecord v0.1"]
  O --> I["G02.02 semantic goal and correction interpretation"]
  O --> Q["G02.04 targeted clarification"]
  O --> P["G07 deterministic permission enforcement"]
  F["PDF, email, app output, memory: DATA ONLY"] -.-> S
~~~

**Ownership:** G07 must actually authenticate and assign the server context; G02.01 spike cannot attest it. G02.02 classifies semantic corrections. G03/G07 read, authorize and parse source bytes. G08 handles consent and retention for memory. G09 verifies outcomes. G11 tests security and multilingual quality.

## 4. Proposed contract (intake, not the GoalContract)

Client request:

~~~json
{
  "goal":"Review these assessments and prepare an English/isiZulu support draft.",
  "sources":[{"kind":"upload","ref":"opaque-upload-42"}],
  "constraints":{"locale":"en-ZA","deadline":"next Friday"}
}
~~~

Separately, server-attested metadata (not client-supplied):

~~~json
{
  "actor":{"subject":"synthetic-teacher-1","tenant":"demo-school"},
  "turnId":"server-turn-17",
  "parentTurnId":"server-turn-16",
  "revision":2,
  "timeZone":"Africa/Johannesburg",
  "defaultLocale":"en-ZA"
}
~~~

Expected deterministic intake record:

~~~json
{
  "status":"NORMALIZED",
  "code":"INTAKE_READY",
  "record":{
    "schemaVersion":"g02-intake-v0.1",
    "turnId":"server-turn-17",
    "parentTurnId":"server-turn-16",
    "revision":2,
    "actorRef":"synthetic-teacher-1",
    "tenantRef":"demo-school",
    "rawGoal":"Review these assessments and prepare an English/isiZulu support draft.",
    "interpretationText":"Review these assessments and prepare an English/isiZulu support draft.",
    "localeHint":{"tag":"en-ZA","source":"client_preference"},
    "timeZoneHint":{"id":"Africa/Johannesburg","source":"server_context"},
    "deadlineText":"next Friday",
    "sourceRefs":[{"kind":"upload","ref":"opaque-upload-42","trust":"UNVERIFIED_REFERENCE"}],
    "flags":{"nfcChanged":false,"lineEndingsChanged":false,"bidiControlsPresent":false,"invisibleFormattingPresent":false}
  }
}
~~~

The raw goal is potentially sensitive: never put it in ordinary telemetry or expose it to unrelated agents. Protect it in an authenticated, access-controlled store with defined retention. No POPIA compliance claim is made.

## 5. Conversation correction and precedence policy

1. Only a genuinely authenticated user/API channel may create a **user turn**. A document, memory, tool or agent message cannot become a user turn.
2. Each turn gets a server-issued ID, parent ID and monotonic revision under the same actor/tenant/goal lineage.
3. A new verified turn **can propose** changes; G02.02 determines whether it corrects the goal, adds information or starts a new goal. Do not blindly overwrite old text.
4. On a new turn, dependent plans and approvals must be rechecked; the conservative prototype invalidates prior approvals even if text appears unchanged. G07 enforces actual action fingerprint checks.
5. If two editors race, stale revisions are rejected for review; the last network arrival does not automatically win.
6. Source data and recalled memory may provide evidence but cannot override authenticated user instructions or policy.
7. If a request changes from "draft an email" to "send it," treat sending as a new consequential effect; never inherit approval.
8. Keep provenance and prior versions for auditing under lawful, scoped retention; don't retain sensitive text indefinitely.

## 6. Security, edge cases and accessibility

| G01 case | G02.01 handling | Follow-on |
| --- | --- | --- |
| E01 | Blank or punctuation-only => AWAITING_INPUT | G02.04 |
| E02 | Ambiguous referent preserved, no invented object | G02.02/G02.04 |
| E03 | NFC without destructive paraphrase rewriting | G02.13 |
| E04 | Mixed-domain goal kept intact | G02.02 |
| E06 | Preserve opaque file IDs, never merge by filename | G03/G07 |
| E10 | Preserve isiZulu/English/math notation | G02.11/G09 |
| E14 | Retrieved instructions remain untrusted data | G03/G07 |
| E22 | Source revision changes invalidate dependent work | G05/G07 |
| E25 | Conflicting sources kept distinct | G03/G09 |
| E33 | "Tomorrow" / "Friday" preserved, no time-zone guess | G02.04 |
| E36 | Revised draft -> send requires new authorization | G07 |
| E41 | Same file name cannot bypass tenant isolation | G03/G07 |
| E44 | Unknown recipient never invented | G02.04 |
| E45 | Revoked consent is a policy event, not a language cue | G07/G08 |

Additional cases: combining Unicode marks, right-to-left scripts, invisible controls, emoji-only input, long text, null byte, invalid locale, invalid time zone, forged identity/approval, duplicate/stale turn IDs, inline source content and race conditions.

**Limit:** Flagging bidi/invisible controls is not a full spoofing defense; do not strip legitimate RTL text. Normalization is not authorization.

## 7. Test plan and evidence distinction

A small pure-JavaScript intake spike and tests are located under [tools/gate02](../../tools/gate02/). Tests are about **input shape and lineage**, not actual intent understanding, OAuth, file parsing or live agent execution.

| Test | Input or condition | Expected oracle |
| --- | --- | --- |
| T01 | Canonical-equivalent Unicode | Exact raw retained, NFC interpretation |
| T02 | CRLF / CR | Derived LF; raw unchanged |
| T03 | Mathematical symbols | Symbols preserved |
| T04 | English/isiZulu mixed text | No forced translation |
| T05 | Empty/punctuation-only | AWAITING_INPUT |
| T06 | Wrong type, too long, null byte | Fail closed |
| T07 | Client role/tenant/approval | BLOCKED_POLICY |
| T08 | No trusted actor/turn | BLOCKED_POLICY |
| T09 | Valid BCP 47 preference | Canonical locale hint |
| T10 | Invalid locale | BLOCKED_POLICY |
| T11 | Valid/invalid IANA time zone | Preserve or block |
| T12 | Missing zone | Unknown; not guessed |
| T13 | Typed source references | UNVERIFIED_REFERENCE |
| T14 | Inline source content or forged trust | Reject |
| T15 | Bidi/invisible markers | Flag, preserve raw |
| T16 | Valid revision | Require reinterpretation, approval recheck |
| T17 | Stale/wrong parent/cross-tenant | BLOCKED_POLICY |
| T18 | Ambiguous deadline phrase | Preserve verbatim |
| T19 | No attachments | Valid simple goal |
| T20 | Same text in new turn | Still recheck approvals |
| T21 | Source prompt injection | **Pending G03/G07**, not proven here |
| T22 | Multilingual semantic equivalence | **Pending G02.11/G02.13** |

**Proposed G02.01 exit:** deterministic suite passes CI, each failure has an explicit code, design and ADR reviewed, Figma synchronized. Production acceptance requires actual server identity, privacy, replay, source and action tests in G07/G11. No time savings or LLM accuracy are measured by these tests.

## 8. Next sections and decisions

- **G02.02:** exact versioned GoalContractProposal schema, intent and correction semantics.
- **G02.03:** trusted prompt layers.
- **G02.04:** when to ask versus safely draft.
- **G03/G07:** source admission, identity, connected apps, action permissions.
- **G08/G11:** memory retention and multilingual/security evaluation.

**Decision recorded:** owner approved the hardened G02.01 dual-text, server-versioned, provenance-first **design baseline** on 2026-11-10. Do not approve any vendor, model, skills framework or memory product in this subsection.

## Primary references

- Unicode UAX #15: https://www.unicode.org/reports/tr15/
- Unicode normalization FAQ: https://www.unicode.org/faq/normalization.html
- IETF BCP 47 / RFC 5646: https://www.rfc-editor.org/info/bcp47/
- OWASP Prompt Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- [G01 security model](GATE-01-SECURITY-THREAT-MODEL.md)


## Critical review and verified v0.2 changes — 2026-11-10

**Historical review state before owner decision: HARDENED PROPOSAL.** The initial 22-test design was not sufficient.

| Weakness | Correction | Test |
| --- | --- | --- |
| No stable goal identity for revisions | Server goalId included; cross-goal revision rejected | T39 |
| Inherited properties and accessor getters | Plain data-only JSON-shaped input validation | T23–T24, T50–T51 |
| Explicit null fields silently defaulted | Absent and explicit null distinguished | T25–T27 |
| Permissive source references | Unique, bounded, syntactically opaque handles; no URLs/paths/content | T28–T29, T33, T49 |
| Unsafe Unicode and length assumptions | Reject unpaired surrogates and unsafe controls; 6000 UTF-8-byte cap | T30–T32 |
| Client budget silently dropped | Preserve maxCostCents including zero as hint, not permission | T34–T36 |
| Raw user goal and identity could be forwarded to model | Allowlisted projectForInterpreter() removes rawGoal, actorRef, tenantRef, goalId, turnId and real source handles | T41–T43 |
| No verified test result | GitHub Actions run 42867607839 succeeded at commit 4c41e29ba4862b23a8e2443b42052b4208626ca4 | 54 pass, 0 fail, 0 skipped |

**Verified GitHub Actions run:** https://github.com/LethaboMH14/T.A.C.E/actions/runs/42867607839 . The workflow logs explicitly show 54 tests passed. An independent in-session V8 harness also ran the 54 deterministic assertions successfully.

**Revised design:** trusted gateway (G07, not yet built) issues goalId, turnId, parent, revision, actor and tenant; deterministic G02.01 produces internal NormalizedIntakeRecord v0.2; restricted projectForInterpreter() emits g02-interpreter-view-v0.2 with interpretation text, locale/time/deadline/budget hints and numbered source slots only. Source handles remain unverified. A new turn always triggers approval and plan recheck.

**Important caveats:** The trusted argument is a test fixture, NOT actual authentication. Comparing two records does not prevent concurrent replay or enforce atomic current-head revision; G07 must implement compare-and-swap in a real event ledger. A syntactically opaque handle is not proof of source ownership. The interpreter view still contains interpretationText and therefore can still contain sensitive information; it is not anonymization. Raw text is exact decoded JavaScript string, not a guarantee of original HTTP bytes. No real authorization, prompt-injection integration, secure parser, memory retention, POPIA compliance, LLM intent accuracy or external effects are proven.

**Remaining P0:** authenticated server context, atomic replay protection, scoped source resolution, exact approval fingerprints, privacy-safe storage/telemetry and retention controls (G03/G07/G08/G11). **Remaining P1:** semantic correction evaluation, multilingual/emoji clarification, adversarial Unicode and concurrency tests (G02.02/G02.11/G02.13/G11).

**Decision (superseded by owner approval below):** G02.01 was proposed pending owner review. Figma page 04 has been updated with v0.2 model privacy boundary and verified CI evidence.


## 10. Owner approval and G02.02 handoff — 2026-11-10

**APPROVED: G02.01 hardened v0.2 design baseline only.** [ADR-0005](../decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md) records the explicit owner approval. Verified test evidence: [54/54 deterministic GitHub Actions tests](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42867607839). Figma page 04 is synchronized.

**Not approved or implemented:** server authentication, replay protection, actual source authorization, external writes, privacy compliance, live LLM interpretation, verified outcome delivery or business impact. G02.02 may now start as **IN_RESEARCH / limited prototype**, subject to its own ADR and signoff. No automatic signoff of G02.02 or G02 overall.
