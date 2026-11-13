# T.A.C.E — Mission Console UI/UX architecture, open-source stack and exact behaviors

**Updated:** 2026-11-13. **Status:** DESIGN/IMPLEMENTATION HANDOFF, **NOT A DEPLOYED UI**. The current Figma pages and draft PR #8 offline wizard are reference/prototype evidence, not proof of the whole Mission Studio working. See [system blueprint](COMPLETE-SYSTEM-BLUEPRINT.md), [API/events](CONTRACTS-STATE-MACHINE-AND-APIS.md), [OpenDots research](../research/OPENDOTS-ADOPTION-AND-CLARIFICATION-UX-20261110.md).

## 1. Product experience and aesthetic direction

**Experience:** A trusted **mission operating system** for a digital colleague, not a generic chatbot, financial dashboard or decorative agent swarm. Every screen answers:
1. **What are we trying to achieve?**
2. **What is actually happening, and who is responsible?**
3. **What evidence justifies it? What failed, changed or remains unverified?**
4. **What finished files or approved actions can I use?**

**Design principle:** ambitious means clear, interactive, thoughtful and inspectable—not maximal colors, neon, animations or useless 3D.

Visual style (proposed):
- Premium restrained graphite navigation, warm-light workspace surfaces, neutral slate text, subtle teal/cyan for navigation and active interactions.
- Reserve red for actual failed checks, amber for warnings/approval, green for independently verified results. Never use these colors as meaningless decoration.
- Typography: high-legibility Inter or accessible system sans; strong type hierarchy, readable ~14–16px body, limited type scales and adequate line-height; dark mode and light mode designs.
- Grid: left 240–264px navigation; flexible center mission canvas; optional right 320–360px contextual inspector; collapsible bottom artifact/activity strip.
- Radius ~10–16px, subtle shadows/borders, consistent 4/8px spacing system, 44px touch targets on mobile, purposeful motion respecting reduced-motion preferences.
- Keep primary task visible. No mandatory opening tutorial or large multi-question form when the user's goal is already unambiguous.

## 2. Complete information architecture / routes (all proposed)

| Route / view | What user sees | Underlying authoritative data |
|---|---|---|
| `/` **Mission Home** | One prominent goal input; recent verified/blocked missions; suggested safe templates; source/connection inventory and simple onboarding | Goals, last RunSnapshot and actual connected capability list; no invented app icons as connected |
| `/missions/new` **Goal Intake** | Goal text, optional attachments/connected sources, deadline/budget, source sensitivity; preview of safe default permissions | G02.01 normalized intake and server-generated IDs, NOT a client identity |
| `/missions/:id/align` **Guided Alignment** | Adaptive targeted question or optional progressive multi-choice, Other, Not sure, Back, Skip optional, review/edit answers, why this question matters | G02.04 policy + versioned clarification question/answer + next server turn |
| `/missions/:id/studio` **Mission Studio** | Real DAG, active goal, agent roster, task ownership, progress, risk banner, current task inspector, run controls | G05 task ledger, G06 handoffs, G07 tool actions, G09 check results |
| `/missions/:id/evidence` **Mission Evidence X-Ray** | Selected claim/line linked to admitted source row, source version, method, checker/evidence, uncertainty and limitations | G03 citation index + G09 EvidenceCheck read model |
| `/missions/:id/repairs` **Autonomous Failure Autopsy** | Original failed artifact, exact violation, targeted repair diff, current recheck, remaining uncertainties | Versioned artifacts, FAILED/PASSED checks, repair events/receipts |
| `/missions/:id/deliverables` **Artifact Desk** | Reports/tables/schedules/draft messages, version and verifier badges, preview/reopen/download; compare versions | Artifact manifest, accepted criteria, resource ACL and checks |
| `/missions/:id/agents` **Agent Activity** | Proportional team selected, role, tool scopes, handoffs, budget, active/blocked state, artifacts per worker | Actual task owners and trusted handoff events; no role theater |
| `/approvals` **Human Control Desk** | Exact proposed shared-write/send action, recipient, changed fields, expiration, scope, deny/approve | Trusted G07 approval requests and one-time server decisions |
| `/connections` **Capability and Sources** | Actual connected vs unavailable vs simulated vs unsupported app/tool, scopes, data use, quotas | Authenticated capability registry and consent, never model assertion |
| `/memory` **Skills and Memory** | Approved skills, scoped memories, evidence, retention, correction/delete options | G08 governed memory/skill registry, not free-text auto-instructions |
| `/settings` **Controls and Preferences** | Adaptive/Guided/Quick clarification mode, language, theme, accessibility, cost/concurrency caps, privacy/retention | User preferences subject to immutable server policy |

