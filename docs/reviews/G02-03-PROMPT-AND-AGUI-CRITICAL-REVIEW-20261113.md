# T.A.C.E G02.03 and AG-UI parallel critical review

**Review date:** 2026-11-13
**Branch / review:** [Draft PR #8](https://github.com/LethaboMH14/T.A.C.E/pull/8) (`review/g02-03-agui-next-20261112`)
**Status:** CHANGES IMPLEMENTED; DETERMINISTIC CI VERIFIED; ADR-0007 **PROPOSED / OWNER DESIGN REVIEW PENDING**.
**Boundaries:** G02.01 and G02.02 design accepted previously; G02.03 not accepted. G02.04 policy not implemented or approved. AG-UI/OpenDots/OpenBot adoption remains evaluation-only.

## Verified results on review branch

- [G02.01–G02.03 check, run 43126625179](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625179): **241 passed / 0 failed / 0 skipped** = 54 intake + 143 goal proposal + **44 G02.03 prompt assembly**.
- [UI/AG-UI check, run 43126625949](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625949): **48 passed / 0 failed / 0 skipped** = 30 event adapter + **18 guided-wizard state and candidate-contract**.
- In that AG-UI run, official pinned [AG-UI 1.0 schema](../../tools/integrations/agui/vendor/ag-ui-1.0.schema.json) accepted **3 emitted positive events** and rejected **4 negative events**. This is concrete offline envelope-level conformance, **not** an official SDK test, complete frontend integration or external service run.
- Browser UI module passed `node --check`; the HTML and CSS are source files and have not been exercised through a full browser-automation/accessibility suite.

## Critical weaknesses found and changes made

| ID | Severity | Original weakness | Change in draft PR #8 | Evidence / limitation |
|---|---|---|---|---|
| A01 | High | `assemblePrompt()` claimed `authenticated_user_goal_as_data` in model-visible payload, while its intake is a caller-supplied fixture | Correct label to `unverified_user_goal_task_data` | A35. No real authentication |
| A02 | High | Assembler accepted additional intake properties and potentially inconsistent raw/NFC or Unicode flags | Require expected normalized intake keys and validate exact flags, proper UTF-16, source references | A36–A44. Not a network parser |
| A03 | High | Duplicate fake source handles could pass assembled message intake after manual mutation | Explicit duplicate source validation | A37. No actual tenant-scoped ownership check |
| A04 | Medium | No independent standard protocol evaluation for emitted AG-UI events | Vendor pinned upstream spec and license; use JSON Schema 2020-12 validator in CI | 3 valid and 4 invalid events. Still not full AG-UI SDK |
| A05 | Medium | No runnable multiple-choice interface to exercise planned user flow | Added responsive semantic HTML/CSS/JS wizard with Back, Other, review, copied JSON and local event trace | 18 state tests and JS syntax test; no E2E browser tests yet |
| A06 | Medium | Prompt-assembly regression suite under-tested contrived bad intake snapshots | 10 additional tests for malformed Unicode, fake flags, metadata and source refs | 44 G02.03 tests in total |
| A07 | Medium | Pure syntax could obscure lack of real tool actions | Explicit candidate/preview-only result; no server writes, no approval or receipts | UI and adapter tests show no side effects under synthetic fixture |
| A08 | High unresolved | Prompt role partition does not guarantee semantic resistance to instruction injection | Preserve limitation as P0 G02.12/G11, do not claim proof | Requires held-out adversarial live model and independent policy checks |
| A09 | High unresolved | Prompt template/schema hash not independently signed or pinned in deployment manifest | Record release pin requirement; no production trust claim | Owner review and supply-chain validation later |
| A10 | High unresolved | No authenticated answer endpoint with atomic revision/consumed interrupt checks | UI only offers answer preview, explicitly not authoritative | G07 and G02.04 implementation required |

## Working integration preview

**Source:** [demo/index.html](../../tools/integrations/agui/demo/index.html), [app.mjs](../../tools/integrations/agui/demo/app.mjs), [styles.css](../../tools/integrations/agui/demo/styles.css), [wizard state and G02.02 contract builder](../../tools/integrations/agui/demo/goal-wizard-state.mjs), [README](../../tools/integrations/agui/demo/README.md).

Launch with a local static server from repository root:

```sh
python3 -m http.server 8000
```

Then browse `http://localhost:8000/tools/integrations/agui/demo/`. The synthetic demo starts with **All three** chosen, asks for results source (Question 2), then action scope (Question 3), and displays an **unverified** G02.02 v0.2 GoalContract preview. It does not connect to any LMS, call a real model or write to any service.

**Editable Figma reference:** [Guided Alignment Wizard, page 08](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=35-2) — three editable UI states. Source code is the working browser prototype; the Figma board is a design reference, not evidence of runtime correctness.

## G02.03 design-acceptance recommendation

**Do not label security or production complete.** For design-only acceptance, the candidate is now reviewable: provider-neutral system/developer/user structural roles, G02.01 allowlisted projection, G02.02 pinned schema, bounded serialization, fail-closed unadmitted context, explicit no-action markers. Limitations remain visible. Semantic prompt-injection defense, user data privacy, approved providers, authenticated event ledger and independently verified execution belong to later gates.

**Open acceptance gaps before G02.03 production/semantic readiness:** genuine model-provider adapter, G02.12 adversarial evaluation, signed/deployment-anchored prompt manifest, upstream schema drift check, real source authorization, privacy review, latency/cost bounds, actual execution/evidence.

**No approval inferred from this PR.** Owner should review **ADR-0007** and explicitly decide G02.03 design acceptance before G02.04 is unblocked. Third-party CopilotKit/OpenDots/OpenBot integration also needs separate product/security/license ADR. The AG-UI protocol spike can proceed independently under evaluation approval.
