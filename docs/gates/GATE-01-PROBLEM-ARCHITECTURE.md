# Gate 01 — Problem-to-goal architecture and evidence boundary

**Version:** 0.1 — 2026-11-10  
**Gate status:** IN_RESEARCH  
**Problem wording status:** APPROVED by user, ADR-0003  
**Scope:** General T.A.C.E goal-to-execution engine; education domain is a judged use case. **No KAIRO dependency.**  
**Visuals:** [Editable FigJam G01 board](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi) and [multi-page diagrams.net source](../../diagrams/TACE-Architecture.drawio).

## 0. The architecture already exists, but is a DESIGN, not a running implementation

Core G01 sections G01.01–G01.15 are the architecture baseline, supplemented by G01.16–G01.22 for adaptive educational requests and connectors. The approved problem wording is ADR-0003. This document connects them in a single diagrammatic contract; it does **not** replace downstream G02–G12 or approve their algorithms.

## 1. G01 architecture at a glance

~~~mermaid
flowchart TD
  A["Observed needs: teacher load + learning gaps + language access + fragmented tools"] --> B["Approved umbrella problem and consequences"]
  B --> C["G01 Goal intake: any natural-language or API goal"]
  C --> D["Inputs: files, pasted content, approved connected apps, public resources or no data"]
  D --> E["Goal boundary / feasibility envelope"]
  E --> F{"Can execution proceed within available info and authority?"}
  F -->|"No essential data"| G["Ask one targeted clarification or produce labelled partial template"]
  F -->|"Unsupported file/tool"| H["Report capability blocker; offer safe alternative"]
  F -->|"Yes"| I["Outcome contract: actor, goal, constraints, requested deliverables, success, authority"]
  I --> J["G02–G09: interpret, context, specialist/tool routing, graph/state, communication, execution, memory, review"]
  J --> K["G10 mission console shows real graph, agent handoffs, files and approvals"]
  K --> L["G11–G12 measured evaluation and delivered education proof"]
~~~

Nodes in G02–G12 are **future responsibility boundaries**, not finished features.

## 2. G01 layers and why they exist

| Layer | Specific responsibility in Gate 01 | Related existing numbered sections | What must be accepted to exit G01 |
| --- | --- | --- | --- |
| 01 Evidence and consequences | Distinguish primary research from hypothesis; define who is affected and what happens if the problem persists | ADR-0003; problem statement G01-P01–P11 | Sources, denominators, inference labels; approved wordings |
| 02 Any-goal intake | Accept natural language and API requests without hard-coded education templates | G01.01–02 | Example goals incl. rephrasings and mixed domains |
| 03 Actor, domain and constraints | Identify who requests an action, relevant school/academy context, deadline and intended beneficiary | G01.03, .05 | Responsibility, authorization and safe defaults |
| 04 Evidence/input boundary | Any user-supplied file can be offered for supported-type detection; sources may come from connected accounts/public evidence | G01.04, .06, .14, .16–22 | Unsupported formats and unauthorized connectors fail honestly |
| 05 Outcome contract | Formalize success evidence, artifact formats, external actions, minimal/complex topology requirements | G01.02, .04, .07–09, .14 | Stable draft goal schema with verifiable acceptance predicates |
| 06 Education examples | Seven goal families, flagship candidates, synthetic fixtures and simple-vs-complex demonstrations | G01.10–12, .16–22 | Flagship and contrasting tasks objectively selected |
| 07 Consequence/risk gate | Data privacy, no fabricated learner marks, language review, human approvals, no fake send receipts | G01.05–06, .08, .15 | Documented stop/ask/approve boundaries |
| 08 Downstream mappings | Link G01 contracts to G02 prompting, G03 context, G04 registry, G05 graph, G06 handoffs, G07 tool API, G08 memory, G09 review, G10 UX, G11 eval, G12 demonstration | All gates | Handoff contracts without pretending these gates are already implemented |

## 3. What a GoalBoundary/GoalEnvelope will need (illustrative only)

~~~json
{
  "goalId": "server-issued",
  "request": {
    "rawGoal": "Our fictional training cohort needs targeted bilingual support and a feasible Friday schedule",
    "source": "web-ui-or-api",
    "actorRole": "teacher-or-coordinator"
  },
  "context": {
    "attachments": ["optional-upload-hashes"],
    "connectedSources": ["optional-authorized-source-ref"],
    "publicResearchAllowed": true,
    "missingEssentialFacts": []
  },
  "outcomes": [
    {"kind": "workbook", "verification": "reconciled-rows-and-math"},
    {"kind": "document", "verification": "citations-and-required-sections"},
    {"kind": "calendar-proposal", "verification": "no-resource-conflicts"}
  ],
  "authority": {
    "canReadAuthorizedInputs": true,
    "canDraft": true,
    "requiresHumanApprovalFor": ["grades", "sending", "scheduling-external-meetings"]
  },
  "boundary": {
    "status": "PROPOSED",
    "unknowns": [],
    "constraints": ["time", "cost", "privacy", "capabilities"],
    "unsupportedActions": []
  }
}
~~~

