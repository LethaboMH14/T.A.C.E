# Decision register — authoritative review state

**Updated:** 2026-11-10. Change decisions through a dated ADR; never erase reasoning.

| ID | Topic | Status | Basis / next action |
| --- | --- | --- | --- |
| D-001 | **Universal outcome-owning execution engine; EdTech first judged deployment** | LOCKED scope principle | ADR-0002 supersedes education-only interpretation of ADR-0001 |
| D-002 | Intent → GoalContract → context → dynamic DAG/swarm → execute/check/repair/deliver | LOCKED principle | ADR-0001 |
| D-003 | Adaptive, risk-based clarification rather than mandatory questionnaire | LOCKED principle | ADR-0001 |
| D-004 | Graph/state/policy control over agent choices and tool effects | LOCKED principle | ADR-0001 |
| D-005 | Role-limited tools, evidence, approval and bounded repair | LOCKED principle | ADR-0001 |
| D-006 | Governed short-/long-term memory, source- and tenant-scoped | LOCKED principle | ADR-0001 |
| D-007 | Final project name and expansion of T.A.C.E | OPEN | user/team decision; do not invent expansion |
| D-008 | EdTech flagship may use learner support, lesson production or academy operations | PROPOSED | No single education demo yet approved; G01 active |
| D-009 | FastAPI + Python LangGraph | PROPOSED | prototype graph/checkpoint feasibility before locking |
| D-010 | React/TypeScript/Vite Mission Console | PROPOSED | verify reuse rights; approve UX flows |
| D-011 | SQLite demo, PostgreSQL+pgvector later | PROPOSED | measure actual retrieval/data complexity |
| D-012 | Context Compiler retrieval/reranking and memory storage | PROPOSED | design and evaluate per role |
| D-013 | Inference provider/model and actual cost budget | OPEN | verify quota, reliability, local hardware and output validity |
| D-014 | External actions and institutional integrations | OPEN | demo remains synthetic/draft-only pending authorization |
| D-015 | BobSwarm implementation source reuse | RESTRICTED | no declared license observed; ideas only until permissions confirmed |
| D-016 | Step-by-step component review/ADRs as project protocol | LOCKED principle | ADR-0001 |
| D-017 | Demo metric targets and performance claims | OPEN | derive from real tests, never assume |
| D-018 | No fixed swarm; proportional topology and goal-dependent outputs | LOCKED principle | ADR-0002 |
| D-019 | Dynamic skills require validation, permissions and sandbox review before use | LOCKED principle | ADR-0002 |
| D-020 | Any goal can be interpreted, but unsupported or unauthorized execution must be declined or partial | LOCKED principle | ADR-0002 |
| D-021 | Editable graph visualization / agent event console | PROPOSED | Detailed UI review is G10 |
| D-022 | API-first goal intake and execution | LOCKED objective, schemas still OPEN | ADR-0002 |
| D-023 | Education domain pack accepts diverse natural-language task families, not fixed commands | LOCKED product direction; evaluation OPEN | G01.16–G01.22 task catalogue |
| D-024 | Connectors are dynamically discovered, capability-checked and least-privilege; not presumed installed | LOCKED product principle; implementation OPEN | G01 connector policy |
| D-025 | KAIRO reuse is explicitly excluded from current competition design | LOCKED user direction | Gate 01 v0.3 |
| D-026 | Combined Education Recovery mission | PROPOSED, NOT SELECTED | compare vs simpler options and event feasibility |

| D-027 | Formal, simple and spoken problem statement wording | **APPROVED** | ADR-0003; wording frozen 2026-11-10 |
| D-028 | Fourth problem: interoperability as source-backed theme, associated risks labelled as hypotheses | **APPROVED research framing** | OECD Digital Education Outlook 2023; ADR-0003 |
| D-029 | Gate 01 architecture and education proof requirements | **DESIGN_COMPLETE** | ADR-0004, G01 final spec; implementation pending |
| D-030 | Editable FigJam G01 evidence, impact and architecture diagrams | **DOCUMENTED** | https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi |

| D-031 | G01 impact hypotheses, baseline metrics and honesty boundary | **DESIGN_ACCEPTED, EMPIRICAL_PENDING** | G01 impact plan; issue #5 |
| D-032 | G01 20-risk security threat model, POPIA/child-data, exact approval policy | **DESIGN_ACCEPTED, IMPLEMENTATION_PENDING** | G01 threat model; issue #4 |
| D-033 | G01 48 edge/adversarial case suite and explicit completion taxonomy | **DESIGN_ACCEPTED, TESTS_PENDING** | G01 edge matrix; issue #4 |
| D-034 | G01 universal outcome boundary and Education Recovery Mission reference fixture | **DESIGN_ACCEPTED** | ADR-0004 and G01 final spec |
| D-035 | G01 fail-closed boundary spike, local 16/16 tests | **LIMITED TESTED PROTOTYPE** | tools/gate01; no auth or effects |
| D-036 | Gate 02 prompt/intent/clarification research may begin | **IN_RESEARCH** | G02 charter and issue #3 |
| D-037 | G02.01 hardened dual-text intake, server goal lineage and restricted interpreter view | **DESIGN_ACCEPTED / RUNTIME_PENDING** | Owner approval ADR-0005; 54/54 deterministic tests verified |
| D-038 | G02.02 strict versioned goal proposal, candidate DAG, source slots and uncertainty/effect claims | **PROPOSED / USER_REVIEW_PENDING** | ADR-0006; 142/142 combined deterministic tests; G07 security pending |

## Review rule

**First session:** Product goal/use case and actor, then Intent/Prompt Engineering. For each section: define purpose → inputs/outputs → algorithms and tools → safety/failure handling → cross-system interactions → tests → ADR → next section.

## Change template

- Date / proposed change:
- Current decision and evidence:
- Alternatives and trade-offs:
- Impacted schemas, nodes, tools, security, tests, cost:
- New test evidence:
- Decision: ACCEPTED / REJECTED / DEFERRED:
- Link to superseding ADR or PR: