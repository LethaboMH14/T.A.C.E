# ADR-0008 — First runtime slice: Node.js, built-in SQLite ledger, deterministic workers

**Status:** PROPOSED (design) · IMPLEMENTATION IN PROGRESS on `feat/mission-engine` · NOT VERIFIED
**Date:** 2026-11-13

## Decision

Build the first end-to-end mission in plain Node.js ES modules with no third-party dependencies:

- **Runtime:** Node ≥ 22.13 `.mjs` + JSDoc types, tested with `node --test`. It matches the existing G01/G02 code, and a fresh clone needs no install step.
- **Ledger:** `node:sqlite` (built into Node) with an append-only `seq`, mirrored line by line to `events.jsonl` for the UI.
- **Contracts:** `engine/contracts.mjs` (event types, run statuses, artifact/check/handoff shapes).
- **Goal intake:** unchanged accepted modules. Each scenario's goal proposal is validated by `tools/gate02/normalize-turn.mjs` and `tools/gate02/goal-proposal.mjs` before any planning. The validated `deliverables` drive the planner. The proposal is still not an authorization.
- **Workers:** deterministic code (analyst, interventions, scheduler, writer) registered as capabilities. They are **not** language models and are never described as such.
- **Reviewer:** a separate module that never imports worker code. It re-opens the saved files and recomputes from the raw sources.
- **Repair:** targeted changes to the failed artifact only, written as a new version (v1 kept), followed by a re-run of the tasks downstream of the repaired artifact and a fresh independent review. The budget is 2 rounds. After that the run is `PARTIAL`.
- **Faults for the demo** are visible flags in the scenario files (`inject`). They are never hidden UI animations.

## Alternatives considered

| Option | Why not now |
|---|---|
| Python + FastAPI + Pydantic + LangGraph | Second language beside existing `.mjs`; install step; hours matter |
| LangGraph JS | Dependency weight; our graph is small and must be inspectable |
| `csv-parse` package | Zero-dependency goal; a small tested parser with formula-cell escaping is enough |
| OR-Tools for scheduling | 36 learners × 3 mentors is solved exactly enough by a deterministic greedy pass with checks |
| TypeScript build | Adds a build step; JSDoc gives editor types without one |

## Consequences

- The deck's "Node/TypeScript" label must read "Node.js".
- An LLM goal reader can be added later behind the same G02.02 validator. Until then, no model call exists in the runtime.
- No auth, tenant layer, real connectors or sending exist. Synthetic data only.

## Acceptance

`npm test` passes from a clean clone. `npm run demo:inject_overlap` writes v1 and v2 schedules, and `events.jsonl` shows `VERIFICATION_FAILED → REPAIR_SCHEDULED → ARTIFACT_REPAIRED → VERIFICATION_PASSED`.
