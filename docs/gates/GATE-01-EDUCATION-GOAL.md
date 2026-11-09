# GATE 01 — Education Goal: Research and problem definition

**Project:** T.A.C.E — education digital colleague  
**Gate ID:** G01  
**Status:** IN_RESEARCH / NOT APPROVED  
**Research snapshot:** 10 November 2026  
**Owner:** Product and education problem definition  
**Next gate:** G02 (Prompt and Intent), blocked until G01 is approved.

> This dossier is **not an approval to implement** the proposed flagship. It separates verified external findings, design inferences and decisions that still need agreement. No source establishes that T.A.C.E itself improves grades or saves time; those outcomes would need testing.

## 01.01 — Mission / research question

**Question:** Which particular education workflow should a digital colleague own end-to-end so that it delivers a real, trustworthy, reviewable outcome rather than a chat response, while remaining feasible for a 24-hour, two-builder demonstration?

**Decision constraints:**
- Must genuinely serve teaching, learning or educational programme operations, not be a generic infrastructure framework.
- Must plan, coordinate distinct specialists, use tools, independently check errors, repair, and deliver persisted work.
- Must have evaluable outputs and a defensible real-world problem.
- Must demonstrate human judgment and agency, particularly on educational decisions or learners' private data.
- Must run reproducibly on synthetic inputs; no real pupil records, messages or high-stakes automated grading.
- Must prioritize a complete vertical slice over an elaborate but untested agent ecosystem.

## 01.02 — External evidence landscape

### S01: Teacher workload is a demonstrable problem (OECD, 2025; TALIS 2024)

OECD's South Africa TALIS country note reports that lower-secondary teachers average **7.1 hours/week** on marking/correcting, compared with **4.6 hours** across the OECD. **72%** identify excessive marking as a source of substantial stress and **66%** report too much administration as a source of stress. The research establishes need; it does **not** prove any AI tool reduces that burden.  
Source: https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html

### S02: The DBE explicitly advocates assessment-to-instruction action

The South African Department of Basic Education's *Diagnostic Test Items* guidance treats assessment as a way to understand what learners know, what misconceptions remain and what instruction or support to adapt. It states diagnostic resources complement CAPS and the Annual Teaching Plan rather than replace them, and emphasizes using diagnostic items for learning rather than grading.  
Sources: https://www.education.gov.za/DiagnosticTestitems.aspx and https://www.education.gov.za/2020DiagnosticTestItems.aspx

### S03: A curriculum-grounded prototype is viable

DBE publishes CAPS Mathematics for Grades 7–9 and Annual Teaching Plan resources, including Grade 8 Mathematics. These provide a grounded reference against which recommended activities and learning objectives can be checked. The exact year/term/topic **must be pinned as a versioned source before building**, not inferred from a model.  
Sources: https://www.education.gov.za/LinkClick.aspx?fileticket=uCNqOwfGbmc%3D&forcedownload=true&mid=1629&portalid=0&tabid=573 and https://www.education.gov.za/Curriculum/NationalCurriculumStatementsGradesR-12/2023ATPsSP/tabid/3208/ItemId/28868/Default.aspx

### S04: AI helps with preparation but should not quietly replace teacher responsibility

OECD's *Reimagining Teaching in an Accelerating World* (2026) discusses AI-supported planning and formative feedback, limitations of algorithmic assessment, and the continuing responsibility of teachers for significant judgments and marks. UNESCO's guidance recommends human-centred, privacy-aware educational AI. This supports **teacher-reviewed interventions and drafts**, not automated consequential decisions.  
Sources: https://www.oecd.org/en/publications/reimagining-teaching-in-an-accelerating-world_d0edfe8c-en/full-report/component-6.html and https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research

### S05: Specific educational task criteria are mandatory

Colleague Zero describes five qualities: reason; self-correct; execute real work; collaborate through multiple agents; serve education. The host's examples include marking, curriculum, learner support, admissions and careers. **A learning-support colleague appears among their examples**, so our differentiation must come from the *end-to-end workflow and verification*, not claiming the underlying idea is novel.  
Source: https://hackathon-26.melsoft.org/

