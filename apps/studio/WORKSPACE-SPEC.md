# Mission Studio → Workspace (wave U5–U8)

## Owner rules (13 Nov, 17:30) — the sonnet reviewer rejects any violation
1. **Nothing hardcoded or scripted.** Every value, status, agent, step, number, list item and animation on screen is derived from a real backend event (`/api/runs/:id/events`), a real file (`/api/runs/:id/file`), or a real API response (`/api/*`). No placeholder data, no demo-only branches, no fake loading. Empty states say what is missing and why.
2. **A proper workspace, not a long page:** left sidebar navigation, a prompt box, a command palette, run controls, and panels laid out in a fixed-height app shell (100vh). Panels scroll inside themselves; the page itself does not scroll on desktop.
3. **Selectable graph nodes** open an inspector with the agent's inputs, outputs, decision log, model/provider/tokens/cost, and the checks touching its outputs. Safe actions start a REAL new run with the change.
4. **Every feature is tested through the interface** against the real server (`npm run studio`) with screenshots. Report what was clicked and seen.
5. Every builder ends its report with **3 concrete improvement ideas** for the next wave.

## Shell (fixed-height grid)
```
┌ sidebar 232px ┬───────────────────────── main ─────────────────────────────────┐
│ T.A.C.E       │ Prompt bar: [ Describe a goal or ask a question …  ] [Run] ⌘K  │
│ ─────────     │ Mission header: title · stepper · status · clock · agents chip │
│ ◉ Mission     ├───────────────────────────────┬────────────────────────────────┤
│ ☰ Missions    │ View content                  │ Inspector (node / check / file)│
│ ◎ Agents      │ (Mission: graph + bottom tabs │ opens on selection, 380px      │
│ ✓ Evidence    │  Activity | Agent room |      │                                │
│ ▤ Files       │  Timeline | Review)           │                                │
│ ⚙ Models      │                               │                                │
│ ─────────     │                               │                                │
│ profile·budget│                               │                                │
└───────────────┴───────────────────────────────┴────────────────────────────────┘
```
Hash routes: `#/mission/<runId>`, `#/missions`, `#/agents`, `#/evidence/<runId>`, `#/files/<runId>`, `#/models`. Below 1000px the sidebar collapses to icons. Below 720px everything stacks (no horizontal scroll at 375px).

## Server endpoints (route modules in `web/api/*.mjs`, wired by the lead into web/server.mjs)
- `GET /api/providers` → `[{name, tier, configured, models:{fast,strong}, price|null}]` + `{profile, budget}` from engine/providers.mjs (never keys).
- `POST /api/providers/check` → runs `checkProviders(process.env)` live; one at a time.
- `POST /api/ask {text}` → **gate**: router model classifies with a strict JSON schema `{kind: 'mission'|'question'|'off_topic', reason}` (enum validated by code; invalid → treated as `question`).
  - `mission`: start a real run with a custom scenario `{id:'custom', title:<short>, goalText:text, intakeSources: all six, proposal:null}`. The Goal Reader model drafts the contract.
  - `question`: answer from the LATEST finished run's files (gap-analysis, performance-summary, mentor-schedule, drafts), citing `file@vN`. The model gets only those files' text as data.
  - `off_topic`: a polite redirect explaining what T.A.C.E does.
  - Without a model key: `{kind:null, error:'Free-text goals need a model; set a key or pick a scenario'}`.
- `POST /api/runs {scenario, overrides?: {unavailable?: [{mentor_id, day}], profile?, provider?}}`: the overrides go into the scenario copy (`unavailable`) and the run's env (`MODEL_PROFILE`, `MODEL_PROVIDER`). A real new run.

## Components and owners
- **U5 shell:** `src/App.tsx` (rewrite into the workspace grid), `src/components/shell/*` (Sidebar, PromptBar UI, CommandPalette with `cmdk`, RouteViews), `src/views/MissionsView.tsx` (TanStack Table of `/api/runs`), `src/views/ModelsView.tsx` (`/api/providers` + check button), `web/api/providers.mjs`.
- **U6 prompt + gate:** `src/components/shell/PromptBar.tsx` logic + `src/components/AskResult.tsx`, `web/api/ask.mjs`, `agents/gate.mjs` (classifier + answerer using the router; code validates the enum and that every cited file exists), tests.
- **U7 inspector + actions:** `src/components/inspector/*` (NodeInspector, CheckInspector, FileInspector), `src/state/selectors-node.ts` (pure: inputs/outputs/decisions/model calls/checks per task from the Mission state + ledger events), "Run again with a change" form (constraint: mentor unavailable day; model: profile/provider) → `api.start(scenario, overrides)`, `web/api/runs-overrides.mjs` (validation of overrides).
- **U8 timeline + views:** `src/components/Timeline.tsx` (swimlanes per role from TASK_STARTED/COMPLETED/RERUN/REVIEW/REPAIR timestamps), `src/views/AgentsView.tsx`, `src/views/EvidenceView.tsx`, `src/views/FilesView.tsx` (versions + line diff v1→v2→v3 with `diff` (jsdiff, BSD-3)), cost column wherever a price is known (`engine/providers.mjs` PROVIDERS price), otherwise "tokens only (price not published)".

Libraries allowed (check the licence before install, report it): `cmdk` (MIT), `@tanstack/react-table` (MIT), `diff` (BSD-3), `@number-flow/react` (MIT, count-ups), `sonner` (MIT, toasts). Motion is installed. Respect `prefers-reduced-motion`.