This is a *draft product requirement*, not the definitive G02 parsed schema or G07 runnable payload. Client input must not be allowed to assert server-side role or auth.

## 4. Evidence and risk path

Evidence claim -> source URL, study date, sample/denominator -> approved problem statement -> downstream risk (label as inferred) -> task opportunity -> proposed intervention -> evaluation oracle.

- Workload: OECD TALIS metrics establish work pressure; teacher time reduction must be separately tested.
- Assessment: TIMSS findings establish broad learning needs; per-learner gap analysis requires authorized assessment records.
- Language: DBE establishes a policy focus; bilingual material requires fluent domain review before treating accuracy as verified.
- Interoperability: OECD establishes multi-system inefficiency in many education contexts; actual academy integrations need discovery, credentials and a confirmed technical environment.
- All education data is high care. Use synthetic fixtures for demos, tenant isolation and human review of consequential decisions.

## 5. Adaptive scenarios and outputs

| Goal | Evidence needed | Right-sized work topology | Verifiable output |
| --- | --- | --- | --- |
| "Convert this syllabus to an organized table" | Uploaded syllabus or authorized source | Parser, structured extraction, checker (possibly deterministic only) | CSV/XLSX opens and matches source |
| "Help teachers reduce marking work" | Rubric and sample answer set, or partial template only | Rubric analyst, consistency reviewer, teacher approval | Reviewed draft marks, feedback docs, exception queue |
| "Identify learning gaps" | Assessment item-to-skill map, score evidence | Evidence analyst, instructional specialist, reviewer | Corrected intervention plan and worksheets |
| "Create bilingual accessible materials" | Reviewed source, language and verified reviewer | Source/a11y specialists, translator draft, human language review | Bilingual DOCX/HTML with review status |
| "Replan because a mentor is absent" | Schedule, mentor constraints, room and deadlines | Constraint solve + support-planning + independent validator | Conflict-free proposal and change report |
| "Our academy is in recovery mode" | Authorized synthetic cohort, staff, calendars, curriculum | Parallel specialists, dynamic graph, review/repair, approval | Workbook, plan, timetable, comms drafts, receipts |
| "Check this AI-produced exam" | Approved source, syllabus, rubric | Independent fact/math checker + correction | Review ledger with accepted/rejected claims |

A user may combine families or write novel goals. Capability discovery decides if the product can comply; all formats are only **requested** until tested capabilities confirm actual reading/writing.

## 6. Gate 01 quality and closure criteria

1. Both formal and simple approved problem statements are stored **verbatim** under ADR-0003 (complete).
2. Evidence is reproducible and accurately attributed, and inferred consequences are flagged (documented; data freshness review remains).
3. G01 diagrams are editable in both **FigJam** and **diagrams.net** (visual documentation, not the eventual live execution UI).
4. Goal intake supports the principle of no mandatory attachments and no mandatory app connections; missing essential data stops or clarifies (design criterion).
5. One minimal and one complex goal have distinct test acceptance and permission boundaries (still to select).
6. The flagship education case is selected and evaluated against hackathon criteria (still pending).
7. G01 exact final API schema and authority map are signed off as scoped *requirements* (not yet).
8. Full G01 status is marked accepted **only after** these open conditions are met. G02 detailed design remains blocked until then.

## 7. Board vs application

FigJam diagrams and diagrams.net are authoring artifacts for researchers and developers. The future **Mission Console** graph in the actual product must be live, backed by an event store, and permission-checked if a user rearranges task nodes. Nothing in these diagrams is evidence that the runtime has been implemented.

## 8. References

- [OECD TALIS 2024 South Africa](https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html)
- [OECD GEC review and TIMSS Grade 9](https://www.oecd.org/en/publications/consolidating-the-general-education-certificate-in-south-africa_06154f19-en/full-report/component-3.html)
- [DBE 2026/27 MTbBE programme](https://www.education.gov.za/Portals/0/Documents/Publications/2026/ATP/DBE%20APP%202026.27%20Final%20for%20Tabling.pdf?ver=2026-04-10-105100-000)
- [OECD Digital Education Outlook 2023 — Interoperability](https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/interoperability-unifying-and-maximising-data-reuse-within-digital-education-ecosystems_660f8da1.html)
- [UNESCO on generative AI in education](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research)
- [Colleague Zero](https://hackathon-26.melsoft.org/)
