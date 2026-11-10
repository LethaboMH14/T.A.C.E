# G02.02 — Versioned GoalContract Proposal, outcome decomposition and correction semantics

**Date:** 2026-11-10
**State:** HARDENED v0.2 / DESIGN_ACCEPTED BY OWNER / DETERMINISTIC PROTOTYPE VERIFIED / PRODUCTION PENDING
**Predecessor:** [G02.01 design ACCEPTED](GATE-02-01-INPUT-NORMALIZATION.md), [ADR-0005](../decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md).
**Decision:** [ADR-0006](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md) — PROPOSED.
**Contract:** [goal-proposal.schema.json](../../tools/gate02/goal-proposal.schema.json).
**Code and tests:** [tools/gate02](../../tools/gate02/).
**Figma:** [Gate 02 editable workspace](https://www.figma.com/design/28egBAkhQHExkqUinyimtM); page **05 — G02.02 Goal Proposal & Candidate DAG** [open editable page](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2), synchronized.
**Scope:** Typed interpretation **proposal** and candidate outcome DAG only, not authorized GoalContract, LLM model, execution planner, tool invocation or policy.

## 1. Why this subsection exists

A user may request one simple artifact, a multi-part education recovery mission, or a completely different domain goal. The next layer must express what outcome is being requested, what inputs are referenced, which candidate subgoals depend on others, what observable checks might prove success, and what is still unknown. It must not claim an app exists, invent evidence, silently promote source text into authority or treat model-suggested effects as permissions.

G02.01 supplies a normalized intake and an **allowlisted interpreter view**. G02.02 accepts a **candidate** structured interpretation and validates it deterministically against a stable schema and intake metadata. Producing that interpretation from natural language via a model is a separate, **unimplemented** step. G02.03 specifies trusted prompt layers; G02.04 governs whether and how to clarify; G02.06 and G07 enforce effect classification/policy; G02.10 adds bounded structural repair; G03/G04/G05 compile actual evidence/capabilities/graph.

## 2. Alternatives and trade-offs

| Decision | Alternative | Recommended for v0.1 | Why / cost |
| --- | --- | --- | --- |
| Proposal format | Free-form prose / loosely parsed JSON | **Strict, versioned domain-neutral JSON Schema** | Detect malformed and extra fields; schema maintenance |
| Goal structure | One opaque prompt or an immediately executable DAG | **Outcome-first proposal with bounded candidate subgoal DAG** | Supports mixed goals without pretending graph is feasible; graph must be replanned in G04/G05 |
| Source provenance | Model copies source URLs/handles | **Integer slots referring to G02.01 source descriptors** | Prevents handle disclosure to model; G03/G07 must authorize actual source bytes |
| Identity and revision | Model supplies tenant/actor/turn IDs | **Server binds validated proposal to trusted intake** | No model-supplied authority; real authentication/atomic event store pending G07 |
| Effects | Model declares actions safe/approved | **Untrusted effect claims and capability needs** | Useful for review; cannot grant permissions or prove tool availability |
| Domain | Fixed teacher/learner fields | **Domain-neutral intent modes and deliverables** | Universal engine; education only a test fixture |
| Validation | Prompt-only format enforcement | **Deterministic bounded checks, strict unknown-key rejection** | Testable, model-independent; no guarantee of semantic correctness |
| Recovery | Silently repair arbitrary invalid output | **Reject with stable error codes** | Fail closed; G02.10 may introduce one bounded, audited structural re-ask |
| Dependencies | Arbitrary nested task plans | **Max 12 candidate subgoals, acyclic dependencies** | Prevents runaway graph candidates; not a fixed runtime graph limit |

**Recommendation is PROPOSED**, not yet accepted. No model, vendor, framework, API connector or memory product is selected.

## 3. Proposed data contract

The **model-side** GoalContractProposal contains *only*:
- `schemaVersion`: exactly `g02-goal-proposal-v0.2`.
- `intent`: concise summary plus 1–4 modes (CREATE, ANALYZE, TRANSFORM, COORDINATE, COMMUNICATE, UNKNOWN); UNKNOWN may not mix with known modes.
- `relationToPrior`: NEW_GOAL, REFINEMENT, CORRECTION or UNKNOWN — **model's claim, not verified fact**. Root turns require NEW_GOAL or UNKNOWN; a new goal on an existing goalId must be re-routed by a trusted gateway.
- `deliverables`: 1–8 named outcome descriptions with format hints; format hint **does not imply supported format or connected app**.
- `subgoals`: 1–12 candidate outcome nodes with IDs, outcome descriptions, `dependsOn`, `deliverableIds`, `sourceSlots`, `capabilityKinds` and `effectKinds`. References must exist, be unique and form a DAG; every deliverable must be covered. These are **not executable tasks or agent assignments**.
- `sourceSlots`: 0–24 unique indices pointing to G02.01 source descriptors, not source content or handles. A slot is not an authorization grant.
- `capabilityNeeds`: 0–12 proposed kinds and reasons, never a declaration of actual installed tools.
- `effectClaims`: 1–8 proposed effect kinds and reasons (READ_ONLY, LOCAL_ARTIFACT, SHARED_WRITE, EXTERNAL_SEND, DESTRUCTIVE, UNKNOWN). **Never an authorization classification**. Destructive claims are rejected by this spike; unknown effects require clarification; consequential effects require later policy review.
- `acceptanceCriteria`: 1–16 candidate check descriptions linked to deliverables and check methods; each deliverable has at least one. A claimed check is not a verified result.
- `uncertainties`: 0–12 codes, targeted questions and blocking flags. The proposal may signal unresolved input, but **G02.04**, not the model, decides final user-facing clarification.

The server-side validation result binds `goalId`, `turnId` and `revision` from G02.01, **not** from model output. It returns one of PROPOSAL_VALID, NEEDS_CLARIFICATION, POLICY_REVIEW_REQUIRED or REJECTED_PROPOSAL; none means APPROVED, EXECUTED or VERIFIED. Validated output is defensively copied and frozen to reduce post-validation mutation risk.

### Architecture

~~~mermaid
flowchart TD
  A["G02.01 internal normalized intake v0.2"] --> B["Allowlisted interpreter view: text, hints, source slots"]
  B --> C["Candidate interpretation from model / fixture (LLM not implemented)"]
  C --> D["Strict versioned GoalContractProposal schema"]
  A --> E["Server-side binding: goalId / turnId / revision (fixture only now)"]
  D --> F["Deterministic shape + bounds + reference checks"]
  E --> F
  F --> G{"Valid, DAG acyclic, criteria linked?"}
  G -->|"No"| X["REJECTED_PROPOSAL + error code"]
  G -->|"Yes"| H{"Unknown / blocking uncertainty / effect?"}
  H -->|"Yes"| I["NEEDS_CLARIFICATION; G02.04 pending"]
  H -->|"No"| J{"Consequential claimed effect?"}
  J -->|"Yes"| K["POLICY_REVIEW_REQUIRED; G07 actual policy pending"]
  J -->|"No"| L["PROPOSAL_VALID (not approved)"]
  I --> M["G02.03/04/06/07 handoffs"]
  K --> M
  L --> M
~~~

## 4. Example A — simple domain-neutral goal

User: "Create a study-plan template." No source references.

Candidate: intent CREATE; deliverable `template` (local artifact), one subgoal `outline`, one criterion "reopen and inspect the saved file"; no source slots; WRITE_ARTIFACT need; LOCAL_ARTIFACT effect; relation NEW_GOAL. Valid structure means **only that the proposed contract is well formed**. No file has been created and no model has been run.

## 5. Example B — synthetic Education Recovery Mission

User: "Review these synthetic assessments, produce English/isiZulu support drafts, plan three mentors and draft—not send—messages." Source slots `[0,1]` refer to two opaque handles.

Candidate outcomes: `gap_analysis` → `support_material` and `mentor_schedule` → `message_drafts`. Four deliverables with independent acceptance checks: source cross-check, artifact reopen, schedule conflict check, human review. Claimed effect LOCAL_ARTIFACT (no external send). Need READ_SOURCE, WRITE_ARTIFACT, SCHEDULING, MESSAGE_DRAFT; none asserts calendar/drive access. If actual scheduling writes or sends become necessary, G07 must reassess from real tool/action semantics and require appropriate approval. No learner data used in tests.

## 6. Correction semantics and threat model

A model may claim CORRECTION or REFINEMENT, but **cannot** establish that claim as fact. Compare server goal/actor/tenant/parent/revision lineage (G02.01); a new goal requires a fresh goalId. On every new turn, invalidate/recheck dependent approvals and plans regardless of text equality. A deterministic revision comparator may report changed claimed effects/deliverables but does not resolve the semantics of natural language.

**Adversarial cases:** client/model-forged `approved`/`actor`/`tenant`; source-handle exfiltration; cross-goal lineage; duplicate IDs, unknown references, self/cyclic dependencies; malformed Unicode; duplicate source slots; oversized nested objects; fake check methods; invalid budgets/format hints; conflicting send capability versus effect claim; destructive effect; unknown effect without explicit uncertainty; model overconfidence; JSON deserialization and schema drift.

**Security boundaries:**
1. Model-provided fields are *proposals only*. The validator never authorizes tools.
2. Source slots cannot be resolved without G03/G07 tenant-scoped authorization.
3. Claimed effect kinds are not trustworthy; G07 must derive actual effect from selected tool/action and compare against user consent, policy and immutable approval fingerprint.
4. `interpretationText` may contain sensitive data; projection is not anonymization. Privacy controls remain G07/G08/G11.
5. The current code accepts caller-supplied normalized intake **fixtures**. It cannot authenticate those fields, atomically enforce replay protection, verify model semantics, detect all prompt injection or prevent transport-level duplicate JSON keys.
6. Static JSON Schema and the dependency-free JavaScript runtime validator are intended to match; this is **not** an independent certified implementation of the entire JSON Schema 2020-12 specification.

## 7. Tests and acceptance conditions

Required tests: simple goal, mixed-domain DAG, duplicate/unknown/cyclic dependencies, missing acceptance checks, unbound source slots, client-forged authority fields, malformed or oversized values, invalid unicode, unknown/consequential/destructive effect routing, correction/root mismatch, cross-goal/tenant revision, immutable snapshots, schema drift and adversarial input. Tests ran in [GitHub Actions run 42870978038](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42870978038) on commit `11cdbe7e34f1c3a412fcffd602edd7f350cbb79f`: **142 pass, 0 fail, 0 skipped** (88 G02.02 + 54 G02.01). This proves only the deterministic test assertions, not semantic intent accuracy or production security.

**G02.02 proposed design exit:** versioned JSON Schema and deterministic implementation; test evidence; Figma synchronized; owner reviews ADR-0006. **Not sufficient for production:** LLM-held-out semantic accuracy, authorization, actual tool execution, graph scheduling, privacy and impact tests.

## 8. Next gate handoffs

- **G02.03:** trusted prompt layers and how the model is asked for this proposal.
- **G02.04:** risk-driven minimal clarification and status-to-user policy.
- **G02.05:** strengthen measurable acceptance criteria.
- **G02.06:** independent deterministic effect and autonomy classification.
- **G02.07:** real capability registry matching.
- **G02.08:** complexity-aware agent/graph planning.
- **G02.09–G02.13:** uncertainty calibration, structural repair, multilingual, adversarial and held-out evaluation.
- **G02.14–G02.15:** API integration, full gate signoff.
- **G03/G04/G05/G07/G09/G11:** context evidence, actual tool feasibility, graph execution, permission enforcement, independent verification and evaluation.

**Decision requested:** review and approve/revise G02.02 schema and candidate DAG **after** verified tests. Do not approve later gates implicitly.


## 9. Verified prototype checkpoint — 2026-11-10

**GitHub Actions:** [run 42870978038](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42870978038), commit `11cdbe7e34f1c3a412fcffd602edd7f350cbb79f`, 142/142 passing. The 88 new G02.02 tests cover strict schema fields, malformed and spoofed inputs, source-slot provenance, duplicate/missing references, DAG cycles, acceptance coverage, unknown effects, claimed send/write effects, root/correction consistency, cross-tenant/cross-goal revisions, defensive frozen copies and schema spot-checks. The 54 previous G02.01 tests also passed.

**Figma:** [editable G02.02 architecture page 05](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2), with proposal trust boundary, candidate DAG, outcome dispositions and explicit security limitations. G02.01 Figma page 04 now marks design accepted.

**Open issues:** The validator is hand-written and the JSON Schema is not independently evaluated by a full schema engine; a model may omit or misclassify real effects; the G02.01 intake fixture is caller supplied and not authenticated; revision comparison is not atomic; source slots do not prove ownership; no real prompt/LLM or multilingual accuracy evaluation. All are later gates' acceptance requirements.

**Decision:** ADR-0006 remains **PROPOSED** pending owner review. G02.03 must not begin without that approval.

## 10. Critical review — hardened G02.02 v0.2 (2026-11-10)

**Owner requested a critical review, not acceptance.** The original 88 G02.02 tests passed, but several cross-field and semantic risks were not covered. This review supersedes the v0.1 recommendation while preserving its historical evidence. [ADR-0006](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md) remains **PROPOSED**, and G02.03 remains **BLOCKED**.

### Defects, corrections, evidence and limitations

| ID | Severity | Original weakness | Hardened v0.2 change | Evidence / residual risk |
| --- | --- | --- | --- | --- |
| R01 | P0 | Model could attach a consequential effect to one subgoal and a risky capability to another, bypassing a global consistency check | Each subgoal now explicitly lists `effectKinds`, `capabilityKinds` and `sourceSlots`; cross-check every node and global mapping; fail on send/write capability inconsistencies | P97–P110. **Still model claims only; G07 must independently classify actual tool effects** |
| R02 | P0 | Revision comparator checked selected binding fields but not the whole result snapshot; forged status/order/policy flags could survive | Recompute and deep-compare both canonical validated results, including code, status, candidate order and binding | P116–P123. No server ledger, cryptographic signing or replay protection |
| R03 | P1 | Same turn metadata could be presented with altered raw goal, source handles or budget | Require exact G02.01 v0.2 intake record shape and raw/NFC/flag consistency; bind an internal SHA-256 fingerprint over canonical intake fields | P133–P143. Fingerprint is **not a MAC**; an attacker controlling input can recompute it; G07 must authenticate/persist events |
| R04 | P1 | JSON Schema and JS validator disagreed on Unicode string length (code points vs UTF-16 units), uniqueness and hidden formatting | Count code points, reject unpaired surrogates and bidi control chars, annotate safe patterns, enforce unique simple arrays | P89–P94, P127–P128. Full schema engine comparison still pending |
| R05 | P1 | Candidate DAG could contain unrelated orphan nodes with no path to a deliverable | Require every node to contribute to a deliverable directly or through descendants | P95–P96. No actual graph feasibility or runtime scheduling proven |
| R06 | P1 | Acceptance criteria contained only generic check text and a method enum | Require `evidenceExpectation` text for each criterion | P111–P113. Still **model-proposed evidence**, not observed proof or an independently executable test |
| R07 | P1 | Global source slots, capability kinds and effect claims could be declared without association to an outcome | Require every global claim to map to at least one subgoal and every subgoal claim to appear globally | P97–P107. Cannot detect omitted real-world actions without semantic evaluation |
| R08 | P1 | Proposal-size cap applied to fields separately but not the whole accepted proposal | Bound serialized, validated proposal to 32,768 UTF-8 bytes | P126. Raw request body and duplicate JSON keys must be limited/handled at HTTP parser boundary |
| R09 | P1 | Validation status could be mistaken for real success | Explicit `semanticStatus: UNVERIFIED`, `verificationStatus: NOT_RUN`, `policyAuthority: NONE` | P114–P115. Caller must still treat these statuses as non-authoritative |

**Compatibility:** `g02-goal-proposal-v0.1` is intentionally rejected by the v0.2 validator. Migration requires explicit versioned conversion and renewed validation; no silent coercion. A source slot is a *reference*, not source permission. A candidate DAG is an *interpretation*, not an executable graph. All subgoal mappings are model claims and may be incomplete or misleading.

**Security caveat:** SHA-256 fingerprints are internal consistency checks only. Neither the normalized intake fixture nor its fingerprint is authenticated, tenant-authorized or stored atomically in this prototype. Actual access control, human approvals, audit, data minimization and replay protection remain G03/G07/G08/G11 responsibilities.

**Semantic limitations:** These tests do not establish whether the user's goal was interpreted correctly, whether all requested effects were identified, whether proposed verification criteria are sufficient, whether multilingual text was understood, or whether a real connector exists. Those require held-out human-reviewed cases and independently derived tool/action policy.

**Verified CI:** [GitHub Actions run 42882371606](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42882371606) succeeded at commit `315357c2a9583bee84a480489e98ce2dfaf773e5`: **197 tests passed, 0 failed, 0 skipped**, comprising **143 G02.02** and **54 G02.01** tests. A prior intermediate run [42882122592](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42882122592) failed 1/186 because test P61 had not mapped the new capability into its subgoal; the test fixture was corrected and later runs passed. This failure was not concealed.

**Figma:** [Editable page 05](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2) updated to v0.2, with per-subgoal mapping and 197-test CI evidence.

**Review outcome:** Owner approved **hardened v0.2 design only** after this critical review, recorded in ADR-0006. G02.03 may begin research; no production readiness, real tool execution or semantic correctness is approved.


## 11. Owner signoff — 2026-11-10

The owner responded **"i approve next"** to the request to approve G02.02 hardened v0.2 and proceed. **Design baseline ACCEPTED**, including the critical review amendments and 197-test evidence. This does not certify semantic interpretation, security, integration or operational impact. [ADR-0006 acceptance record](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md) is authoritative. [G02.03 prompt architecture](GATE-02-03-PROMPT-ARCHITECTURE-RESEARCH.md) is now IN_RESEARCH, with its own PROPOSED ADR-0007; G02.04 remains blocked.
