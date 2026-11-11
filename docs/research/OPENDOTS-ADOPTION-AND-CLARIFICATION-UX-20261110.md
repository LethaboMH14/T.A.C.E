# T.A.C.E research note — CopilotKit/OpenDots and clarification UX

**Date:** 2026-11-10  
**Status:** EVALUATION_APPROVED — isolated AG-UI adapter prototype tested; vendor dependency adoption NOT APPROVED  
**Sources inspected:** [OpenDots README](https://github.com/CopilotKit/OpenDots/blob/main/README.md), [MIT LICENSE](https://github.com/CopilotKit/OpenDots/blob/main/LICENSE), [Connections](https://github.com/CopilotKit/OpenDots/blob/main/docs/CONNECTIONS.md), [Computers](https://github.com/CopilotKit/OpenDots/blob/main/docs/COMPUTERS.md), [Setup](https://github.com/CopilotKit/OpenDots/blob/main/docs/SETUP.md), [OpenBot README](https://github.com/CopilotKit/OpenBot/blob/main/README.md). Live third-party integration not independently tested by T.A.C.E.

## A. Clarification: where and when

**G02.03** establishes safe prompt/role/data packaging. **G02.04** then decides which uncertainties are decision-critical and when to present clarification. Clarification should occur **before committing a material work plan or executing consequential effects**, with the ability to re-enter when a new source, contradiction, user correction or unavailable capability changes assumptions. **G02.05** strengthens outcome and acceptance verification; **G02.06/G07** provide independent risk classification and approvals; **G10** builds the production Mission Console UI.

### User-configurable mode (captured requirement; not implemented)

- **Adaptive (default):** ask only if missing information materially changes a planned output, interpretation, feasibility, money, recipients, privacy or permissions. Otherwise proceed with visible low-risk assumptions.
- **Guided alignment (opt-in):** before substantial work, show a short sequence of answerable multiple-choice cards: goal/outcome → inputs/scope → desired artifacts/constraints → plan summary. Prefer 1 question at a time, 2–4 questions total initially, branch adaptively and stop early when resolved. Include **Other / write my own**, **Not sure**, **Skip optional**, **Back** and **Review answers**; no mandatory questionnaire for a trivially specified request.
- **Quick start:** make only clearly reversible low-risk assumptions; surface them with an **Edit assumptions** affordance. Never interpret this as waiving mandatory consent, recipient/target verification, sensitive-data or tool-policy checks.
- Optional one-run override: **Ask me more before starting**; do not modify global setting.
- Never force all users into a long wizard; make accessibility and language considerations explicit and avoid repetitive questions.

### Candidate decision rule (G02.04 still blocked)

Given candidate goals, collect explicit `blockingUncertainties` and independently classified intended effects. Ask a targeted question if its possible answers would change (a) intended action class/recipient, (b) acceptance evidence, (c) source ownership/authorization, (d) time/cost budget, or (e) significant irreversible outcome. In low-risk reversible situations, the system may present labeled assumptions and an editable draft. Before external send, shared write, grade/eligibility decision, money movement, destructive action or exposure of sensitive personal data, require all needed clarification/authorization **regardless of mode**. This is a *proposed* policy; no calibrated threshold or model-confidence score is approved.

### Proposed wizard contract

`ClarificationQuestion`: `id`, `goalId` (server internal), `turnRevision`, `question`, `reason`, `kind` SINGLE_CHOICE/MULTI_CHOICE/SHORT_TEXT, `options` with stable IDs and neutral wording, `otherAllowed`, `notSureAllowed`, `optional`, `dependsOn`, `affects` (goal field/criterion/effect/approval), `expiry`, `status`. Never accept new actor/tenant/approval or permissions from question answers.

On submission, atomically create a **new G02.01 turn/revision** with the answer attached to its original question/version; recompile G02.02 candidate proposal; recheck old plan, approval fingerprints and dependent checks. Reject stale/wrong-goal answers; make prior choices editable before action. Keep full answer history for audit according to retention/privacy rules rather than silently overwriting the user's goal. **No implementation yet.**

### Test plan for G02.04

- Unambiguous small request → no question in Adaptive; Guided mode not artificially forced to ask irrelevant questions.
- "Draft an email to the team" → may draft; "send" with unspecified recipients → clarification and approval.
- "Create performance summary" → ask only what changes the artifact significantly; source unavailable → disclose blocker.
- Ambiguous deadline/time zone; contradictory corrections; unknown data ownership → ask rather than invent.
- Consequential or destructive action under Quick start → mandatory gating persists.
- Wrong-tenant and stale wizard answers fail closed; selected option IDs cannot inject policy/tool instructions.
- 1, 2, 3, 5 and 10 ambiguities; question ranking/stop early; no duplicative loop; option coverage and Other path.
- Usability/accessibility: keyboard, screen reader, mobile, translation, progress, skipping optional items, user cancellation.
- Compare Auto vs Guided vs Quick Start across synthetic held-out goals; report **measured** intervention rate, wrong-task rate, abandoned questions, cost, latency, human usefulness and external-effect safety.

**Status:** forward requirement captured. G02.04 is **BLOCKED** until G02.03 design review/signoff. G10 is responsible for full UI realization, although a G02.04 design prototype is useful.

## B. OpenDots: verified repository features and fit

**Repository:** https://github.com/CopilotKit/OpenDots  
**Owner:** CopilotKit; public TypeScript/React project; **MIT-licensed application source** (retain copyright/license attribution). Current README describes itself as an **alpha, single-owner starting template**, not an enterprise-ready plug-and-play universal agent engine.

| Existing OpenDots feature / claim | T.A.C.E fit | Proposed action / gate |
| --- | --- | --- |
| Dot specialists with editable roles and tools | Specialist/agent roster UI | Evaluate UI patterns for G04/G10; don't let role text grant privileges |
| Spaces and editable pages, autosave/revision checks | Artifact library and mission outputs | Evaluate selective reuse G10; bind to T.A.C.E evidence/receipt types |
| React SDK chat, persistent threads and source links | Conversation UI and context | AG-UI/CopilotKit interoperability spike G02.14/G10 |
| Per-Dot computers, browser/terminal/files/takeover | Sandboxed execution research | Evaluate OpenBot services in G07; don't enable uncontrolled execution |
| Human approval cards for MCP write actions | Approval experience | UI inspiration G07/G10; enforce T.A.C.E exact server-side consent/receipt controls independently |
| MCP servers and Composio-connected apps | Connector discovery | Evaluate in G04/G07 after explicit connector/security tests |
| Background schedules in original conversations | Recurring work | Evaluate G05/G08; not a full event-triggered lifecycle |
| Slack channels | Multi-surface messaging | Later optional integration G06/G10; connected-service verification pending upstream |
| WebRTC voice calls / delegated compute | Multimodal access | Later optional; review privacy, consent and actual service costs |
| Saved memory preferences and automatic learning | Scoped memory/skills | Evaluate G08 with review/publishing and cross-tenant isolation; never auto-install untrusted skills |
| Searchable page library and rich editor | Mission Console artifact browsing | High-priority UI candidate for G10; editable output must be evidenced |
| Read-only browser research / Parallel integration | Evidence retrieval | Optional G03; evaluate data disclosure, endpoint trust and provider quotas |

### Security and feature limitations verified from OpenDots docs

- **OpenDots is single-owner**, with no shared editing/invitations/file uploads/interactive page embeds yet; no multi-Dot group conversation or automatic delegation; schedules are recurring instructions, not complete event-triggered workflows. Avoid claiming a ready-made dynamic T.A.C.E agent swarm or full mission graph.
- **Conversations require CopilotKit Intelligence**: hosted, local Docker evaluation or separately **licensed** self-hosted deployment. MIT license of the UI/repo does **not** mean all required runtime services are unrestricted/free. Model-provider, computer and SaaS costs may apply. Local Intelligence evaluation is macOS-oriented with resource requirements in current setup docs; production licensing must be checked before adoption.
- OpenDots per-tool permissions use a remote MCP tool's **readOnlyHint** to default some read operations to autonomous execution. Its docs explicitly say this is merely a hint, and tools start enabled. T.A.C.E must **not** import this as an authorization truth; its G07 policy should deny by default, independently classify exact tool effects, and bind approvals to immutable request arguments.
- Computer service uses separate containers and per-Dot permissions; the docs explicitly note standard Docker shares the host kernel and no restrictive network-egress policy is configured by default. Do not treat containerization alone as sufficient sandboxing.
- OpenDots itself reports some *local* service verification, but cloud scheduling, Slack/live service paths and automatic-learning delivery still require connected-service verification; T.A.C.E has tested none of these.
- OpenDots's maintained higher-governance sibling is **OpenBot**, available with the OpenDots **UI skin**. OpenBot README describes sign-in, roles, permissions and audit, with a separately licensed Intelligence runtime. For a long-lived/governed engine, evaluate **OpenBot + OpenDots skin + AG-UI** alongside selective CopilotKit components, instead of forking the entire alpha template by default.
- Additional source audit needed: dependency and transitive licenses, version pinning, vulnerabilities, user data flow, browser isolation, consent, design-system license and practical integration compatibility.

### Technical recommendation (NOT accepted)

**Prefer a modular adapter strategy:**

```
T.A.C.E goal intake (G02.01)
    → safe prompt interpretation (G02.03)
    → typed goal proposal (G02.02)
    → adaptive clarification (G02.04, upcoming)
    → capability discovery / graph / tools / verified receipts (G04–G09)
    → AG-UI adapter → CopilotKit/OpenDots-inspired or OpenBot-skin interface (G10)
```

AG-UI is a UI event protocol, **not** an execution-security boundary. The T.A.C.E server owns permissions, approved tool envelopes, receipts, tenant separation, audit and final verification. Reuse MIT-licensed source only with attribution, pin exact commits and test compatibility before adopting. Do not duplicate T.A.C.E's approved G02.01/G02.02 contract in OpenDots's conversational layer.

**Recommendation:** HIGH priority to **evaluate** CopilotKit/AG-UI + OpenDots/OpenBot UI patterns; MEDIUM priority for OpenBot computer/approval/connectors after G07 review; LATER for Slack/voice/automatic learning. **No implementation or integration approved.**

## C. Proposed proof-of-concept acceptance (future, not executed)

1. Render a controlled T.A.C.E stream as AG-UI events: intent received, interpretation proposal, **clarification required**, answer submitted, pending approval, verified artifact.
2. Show the same three-choice + Other wizard in a React prototype and mobile layout; one pending active question, no stale submission.
3. Verify no frontend-controlled choice sends a tool call or changes an approval fingerprint by itself.
4. Test pause/resume and retries with no duplicate side effects, with event IDs/receipts preserved.
5. Show that dynamic subgoals (1 vs multiple) have proportional UI, not a hardcoded swarm.
6. Evaluate real deploy/license/cost and dependency status before any adoption.

**This is a research recommendation, not a claim that the project currently uses OpenDots, OpenBot or CopilotKit.**

## D. Owner authorization to evaluate — 2026-11-10

**Decision:** The owner explicitly approved **evaluating** CopilotKit + AG-UI for T.A.C.E's interactive clarification and mission interface, selected OpenDots UX patterns, and OpenBot's execution infrastructure, **while keeping T.A.C.E's own GoalContract validation, independently enforced permissions, exact approval checks and verified receipts**. Crucially, a remote MCP server's `readOnlyHint` or tool description cannot by itself authorize actions.

**Approval boundaries:** This is authority for an engineering/research proof of concept, technical comparison and isolated integration tests — **not** approval to replace T.A.C.E's architecture, adopt dependencies irrevocably, deploy OpenBot, connect user credentials, execute external actions or switch on broad computer/shell permissions. Any production adoption needs a later explicit ADR with licensing, security and CI evidence.

**Evaluation acceptance targets:** AG-UI stream mapping for `INTAKE` → `CLARIFICATION_REQUIRED` → `ANSWERED` → `PROPOSAL_VALID/NEEDS_CLARIFICATION` → `POLICY_REVIEW_REQUIRED` → `VERIFIED` (only after real verification); accessible guided three-question prototype; tested stale-answer and revision fences; independent effect classification despite inaccurate read-only hints; pinned dependency/commit and separate CopilotKit Intelligence licensing/cost review; no real execution or PII in initial fixture tests.

**Status (superseded by 2026-11-11 checkpoint):** evaluation approved; isolated integration spike now implemented and tested. Full CopilotKit/OpenDots/OpenBot integration pending. G02.03 remains in research, G02.04 is not yet approved, G10 UI integration remains a downstream option.


## E. Parallel evaluation implementation checkpoint — 2026-11-11

The owner requested this evaluation proceed **in parallel** with G02.03. [Issue #7](https://github.com/LethaboMH14/T.A.C.E/issues/7) records the evaluation lane. Implemented an isolated adapter for AG-UI 1.0 `RUN_STARTED`, namespaced `CUSTOM` clarification event, and `RUN_FINISHED` interrupt with JSON Schema answer choices; answer-preview validation rejects stale/wrong-goal/forged option submissions. [Code and limitations](../../tools/integrations/agui/README.md).

**Verified [GitHub Actions 42930855437](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42930855437): 30/30 passing**, 0 failures, 0 skipped. Initial isolated run 42930753252 failed one *incorrect test expectation*; corrected and reran successfully. **No actual AG-UI SDK conformance run, React/CopilotKit UI, hosted Intelligence, OpenDots/OpenBot instance, model, computer or connected service is in place**. Pending security/licensing/UX evaluation before adoption. Maintain independent T.A.C.E exact permission and receipt enforcement; `readOnlyHint` is not policy.
