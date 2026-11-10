# Gate 02.01 — deterministic intake research spike

**Status:** Proposed design; deterministic code/tests only. This is NOT a deployed intent interpreter, authentication middleware, parser, permission system, agent or memory store.

From repo root:

~~~bash
node --test tools/gate02/normalize-turn.test.mjs
~~~

Files:
- normalize-turn.mjs: preserve raw goal, derive NFC/LF interpretation view, locale and time-zone hints, untrusted source references, simple revision-lineage check.
- normalize-turn.test.mjs: 22 deterministic tests of text preservation, Unicode, mixed languages, invalid fields, source trust and revision handling.
- [Research and test plan](../../docs/gates/GATE-02-01-INPUT-NORMALIZATION.md)
- [Proposed decision ADR-0005](../../docs/decisions/ADR-0005-g02-01-normalization-and-turn-precedence.md)

**Security limits:** The trusted parameter is a caller-supplied test fixture, NOT authenticated by this module. No real server, OAuth, source parsing, user data, learner records, external sends or approvals are implemented. Raw goal text may be sensitive: do not log it in production. The module does not decide semantic corrections, whether the user really speaks the locale, or whether an app is connected.

**Evidence:** CI status must be verified separately. A green unit suite proves only the explicitly tested branches, not prompt injection resilience, semantic goal comprehension, real tenant isolation or POPIA compliance.

**Design integration note:** G01 goal-boundary spike currently supports a narrower constraints shape. Future typed G02/G07 integration must reconcile the interface and require server-attested turn metadata before the execution boundary. Do not silently modify G01 approved requirements or claim a production contract.