### S06: Privacy and risk boundaries matter

POPIA (Act 4 of 2013) contains specific restrictions and exceptions for processing personal information about children, notably sections 34–35. This research is not legal advice. For the competition, use **fictional learner profiles only**, access controls for records, clear deletion and no transmissions to real recipients.  
Source: https://www.justice.gov.za/legislation/acts/2013-004.pdf

### S07: OECD formative assessment approach

OECD's *Unlocking High-Quality Teaching* (2025) frames formative assessment as establishing learner goals, diagnosing current understanding, providing feedback and adapting teaching. The implied missing operational link is **turning evidence into checked, usable actions**; that is our proposed product opportunity, not an experimentally validated causal conclusion.  
Source: https://www.oecd.org/en/publications/unlocking-high-quality-teaching_f5b82176-en/full-report/using-formative-assessment-and-feedback_189fb6dc.html

## 01.03 — Candidate workflow comparison (design evaluation, NOT external benchmark)

| Candidate | Real education need | Clear completed output | Natural multi-agent work | Independent check and repair | 24-hour demo feasibility | Key concern |
| --- | --- | --- | --- | --- | --- | --- |
| **A: Assessment → personalised intervention package** | High: diagnosis and support | High: learner plans, resources, follow-up records | High: analysis, curriculum, design, review, action | High: source mismatch, unsupported inference, math answer key | Medium–High if tightly scoped | Privacy, unwarranted profiling, curricular accuracy |
| B: Curriculum → lesson + exercises + answer key | High | High: teacher-ready lesson pack | Medium: research, activity, review | High: content/answer-key checks | High | Many generic AI tools already draft lessons; limited longitudinal action |
| C: Accessible learning companion | High and meaningful | Medium: adaptive materials, transcripts | Medium–High | Medium: accessibility checks | Medium | Could become conversational tutoring instead of finished autonomous work |
| D: Admissions and learner administration | High | High: checklist, drafts, tracked actions | High | High: completeness checks | Medium | Sensitive eligibility/record decisions and more integration overhead |
| E: Career/graduate preparation | High | High: CV and interview assets | High | Medium | High | Harder to show unique curricular/teacher impact |

**Current recommendation:** A, with B incorporated only as a bounded supporting capability (targeted worksheets). Reason: A visibly combines reasoning about evidence, curricular retrieval, multiple specialist roles, correctness verification, artifact persistence and follow-up action. This is an **engineering/product inference**; it remains PROPOSED until reviewed.

**Strong alternative:** B is the safer short-scope fallback if the evaluation of A reveals excessive complexity. Do not claim that A is empirically superior without a user study.

## 01.04 — Proposed exact educational goal

> **For a Grade 8 Mathematics teacher:** Given a fictional class diagnostic assessment, an optional attendance summary and a versioned CAPS/Annual Teaching Plan reference, T.A.C.E independently prepares a curriculum-aligned learning-support package that identifies observed skill gaps, creates tailored practice and feedback, checks factual/mathematical correctness, repairs detected errors, and saves teacher-reviewable plans and follow-up tasks. It does **not** infer why a learner is struggling, assign permanent risk labels, send messages, change grades or make consequential decisions without teacher approval.

**Proposed one-sentence goal input:**  
“Review these 12 fictional Grade 8 Mathematics learners' diagnostic responses and our term plan. Prepare evidence-backed catch-up activities and a follow-up schedule, and show me what needs my approval.”

**Input and output boundaries are part of G01:** no general web browsing, spontaneous source selection or uncontrolled CRM messaging necessary to prove a single complete workflow.

## 01.05 — Primary user and scenario

- **Primary actor:** teacher teaching Grade 8 Mathematics, with permission to review a synthetic class assessment.
- **Secondary actor:** programme coordinator who reviews the completed class overview; not a second permissions persona in MVP.
- **Subject:** Mathematics, Grade 8, one approved topic and one pinned curriculum version (the precise term/topic is OPEN).
- **Scale:** 12 synthetic learner IDs (not personal names), one assessment CSV, one curriculum source, optionally one attendance CSV.
- **Job-to-be-done:** "After an assessment, turn observed misconceptions into a checked, practical teaching plan for the coming week, without manually reconciling every document and writing every activity and follow-up."
- **Accessible outcomes:** exported teacher summary plus learner-level draft resources; future translation/accessibility is an extension, not a prerequisite for the first validated slice.

