# Gate 01 — Universal Education Task Catalogue (v0.3)

**Status:** DESIGN CANDIDATES, G01 still IN RESEARCH. **Date:** 2026-11-10.
**Scope:** T.A.C.E is the universal, API-first, goal-to-execution engine. Education is its first domain capability pack for Colleague Zero; it is NOT hardwired to one type of prompt. **KAIRO is excluded from this design path.**

## G01.16 — Problem families and evidence

- Teacher workload: marking, reporting, administrative scheduling and teacher support; South Africa TALIS/OECD context: https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html
- Learning gaps: diagnostic evidence to targeted support and reassessment; DBE diagnostic items: https://www.education.gov.za/DiagnosticTestitems.aspx
- Language and accessible learning: bilingual instructional materials, terminology, low-data formats and captions where actual tools and reviews exist; DBE: https://www.education.gov.za/
- Additional family overlap: cohort rescue, continuity control, source-truth investigation and access/admissions/career administration.

The core goal may be totally general. The education pack only determines which educational sources, safety rules, skills, connectors, evaluation criteria and examples are offered.

## G01.17 — Any rewording in a category should produce an appropriate task plan

| Family | Natural-language example (not a trigger phrase) | Possible outputs |
| --- | --- | --- |
| F01 Teacher workload | "I've got 80 learners and endless marking"; "organise our feedback"; "turn assessment results into parent-ready summaries" | Rubric review, class spreadsheet, feedback DOCX/PDF drafts, unsent mail drafts, workload schedule |
| F02 Targeted learning interventions | "They keep missing fractions"; "use this assessment to identify misunderstandings"; "what support is needed after this test?" | Item-to-skill map, evidence-based intervention plan, question set/answer-key, progress CSV, follow-up tasks |
| F03 Language and accessibility | "Make this Maths lesson work in isiZulu"; "simplify science for bilingual teaching"; "accessible offline lesson" | Parallel-language learning pack, glossary, accessible DOCX/HTML, captions, review status |
| F04 Cohort rescue | "Our trainees are falling behind before Friday"; "our mentor programme is breaking down" | Bottleneck analysis, cohort plan, prioritized resource allocation, calendar proposals, task records |
| F05 Learning continuity | "A teacher is away and the lab is down"; "we lost connectivity, reorganise tomorrow" | Constraint-feasible timetable, substitute schedule, printable/offline packs, change report |
| F06 Learning truth | "These curricula disagree"; "the answer key might be wrong"; "check AI teaching before publishing" | Evidence audit, source dispute table, corrected outputs, failure/repair log |
| F07 Opportunity/admin | "Help with these admissions"; "prepare a bursary document checklist"; "align curriculum with work-readiness" | eligibility evidence matrix, checklists, draft docs, deadline tasks and review queue |

These are evaluation families, NOT a closed keyword classifier. A novel educational request can require new specialist skills or capabilities; unsupported work must be reported honestly.

## G01.18 — With data, without data and with connected apps

| Input situation | What T.A.C.E should do | It must not do |
| --- | --- | --- |
| User attaches files | Extract, check integrity/coverage, keep source IDs, resolve conflicts, plan only authorized actions | Treat OCR and model-generated claims as verified facts |
| No attachments; safe public knowledge | Retrieve approved public sources, prepare a labelled general draft/template with explicit assumptions | Invent actual learners, marks, schedules, recipients or institutional tools |
| User authorizes connected workspace | Discover permitted sources through authenticated, scoped connectors | Assume a named app is already installed or connected |
| Missing facts materially alter action | Ask one essential targeted question, or produce a safe partial result | Present a lengthy questionnaire or guess consequential facts |
| Missing private learner records | Prepare demonstration using synthetic data or halt for inputs | Fabricate real personal conclusions |
| Desired modality unavailable | Offer an honestly labelled fallback; request explicit capability connection | Claim PDF, video, email or LMS action exists without a real result |

