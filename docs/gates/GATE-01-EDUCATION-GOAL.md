# GATE 01 — Universal Goal Boundary and Education Proof Case

**Version:** v0.2, 2026-11-10  
**Status:** IN RESEARCH — not approved  
**Scope decision:** [ADR-0002](../decisions/ADR-0002-universal-engine-education-demo.md)  
**Previous education-first research:** [Archived v0.1](../archive/GATE-01-EDUCATION-GOAL-v0.1.md)

## North star

T.A.C.E is a **domain-agnostic, API-first, goal-to-verified-outcome engine**. It should accept a user's natural-language objective without forcing one predefined kind of task. It determines, within actual capability, permission, safety, time and budget constraints, whether the outcome requires one worker, a multi-agent swarm, research, tools, approvals, a dynamic graph and a particular output modality.

**Colleague Zero exception:** the **demonstration** must solve a *specific, real educational problem*. Education is a domain pack and judging proof case, not the only domain the underlying engine can serve. The goal can be broad; the **execution claim cannot exceed validated capabilities**.

## G01.01 — Incoming goals and interfaces

Potential inputs include natural language, structured JSON/API requests, files and authorized workspace resources. The goal may request a concise answer, analysis, CSV, PDF, DOCX, data transformation, architecture diagram, editable project, presentation, video, source code, schedule, or multi-step external action. It can be educational, HR-related, engineering-related, business-related or not yet classified.

**Acceptance != execution.** An unsupported or insufficiently authorized goal must produce a bounded status/next action, not pretend a skill/tool/media capability exists.

## G01.02 — Job-to-be-done and outcome ownership

The mechanism's job is to turn an initial outcome into a **measurable completion contract**, decide whether/how to act, work safely and return verified artifacts or transparent blockers. It is not a universal answer chatbot and not a static sequence automation. Its reasoned actions and termination criteria must differ across user goals.

## G01.03 — Who, domain and environment

Actor: role, authority, workspace, language and relevant context; domain: explicit, inferred or unknown. Unknown domain is not automatically a reason to reject the prompt, but ambiguity that changes permission, tooling or evaluation must be resolved before execution. Domain packs supply **policies, terminology, source connectors, skill references, test rubrics and output templates**, not an entirely separate orchestrator.

## G01.04 — Output and action modalities

For each goal, define target outputs, quality criteria, format, persistence and authorized destination. Possible formats: table, CSV/JSON, document/PDF, code, graph/diagram, multimedia asset or an external side effect. Model claims ("I made a video", "I sent an email") do not count; the required tool must run and produce a verifiable artifact/receipt.

## G01.05 — Autonomy boundary

Modes proposed: ANALYSE_ONLY, PLAN, DRAFT, EXECUTE_WITHIN_SCOPE and ASK_APPROVAL_FOR_EFFECTS. These are user preferences bounded by system policy. High-impact actions such as modifying formal marks, sending communications to real learners, changing external records, spending money or deploying sensitive code require explicit authorization. Unknown permission is a **halt**, not a licence to guess.

## G01.06 — Capability feasibility and tool/skill discovery

The goal boundary must distinguish **what is requested** from **what tools, models, rights, sources and skills actually exist**. A later capability planner may select existing trusted skills, propose new skills or model/tool adapters, and ask for approval to connect services. Agents may draft a role skill but must **not auto-execute untrusted generated code, install arbitrary packages, mint credentials, or self-grant access**. Proposed skills need schema checks, test fixtures, permission validation, versioning and sandbox evaluation. Fine-tuning an LLM for each goal is not a practical default; use contextual evidence and permitted tools first, and only study fine-tuning after measured recurring errors and licensed data.

## G01.07 — Complexity and right-sized team

| Initial goal | Illustrative topology | Verified outcome |
| --- | --- | --- |
| "Summarise this syllabus in a table" | one model or deterministic conversion; no swarm | table/CSV with source references |
| "Make a CAPS-aligned lesson and worksheet" | curriculum retriever -> lesson composer -> answer-key validator | curriculum-grounded documents |
| "Analyse this assessment and prepare learner support" | assessment + curriculum agents in parallel -> intervention specialist -> independent reviewer -> tool executor | reviewed plans, follow-up records, saved files |
| "Send outcomes to learners" | above + human authorization gate for external messages | signed-off, logged action or explicitly pending approval |
| "Make a video" with no media service | feasibility failure or storyboard-only partial | no fake finished video |

The planner algorithms belong to G04/G05, not G01. These are **illustrations**, not implementation or benchmarks.

## G01.08 — What defines a successful goal?

