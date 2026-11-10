# T.A.C.E numbered gate registry — v0.2

**Date:** 2026-11-10. **Product scope:** universal goal-to-execution engine; **judged deployment:** adaptable education domain pack with task families and optional app/API connectors.

| Gate | Name | Current state | Exit artifact |
| --- | --- | --- | --- |
| G01 | **Universal Goal Boundary + EdTech Proof Case** | **IN_RESEARCH** | accepted goal classes, output semantics, authority, objective proof, selected EdTech case |
| G02 | Prompt Engineering and Adaptive Clarification | BLOCKED | structured goal interpretation and clarity contract |
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

**G01 remains IN_RESEARCH. Do not begin G02 detailed design until the goal boundary and an EdTech flagship are formally reviewed and approved.**


## Gate 01 detailed work streams

- [Seven adaptive education task families, varied inputs and outputs](GATE-01-UNIVERSAL-TASK-CATALOGUE.md)
- [Application connectors, authorization and capability checks](GATE-01-CONNECTOR-CAPABILITIES.md)
- [Editable architecture and connector maps](../../diagrams/TACE-Architecture.drawio)
- **Explicitly excluded from this design track:** KAIRO reuse. The separate historical review is not an approved dependency.

**Decision still open:** select one competition flagship, supported integrations, exact test fixtures and observable metrics. G02 remains blocked.


## G01 researched problem definition

[Primary umbrella education problem statement and source audit](GATE-01-PROBLEM-STATEMENT.md) describes the information-to-action gap across educators, programmes and learners without hardcoding any single task. Sources and proof metrics are explicit; no time savings, human interviews or educational improvement have yet been established. **Status: formal/simple problem wording APPROVED (ADR-0003); the overall G01 gate is still IN_RESEARCH.**