For judge demo, prioritize **Mission Home → Mission Studio → Evidence X-Ray → Failure Autopsy → Deliverables**; separate full navigation later if insufficient time. No route should show fake “completed” labels based on simulated data without explicit SYNTHETIC/DEMO marking.

## 3. Mission Studio screen composition

**Top command bar:** project/breadcrumb, selected mission, goal revision, actual task status, elapsed time, source badges, cancellation request and cost usage. Add action-specific approval button only if backed by a server proposal.

**Center 60–70%:** React Flow/XYFlow DAG canvas with a real task-node and edges. Node type badges:
- Goal admitted / interpreted;
- evidence/source admitted;
- planner/agent working;
- artifact created;
- independent review pending, failed or passed;
- repair in progress;
- blocked input, approval required, halted.
Each node shows short task title, actual worker, state, attempt/time, output count, verification state. Clicking selects the node and opens inspector. Zoom/pan/minimap if needed, fit-to-run, keyboard-focus and accessible alternative ordered list. Avoid displaying raw model chain-of-thought.

**Right inspector 25–35%:** context-sensitive view of the selected node: actual inputs/source digests; output refs; source citations; method/check version; acceptance PASS/FAIL/UNKNOWN; artifact preview; permissions; cost/retries; repair history. When no node selected, show concise mission summary and next blocking decision.

**Bottom tray:** persisted artifacts and chronological trustworthy event timeline. A run should make it obvious when a worker is active, blocked, awaiting approval or completed. “AI is thinking” without actual event/call is misleading. Streaming events must reconnect and reconcile from ledger; do not fabricate optimistic completion.

**Responsive:** on tablet inspector becomes slide-over; on phones graph becomes a readable vertical step timeline with task selection, inspector via tabs/bottom sheet, persistent primary action, no horizontal squeezed three-column canvas. Ensure keyboard, screen-reader names and status announcements.

## 4. Signature interactions

### A. Goal-to-Graph (core)

Input natural goal → show proposal preview and source/capability availability → if ambiguous, ask only relevant question → server-bound plan preview → real task nodes materialize from an actual DAG. Selecting a node reveals why it is needed and what done means. If user edits goal, invalidate stale plan and approvals; show new plan version/diff. **No hardcoded “five agents every mission.”**

### B. Guided Alignment (G02.04, planned)

Three configurable modes:
- **Adaptive (default)**: ask on material ambiguity, no interruption for simple safe draft.
- **Guided (opt-in)**: short progressive multiple-choice question with Other, Not sure and Back; summarize accepted intent, sources and allowed outputs before planning; skip irrelevant question.
- **Quick Start**: reversible assumptions only; mandatory consent, recipient and high-risk approvals still enforced.

A question card has short title, reason (“why this matters”), visible step/progress when multi-step, 2–6 neutral answer options, optional Other free-text and a review/edit answers step. Each selected answer remains provisional until a **server-validated new goal turn** is committed. Stale wizard answer must error with a helpful refresh route.

