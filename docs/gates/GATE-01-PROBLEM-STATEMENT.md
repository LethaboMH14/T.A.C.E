# Gate 01 — Evidence-based problem statement and user goal boundary

**Version:** 0.2 | **Date:** 10 November 2026  
**Problem statement approval:** **APPROVED by the user** — wording and root problem only, recorded in [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md).  
**Architecture and gate status:** G01 **IN_RESEARCH**; G02 **BLOCKED**. No implementation or measured impact claimed.  
**Scope:** General-purpose T.A.C.E goal-to-execution engine, with an educational Colleague Zero deployment. **KAIRO explicitly excluded from this track.**

## G01-P01 — Primary problem statement (APPROVED, wording frozen)

> **Educators and training providers are expected to do more than teach. They must assess learning, identify difficulties, adapt materials, coordinate support and manage communication—often under significant time and resource constraints.**
>
> **When these responsibilities require information from different documents, systems and people, turning evidence into useful action becomes time-consuming and difficult to coordinate. The result is pressure on educators and a risk that learners do not receive the right support at the right time, in a form they can understand.**

This is a problem, **not** a product feature list. It does not mention AI, agents, a graph or model orchestration.

## G01-P02 — One-line problem (headline)

**Education teams have information and responsibilities, but too often lack the time and connected support needed to turn them into timely, personalised, trustworthy action.**

Alternative short header: **The gap between knowing what needs to be done and getting it done.**

## G01-P03 — 20-second simple problem statement (APPROVED, wording frozen)

> A teacher can see that learners need help but still has assessments to mark, lessons to prepare, a timetable to manage and parents to update. A learner may need a different explanation or language, yet that support takes additional work to prepare and coordinate. The central challenge is not just finding information; it is turning information into the right action, reliably and on time.

The above is an *illustrative* narrative, not a first-person quote from a real teacher or an interview. Gather real user voice before claiming it as directly validated.

## G01-P04 — Why this problem is evidence-backed (primary official research)

| Problem link | Verified evidence | What it establishes | What it **does not** establish |
| --- | --- | --- | --- |
| Teacher time/pressure | OECD TALIS 2024 South Africa country note (released 7 October 2025): among surveyed lower-secondary teachers, **72%** report excessive marking as substantial stress, **66%** excessive administration; full-time teachers report **7.1 hours/week** marking and **4.9 hours/week** administration | Workload and stress are documented, relevant education problems | These time categories are not necessarily additive without overlap review. Does not prove T.A.C.E cuts hours. |
| Learning gaps | OECD *Consolidating the General Education Certificate in South Africa* (late Oct/Nov 2026): **55% of assessed Grade 9 learners** did not attain the **lowest international benchmark in Mathematics** in TIMSS 2023 | A substantial need for mathematics support and responsive teaching | This is not a Grade 9 pass/fail rate, not a diagnosis, nor a count of learners T.A.C.E can recover. |
| Language access | DBE Mother Tongue-based Bilingual Education (MTbBE): rollout from Grade 4, beginning in 2025, in Mathematics and Natural Science/Technology, with gradual expansion | Government treats language of instruction and conceptual access as material educational needs | An AI-generated translation is not automatically appropriate or verified for teaching. |
| Digital fragmentation and manual coordination | OECD *Digital Education Outlook 2023*, interoperability chapter: systems that cannot share data create extra data entry and slow/error-prone processing; institutions collect information that is hard to use for decisions | It is not speculative that disconnected education systems can impair efficient workflow and actionable information | Not a measured count of disconnected applications at Melsoft Academy, nor proof that most South African educators have this exact tooling issue. |
| Trust, accountability and AI assurance | UNESCO *Guidance for generative AI in education and research* (2023, web update 2026): human-centred educational validation, privacy, inclusion and appropriate oversight | Unchecked AI outputs and personal data governance matter in education | Does not mean every AI output is wrong or that agents are independently trustworthy. |

**Primary source URLs and date notes**