Goal-specific pass criteria: (1) requested outcome and intended beneficiaries; (2) allowed source/permission boundary; (3) target artifacts/actions; (4) objective tests; (5) persistence/tool receipts; (6) uncertainty handling; (7) stop/ask/retry thresholds. Complete states include DELIVERED, APPROVAL_REQUIRED, NEEDS_INPUT, PARTIAL_ONLY, UNSUPPORTED, FAILED, CANCELLED. Merely generating text does not prove an external task was executed.

## G01.09 — Dynamic graph and communication expectations

Some jobs should end after one small validation, others require research -> parallel specialists -> merge -> reviewer -> correction loop -> tool call -> read-back verification. A later graph engine chooses nodes dynamically and enforces dependencies and bounded retries; agents exchange **typed messages, artifact references and evidence**, not an unbounded all-to-all monologue.

## G01.10 — Education as the first specialized deployment

Educational domains include classroom curriculum and assessment, university operations, facilitator support, accessibility, career guidance and academy cohort management. A domain pack is composed of verified resources, educational quality checks, access rules and optional output tools. **We must pick one** flagship educational result for judges to see completed; this is not the engine's only possible work.

## G01.11 — Potential flagship EdTech goals (research, not approved)

- **A: Learning-support operations.** Synthetic diagnostic responses -> evidence-based gap map -> teacher-reviewed interventions -> local follow-up tasks. Strong demonstration of multi-agent dependencies and tool execution.
- **B: Curriculum production.** Curriculum + goal -> lesson, worksheets and validated answer key. Simpler and highly demonstrable but can resemble generic document generation.
- **C: Academy cohort operations.** Synthetic learner progress + training targets -> skill-gap reports, targeted schedules, draft interventions and proof of saved records. Strong possible Melsoft relevance but needs realistic fixture.
- **D: Accessibility and language.** Transform authorized source material into accessible, multilingual learning assets with genuine quality checks. Valuable but raises evaluation and modality complexity.

**Research recommendation:** A is the leading *complex live example*, paired with a much smaller contrasting educational request. C may align with vocational training. We have not locked any option.

## G01.12 — Official criteria and judge/company signals

The official Colleague Zero rules: **reasons, self-corrects, executes, collaborates, serves education**; the FAQ requires an EdTech problem, and judging presentation requires a live demo and correction explanation: https://hackathon-26.melsoft.org/.

Melsoft Academy public site emphasizes practical career-ready training and learner support: https://www.melsoftacademy.com/. Otinga, linked to judge Francois van der Merwe, emphasizes practical measurable outcomes: https://otinga.io/about/. Vambo AI, linked to judge Chido Dzinotyiwei, emphasizes African language access: https://vambo.ai/about.

**Important:** Organiser criteria are official. Specific judges' private preferences are unknown; conclusions inferred from their public work should not be represented as scoring rules. See [research memo](GATE-01-judge-alignment.md).

## G01.13 — Dashboard design boundary (concept only)

- **Left:** active agent/model roles, reasons selected, genuine events, specialist-to-specialist handoff records, structured critiques and tool receipts; no fabricated hidden reasoning.
- **Middle:** **node-based graph editor** (React Flow / XYFlow proposed), moveable nodes, typed edges, live state, dynamic branches, retries and approval barriers. User edits must validate through the execution graph before activation.
- **Right:** goal contract, source evidence, artifact previews/downloads, completion checks, approval/clarification controls.
- **Top:** natural language goal entry, workflow mode, scope, cost/time status.

Editable visual workflow and runtime workflow must share IDs and source-of-truth state. Design implementation belongs in G10.

## G01.14 — API-first goal envelope (illustrative, not final schema)

~~~json
{
  "goal_text": "Create an assessed Grade 8 maths lesson and worksheet",
  "actor": {"role": "teacher", "workspace_id": "demo_education"},
  "domain_hint": null,
  "input_refs": ["file:curriculum.pdf"],
  "desired_outputs": [{"kind": "worksheet", "format": "pdf"}],
  "autonomy_preference": "execute_within_scope",
  "constraints": {"audience": "Grade 8"},
  "permissions": {"send_external_messages": false},
  "success_evidence": ["valid_pdf", "correct_answers", "curriculum_anchor"]
}
~~~

Detailed intent parsing, clarification generation, confidence calibration and structured master-prompt conversion are **G02**, explicitly NOT yet designed or approved.

## G01.15 — Decision and gate closure requirements

