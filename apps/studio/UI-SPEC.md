# Mission Studio (React) — build spec

Port of `web/` (the zero-dependency page that already passed two critique rounds) onto the planned stack: **Vite + React 18 + TypeScript + Tailwind + shadcn/ui + React Flow (@xyflow/react) + Motion**. Same server API, same visual world (PRODUCT.md), plus the agent-layer events. The old page stays at `/classic` as a fallback until this one passes the same checks.

## Hard rules
- Render ONLY what the ledger says (`/api/runs/:id/events` SSE) and what files contain (`/api/runs/:id/file?path=`). No invented numbers, no hardcoded green, no "confidence".
- Light theme only. Tokens from `web/styles.css` `:root` (copy the hex values exactly into `src/styles/tokens.css` as CSS variables and into the Tailwind theme).
- Fonts: Instrument Sans (UI), Bricolage Grotesque (mission title only), JetBrains Mono (ids, digests, times). Same Google Fonts link as `web/index.html`.
- Icons: lucide-react, 1.7 stroke. No emoji.
- Banned: eyebrow/kicker labels, gradient text, glass decoration, coloured side-borders, hairline + wide shadow, card grids of icon + blurb, nav links to pages that don't exist.
- Motion: one authored moment, the Failure Autopsy (red clash → struck v1 row → v2 row slides in → green re-check). Respect `prefers-reduced-motion`.
- Phone width 375px: no horizontal scroll.

## API (served by `web/server.mjs` on :4173; Vite dev proxies `/api` there)
`GET /api/scenarios` · `GET /api/runs` · `POST /api/runs {scenario, model?: 'off'}` → `{runId}` · SSE `GET /api/runs/:id/events` (each `data:` is a ledger event; `event: end` when finished) · `GET /api/runs/:id/file?path=artifacts/<file>` · `GET /api/sources/<file>`.
Event types and payloads: `engine/contracts.mjs` + `engine/AGENTS-SPEC.md` §6.

## State (owned by U1, `src/state/mission.ts`): a pure reducer + `useMission()` hook
```ts
type NodeState = 'pending'|'running'|'done'|'failed'|'repairing'|'skipped'|'blocked';
interface Mission {
  runId: string|null; title: string; goalText: string; paceMs: number;
  agents: { mode: 'model'|'code'; provider?: string; model?: string; note?: string } | null;
  planted: string[];                    // plain sentences from RUN_STARTED plantedFault / changedConstraints / excludedSources
  deliverables: string[]; unsupported: string[]; goalSource: 'model'|'fixture'|null;
  goalDrafts: { attempt: number; ok: boolean; code: string|null }[];
  sources: { sourceId: string; file: string; rows: number; digest: string }[]; blockedSources: { sourceId: string; code: string }[];
  tasks: { id: string; role: string; label: string; dependsOn: string[]; produces: string[] }[];
  node: Record<string, { state: NodeState; badge?: { text: string; tone: 'ok'|'bad'|'redo'|'plain' } }>; // task ids + 'goal','sources','review','repair','deliver','blocked'
  joined: { agent: string; capabilityId: string; reason: string; by: string }[];
  messages: AgentMessage[];             // AGENT_MESSAGE payloads, in order
  modelCalls: { agent: string; ok: boolean; ms: number; total: number; error: string|null }[];
  handoffs: { from: string; to: string; artifact: string; seq: number }[];   // latest drives edge pulses
  summaries: Record<string, any>;       // TASK_COMPLETED summary by task id
  checks: Record<string, Check & { round: number }>;   // latest per id
  rounds: { round: number; failed: string[]; messages: string[] }[];       // VERIFICATION_FAILED
  repairs: { round: number; from: string; to: string; changes: any[]; checkIds: string[] }[];
  passed: { round: number; passed: number; total: number } | null;
  files: Record<string, { name: string; versions: (ArtifactRef & { seq: number; by: string })[] }>;
  stage: Record<'goal'|'plan'|'execute'|'verify'|'deliver', 'idle'|'active'|'done'|'bad'>;
  feed: { t: number; text: string; tone: ''|'ok'|'bad'|'redo' }[];        // human sentences (same wording as web/app.js)
  started: number|null; lastTs: number|null; finished: { status: 'VERIFIED'|'PARTIAL'|'BLOCKED'; checksPassed: number; checksTotal: number; repairs: number; reason: string|null } | null;
}
export function reduce(m: Mission, e: LedgerEvent): Mission    // pure; mirrors web/app.js apply()
export function useMission(runId: string|null): Mission         // opens EventSource, folds events with reduce
export const api = { scenarios(), runs(), start(scenario, model?), fileText(runId, path), sourceLines(file) }
```
Components import ONLY `useMission`/`api`/types from `src/state`, never each other's internals.

## Components (each builder owns the files named)
- **U1 shell:** `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/*`, `src/state/*`, `src/components/ui/*` (shadcn: button, select, badge, tabs, sheet, scroll-area, tooltip), `src/components/TopBar.tsx`, `src/components/MissionHeader.tsx` (title, count line, planted-fault note, stepper, status, clock, agent mode chip), `src/components/GoalPanel.tsx`, `src/components/SourcesPanel.tsx`, `src/components/ActivityFeed.tsx`. The layout grid matches `web/styles.css` (300px | 1fr | 400px, then the files row). Slots for U2–U4 components are imported by name.
- **U2 graph:** `src/components/MissionGraph.tsx`, `src/components/graph/*`. React Flow with custom node type (glyph, role, sub-label, state ring, badge; styles from `.node` in web/styles.css), top-to-bottom layered layout computed from `tasks` (depth = longest dependsOn chain) plus goal/sources/review⇄repair/deliver; edges animate on HANDOFF; review⇄repair dashed loop; `fitView`, no minimap. Roster chips under it from `joined` (role + reason tooltip + "model"/"code" kind).
- **U3 review:** `src/components/ReviewPanel.tsx`, `src/components/autopsy/*`, `src/components/EvidenceXRay.tsx`. Check list (13–14 rows, flip animation on status change), Failure Autopsy with Motion (fetch v1/v2 CSV via api.fileText; strike the moved row, slide in the new row, then the green re-check line), Evidence X-Ray (expected vs observed, source rows via api.sourceLines).
- **U4 agents + files:** `src/components/AgentRoom.tsx` (AGENT_MESSAGE as a typed channel: type pill REQUEST/RESULT/CHALLENGE/DECISION/ESCALATE, from → to, reason, artifact chip), `src/components/ModelMeter.tsx` (per-agent calls, ms, tokens from `modelCalls`; shows "Code only — no model key" when agents.mode = 'code'), `src/components/FilesPanel.tsx` + `src/components/FileDrawer.tsx` (shadcn Sheet; CSV as table with clash rows highlighted, JSON pretty, MD with UNSENT banner; version chips v1 ✗ / v2 ✓ per the web page rules).

## Done when
`npm run build` in `apps/studio` succeeds. `web/server.mjs` serves `apps/studio/dist` at `/` when it exists, and the old page at `/classic`. A replayed `inject_overlap` run shows the same story as the classic page, and a live run streams.
