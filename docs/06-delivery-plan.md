# 06 — Engineering delivery plan and judging proof

**Status:** Proposed implementation order. Not scheduled autonomous work.

## Two parallel tracks

**Track A — Engine / control plane:** contract schemas, planner, graph, context tools, policy/permissions, fixture-backed execution and tests.

**Track B — Experience / evidence:** Mission Console, real event stream, evidence/artifact browser, approval controls, sample datasets, demo tests and repository presentation.

Share a versioned API and event envelope first so the two tracks can proceed without interface drift.

## Sequence

### Stage 0: product and contracts

- Decide flagship educational workflow, target actor, input documents and required artifact set.
- Finalize GoalContract, RunState, TaskNode, handoff, Evidence and ToolReceipt schemas.
- Set clear test fixtures and success conditions.
- Confirm external component licenses and hosting/inference capability.

### Stage 1: single vertical slice

- Submit one teacher goal → parse and validate contract.
- Dispatch one task graph that reads synthetic data and persists one plan.
- Display actual backend events and allow persisted artifact download.
- Verify reload/replay; add error and permission handling.

### Stage 2: dynamic swarm and context

- Planner builds 2–4 dependency-aware tasks from capability registry.
- Assessment and curriculum specialists gather distinct information.
- Intervention specialist consumes typed handoff; every claim links to evidence.
- Test context poisoning and untrusted content isolation.

### Stage 3: self-repair and human control

- Inject a synthetic curriculum mismatch in one proposed intervention.
- Independent reviewer flags specific mismatch against trusted curriculum fixture.
- Repair node re-queries evidence, edits only affected plan, and re-verifies.
- Keep messages in draft state until explicit teacher approval.
- Avoid external notification calls in the demo.

### Stage 4: harden and present

- Add run recovery, idempotency tests, cancellation and error states.
- Record real evaluation results and compare single-agent baseline.
- Write honest README and demonstration runbook; rehearse live and offline fallback paths.

## Suggested demo narrative (only claim what has actually run)

1. Teacher requests an outcome; show interpreted GoalContract and minimal clarification.
2. Approve contract; show generated DAG and specialists selected for this task.
3. Run real data and curriculum analyses, with live events and evidence.
4. Reviewer rejects a flawed recommendation with an explicit source mismatch; show loop to repair.
5. Verify corrected recommendation and persist plans, task records and approval-gated message drafts.
6. Reload dashboard and reopen artifacts and audit trail; show completion tests passed.
7. Explain next steps without claiming unbuilt features.

## Test matrix

| Test | Passing condition |
| --- | --- |
| Ambiguous ask | targeted clarification only if a missing choice changes the action |
| Complete ask | no mandatory questionnaire |
| Malicious curriculum excerpt | cannot override system/tool policy |
| Broken source link | claim marked uncertain; no fake citation |
| Worker timeout | fail/retry within max budget, visible state |
| Broken tool receipt | final result not marked delivered |
| Reviewer detects mismatch | structured critique with exact failed criterion |
| Repair | wrong recommendation replaced; cited source verifies |
| Replay | no duplicate follow-up tasks or messages |
| Approval | no external send/change without explicit authorized approval |
| Reload | authoritative snapshot and events rebuild run state |
| Data scope | synthetic data only; cross-tenant retrieval refused |

## Metrics to collect, not invent

- task completion rate across a fixed number of real runs;
- acceptance-check pass rate and evidence-backed claim proportion;
- number of corrections actually found/repaired;
- end-to-end latency, model calls and tool calls;
- invalid schema and tool-error rate;
- zero unauthorized effects and zero cross-scope memory retrieval.

## Competition schedule / priority

Colleague Zero event visuals provided in conversation show Saturday 14 November 2026 final presentations at 12:00, judging deliberation at 13:00 and winner announcement at 14:00 (SAST). Before implementation, reconfirm official submission rules/deadline from organizer material; do not infer that presentation time equals repository submission deadline.

## Fallback

If a provider or document parser fails, use a previously **genuinely recorded** test trace labeled as a recording; never play fabricated events as if live. The deterministic synthetic fixture runner should still demonstrate true graph transitions, tool writes, checks and provenance with no paid service dependency.