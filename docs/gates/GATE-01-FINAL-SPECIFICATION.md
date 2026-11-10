# GATE 01 — Universal Goal Boundary: final requirements baseline and G02 handoff

**Date:** 2026-11-10 | **Version:** G01 v1.0 | **Status:** DESIGN SPECIFICATION COMPLETE / IMPLEMENTATION PENDING
**Decision:** [ADR-0004](../decisions/ADR-0004-g01-requirements-signoff-and-g02-handoff.md).
**Problem statements:** **approved and frozen verbatim** in [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md).
**Core invariant:** T.A.C.E is a general, API-first **any-goal feasibility-to-verified-outcome engine**. The first contest demonstration is EdTech. **KAIRO not used**.

## 1. Purpose, beneficiaries and problem outcome

**Problem:** Teachers and training providers must coordinate assessments, interventions, accessible learning and administrative work despite workload, learning gaps, language needs and fragmented data/tools. The **information-to-timely-action gap** is the cross-cutting problem. Primary evidence and inferred downstream impacts are kept separate: [problem dossier](GATE-01-PROBLEM-STATEMENT.md).

**Actor:** adult teacher, mentor or academy coordinator in the first education proof; students/learners are beneficiaries, not an uncontrolled source of institutional authority. The core later supports other authorized roles and domains.

**Job:** accept varied requests with optional uploaded/connected/public sources, determine feasible actions and deliverable formats, execute only within actual permissions/capabilities, verify the results and report incomplete work honestly.

**Non-goals:** a fixed marking script, pretend multi-agent transcripts, automatic official grading, claims of improved grades, blanket support for every file extension, permissionless email sending, unauthorized real learner records or an educational-only engine.

## 2. Inputs: universal interface and default assumptions

| Input | Required? | Semantics |
| --- | --- | --- |
| Natural-language goal (or equivalent API intent text) | Yes for goal admission; request may need clarification | Raw statement retained, no hardcoded keyword route |
| Authenticated principal + tenant + roles | Required for private/side-effectful actions; derived from real server middleware, **NEVER from model or request fields** | Actor authority is a separate verified server assertion |
| Attached data | Optional | Any bytes may be presented for admission; **only supported, safe parser types** can be processed |
| Connected app references | Optional | Discovered only from authenticated registry; mention of Gmail/Excel is not a connection |
| Public research references | Optional | Only approved URL/retrieval paths; no arbitrary internal fetch |
| Constraints | Optional; defaults documented | Deadline and timezone, accessibility, money/tokens/time, permitted providers, privacy and required approvals |
| Requested deliverables | Optional | The goal parser infers feasible candidate outputs; user can modify/approve expected output types |
| User clarifications and corrections | On demand | Must not silently relax existing scope and permissions |
| Data usage and lawful basis | Required when personal data involved | No real student/personal data in demo; later deployment requires verified lawful access |

**Possible formats requested:** CSV/XLSX, TXT/MD, PDF, DOCX, PPTX, images, diagrams, accessible HTML, audio/video, email drafts, calendar proposals, LMS changes, arbitrary app/API actions. **Requesting** an output does not imply a tool exists or has consent; capability check must identify supported subset.

**Default when not specified:** do not choose a specific school, grade, learner marks or recipients; safe draft/template or targeted clarification. Default timezone for a given target school must be explicit when date matters. Default remote side effects = **DENIED**.

## 3. Server-attested goal contract requirements

The following is a **design contract**. G02 creates interpretation logic, G04/G07 implementation and auth. A baseline JSON contract will exist for cross-gate compatibility.

- **Goal identity:** server-issued stable ID, schema version, raw goal, request origin, creation time, content digest.
- **Actor:** authenticated user reference, tenant, role set, source of authority; no client-specified identity.
- **Outcome:** typed requested artifact or action list, done/acceptance predicates, named stakeholder if known.
- **Context:** source refs, versions, file/MIME/parser verdicts, privacy tier, source origin and confidence/coverage, approved connected providers.
- **Constraints:** deadlines, locale, timezone, cost/time/token ceilings, capabilities, language reviewer requirement, impact risk.
- **Execution proposal:** suggested subgoals, tool/effect classes, need for collaboration and independent reviews; not executable by mere model JSON.
- **Authorities:** explicit read/draft/write/send scope; any risky action has a canonical, immutable approval proposal and independent policy enforcement.
- **Unknowns:** essential blockers, safe assumptions, partial-work status and why clarification is needed.
- **Verification:** acceptance tests, files/receipts/read-back and independent reviewer verdict, unresolved gaps.