- [ ] Clearly distinguish generic engine from education deployment.
- [ ] Approve possible goal and output classes and capability boundary.
- [ ] Approve actor, impact and authorization policy.
- [ ] Specify stop/partial/unsupported semantics.
- [ ] Formalize expected outcome and evidence/receipt semantics.
- [ ] Compare at least three education task sizes and required topology.
- [ ] Select ONE complete EdTech flagship with exact user, fixture, artifacts and quality tests.
- [ ] Show a distinct small educational task as evidence of right-sized planning.
- [ ] Specify what constitutes true correction and full completion.
- [ ] Define a user validation/education-expert review path.
- [ ] Record a future G01 approval ADR and update registry; **ADR-0002 approves scope, not this gate**.

**Current status: IN_RESEARCH. G02 BLOCKED.**

## Sources

- Hackathon official: https://hackathon-26.melsoft.org/
- Academy: https://www.melsoftacademy.com/
- Otinga: https://otinga.io/about/
- Vambo: https://vambo.ai/about
- LangGraph dynamic state: https://langchain-ai.github.io/langgraph/how-tos/multi-agent-network/
- LangGraph interrupts: https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/interrupts.mdx
- React Flow: https://reactflow.dev/
- MCP tool security: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx


## G01.16–G01.22 — Goal-adaptive education families and integration scope (v0.3 clarification)

This gate is **NOT an educational task router with fixed prompt strings**. T.A.C.E must interpret goals across workload reduction, learning-gap intervention, multilingual access, academy cohort rescue, learning continuity, evidence auditing and access/careers operations, including unexpected combinations and previously unseen phrasings. Each should produce different evidence needs, graph topology, specialists, outputs, tool effects and end conditions. Missing files and unavailable app connections must lead to minimal clarification, trusted public sources or honest partial results—not invented facts.

- [Detailed seven task-family catalogue, multiple rephrasings, sample topologies and a high-impact combined mission](GATE-01-UNIVERSAL-TASK-CATALOGUE.md)
- [Excel, Word, Gmail, Outlook, Google Workspace, Classroom, Moodle, calendar and custom-API capability contracts](GATE-01-CONNECTOR-CAPABILITIES.md)
- [Editable visual gate and integration maps](../../diagrams/TACE-Architecture.drawio)

The user explicitly chose **not** to integrate KAIRO into this direction. Existing KAIRO research remains historical and is not an accepted product dependency.

**Important distinction:** education is the first competition *domain*, not a restriction on the universal engine. No one candidate—Cohort Rescue, Continuity, Learning Recovery or a combined mission—is the approved flagship. G01 remains IN_RESEARCH; G02 remains BLOCKED.


## G01 Problem Statement — task-to-outcome gap (2026-11-10)

**Recommended umbrella problem statement:** Educators and training providers are expected to assess learning, identify difficulties, adapt materials, coordinate support and manage communication under time/resource constraints. When the work crosses multiple documents, systems and people, turning evidence into timely, reliable action becomes expensive in effort and difficult to coordinate. Educators experience pressure and learners risk delayed or inadequately tailored support, including language access barriers.

**Evidence versus hypothesis:** OECD TALIS 2024 South Africa directly measures reported marking and admin workload; OECD's 2026 General Education Certificate review cites Grade 9 Mathematics benchmark gaps; DBE MTbBE documents language-access needs; OECD's Digital Education Outlook documents fragmented digital tools and inefficient manual data interchange. That T.A.C.E improves outcomes is **a testable hypothesis, not an established result**.

See [the full evidence-backed problem statement, public pitch variants, mappings to all seven goal families, input/file/connector boundaries, and proof metrics](GATE-01-PROBLEM-STATEMENT.md). **Any requested file format may be presented for feasibility inspection; only formats actually supported by validated tools can be ingested/exported, and connected accounts require explicit authorization.** G01 remains IN_RESEARCH.


## G01 Approved Problem Definition, Consequences and Architecture (2026-11-10)

**Formal and simple problem wording is approved** by the user and preserved exactly in [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md). The [source-backed problem dossier](GATE-01-PROBLEM-STATEMENT.md) now explicitly connects teacher workload, learning needs, language access and interoperability to plausible **risk-labelled** downstream consequences, separately from T.A.C.E's untested solution hypothesis. The [Gate 01 problem-to-goal architecture](GATE-01-PROBLEM-ARCHITECTURE.md) maps evidence and actors to any-goal intake, file/connector permission boundaries, an illustrative outcome envelope and successor gate responsibilities. [Editable FigJam](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi) and [editable diagrams.net source](../../diagrams/TACE-Architecture.drawio) are the visual source maps.

**IMPORTANT:** This approval concerns **problem framing**, not the full Gate 01 completion. User has not yet selected a final flagship, data fixtures, authenticated connections or specific acceptance tests. G01 remains IN_RESEARCH; G02 BLOCKED.
