# Two-lane T.A.C.E engineering checkpoint — G02.03 + AG-UI/OpenDots/OpenBot

**Date:** 2026-11-11  
**Owner instruction:** Continue core G02.03 and CopilotKit/AG-UI/OpenDots/OpenBot integration evaluation **in parallel**. Work completed in this checkpoint, not an unattended continuous task.

## Lane A — G02.03 prompt-assembly prototype

**Files:** [prompt-assembly.mjs](../../tools/gate02/prompt-assembly.mjs), [34 tests](../../tools/gate02/prompt-assembly.test.mjs), [CI workflow](../../.github/workflows/gate02-prompt-assembly.yml), [ADR-0007](../decisions/ADR-0007-g02-03-prompt-trust-architecture.md).

**Actual implementation:** dependency-free, server-owned `system`, `developer`, `user` message assembly; typed `g02-prompt-assembly-v0.1` output; G02.01 `projectForInterpreter` allowlist; pinned schema version `g02-goal-proposal-v0.2` and SHA-256 digests; byte-size budget; no admitted external context in this spike; fake role strings remain literal user text; no provider or tool call. Explicit `semanticStatus=UNVERIFIED`, `verificationStatus=NOT_RUN`, `policyAuthority=NONE`. The G02.02 validator remains independent.

**Verified:** [GitHub Actions run 42930397995](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42930397995) passed **231/231 deterministic tests**, 0 failed, 0 skipped: 54 G02.01 + 143 G02.02 + 34 G02.03. **Only 34 are new G02.03-specific tests.**

**Limitations:** Prompt role separation is structural, **not evidence of semantic prompt-injection immunity**. The model-visible interpretation text can still contain personal data and persuasive instructions. The schema digest is computed from the deployed file and can be checked against an expected digest, but not anchored to an external signed manifest. No full provider adapter, real authentication, source authorization, data minimization, semantic model evaluation, cost/latency benchmarking or final G02.03 design approval. **ADR-0007 remains PROPOSED; G02.04 remains blocked.**

## Lane B — AG-UI clarification interface evaluation

**Files:** [tace-clarification-events.mjs](../../tools/integrations/agui/tace-clarification-events.mjs), [30 tests](../../tools/integrations/agui/tace-clarification-events.test.mjs), [README](../../tools/integrations/agui/README.md), [CI workflow](../../.github/workflows/agui-clarification-eval.yml). [Issue #7](https://github.com/LethaboMH14/T.A.C.E/issues/7).

**Actual implementation:** converts a proposed clarification question to a short AG-UI-shaped stream: `RUN_STARTED` → T.A.C.E namespaced `CUSTOM` clarification → `RUN_FINISHED` with an `interrupt` and choices expressed as `responseSchema`. A separate preview function validates question/option/revision and states that a new GoalContract proposal and approval review would be necessary. **It does not save an answer or make an external request.**

**Verified:** [GitHub Actions run 42930855437](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42930855437) passed **30/30 tests**, 0 failed, 0 skipped, after a corrected test expectation. These are **shape and state-guard tests**, not full upstream AG-UI SDK conformance or a real CopilotKit integration.

**Upstream evidence:** [AG-UI 1.0 schema](https://github.com/ag-ui-protocol/ag-ui/blob/main/spec/1.0/schema.json) defines `RUN_STARTED`, `CUSTOM`, `RUN_FINISHED` and the interrupt outcome with `responseSchema`. [OpenDots](https://github.com/CopilotKit/OpenDots) is an MIT-licensed alpha template with specialists, Spaces, computers, MCP, voice, Slack, schedules and memory; it depends on separately licensed CopilotKit Intelligence for conversations. [OpenBot](https://github.com/CopilotKit/OpenBot) is the more maintained and governed alternative with an OpenDots skin. **Neither application or service has been installed, forked, run or connected to T.A.C.E here.**

## Explicit boundaries and parallelization

- Separate paths, CI workflows and issue tracking. The UI adapter consumes **display-only** events, never direct tool authority; an AG-UI UI event, MCP tool hint or agent response cannot grant T.A.C.E permission.
- No cross-lane dependency until G02.03 and G02.04 have versioned, approved contracts; G10 owns the product interface, G07 owns actual authorization and exact approvals.
- G02.03 has a working deterministic prototype, not an approved design. G02.04 multiple-choice decision policy is still awaiting G02.03 signoff.
- Integration evaluation is authorized; no external app credential or production dependency adoption is authorized.

## Next acceptance steps

A: critical review against ADR-0007, expand adversarial cases and run a model-semantic evaluation when a provider is selected; request separate owner G02.03 design approval, then start G02.04.

B: official AG-UI SDK/schema conformance, UI prototype with accessible cards and revision-safe answer endpoint, independent permissions/effect checks, deployment/licensing trade-off analysis, and later separate integration ADR.

**Honesty rule:** 231 core tests and 30 integration tests are distinct passing suites. Do not add them to imply 261 independent system-level end-to-end tests; none has connected a real CopilotKit backend or executed a live task.