**Goal state taxonomy:** RECEIVED, AWAITING_INPUT, BLOCKED_CAPABILITY, BLOCKED_POLICY, PLANNED, AWAITING_APPROVAL, EXECUTING, VALIDATING, REPAIRING, COMPLETED_VERIFIED, COMPLETED_WITH_LIMITATIONS, FAILED_VALIDATION, FAILED_RUNTIME, CANCELLED. Transitions are owned by trusted orchestrator, not user-supplied status fields. External action execution additionally requires immutable approval and rechecked resource version.

## 4. Goal classes, examples, alternative wordings and expected topology

See [G01 seven adaptive families](GATE-01-UNIVERSAL-TASK-CATALOGUE.md). Families are acceptance categories, not fixed prompt triggers. The system must support mixing requests and deciding to use no swarm for trivial transformations.

| Sample type | Goal | Required behavior |
| --- | --- | --- |
| S0 minimal | “Turn this approved syllabus into a sorted spreadsheet of learning outcomes” | One source extraction/formatter + validator, real downloadable XLSX/CSV; no unnecessary specialist team |
| S1 workload | “Organise marking against my rubric, find discrepancies, draft feedback” | Work distribution, independent rubric review, teacher approval before official publication |
| S2 gaps | “Identify which fictional trainees struggle with fractions and prepare targeted support” | Source/score mapping, curriculum validation, intervention artifact, no fake ability label |
| S3 language | “Create a bilingual English/isiZulu accessible support pack” | Source-preserving parallel-language **draft**, explicit fluent-review gate |
| S4 continuity | “The lead mentor can't make tomorrow's sessions; fix the schedule” | Deterministic resource-constraint check, recompute affected tasks only |
| S5 truth | “These two answer keys disagree. Find the supported answer.” | Evidence conflict table, independent formula checks, unresolved state when evidence insufficient |
| S6 administration | “Prepare required documents and deadlines for an opportunity” | Dated public requirements, verified source list, authorized private checklist; no eligibility guarantee |
| S7 combined | “Recover our 36-trainee programme under resource and language constraints” | Actual specialized agent handoffs, mixed verified artifacts, approval queue, replanning and repair |

At least 30 varied prompt phrasings with a held-out subset are proposed for later evaluation, plus 48 negative/edge cases. No such evaluation is claimed completed.

## 5. Flagship for initial G02→G12 engineering (scoped design choice)

**Working scenario name:** **Education Recovery Mission**. Chosen as the *engineering reference scenario*, not a hardcoded domain limit or asserted winning idea.

**Fixture:** a fully synthetic adult-learning cohort of **36 fictional trainees**, **3 fictional mentors**, subject **Mathematics support**, limited sessions and a short deadline; optional English/isiZulu resources **in unverified draft state** unless fluent review is truly performed. At least two source formats and one sandbox connector can be supplied for integration testing (NOT assumed implemented).

**Natural request, paraphrasable:** “We have 36 trainees falling behind and a mentor is unavailable. Review the assessments, work out targeted support, revise the remaining schedule, prepare accessible learning materials, a verified workbook and communications drafts, and show what needs approval.”

**Required outputs:** verified analysis CSV/XLSX; source-grounded intervention DOCX/PDF; conflict-checked session proposal; bilingual learning draft with review label; unsent communication drafts; tool event/reviewer/correction audit; explicit unresolved items.

**Required live changes:** (A) late mentor cancellation invalidates only dependent schedule/support nodes and produces a feasible updated proposal or honest infeasibility; (B) seeded wrong answer key or schedule conflict is caught by independent verification, corrected and revalidated. Seeded errors must be labelled test injections.

**Security:** real learner data prohibited; no actual messages, grades, applications or calendar invites in the competition demo without separate permissioned sandbox. A submitted proposal is not a completed external action.

