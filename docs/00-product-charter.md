# 00 — Product charter

**Status:** Proposal for design review. **Version:** 0.1. **Date:** 2026-11-10.

> **v0.2 scope refinement — ADR-0002:** T.A.C.E is a domain-agnostic goal-to-execution engine. Education examples below are proposed Colleague Zero deployments, not a general engine restriction. Gate 01 now defines any-goal boundaries, completion and capability semantics; Gate 02 will define adaptive prompt interpretation only after G01 approval. See [Gate 01](gates/GATE-01-EDUCATION-GOAL.md).

## Product intent

T.A.C.E will be a domain-agnostic autonomous goal-to-execution engine, demonstrated first as an education-focused digital colleague. Its visible value is **finished, verified educational work**. The user provides an outcome, not a sequence of steps. The colleague must interpret it, locate relevant materials, choose agents, produce an action plan, use tools, check work, repair mistakes, and deliver artifacts with evidence. It must not claim it completed an action it merely recommended or drafted.

### Sample north-star request

"Identify which learners need support using this class assessment and attendance data, then prepare evidence-based catch-up plans, teacher-reviewable contact drafts and scheduled follow-up tasks."

**Reference demo dataset:** 12 fictional learners, a small synthetic assessment table, synthetic attendance records, a curriculum document and a teacher policy document. Do not include personal records of actual minors.

### Provisional user and value proposition

- **Primary user candidate:** teacher or academic programme coordinator.
- **Primary pain:** reconciling multiple information sources, choosing differentiated educational actions, documenting rationale, and following through is laborious and inconsistent.
- **Outcome:** reproducible intervention package, not only chat advice.
- **Other candidate workflows:** lesson + assessment generation; syllabus-aligned resource preparation; accessible student support; academic administration workflows.
- **PRODUCT DECISION NEEDED:** select one flagship use case before coding. Learner success is an evidence-based proposal, **not locked**.

## User journey

1. User states goal or chooses a workflow template.
2. Intent layer extracts outcome, stakeholders, constraints, permission limits and completion tests.
3. Clarification gate asks the minimum high-impact questions only if necessary (multiple choice + Other). Defaults are visible, reversible and safe.
4. User can review the GoalContract; the graph plans subtasks and the capability roster.
5. Agents work against contextual sources while the live mission view shows real statuses, evidence and failures.
6. Reviewer checks curriculum references, policy rules, completeness and contradictions; rejected work is repaired under a strict retry budget.
7. Tool layer writes approved files/records and prepares but does not send sensitive communication without an explicit approval.
8. User receives downloadable artifacts, an evidence ledger, outstanding approvals and verified completion states.
9. Memory curator proposes only supported reusable information for permitted persistence.

## Outcome objects for proposed flagship

- per-learner risk evidence summary with source IDs and uncertainty;
- differentiated learning-support plan grounded in the supplied curriculum;
- draft teacher/guardian communications, awaiting approval;
- follow-up tasks in a demo task calendar/record store;
- one summary report and an evidence/provenance ledger;
- trace of at least one rejected, corrected and re-verified recommendation.

## Non-goals for hackathon

- general-purpose agent marketplace or dozens of permanent agents;
- production student-risk prediction or automated educational decisions;
- auto-publishing grades, disciplinary actions or sensitive messages;
- training a new foundation model;
- integration with real learners' accounts, private LMS records or personal data;
- uncontrolled browser, shell or GitHub actions;
- falsely simulated model progress presented as live execution.

## Hard acceptance conditions

- A goal is converted to a machine-valid contract; unsupported assumptions are exposed.
- A real graph run records node, agent, tool, source and artifact events.
- At least two specialist tasks can be shown collaborating; where independent, they overlap.
- At least one error is detected by a meaningful verifier and repaired (not a hard-coded success animation).
- A tangible artifact is persisted and can be reopened/downloaded.
- Completion claims are derived from tool acknowledgements and acceptance tests.
- A teacher approves any consequential communication or grade changes; no real data is used.
- A failed tool/agent either retries safely within budget or fails explicitly.

## Competition mapping

| Criterion | Required evidence |
| --- | --- |
| It reasons | GoalContract, task DAG, explicit next-action decision and explanation |
| It self-corrects | rejected recommendation, evidence-based critique, repair and successful recheck |
| It executes | files/records created and persisted; reopen proof |
| It collaborates | distinct specialists, typed handoffs, dependency-aware parallelism |
| It serves education | concrete learner/teacher outcome tied to curricular evidence |

## Questions to close

1. Product-facing name and T.A.C.E expansion, if any.
2. One approved flagship workflow, target user and exact input/output boundary.
3. Privacy/permission policy for a demo vs future institutional use.
4. Deployment surface: local demo, hosted demo, or both.