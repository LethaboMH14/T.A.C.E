# T.A.C.E — Numbered gate registry

**Last reviewed:** 2026-11-10. **Protocol:** only one gate is under active deep review at a time.

| Gate | Formal title | Status | Dependency | Gate output |
| --- | --- | --- | --- | --- |
| G01 | Education Goal & Product Outcome | **IN_RESEARCH** | none | approved job, user, inputs, outputs and educational success criteria |
| G02 | Prompt Engineering & Intent Contract | BLOCKED | G01 approved | validated goal contract and ambiguity policy |
| G03 | Context Engineering & Evidence Retrieval | BLOCKED | G02 approved | trusted source context compiler |
| G04 | Capability Planning & Agent Registry | BLOCKED | G03 approved | verified typed task DAG and roster |
| G05 | Graph Runtime, State & Recovery | BLOCKED | G04 approved | transition and checkpoint model |
| G06 | Swarm, Role Protocols & Handoffs | BLOCKED | G05 approved | role contracts, dependencies and parallelism |
| G07 | Tool/Action Engineering & Permissions | BLOCKED | G06 approved | bounded adapters, receipts, approvals |
| G08 | Memory Lifecycle & Knowledge Governance | BLOCKED | G07 approved | scoped working/episodic/semantic/procedural memory |
| G09 | Independent Verification & Self-Correction | BLOCKED | G08 approved | validators, review and bounded repair |
| G10 | Mission Console & User Experience | BLOCKED | G09 approved | traceable workflow and artifact UI |
| G11 | Evaluation, Security, Privacy & Operations | BLOCKED | G10 approved | reproducible safety and quality evaluation |
| G12 | Integrated Educational Outcome & Delivery | BLOCKED | G11 approved | verified end-to-end demo and evidence |

**Gate states:** NOT_STARTED → RESEARCH → DRAFTED → REVIEWED → APPROVED → IMPLEMENTED → VERIFIED. A gate can be BLOCKED; later evidence can return it to REVIEW without overwriting prior decisions.

## Numbering convention

- **G01** = gate.
- **G01.01** = first research/design item within the gate; **G01.12** = approval and handoff.
- **G01-D01** = gate-specific design decision, to be recorded in an ADR.
- **G01-T01** = test/acceptance case.
- **G01-S01** = evidence/source record.
- **G01-O01** = output artifact.
- Link every implementation file, test, design element and acceptance note to its gate and item ID.

## Gate documents

- [G01 research dossier](GATE-01-EDUCATION-GOAL.md)
- [Editable diagram source](../../diagrams/TACE-Architecture.drawio) — two pages: 00 overview and 01 education goal
- [Overview Mermaid diagram](../../diagrams/TACE-system-gates.mmd)
- [Detailed G01 Mermaid diagram](../../diagrams/GATE-01-education-goal.mmd)

**Progress policy:** never start G02 design until G01 has been explicitly approved and ADR-0002 is committed. High-level placeholder names on the overview are navigation, not specifications.