**Comparison:** S0 must use less coordination than the combined S7. Same universal intake and policy contracts, different graph topology and outputs.

## 6. Explicit completion criteria for G01 REQUIREMENTS

| # | Criterion | Design state | Implementation / empirical state |
| --- | --- | --- | --- |
| 1 | Universal engine scope and education domain boundary | DOCUMENTED ADR-0002, this spec | No runtime built |
| 2 | Approved formal + simple problem statements, source discipline | APPROVED ADR-0003 | No human impact evaluation |
| 3 | Actor/beneficiary and educational reference mission | SELECTED as bounded engineering fixture in this spec | Synthetic data not built/verified yet |
| 4 | Examples of differently phrased, multi-domain and incomplete goals | DEFINED | Prompt recognition tests pending G02/G11 |
| 5 | Input/source/file format and connector admission semantics | DEFINED | Real parsers/permissions pending G03/G07 |
| 6 | Goal identity, outcomes, constraints, missingness and authority | DEFINED | Stable serialization and signed actor binding pending G02/G07 |
| 7 | Effect/approval/read-back states and no-fake-completion rule | DEFINED | Approval and tool enforcement pending G07 |
| 8 | Adaptive topology and changed-goal/version rules | DEFINED | Dynamic graph implementation pending G04/G05 |
| 9 | Impact baseline and measurable success/failure targets | DEFINED G01.23 | **PENDING** G11/G12; no savings claims |
| 10 | Threat model and risk controls, POPIA/child data boundary | DEFINED G01.24 | **PENDING** G07/G11 before real data |
| 11 | Comprehensive edge/adversarial test catalogue | DEFINED G01.25 | **PENDING** tests for runtime |
| 12 | Editable source diagrams and traceable decisions | DOCUMENTED FigJam/diagrams.net/ADRs | Runtime Mission Console pending G10 |

**G01 completion represents design/requirements closure ONLY.** G02 may begin after ADR-0004 recording this as a scoped handoff. G01 cannot be described as an engineered, secure, production-ready or demonstrated system. **No safety or performance test is waived by allowing G02 design to begin.**

## 7. Detailed successor responsibilities

- **G02:** versioned master prompt/intent interpretation, structured GoalContract drafting, ambiguities, no-data handling, refusal/clarification, safe user language; explicit threat boundary (no prompt-derived permission).
- **G03:** source selection, safe parsing, provenance, privacy-aware retrieval, trusted/untrusted context separation.
- **G04:** capability registry, skill selection, model/agent roster.
- **G05:** DAG planning, checkpointing, cancellations, fault/replan semantics, bounded retry and cost.
- **G06:** typed authenticated handoffs; real inter-agent collaboration.
- **G07:** **P0 SECURITY IMPLEMENTATION:** server-derived identity, least privilege, secure file admission, policy enforcement, exact approvals, safe connectors and idempotent writes.
- **G08:** private tenant-scoped memory with expiry and right-to-delete.
- **G09:** independent review and repair (answer/citation/constraint/format verification).
- **G10:** live editable Mission Console backed by authentic events.
- **G11:** impact baseline, usability and adversarial security evaluation; institutional/privacy audit.
- **G12:** integration and judged live demo with real file artifacts and tool receipts, no unverified claims.

## 8. Research/source references

- [Approved problem](../decisions/ADR-0003-education-problem-statement-approval.md)
- [Impact test plan](GATE-01-IMPACT-EVALUATION-PLAN.md)
- [Security threat model](GATE-01-SECURITY-THREAT-MODEL.md)
- [48 edge cases](GATE-01-EDGE-CASE-MATRIX.md)
- [G01 evidence and consequence architecture](GATE-01-PROBLEM-ARCHITECTURE.md)
- [Connectors](GATE-01-CONNECTOR-CAPABILITIES.md)
- [Official Colleague Zero](https://hackathon-26.melsoft.org/)

**Signoff scope:** scoped and accepted as a design baseline for starting G02 through ADR-0004 on the user's direction to complete Gate 01 before moving on. This does not retroactively approve measured results, unimplemented tools or security.