The existing education evidence justifies *investigating* this job. The scenario and scale are deliberately chosen design assumptions.

## 01.06 — Completed outcome and required outputs

**Minimal persisted artifacts (PROPOSED):**
1. **Class diagnostic summary** — questions/topic mapping and aggregated response patterns, with explicit observation vs uncertainty.
2. **12 draft support-plan records** — each plan linked to exact synthetic response evidence and curriculum anchor; teacher may edit/approve.
3. **Differentiated activities / worksheet pack** — topic and difficulty matched to observed needs, plus separately validated answer keys.
4. **Teacher review queue** — entries needing approval, missing information, content risks and unresolved evidence.
5. **Follow-up schedule in a local demo task store** — records created, read back and displayed; no email or SMS sent.
6. **Evidence and correction ledger** — source IDs, tool receipts, reviewer rejection, repair and final verification outcome.

**Scope stop:** if 12 individual worksheets would be over-expensive, generate 3 differentiated intervention groups plus 12 individually referenced plan records; never falsely claim every learner has a unique worksheet.

**What not to claim:** automated student success, improved test scores, trusted ability diagnosis from one assessment, actual message delivery, or perfect mathematical and curricular accuracy.

## 01.07 — True user outcome vs model output

A **generated paragraph** is not finished work. Completion requires:
- the inputs are parsed, bounded and traceable;
- assessment items map to explicit approved learning objectives;
- drafts are generated with source anchors;
- curriculum mismatch and wrong answers trigger failure codes, not quiet acceptance;
- repairs produce a changed artifact and pass re-validation;
- persisted files and task records are reopened and verified;
- permissions and pending human approvals are clear;
- delivered screen links resolve to actual saved artifacts.

For grades and interventions involving real learners, the teacher remains the decision-maker.

## 01.08 — Education workflow functional boundaries

**Included:** structured synthetic upload; skill-gap observations; curriculum source anchoring; material generation; review and repair; scheduling local follow-up tasks; export; auditability; teacher approval.

**Excluded:** psychological or medical diagnosis, inference of causes based on attendance, punitive absenteeism categorization, learner-ranking dashboards, real student PII ingestion, external outreach, LMS write access, auto-grading or formal marks, cross-tenant knowledge sharing, autonomous staff changes.

**Non-causal interpretation:** attendance may help describe available data and trigger a "verify with teacher" note. It is not evidence of motivation, disability, ability, home circumstances or why a learner obtained a score.

## 01.09 — Example self-correction scenario