**Example:** "Mark our students" with no work or rubric cannot yield genuine grades. It can generate a rubric audit and ask for authorized evidence. "Prepare a Grade 8 fractions lesson" can produce an explicitly provisional general lesson grounded in suitable public curriculum if the grade/curriculum context is known.

## G01.19 — Adaptive topology examples

**Tiny goal:** "Turn this syllabus into a table" -> source read -> formatter -> deterministic validator -> verified CSV. There is no reason to spawn many agents.

**Middle goal:** "Make an English/isiZulu science pack" -> source grounding + pedagogy in parallel -> draft language conversion -> terminology/meaning checks -> qualified human language approval -> accessible materials.

**Complex goal:** "Our academy is behind; two teachers are absent; prepare learner support by Friday" -> assessment and resource analysts + policy/curriculum researcher -> feasibility scheduling -> intervention creation -> independent review/correction -> human approval for external effects -> writes/receipts/read-back.

**Trust/audit goal:** "Review our assessment scoring" -> audited partition -> specialist assessors -> independent consistency checker -> revision -> teacher signoff. No unreviewed autonomous final grade publication.

Topology is determined by task requirements, cost, permission, capability and verification—not automatically by the category or prompt length. The actual planner algorithms belong to G04/G05.

## G01.20 — Proposed most impressive combined demonstration (NOT LOCKED)

**Working title: Education Recovery Command Mission.**

Illustrative prompt: "Our fictional academy has 36 learners struggling with Mathematics, limited mentors, a missing staff member and bilingual teaching needs. Review the supplied evidence and trusted curriculum, find the most feasible recovery plan, revise the teaching schedule, produce usable support materials in approved formats, prepare communications, and show what needs my approval."

**Potential persisted deliverables:** analytical CSV/XLSX with reconciled learner IDs, DOCX/PDF support plan, accessible bilingual activity with human language-review status, a conflict-free local schedule/calendar proposal, reviewed email drafts, an evidence register, and verified tool receipts.

**Dynamic demo event:** a mentor becomes unavailable mid-run. Only affected graph nodes should be invalidated and rerun; a real scheduling constraint solver must either find a feasible revision or explicitly declare the conflict.

**Trust demo event:** a seeded mistaken curriculum reference or invalid worksheet answer is rejected by an independent validator, repaired and independently checked. Demonstrate genuine before/after and validation logs; never imply the error was spontaneous if it was intentionally injected.

**Contrast demonstration:** one source-to-table educational request uses a minimal graph. Then the complex recovery mission dynamically allocates multiple specialists. Judges see resource proportionality and true collaboration.

## G01.21 — Format and action completion standards

| Target | Done means |
| --- | --- |
| CSV/Excel | File opens, has expected rows/columns/formulas, no lost IDs, reconciliation passes |
| DOCX/PDF | File exists and opens, citations and required sections present and verified |
| Diagram/slides | Actual export; dependency and claim-to-evidence consistency validated |
| Accessible/bilingual lesson | Relevant content preserves source meaning; review status stated; keyboard/reading alternative validated |
| Video/audio | Actual playable file from authorized supported media tool; no fictitious generated video |
| Email | Draft exists. Sending is a distinct, permissioned action with receipt |
| Calendar/LMS | Either explicit proposal or actual write/read-back with user authorization; no conflation |
| Automation run | Real tool calls, typed handoffs, errors, bounded retries, terminal state and evidence |

## G01.22 — Competition and product boundary

The official brief judges five things: REASONS, SELF-CORRECTS, EXECUTES, COLLABORATES, SERVES EDUCATION. https://hackathon-26.melsoft.org/ . A generic architecture alone cannot satisfy the event; the demonstrated outcome must solve a real educational task.

**Gate 01 is OPEN.** Do not claim the flagship above is chosen, or begin G02. The exact demo fixture, user, goals, tools, rubric, failure-injection tests and authorization must still be agreed, and a later ADR must record approval.
