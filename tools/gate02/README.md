# Gate 02.01 — deterministic intake research spike

**Status:** Proposed design; deterministic code/tests only. This is NOT a deployed intent interpreter, authentication middleware, parser, permission system, agent or memory store.

From repo root:

~~~bash
node --test tools/gate02/normalize-turn.test.mjs
~~~

Files:
- normalize-turn.mjs: preserve raw goal, derive NFC/LF interpretation view, locale and time-zone hints, untrusted source references, simple revision-lineage check.
- normalize-turn.test.mjs: 54 deterministic tests of text preservation, Unicode, mixed languages, invalid fields, source trust and revision handling.
- [Research and test plan](../../docs/gates/GATE-02-01-INPUT-NORMALIZATION.md)
- [Proposed decision ADR-0005](../../docs/decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md)

**Security limits:** The trusted parameter is a caller-supplied test fixture, NOT authenticated by this module. No real server, OAuth, source parsing, user data, learner records, external sends or approvals are implemented. Raw goal text may be sensitive: do not log it in production. The module does not decide semantic corrections, whether the user really speaks the locale, or whether an app is connected.

**Evidence:** GitHub Actions run 42867607839 verified success with 54/54 tests. A green unit suite proves only the explicitly tested branches, not prompt injection resilience, semantic goal comprehension, real tenant isolation or POPIA compliance.

**Design integration note:** G01 goal-boundary spike currently supports a narrower constraints shape. Future typed G02/G07 integration must reconcile the interface and require server-attested turn metadata before the execution boundary. Do not silently modify G01 approved requirements or claim a production contract.


## v0.2 critical review and verified CI

54 deterministic Node tests now pass in GitHub Actions: https://github.com/LethaboMH14/T.A.C.E/actions/runs/42867607839 (commit 4c41e29ba4862b23a8e2443b42052b4208626ca4). The original README's 22-test count is superseded.

The revised prototype adds goalId and revision lineage, plain-data-only validation, explicit-null rejection, Unicode/UTF-8 limits, bounded opaque handles, budgetHint and an allowlisted projectForInterpreter() view without internal rawGoal, identity fields or source handles. The interpretation text still may contain sensitive information.

No actual authentication, atomic compare-and-swap, secure parser, source ownership, prompt-injection resistance, data retention or LLM accuracy is established.


## G02.02 — outcome-first candidate proposal research spike

**Status:** PROPOSED / OWNER REVIEW PENDING. G02.01 design is accepted, but G02.02 is not yet approved.

- `goal-proposal.schema.json`: versioned provider-neutral JSON Schema 2020-12 proposal shape; not a runtime authority.
- `goal-proposal.mjs`: deterministic validation of bounded candidate outcomes, DAG acyclicity, source slots, acceptance criteria, claimed effects and revision consistency; returns no approval.
- `goal-proposal.test.mjs`: **88** negative and positive deterministic tests, including JSON Schema structural drift spot-checks.
- `.github/workflows/gate02-proposal.yml`: runs both suites; [GitHub Actions run 42870978038](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42870978038) passed **142/142 tests** (54 intake + 88 proposal), 0 failures, 0 skipped, on commit `11cdbe7e34f1c3a412fcffd602edd7f350cbb79f`.
- [G02.02 dossier](../../docs/gates/GATE-02-02-GOAL-SCHEMA-AND-DECOMPOSITION.md) and [ADR-0006](../../docs/decisions/ADR-0006-g02-02-goal-proposal-and-candidate-dag.md).

**Do not overclaim:** No LLM interpreter, independent full JSON Schema engine, real authentication, tool registry, effect enforcement, secure source resolution, privacy controls, executable graph or measured semantic accuracy is included.