**Actual current UI prototype:** [PR #8 offline browser demo](https://github.com/LethaboMH14/T.A.C.E/tree/review/g02-03-agui-next-20261112/tools/integrations/agui/demo) shows three Qs and G02.02 JSON preview, with no real auth/ledger/provider. [Editable Figma page 08](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=35-2) depicts the screens.

### C. Mission Evidence X-Ray

From any highlighted claim in a report (e.g., “Topic B needs extra support”), open split inspector showing:
1. exact claim text and artifact ID/version;
2. admitted source row IDs and evidence locations (data lineage);
3. transformation or deterministic analysis code/check name/version;
4. confidence/uncertainty **as calibrated or qualitative, not fabricated numeric score**;
5. independent PASS/FAIL/UNKNOWN status with actual read-back or source cross-check;
6. ability to raise a correction or ask which source is missing.

The evidence inspector can display a table using TanStack Table and human-readable source snapshots. A citation without resolved source/version is not verified.

### D. Autonomous Failure Autopsy

A meaningful correction timeline:
```
10:21:08  Schedule artifact v1 written
10:21:10  Reviewer failed: Mentor B at 14:00 overlaps another session
10:21:11  Repair task scheduled: only mentor schedule
10:21:15  Schedule artifact v2 written (diff attached)
10:21:17  Independent checker passed: 0 overlaps on v2
```
**These are sample illustrative labels, not actual recorded T.A.C.E events.** Actual timestamps, actions, statuses, model/worker ID, before/after values and proof digests must come from server events. Show v1 and v2 simultaneously and let judges independently inspect. If unresolved, show explicit failed/blocked state, not green optimism.

### E. Deliverables as first-class artifacts

Artifact cards: title/type, goal criterion, creation time, version, source evidence coverage, verifier status, actions (open/compare/copy/download), who produced/checked, sensitivity/sharing state. For XLSX/CSV preview use safe table, Markdown/HTML sanitized renderer, DOCX/PDF preview only with tested parser/viewer. Full-size editing uses editor with autosave/versioning later; editing a verified artifact invalidates affected check and requires re-verification. **Draft message cannot have a “Sent” badge without an actual send receipt.**

### F. Real approval queue

Show exact action operation, destination/recipient, resource version, args diff, cost, risk, reason, permission status, expiry. Buttons emit **approval requests** to G07 API only, with authenticated server check and one-time consume; UI never directly invokes side-effectful tools. If approval is stale, show “Needs review again” rather than executing old payload.

### G. Agent Activity and proportional staffing

Show only specialists actually instantiated/used: Planner, Evidence Analyst, Schedule Planner, Intervention Designer, Artifact Producer, independent Reviewer, Repair Worker. Handoff cards show input artifact versions, output IDs, status, cost/time. For a simple “create template” goal, show one worker; multi-part goal shows dependency-aware team. Group tasks by actual graph branches. Agent profiles can be OpenDots-inspired without importing its permission logic.

## 5. Open-source UI/interaction stack — research/adoption status

| Layer | Preferred candidate | Why | Status/caveat |
|---|---|---|---|
| App shell | React 19 + TypeScript + Vite or Next.js | Component architecture and ecosystem, quick demo | **Proposed**, not installed on main |
| Components | shadcn/ui + Radix + Tailwind CSS | Accessible forms, dialogs, sheets, menus, design-system control | **Proposed**; pin licenses/versions |
| Dynamic graph | React Flow (`@xyflow/react`) | Custom task nodes, pan, zoom, minimap and selections | **Proposed**, server graph is authoritative |
| Agent/mission stream | CopilotKit + AG-UI | UI-state streaming, human-in-the-loop events | AG-UI **shape adapter** exists; no connected CopilotKit runtime |
| Workspaces/specialists | OpenDots, OpenBot + OpenDots skin | Specialist UI, editable Spaces, approval patterns, computer views | **Evaluation approved**, not adopted/installed |
| Evidence tables | TanStack Table | Sorting, filters, evidence/receipt rows | **Proposed** |
| Artifact editor | Tiptap | Rich report and communication draft editor | **Proposed**, confirm plugin licensing |
| Animation | Motion for React | Purposeful updates, graph focus, repair transitions | **Proposed**; reduced motion |
| Icons and chart | Lucide, lightweight charts/SVG | Restrained visuals, confidence/usage graphs | **Proposed**, no vanity dashboards |
| State/data fetching | React Query/TanStack Query, URL state | Reconnects, optimistic *display* only, cache invalidation | **Proposed** |
| Realtime transports | SSE or WebSocket + AG-UI adapter | Ordered authoritative events and replay | No production backend stream yet |

**OpenDots/OpenBot caveats:** The OpenDots application is an alpha single-owner starting template. Its MIT application code does not mean CopilotKit Intelligence or hosted models/computers are free/unlicensed. Evaluate design patterns, workspaces, approval cards and skins without importing its policy defaults. OpenBot may be a more governed host, but T.A.C.E must retain its own GoalContract, G07 policy, event/receipt ledger and output verification.

## 6. AG-UI event integration contract (proposed production bridge)

Backend emits monotonic T.A.C.E events and a safe projection. UI subscribes and replays:
- `RUN_STARTED` → mission begins, no success implication;
- T.A.C.E namespaced `CUSTOM` e.g. `tace.clarification.requested.v1`, `tace.task.state.v1`, `tace.evidence.checked.v1`, `tace.artifact.versioned.v1`;
- `RUN_FINISHED` with `interrupt` → run **paused awaiting answer**, not completed;
- completion receipt and verified final manifest cause real terminal state.

The adapter in main/PR #8 emits simple AG-UI 1.0 envelopes; PR #8 pins official schema and checks a subset, not full upstream SDK behavior. A production adapter needs authenticated subscription, monotonic sequence ID, client resume/cursor, event privacy scope, reconnection, dedupe, out-of-order handling and no client authority.

State projections should be built from actual event log; an event is a fact *about the system*, not a substitute for independently checked evidence. Never derive approvals from a `CUSTOM` payload, hallucinated `RUN_FINISHED` or model narration.

## 7. Suggested component tree (proposed)

```
apps/web/src/
  app/                  # routes, layouts, auth boundary
  components/
    shell/              # Nav, breadcrumbs, command bar, workspace context
    goal/               # GoalComposer, SourcePicker, ConstraintsBar
    clarification/      # QuestionCard, Options, Other, Review, Modes
    mission/            # MissionHeader, DagCanvas, TaskNode, RunTimeline
    agents/             # AgentRoster, HandoffInspector, ActivityFilters
    evidence/           # EvidenceXRay, SourceRow, VerificationBadge
    repair/             # FailureAutopsy, BeforeAfterDiff, RecheckProof
    artifacts/          # ArtifactCard, Preview, VersionHistory
    approvals/          # ExactActionDialog, ApprovalQueue
    connections/        # CapabilityList, SourcePermission
  hooks/                # useMissionEvents, useGoalRevision, useArtifact
  lib/api/              # typed API client, idempotency and CSRF strategy
  lib/agui/             # event map and validator (not execution authority)
  styles/               # tokens, themes, responsive breakpoints
  tests/                # accessibility, e2e, event replay, snapshots
packages/contracts/     # trusted shared DTO schemas, versioned
```

This is a suggested future directory, not current repository structure. Do not scaffold large skeletons without working behavior.

## 8. Accessibility and quality gates

- Keyboard navigation for every wizard answer, graph alternate list, dialogs and inspector; visible focus, semantic labels and proper aria-live for state changes without announcement spam.
- Sufficient contrast, 44px tap targets, reduced motion, zoom at 200%, error text not color-only, responsive no-horizontal-overflow at 360px.
- “Question 2 of 3” only when there really are three; Guided mode should branch/stop early when appropriate. Do not force multi-choice where missing data demands specific text upload.
- Any claim in a report can be selected to inspect source or be clearly labeled unsupported. Evidence should be understandable to non-engineer educator.
- Show VERIFIED only on actual independent PASS; user sees pending/unverified/blocked without green decorations.
- Test edge: long goals, mixed languages/RTL, Unicode, noisy events, offline/reconnect, stale revision, canceled run, missing tool, no artifacts yet, many artifacts, mobile.

## 9. UI integration test matrix

1. **Goal input:** small unambiguous goal proceeds without wizard in Adaptive mode; complex goal shows targeted clarification.
2. **Wizard:** All three → data source → draft-only; Back/Other/Not sure; no answer is persisted without server response; stale wrong-goal answer refused.
3. **Task graph:** renders correct edges from backend snapshot, no fabricated agent count, updates on PLAN_REVISED, can inspect nodes by keyboard and mobile.
4. **Evidence:** open claim, resolve actual source version/row and check status; missing source gives UNKNOWN.
5. **Repair:** open failed v1 and corrected v2, show actual diff/check; no simulated green without PASS event.
6. **Artifacts:** safe reopen/download by tenant, version history, edit invalidates prior check.
7. **Approval:** exact recipient/body/args, expired/mutated action cannot be approved; double click no duplicate effect.
8. **AG-UI:** schema validation, event cursor/replay/dedup, reconnect, malformed event rejection; no cross-tenant leakage.
9. **Accessibility:** axe-core, keyboard-only, mobile viewport, reduced motion, screen-reader labels.
10. **Visual verification:** compare real browser screenshots to Figma and inspect responsive behavior before claiming pixel quality.

## 10. Editable Figma and prototype sources

- [Master Figma design](https://www.figma.com/design/28egBAkhQHExkqUinyimtM): 01 Intent/Trust, 02 Mission Console, 03 Skills/Memory, 04 G02.01, 05 G02.02, 06 G02.03, 07 AG-UI/OpenDots evaluation, [08 Guided Alignment Wizard](https://www.figma.com/design/28egBAkhQHExkqUinyimtM?node-id=35-2).
- [Gate 01 FigJam architecture](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi).
- [Diagram source](../../diagrams/TACE-Architecture.drawio).
- [Draft PR #8 browser UI](https://github.com/LethaboMH14/T.A.C.E/tree/review/g02-03-agui-next-20261112/tools/integrations/agui/demo) (static HTML/CSS/JS, not React or deployed).
- [OpenDots/CopilotKit evaluation dossier](../research/OPENDOTS-ADOPTION-AND-CLARIFICATION-UX-20261110.md).

**Implementation direction:** build a real event-backed Mission Studio around **goal → plan → agent work → failed check → targeted repair → independent verified result → downloadable artifacts**. Only then add sophisticated motion, rich editors and third-party agent skins. T.A.C.E should feel excellent because the software is legible and truthful, not because it depicts unbuilt intelligence.