1. OECD South Africa TALIS 2024 country note: https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html
2. OECD on the General Education Certificate and TIMSS Grade 9: https://www.oecd.org/en/publications/consolidating-the-general-education-certificate-in-south-africa_06154f19-en/full-report/component-3.html
3. DBE official bilingual education rollout: https://www.education.gov.za/Programmes/MTbBE.aspx
4. OECD digital ecosystem interoperability: https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/interoperability-unifying-and-maximising-data-reuse-within-digital-education-ecosystems_660f8da1.html
5. UNESCO generative AI education guidance: https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research
6. UNESCO *Languages matter*: https://www.unesco.org/en/articles/new-unesco-guidance-calls-multilingual-education-unlock-learning-and-inclusion
7. Colleague Zero organiser / five criteria: https://hackathon-26.melsoft.org/

**Evidence discipline:** The first four findings support relevance. The causal hypothesis that a goal-to-execution multi-agent engine will save time, improve reliability or learning outcomes **remains untested**. OECD's interoperability discussion is general, not a prevalence estimate for a particular South African academy.

## G01-P05 — The unifying problem mechanism

**Task-to-outcome friction** across five stages:
1. **Understand:** user request may be vague, incomplete, multilingual, urgent or unfamiliar.
2. **Gather:** evidence lives in documents, workbooks, policy sites, emails, LMSs or disconnected systems; permissions and data quality vary.
3. **Decide:** prioritise and assign work, account for trade-offs and learning needs; decide whether to ask, plan, perform or stop.
4. **Execute:** produce concrete materials, organise timetables, prepare/draft communications and update authorized records, often across formats.
5. **Verify/close:** independently check mathematics and claims, repair errors, get human approval where required and prove outputs/actions actually exist.

No single workflow topology suits every goal. This is the **generic product hypothesis** under test, not a claim that current T.A.C.E code performs these steps.

## G01-P06 — How seven kinds of user goals instantiate ONE problem

| User's natural request | Specific manifestation of the same root problem | What successful assistance could mean |
| --- | --- | --- |
| "I've got piles of marking" | Assessment work consumes educator time and has accuracy/consistency demands | Rubric-based review plan, checked summaries, teacher-approved feedback drafts, workbook |
| "Why are the learners struggling with algebra?" | Assessment evidence is hard to interpret and turn into targeted support | Skill-gap map, grounded intervention draft, verified answer key, follow-ups |
| "Make this in isiZulu and English" | Learners need a comprehensible, accessible presentation | Parallel-language documents, glossary, accessible resources, explicit fluent-review status |
| "Our training cohort is falling behind" | Schedule, learning support and staff capacity interact | Feasible mentor schedule, prioritized support plans, actual saved records and approval queue |
| "A teacher is absent; reorganise classes" | A live constraint change invalidates plans in several tools | Updated conflict-free timetable and change report |
| "These teaching sources contradict one another" | Unreliable evidence and plausible AI errors undermine trust | Source comparison, accepted/unknown claims, corrected deliverables and repair ledger |
| "Prepare admissions or learner opportunity paperwork" | Rules, deadlines and records must become accurate, permissioned action | Evidence checklist, prepared documents, task reminders, carefully scoped action proposals |

These examples do **not** define fixed prompt categories. A prompt may combine several or introduce a new one. Task scope, agents, tools and output formats follow the outcome and constraints, not a keyword classifier.

## G01-P07 — Scope and beneficiaries

**Primary actor for judged demo:** educator, trainer, school/academy coordinator.  
**Beneficiaries:** learners, instructional staff, institutions and families where communication is authorized.  
**Education competitors/alternatives:** manual work using Word/Excel/email and existing LMS, conventional automation, one general AI chatbot and specialised education tools. The value claim must prove improvement over a fair baseline; do not assume agents are always superior.

**T.A.C.E product scope:** domain-agnostic **any-goal intake and feasibility**; first domain pack is education. Input may be text/API payload and attached or connector-discovered resources. The intention can mention any file format, but **only actually supported, safely processed formats can be read or generated**. Unsupported or unavailable formats must be refused or converted through a verified capability, never silently misread.

## G01-P08 — Solution hypothesis (separate from the problem)

