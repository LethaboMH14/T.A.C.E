# ADR-0003 — Approve the education problem statement, not the full Gate 01 architecture

**Decision date:** 2026-11-10
**Decision status:** **ACCEPTED — problem statement wording and scope only**
**Gate 01 status:** **IN_RESEARCH**; Gate 02 remains **BLOCKED**
**Authority:** Explicit user approval: "I approve problem statements" on 2026-11-10
**Relationship:** Complements [ADR-0002](ADR-0002-universal-engine-education-demo.md), which keeps T.A.C.E domain-agnostic and education as its first judged deployment. This decision excludes KAIRO reuse.

## Decision

### 1. APPROVED — Formal primary education problem statement (verbatim)

> **Educators and training providers are expected to do more than teach. They must assess learning, identify difficulties, adapt materials, coordinate support and manage communication—often under significant time and resource constraints.**
>
> **When these responsibilities require information from different documents, systems and people, turning evidence into useful action becomes time-consuming and difficult to coordinate. The result is pressure on educators and a risk that learners do not receive the right support at the right time, in a form they can understand.**

### 2. APPROVED — Simple, human-centred statement (verbatim)

> A teacher may know that learners need help, but still have dozens of assessments to review, lessons to prepare and reports to complete. A learner may need extra support, but the right material, explanation or intervention does not always reach them when it matters. The challenge is not just finding information—it's turning that information into the right action.

### 3. APPROVED — Concise spoken pitch (verbatim)

> Teachers are overwhelmed, learners need targeted support, and the information needed to help them is often scattered across people, documents and systems. Turning that information into timely, trustworthy action is the challenge.

These exact texts are **accepted baseline wording**. Changes require an explicit dated amendment; ordinary refinement of supporting research must not silently rewrite them.

## Four evidence-backed problem strands

| Strand | Grounded indicator | Source and boundary |
| --- | --- | --- |
| Teacher workload | Among South African lower-secondary teachers surveyed in OECD TALIS 2024: 72% report too much marking as significant stress; 66% report too much administrative work; full-time respondents report 7.1 h/week marking and 4.9 h/week administration | [OECD South Africa TALIS 2024](https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html). Work categories may overlap, not a claim of additive hours saved. |
| Learning gaps and need for interventions | 55% of assessed South African Grade 9 learners did not achieve the lowest TIMSS 2023 Mathematics international benchmark | [OECD South Africa GEC review](https://www.oecd.org/en/publications/consolidating-the-general-education-certificate-in-south-africa_06154f19-en/full-report/component-3.html). Not an exam failure rate or an individual learner diagnosis. |
| Language access | DBE's mother-tongue-based bilingual education strategy supports Mathematics, Science and Technology instruction in home languages alongside English | [DBE 2026/27 Annual Performance Plan](https://www.education.gov.za/Portals/0/Documents/Publications/2026/ATP/DBE%20APP%202026.27%20Final%20for%20Tabling.pdf?ver=2026-04-10-105100-000). Does not validate machine translation accuracy. |
| **Fourth piece: fragmented information and systems** | OECD finds lack of interoperability can lead to repeated data entry, slow/error-prone manual data linking and difficulty using school data for decisions | [OECD Digital Education Outlook 2023 — Interoperability](https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/interoperability-unifying-and-maximising-data-reuse-within-digital-education-ecosystems_660f8da1.html). General education-system evidence, **not** a measured claim about Melsoft Academy's software. |

## Consequences and downstream risks (proposed inferences, NOT direct causal measurements)

If these challenges remain unresolved, plausible risks include: reduced time for individual teaching and feedback; delays between spotting learning needs and delivering support; widening differences in access for learners needing alternative language/format; duplicated coordination effort; inconsistent or stale teaching/grade communications; schedule bottlenecks and missed deadlines; errors propagated through multiple documents or systems; and weaker trust when unchecked machine-generated material looks authoritative.

These are **reasonable product-impact hypotheses**, not proof that these outcomes happened to a given school, or that T.A.C.E will prevent them. Each requires its own evaluation design and stakeholder evidence.

## Separate the problem from the proposed answer

- **Research problem (approved):** workload, learning gaps, language barriers and fragmented information-to-action work.
- **Solution hypothesis (NOT empirically validated):** a domain-neutral, goal-to-verified-outcome engine can choose proportional agents/tools, discover permitted files/apps, plan and execute tasks, independently check outputs and get approval for consequential actions.
- **Proof obligations (not complete):** fair manual/standard-tools comparison; successful varied prompts; real deliverable receipts, source/correctness checks, repair tests, human approval checks; actual time/cost/user-benefit measurements.

## Gate and architecture consequences

The approved problem applies to a diverse set of education request families (not hardcoded prompts): marking/admin relief, assessment-to-support, bilingual materials, cohort rescue, continuity, learning-truth auditing and opportunity administration. The goal may have any text/API shape and *request* any input/output format, but only validated parsers/exporters and authenticated connectors can execute. This ADR **does not** approve a specific flagship goal, grade, dataset, connector, model, orchestration algorithm, external account access, user interface or claim of real implementation.

**Architecture references:** [G01 problem architecture](../gates/GATE-01-PROBLEM-ARCHITECTURE.md), [G01 core gate](../gates/GATE-01-EDUCATION-GOAL.md), [FigJam board](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi), [editable diagrams.net map](../../diagrams/TACE-Architecture.drawio).

**Gate exit remains open:** actor/persona selection, educational demonstration acceptance, GoalContract precision, source/format support boundaries, risk and privacy, capability checks, evaluation plan, and subsequent approval.
