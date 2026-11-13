# AG-UI clarification boundary — isolated evaluation spike

**Status:** EVALUATION APPROVED / 30 deterministic tests passing / NOT integrated with a live CopilotKit, OpenDots or OpenBot installation.

This is a T.A.C.E-owned, dependency-free JavaScript adapter that emits a **subset** of AG-UI 1.0 event envelopes for a *server-supplied* clarification question, without giving the UI permission to run tools.

## What actually works

- `makeClarificationEvents(context,question)`: creates `RUN_STARTED`, `CUSTOM` (`tace.clarification.requested.v1`) and `RUN_FINISHED` with a legitimate AG-UI `interrupt` outcome containing `responseSchema` for multiple-choice answers.
- `previewClarificationAnswer(context,question,answer)`: checks option and revision IDs and returns **ANSWER_PREVIEW_ONLY**, with mandatory proposal recompilation and approval recheck flags.
- Rejects malformed context, stale questions, duplicate choices, forged approval fields, cross-goal/turn/revision answers and unexpected text.
- Emits no `TOOL_CALL_*` events, no approval receipt, no verification result and no side effect.

## How to test

```sh
node --test tools/integrations/agui/tace-clarification-events.test.mjs
```

**Verified CI:** [GitHub Actions run 42930855437](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42930855437), **30/30 passing**, 0 fail, 0 skipped. Initial failed run [42930753252](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42930753252) was due to a test expecting `INVALID_UI_INPUT` where the correctly guarded adapter returned `INVALID_QUESTION`; updated the test and reran successfully.

**Upstream protocol:** [AG-UI 1.0 schema](https://github.com/ag-ui-protocol/ag-ui/blob/main/spec/1.0/schema.json) (event names and required shapes). The custom `tace.clarification.requested.v1` value is a T.A.C.E extension **not specified as standard AG-UI wizard semantics**.

## Known limits

1. Event *shape smoke tests*, not a formal conformance run against upstream `@ag-ui/core` or `schema.json`.
2. No web/React UI, OpenDots/CopilotKit runtime, actual streaming transport, persistent state, server authentication, atomic replay prevention or real connected apps.
3. UI events and selected options are untrusted and can be fabricated or replayed. `previewClarificationAnswer` **does not persist a new G02.01 turn**. G07 must atomically validate identity, current goal revision, expiry and consumed approval/answer IDs.
4. `RUN_FINISHED` with an interrupt reflects a simulated pause awaiting an answer, not a completed task.
5. No actual tool invocation or verified artifact. Browser/computer/Slack/voice components are **not** evaluated in this code.
6. Do not import an MCP server's `readOnlyHint` as a permission; classify actual tools/actions independently in G07.

## Integration acceptance before adoption

- Bind to a real CopilotKit/AG-UI frontend with controlled synthetic sessions and verify event decoding against official SDK/schema.
- Build accessible 3-question (or fewer when appropriate) Guided Alignment wizard and submit answers through authenticated API to append-only revision ledger.
- Compare standalone [OpenDots](https://github.com/CopilotKit/OpenDots) versus maintained [OpenBot](https://github.com/CopilotKit/OpenBot) + OpenDots skin, including CopilotKit Intelligence licensing and hosting costs.
- Validate source trust, agent credentials, containers, network egress, tool scopes, approval fingerprints and receipts in G07/G11.
- Obtain separate owner ADR approval for actual dependency adoption.

Tracking: [Issue #7](https://github.com/LethaboMH14/T.A.C.E/issues/7). This is parallel research, **not a background autonomous worker**.
s=>s+"\n\n## Review branch PR #8 — official schema and guided UI proof of concept\n\n[Draft PR #8](https://github.com/LethaboMH14/T.A.C.E/pull/8) adds an offline three-question [browser wizard](demo/README.md), \`demo/goal-wizard-state.mjs\` with candidate \`g02-goal-proposal-v0.2\` builder and [18 new tests](demo/goal-wizard-state.test.mjs). [GitHub Actions 43126625949](https://github.com/LethaboMH14/T.A.C.E/actions/runs/43126625949) verified **48 pass** (30 adapter + 18 wizard), plus **3 positive events accepted / 4 negatives rejected** against the pinned upstream [AG-UI 1.0 schema](vendor/ag-ui-1.0.schema.json). The browser module syntax passes Node checking; visual browser E2E has not yet run.\n\nDemo can be served with \`python3 -m http.server 8000\` and opened at \`http://localhost:8000/tools/integrations/agui/demo/\` from the repo root. Neither real CopilotKit/OpenDots nor authenticated T.A.C.E API is connected. [Figma editable page 08](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=35-2) is design reference only.\n"