# 05 — BobSwarm lineage and reuse boundary

**Reference project:** https://github.com/Sibusiso-K/Sonar-BobSwarm-
**Files inspected:** README, docs/architecture.md, orchestrator/system_prompt.md, orchestrator/decompose.js, .bob/skills/bobswarm/SKILL.md, docs/CRITICAL_DECISIONS.md and docs/FINAL_SUBMISSION_REPORT.md.
**Review date:** 2026-11-10.

## Evidenced BobSwarm design

- A React/TypeScript/Vite dashboard created runs and showed an event-backed agent lifecycle.
- A separate IBM Bob custom mode used native spawn_subagent to execute specialist analysis.
- A human copied a generated run ID/prompt from the UI into Bob; the dashboard did **not** directly launch Bob.
- Explicit specialist roles: Debugger, Documenter, Onboarding, Data Lineage, Refactorer.
- Debugger, Documenter, Onboarding and Data Lineage could run concurrently; Refactorer waited for Debugger when both were selected.
- An MCP server exposed bounded Git/filesystem/progress/finding tools; evidence-backed findings and deterministic reporting were a core feature.
- The repository's final submission report distinguished recorded performance figures from other experiments. Do not transfer those figures to T.A.C.E or claim they were reproduced here.

## Reuse decisions

| BobSwarm concept | T.A.C.E treatment | Why |
| --- | --- | --- |
| Explicit agent personas | **Adapt** into a capability registry | tasks should select role by ability, not fixed keyword list |
| Independent parallel subagents | **Keep the principle** | visible collaboration and efficiency |
| Dependency-aware refactoring | **Generalize** to a DAG | arbitrary workflow dependencies |
| MCP-scoped source tools | **Keep design pattern** | bounded, traceable action interface |
| Literal-evidence findings | **Extend** to source IDs, versions and receipt verification | trust and correctability |
| Deterministic final report | **Extend** into artifact and outcome verification | actual work completion |
| WebSocket run visualisation | **Reimagine** as Mission Console | show graph, correction, approvals, deliverables |
| Run UUID and event sequencing | **Keep the concept** | replayable authoritative progress |
| Human copy/paste to IBM Bob | **Replace** | T.A.C.E controls its own execution from the app |
| Keyword router | **Replace** with contract-aware semantic planning + typed DAG | robust handling of broader goals |
| In-memory run storage | **Replace** with persisted checkpoints | resume and memory |
| Developer-audit specialty | **Replace** for competition demo with educational outcome | Colleague Zero alignment |

## Intellectual property and implementation

The BobSwarm GitHub repository was publicly accessible but did not declare a repository license in inspected metadata. Public visibility is not permission to copy source. T.A.C.E's MIT license covers original code here; it does not relicense someone else's work. Reproduce **ideas/design principles**, use permissively licensed external packages under their notices, and obtain permission before importing source files from BobSwarm or its frontend.

## Distinction to demonstrate

BobSwarm goal: analyze a developer repository and produce a structured report.
T.A.C.E goal: independently own an educational outcome, work through validated context, create authorized artifacts, detect and correct its mistakes, verify persistence and retain only justified memory.

**Do not claim T.A.C.E is already an autonomous product.** The current commit is architecture documentation only.