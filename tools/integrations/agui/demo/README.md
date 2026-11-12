# T.A.C.E Guided Alignment — interactive synthetic prototype

**State:** Offline browser proof-of-concept on draft PR #8, not a deployed or security-certified T.A.C.E product.

## What you can use

A responsive, accessible three-question alignment wizard for a synthetic training-results mission. The initial answer is **All three** (gap analysis, performance report, improvement and scheduling plan). Question 2 asks for the training data source. Question 3 distinguishes draft-only, review, or proposed connected updates. Users can go Back, edit answers, choose Other, review selections, inspect the candidate G02.02 `g02-goal-proposal-v0.2` JSON and copy the JSON if clipboard permission is available.

Every question produces a synthetic `RUN_STARTED` → namespaced `CUSTOM` → `RUN_FINISHED` (interrupt) AG-UI event preview through the real T.A.C.E adapter. The UI preview validates selected option IDs but **does not** append a server turn, authorize a source, run a model, send messages, change schedules or execute tools.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open: **http://localhost:8000/tools/integrations/agui/demo/**

An HTTP server is required because modern browsers do not reliably permit ES-module imports over file://.

Run the deterministic tests:

```sh
node --test tools/integrations/agui/tace-clarification-events.test.mjs tools/integrations/agui/demo/goal-wizard-state.test.mjs
node --check tools/integrations/agui/demo/app.mjs
```

For upstream AG-UI 1.0 protocol conformance, install Python `jsonschema==4.23.0` in an isolated environment and run:

```sh
node tools/integrations/agui/write-protocol-fixtures.mjs | python3 tools/integrations/agui/verify-official-schema.py
```

The CI workflow does this with a temporary Python virtual environment.

## Explicit trust limitations

- There is **no live React, CopilotKit, OpenDots or OpenBot deployment**. This is framework-independent browser JS simulating the proposed interaction.
- No authenticated user, persisted server revision, real source handles, read/write tool decisions, human approval receipts or privacy classification.
- The displayed GoalContract proposal has not been produced by an LLM. Tests invoke G02.02's existing validator on synthetic cases, but browser state **cannot grant authority**.
- The official AG-UI schema conformance check validates event envelopes and an interrupt payload, **not** a full conformance-certified CopilotKit integration.
- Do not insert personal learner data into this proof of concept; all records are synthetic.
- DOM inputs and text use browser text nodes, not insertion of untrusted HTML.
- Connected update and notification options merely propose consequential effects. G07 independently classifies and authorizes actions.

Follow-ups: G02.03 ADR-0007 critical review, then G02.04 ambiguity policy (owner signoff required); AG-UI SDK/React visual integration and G07 authenticated answer endpoint remain separate lanes. Track PR #8 and Issue #7.