> T.A.C.E will aim to turn diverse natural-language goals into authorised, verifiable finished work by discovering available sources and capabilities, selecting appropriately sized specialist workflows, executing through real tools and applications, independently checking results, seeking human approval when necessary, and providing evidence of completion.

This is not part of the public problem statement. It is the product's **hypothesis to test** against the problem.

## G01-P09 — What would prove the problem/solution fit?

Use realistic **synthetic** cases and document baseline-vs-T.A.C.E measurement. Before claiming improvements, collect:
- **Teacher/coordinator user validation:** 3–5 consenting adult testers representing intended roles; task interviews before showing solution; note whether problem resonates and how currently handled.
- **Time to verified outcome:** elapsed minutes for task, separated into human time and compute time; compare against a fair manual/standard-tools baseline.
- **Correctness:** workbook formula/reconciliation pass rate, curriculum reference correctness, independent education reviewer acceptance and false-positive rates.
- **Work completeness:** deliverable files created/read-back, verified tool receipts, external send vs draft clearly separated.
- **Decision quality:** resource constraints met, late-change replan correct, unnecessary agent/call avoidance.
- **Trust:** counted errors detected, corrected, unresolved and rejected; high-stakes actions always gated.
- **Access:** language review by fluent educator, keyboard/low-data fallback when claimed.
- **Cost:** actual compute/provider usage, calls, and no unsupported cost savings claim.

**No measured time saved, improved achievement, learner retention, actual stakeholder interviews or deployment is claimed here.**

## G01-P10 — Judges' fit

Official Colleague Zero requirements are **REASONS, SELF-CORRECTS, EXECUTES, COLLABORATES, SERVES EDUCATION**. The problem needs to be a clear real education challenge, and the product proof must include actual coordinated work, not merely a well-written plan. https://hackathon-26.melsoft.org/

A practical demo hypothesis: **a single Education Recovery Mission** addressing instructor workload, support gaps and language access with output workbook, evidence-backed intervention PDF, reviewed bilingual drafts, local schedule and communications drafts. A staff change forces a real replan; a seeded factual or scheduling error triggers a real independent validation/repair loop. A tiny contrasting request produces a minimal graph.

**No flagship approved yet.** Education Recovery Mission is a candidate, not the only possible application or a fixed template.

## G01-P11 — Approval questions to close G01

- [ ] Does the primary problem statement sound like the challenge a real educator/coordinator reports, in their own words?
- [ ] Is the specific competition persona and environment appropriate without claiming access to Melsoft's private software or user data?
- [ ] Is the source-to-action bottleneck measurable against a baseline?
- [ ] Which small and complex educational goals will prove different execution strategies?
- [ ] Which exact authorized files/connectors and formats will be supported in the demo?
- [ ] What first-goal acceptance tests and error/correction fixture will be run?
- [ ] What education expert/stakeholder feedback and validation can be obtained?
- [x] Problem statement wording approved in ADR-0003; full G01 acceptance is still separate.

**Status:** Problem statement wording APPROVED in ADR-0003; the larger G01 architecture and demonstration acceptance are still IN_RESEARCH. G02 BLOCKED.


## G01-P12 — The fourth problem: fragmented information, tools and decision flow (source-backed)

**The missing fourth piece is interoperability and coordination:** an educator's goal can require reading a syllabus, checking an Excel mark sheet, reviewing a student-support record, finding an official curriculum reference, drafting a Word document and preparing a calendar/email action. The source data and tools may be separated by file format, application, access role or incomplete synchronization. Even when the information exists, combining it and *acting correctly* can require many manual steps.

OECD's *Digital Education Outlook 2023* explains that insufficient interoperability between educational tools can lead to duplicate data entry, error-prone data exchange, wasted staff time and difficulty turning collected data into decisions. **That is general evidence of a known education systems problem; it is not a finding about Melsoft Academy's private software stack or a measured prevalence rate for South Africa.**

**Source:** [OECD, Interoperability: unifying and maximising data reuse within digital education ecosystems (2023)](https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/interoperability-unifying-and-maximising-data-reuse-within-digital-education-ecosystems_660f8da1.html).

