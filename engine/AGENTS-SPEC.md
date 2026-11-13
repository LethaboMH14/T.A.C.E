# Agent layer — contract (13 Nov 2026)

**Rule:** the model proposes, code decides. Every model output passes a code check before it is used. The engine from wave 1–2 (planner, workers, reviewer checks, repair) becomes the tools and guards around the agents. If no key is configured, the model is "not available" and the run says so; nothing pretends a model ran.

## Provider (verified from Meta's docs on 13 Nov 2026)
- Meta Model API (formerly Llama API). OpenAI-compatible Chat Completions: `POST {base}/chat/completions`, `Authorization: Bearer <key>`.
- Base URL default `https://api.meta.ai/v1`; model default `muse-spark-1.3`.
- Key env var `MODEL_API_KEY` (alias `LLAMA_API_KEY`). Overrides: `MODEL_BASE_URL`, `MODEL_NAME`. `.env` is git-ignored; CLI and server load it with `--env-file-if-exists=.env`.
- Tools: `tools:[{type:'function', function:{name, description, parameters}}]`, response `choices[0].message.tool_calls[] {id, function:{name, arguments(JSON string)}}`, `tool_choice` must be `"auto"` (others → 400). Results go back as `{role:'tool', tool_call_id, content}` AFTER the full assistant message.
- Structured output: `response_format:{type:'json_schema', json_schema:{name, schema, strict?}}`; JSON arrives as a string in `choices[0].message.content`. No recursive schemas, depth ≤ 10.
- 429/5xx: exponential backoff with jitter from ~500 ms; honour `Retry-After`.

## 1. `engine/model.mjs`
```js
export function modelFromEnv(env = process.env, opts = {}) // -> createModel({apiKey: env.MODEL_API_KEY || env.LLAMA_API_KEY, baseUrl: env.MODEL_BASE_URL, model: env.MODEL_NAME, ...opts})
export function createModel({ apiKey, baseUrl = 'https://api.meta.ai/v1', model = 'muse-spark-1.3', timeoutMs = 45000, maxRetries = 2, fetchImpl = fetch, onCall = () => {} })
// -> { available: !!apiKey, provider: 'meta-model-api', model, baseUrl, chat }
// chat({ agent, messages, tools, jsonSchema: {name, schema}, temperature = 0.2, maxTokens = 1500 })
//   -> { text, json, toolCalls: [{id, name, args}], usage: {prompt, completion, total}, ms, message }   (message = the raw assistant message, for tool loops)
// errors carry .code: MODEL_UNAVAILABLE | MODEL_TIMEOUT | MODEL_HTTP_<status> | MODEL_BAD_JSON | MODEL_EMPTY
// onCall({agent, provider, model, ok, ms, usage, error}) after every attempt (the runner turns it into MODEL_CALL)
// NEVER put the key, the Authorization header, or full prompt text in errors, logs or events.
```

## 2. `engine/messages.mjs` (zod)
```js
export const AgentMessage = z.object({
  id: z.string().regex(/^M-\d{3,}$/),
  type: z.enum(['REQUEST', 'RESULT', 'CHALLENGE', 'DECISION', 'ESCALATE']),
  from: z.string().min(1).max(40), to: z.string().min(1).max(40),
  about: z.object({ artifact: z.string().optional(), digest: z.string().optional(), checkId: z.string().optional() }).strict().optional(),
  reason: z.string().min(1).max(500),
  body: z.unknown().optional(),
}).strict();
export function createMessenger(emit) // -> { send({type, from, to, about, reason, body}) -> validated message with next id; list() }
// send() validates with AgentMessage.parse and emits EVENT.AGENT_MESSAGE; invalid -> throws code BAD_MESSAGE
```

## 3. Agents (`agents/*.mjs`, domain-neutral) — each takes `{ model, emit, messenger, ... }`
- **Goal Reader** `readGoal({ model, intake, catalog, messenger, emit, maxAttempts = 3 })` → `{ status: 'ACCEPTED'|'ESCALATED', proposal, attempts }`.
  - Builds the request with the accepted G02.03 `assemblePrompt(intake)` plus one extra system message listing the catalog of deliverable ids the engine can produce.
  - Asks for JSON matching `tools/gate02/goal-proposal.schema.json`, then validates with G02.02 `validateGoalProposal(proposal, intake)`. If rejected, sends a CHALLENGE (`from: 'Validator'`) and re-asks with only the rejection code and path.
  - Emits `GOAL_DRAFTED` per attempt.
- **Supervisor** `staffTeam({ model, proposal, registry, codePlan, messenger, emit })` → `{ tasks, hires: [{capabilityId, role, reason, source: 'model'|'dependency'}] }`.
  - The model proposes who to hire and why. Code compares that with `codePlan` (the planner's backward chain).
  - A missing dependency or an unneeded hire gets a CHALLENGE from `'Planner'` and one revision. The final team is always the code plan (DECISION message), with the model's reasons kept where they match.
  - Emits `AGENT_JOINED` per task.
- **Reviewer voice** `explainReview({ model, checks, route, messenger })` → `{ verdict, routeAgreed }`.
  - The model writes a ≤2-sentence verdict per failed check and proposes `repair` or `person`. Code compares that with `route` (from `planRepairs`). A mismatch gets a DECISION that keeps the code route, with the reason.

## 4. Education: LLM Message Writer
`domains/education/message-writer.mjs` → `draftMessagesWithModel(ctx)`. Same output files and format as `writer.draftMessages` (ARTIFACTS.md §5), but each learner draft's `subject` and `body` are written by the model from structured facts (learner name, skill name, mentor name, day label, start–end). `ctx.feedback` (failed C14 details) is passed back on a re-run. The facts fields (day/date/start/mentor_id/session_id/status) are always copied by code, never by the model.

New reviewer check **C14_drafts_text_matches** (message_drafts): every learner draft `body` contains its day label (e.g. `Tue 17 Nov`), its `start`, and its mentor's display name. It contains no other `HH:MM` time except `start`/`end`, and no other weekday name. On FAIL the route re-runs `draft_messages` with feedback.

## 5. MCP server `mcp/server.mjs` (stdio)
Tools: `list_scenarios`, `run_mission {scenario}` (real run, returns runId/status/checks), `list_files {runId}`, `read_file {runId, name, version?}`, `review_run {runId}` (re-runs the independent checks on that run's files). Read-only except `run_mission`, which writes only under `runs/`. Zod input schemas.

## 6. Events the UI shows
`AGENT_JOINED` (avatar joins with reason), `AGENT_MESSAGE` (agent room), `MODEL_CALL` (tokens/ms per agent), `GOAL_DRAFTED` (contract attempts), `HUMAN_QUESTION`/`HUMAN_ANSWER` (pause and answer).