An Intervention Designer proposes a worksheet with one incorrectly calculated answer and a second activity that lacks support in the pinned curriculum topic. Independent assurance checks: deterministic math answer validation and curriculum-anchor verification. It issues typed failures: \`ANSWER_KEY_MISMATCH\` and \`UNSUPPORTED_CURRICULUM_ALIGNMENT\`. A repair task corrects only the affected resources, re-runs the validator and stores before/after proof. If checks still fail after the retry budget, the package remains blocked rather than delivered.

**Demo honesty:** a seeded example may guarantee that an error condition is encountered, but whether the system actually detects, repairs and verifies it must be determined by real tool calls and logged evidence, not animation or an always-success script.

## 01.10 — Measurable proof / acceptance tests

| Gate metric | Proposed MVP passing condition | Evidence |
| --- | --- | --- |
| Source completeness | All submitted fixture records parsed or explicitly rejected | import report |
| Plan coverage | 12/12 fictional learner IDs receive a reviewable plan or a documented abstention | persisted records |
| Provenance | Every substantive learner-specific observation references assessment row/question and curriculum objective | evidence ledger |
| Correction | At least one injected content error is flagged, revised and independently rechecked | before/after artifact and validator log |
| Tool execution | Follow-up records exist in local store and survive reload | write receipt + read-back |
| Safety | Zero external messages and zero formal grade changes | tool permission log |
| Completion | Required artifacts exist, reopen successfully and satisfy their acceptance schemas | completion validator |
| Honest uncertainty | Conflicting or missing facts are marked unknown, not invented | negative test fixtures |
| Performance | Track actual elapsed time, tool calls and successful runs; do not invent targets | run telemetry |
| Teacher decision | Approvals are explicit and audit-traceable | teacher review queue |

The numbers **12**, one correction and the defined artifact set are *proposed test fixtures*, not claimed observed performance.

## 01.11 — Research limitations and decisions still open

1. **User validation gap:** no teacher interviews, classroom usability testing or proof of time saved yet. Recruit informed teacher feedback before claiming value beyond demo feasibility.
2. **Course anchoring:** Grade 8 mathematics is proposed, but term/topic and exact CAPS+ATP source versions require selection and a content review.
3. **Assessment design:** need a synthetic item-to-skill matrix with an independent truth oracle. Do not infer misconceptions solely from raw percentages.
4. **Intervention quality:** define a rubric for specificity, age suitability, correct content, inclusion and level of scaffolding.
5. **Access/translation:** important local needs, but genuine multilingual correctness requires evaluation, not a marketing checkbox.
6. **Security/legal:** synthetic-only demo is clear. Production institution use would need independent privacy/legal review and real consent/access-control design.
7. **Competitive proof:** need a clean single-agent vs multi-agent comparison with identical tasks and objective correctness tests.
8. **Name:** public product name and T.A.C.E acronym are not defined.
9. **Workflow selection:** A is recommended, B fallback; explicitly approve or change.

## 01.12 — Gate 01 exit / approval

**Gate does not close until all are checked:**
- [ ] Approve a single **primary teacher/learner actor**.
- [ ] Approve the **one educational problem** and why it is worth solving.
- [ ] Choose the **flagship workflow** (A recommended; B fallback).
- [ ] Approve class level, domain, subject, topic and source version.
- [ ] Approve exact **input schemas, artifact list and no-go boundaries**.
- [ ] Define actual success measurements and one reproducible correction case.
- [ ] Review privacy, child-data and human authorization boundary.
- [ ] Document one educational expert or teacher-feedback plan.
- [ ] Approve final plain-language goal and end-to-end demo promise.
- [ ] Record decision in **ADR-0002** (to be created only when reviewed), update the Decision Register and tracker.
- [ ] Confirm acceptance of downstream G02 interface: actor, objective, constraints, source policy, artifact list and completion criteria.

**Status: IN_RESEARCH. Exit not met. G02 NOT STARTED.**

## Source register

All sources are public, listed for review; source claims and design inferences must remain distinct.

- S01 OECD (2025), TALIS 2024 South Africa country note: https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html
- S02 DBE Diagnostic Test Items: https://www.education.gov.za/DiagnosticTestitems.aspx
- S03 DBE 2020 Diagnostic Test Items and CAPS framing: https://www.education.gov.za/2020DiagnosticTestItems.aspx
- S04 DBE Mathematics CAPS Grades 7–9: https://www.education.gov.za/LinkClick.aspx?fileticket=uCNqOwfGbmc%3D&forcedownload=true&mid=1629&portalid=0&tabid=573
- S05 DBE Senior Phase ATP listing: https://www.education.gov.za/Curriculum/NationalCurriculumStatementsGradesR-12/2023ATPsSP/tabid/3208/ItemId/28868/Default.aspx
- S06 OECD (2026) Reimagining Teaching, human agency: https://www.oecd.org/en/publications/reimagining-teaching-in-an-accelerating-world_d0edfe8c-en/full-report/component-6.html
- S07 UNESCO GenAI in Education: https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research
- S08 OECD (2025), Formative assessment and feedback: https://www.oecd.org/en/publications/unlocking-high-quality-teaching_f5b82176-en/full-report/using-formative-assessment-and-feedback_189fb6dc.html
- S09 POPIA official Act: https://www.justice.gov.za/legislation/acts/2013-004.pdf
- S10 Colleague Zero: https://hackathon-26.melsoft.org/