The product problem is not "schools need another AI chatbot." It is that **information, resources and intentions do not reliably translate into coordinated, completed and verifiable work.**

## G01-P13 — Why failure to address the problem matters

The following **downstream risks are inferences requiring institution-specific testing**, not percentages or conclusions proved by the workload, TIMSS or interoperability research:

| Unresolved issue | Plausible human / operational consequence | How we could verify the consequence |
| --- | --- | --- |
| Marking/administration volume | Less staff capacity for prompt, personalized support; stress, after-hours work or delayed feedback | teacher time logs; actual feedback cycle time; interviews |
| Learning difficulties not turned into action | Repeated misconceptions and slower intervention, with learners continuing to struggle | days from assessment to support; independently reviewed work |
| Inaccessible language/format | Content remains harder to understand or participate in for some learners | comprehension/user tests; fluent educator and accessibility review |
| Duplicate manual cross-system work | Staff repeat entries, transcribe errors, miss updates or struggle to reconcile records | duplicate-action counts; error ledger; before/after process observation |
| Changing timetables/staff capacity | Resource clashes, postponed sessions and incomplete follow-ups | constraint feasibility tests; missed-session records |
| Unchecked educational or AI-generated claims | Incorrect answer keys, flawed learning resources and diminished trust in the output | independent expert review; validator false-negative rate; correction audit |
| Missed deadlines or inconsistent communication | Learners miss timely opportunities or receive confusing updates | documented workflow/notification outcomes, not estimated savings |

**Careful causal claim:** The approved statement says these conditions create *risk* of delayed or ill-matched support. It does not claim that all South African education outcomes are caused by admin work or that an agentic system can automatically prevent them.

## G01-P14 — The research problem versus our proposed solution

| Question | Status | Statement |
| --- | --- | --- |
| What is the observed problem? | **RESEARCH-BACKED** | Workload and stress, serious learning gaps, language access needs, and digital interoperability challenges are supported by official evidence |
| What links the different user goals? | **PROBLEM SYNTHESIS / PRODUCT INFERENCE** | The recurring *information-to-action gap*: turning facts and intentions into timely, personalized, reliable completed work |
| What are the consequences? | **PLAUSIBLE RISKS, NOT MEASURED CAUSATION** | Delay, duplication, inconsistent support, preventable mistakes and resource pressure |
| What might solve part of it? | **PROPOSED SOLUTION** | A universal goal-to-verified-outcome system, with dynamically selected specialists, real connectors, approvals and independent checks |
| Does T.A.C.E solve it yet? | **NOT ESTABLISHED** | The universal runtime and these benefits have not been demonstrated in this research gate |
| What would prove it? | **ACCEPTANCE HYPOTHESES** | Measured time to verified outcome, correctness, file and API receipts, replan under constraint, human approval fidelity, user testing and cost |

Avoid turning the general interoperability evidence into a specific factual claim that Melsoft Academy uses a particular LMS or office suite. The connectors listed in G01 are possibilities, not confirmed connections.

## G01-P15 — Accepted wording, approved scope and editable architecture

The user has approved **both the formal and simple problem statements**, along with the concise spoken pitch. Their exact approved text is preserved in [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md). The full problem-to-goal architecture is specified in [G01 Problem Architecture](GATE-01-PROBLEM-ARCHITECTURE.md).

- [**Figma FigJam — live editable architecture, evidence and consequence diagrams**](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi)
- [**diagrams.net — editable six-plus-page architecture source**](../../diagrams/TACE-Architecture.drawio)
- [**G01 universal task-family catalogue**](GATE-01-UNIVERSAL-TASK-CATALOGUE.md)
- [**G01 connector capability and authorization contract**](GATE-01-CONNECTOR-CAPABILITIES.md)

**Approved:** problem wording, simple relatable version, the fourth interoperability strand as a researched theme, and preservation of clear research/hypothesis boundaries. **Still open:** exact example actors, dataset, education flagship, goal-envelope schema, technical coverage and objective test cases.

A user can **request** arbitrary file formats, but reading and exporting must be limited to actual safely supported/validated capabilities. No undocumented app or account access is presumed.
