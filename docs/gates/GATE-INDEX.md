# T.A.C.E numbered gate registry — v1.0

**Date:** 2026-11-10. **Product scope:** universal goal-to-execution engine; **judged deployment:** adaptable education domain pack with task families and optional app/API connectors.

| Gate | Name | Current state | Exit artifact |
| --- | --- | --- | --- |
| G01 | **Universal Goal Boundary + EdTech Proof Case** | **DESIGN_COMPLETE** | accepted goal classes, output semantics, authority, objective proof, selected EdTech case |
| G02 | Prompt Engineering and Adaptive Clarification | **IN_RESEARCH** | structured goal interpretation and clarity contract |
| G03 | Context Engineering and Retrieval | BLOCKED | trusted context compiler / evidence scopes |
| G04 | Skill, Tool and Agent Capability Planning | BLOCKED | feasible dynamic roster / task DAG |
| G05 | Graph Orchestration, State and Recovery | BLOCKED | validated dependencies, retries, stop/ask policy |
| G06 | Swarm Communications and Handoffs | BLOCKED | typed agent messages and parallelism |
| G07 | Bounded Tools, API Actions and Permissions | BLOCKED | action receipts, approvals, verified side effects |
| G08 | Short- and Long-Term Memory | BLOCKED | provenance- and access-scoped memory lifecycle |
| G09 | Independent Review and Self-Correction | BLOCKED | validation/revision evidence |
| G10 | Editable Mission Console and Visualization | BLOCKED | reliable event-backed graph editor and artifact panel |
| G11 | Evaluation, Privacy and Operational Safety | BLOCKED | benchmark and negative-test evidence |
| G12 | End-to-End Integration and Judged Delivery | BLOCKED | deployed verified education outcome |

## Item numbering

- Gate: **G01**; items: **G01.01–G01.15**.
- Decision: **G01-D01**; source: **G01-S01**; test: **G01-T01**; output: **G01-O01**.
- Every item has a formal scope, owner, inputs/outputs, alternatives, dependencies, tests and approval gate in the detailed dossier.
- **Status sequence:** OPEN → IN_RESEARCH → REVIEWED → APPROVED → IMPLEMENTED → VERIFIED. Blocked later gates remain conceptual placeholders. Decisions changing earlier design create a superseding ADR.

## Links

- [G01 revised detailed research](GATE-01-EDUCATION-GOAL.md)
- [G01 judge alignment](GATE-01-judge-alignment.md)
- [Original v0.1 education research preserved](../archive/GATE-01-EDUCATION-GOAL-v0.1.md)
- [Scope decision ADR-0002](../decisions/ADR-0002-universal-engine-education-demo.md)
- [Editable architecture map](../../diagrams/TACE-Architecture.drawio)

**G01 design scope completed under ADR-0004; G02 research is now open. No runtime and no impact/security claim.**


## Gate 01 detailed work streams

- [Seven adaptive education task families, varied inputs and outputs](GATE-01-UNIVERSAL-TASK-CATALOGUE.md)
- [Application connectors, authorization and capability checks](GATE-01-CONNECTOR-CAPABILITIES.md)
- [Editable architecture and connector maps](../../diagrams/TACE-Architecture.drawio)
- **Explicitly excluded from this design track:** KAIRO reuse. The separate historical review is not an approved dependency.

**Decision recorded:** Education Recovery Mission selected as bounded synthetic *reference fixture* (not a fixed engine domain); exact connectors, test fixture bytes, implementation and measured outcomes remain pending. G02 research is open.


## G01 researched problem definition

[Primary umbrella education problem statement and source audit](GATE-01-PROBLEM-STATEMENT.md) describes the information-to-action gap across educators, programmes and learners without hardcoding any single task. Sources and proof metrics are explicit; no time savings, human interviews or educational improvement have yet been established. **Status: formal/simple problem wording APPROVED (ADR-0003); the G01 design is complete; runtime, security and impact evidence remain pending.**


## G01 design completion and G02 handoff

- [ADR-0004 design signoff](../decisions/ADR-0004-g01-requirements-signoff-and-g02-handoff.md) and [full requirement spec](GATE-01-FINAL-SPECIFICATION.md)
- [Impact measurement — pending empirically](GATE-01-IMPACT-EVALUATION-PLAN.md) / [issue #5](https://github.com/LethaboMH14/T.A.C.E/issues/5)
- [Security threats and POPIA boundaries](GATE-01-SECURITY-THREAT-MODEL.md) / [implementation issue #4](https://github.com/LethaboMH14/T.A.C.E/issues/4)
- [48 edge cases](GATE-01-EDGE-CASE-MATRIX.md) with implementation and test assignments
- [16 passing local goal admission tests](../checks/G01-BOUNDARY-TEST-20261110.md); tests and source in [tools/gate01](../../tools/gate01/)
- [G02 in-research charter](GATE-02-INTENT-AND-CLARIFICATION-RESEARCH.md) / [issue #3](https://github.com/LethaboMH14/T.A.C.E/issues/3)

**Design is not production approval: runtime G07 security, G09 correctness, G11 evaluation and G12 full integration remain pending.**


## Gate 02 subsection states — 2026-11-10

- **G02.01: DESIGN_ACCEPTED** by explicit owner approval in [ADR-0005](../decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md); hardened v0.2 unit spike verified [54/54](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42867607839). Not production acceptance.
- **G02.02: IN_RESEARCH / PROPOSED** — [goal schema and candidate DAG dossier](GATE-02-02-GOAL-SCHEMA-AND-DECOMPOSITION.md), [ADR-0006](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md), schema, validator, [142/142 combined deterministic tests](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42870978038), [Figma architecture](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2). Owner review pending; no G02.03 work started.
- **G02.03–G02.15: BLOCKED** pending numbered review and approval. G02 overall stays IN_RESEARCH; G07/G11 production security and evaluation remain pending.


### G02.02 critical review — 2026-11-10

**G02.02 remains PROPOSED / owner review pending.** Hardened `g02-goal-proposal-v0.2` adds per-subgoal effect/capability/source mapping, orphan-DAG rejection, expected evidence, Unicode/schema alignment, canonical intake fingerprint and full snapshot revision checks. [ADR-0006](../decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md), [dossier](GATE-02-02-GOAL-SCHEMA-AND-DECOMPOSITION.md), [editable Figma page 05](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=11-2). [Verified CI](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42882371606): **197 pass, 0 fail, 0 skipped** (143 G02.02 + 54 G02.01). G02.03 remains BLOCKED pending explicit v0.2 design approval; no production claims.
