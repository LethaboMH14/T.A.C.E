#!/usr/bin/env node
// T.A.C.E command line.
//   node cli/tace.mjs run --scenario inject_overlap [--pace 600] [--runs runs] [--run-id my-run] [--json]
//   node cli/tace.mjs list
// Exit code: 0 VERIFIED, 2 PARTIAL, 3 BLOCKED, 1 crash.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMission } from '../engine/run.mjs';
import { EDU_DOMAIN } from '../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../fixtures/education-recovery/scenarios.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Load repo/.env (git-ignored) if present. The key is read by engine/model.mjs and never printed. */
export function loadLocalEnv() {
  try { process.loadEnvFile(path.join(repoRoot, '.env')); } catch { /* no .env: model stays off */ }
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

export function loadScenario(id) {
  if (!/^[a-z_]+$/.test(id)) throw new Error(`bad scenario id: ${id}`);
  const file = path.join(EDU_DOMAIN.scenariosDir, id + '.json');
  if (!fs.existsSync(file)) throw new Error(`unknown scenario: ${id} (try: node cli/tace.mjs list)`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function stampRunId(scenarioId, d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${scenarioId}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const line = (e) => {
  const who = (e.role ? `${e.role}` : '').padEnd(16);
  const d = e.data || {};
  switch (e.type) {
    case 'RUN_STARTED': return `▶ ${d.title}\n  goal: ${d.goalText}\n  agents: ${d.agents?.mode === 'model' ? `${d.agents.provider} · ${d.agents.model}` : `code only (${d.agents?.note ?? 'no model'})`}`;
    case 'MODEL_CALL': return `  ${who}${d.provider}:${d.model} ${d.ok ? 'ok' : 'FAILED ' + (d.error ?? '')} · ${d.ms} ms · ${d.usage?.total ?? 0} tokens`;
    case 'MODEL_FALLBACK': return `  ${who}fallback ${d.from} → ${d.to} (${d.reason})`;
    case 'AGENT_JOINED': return `  ${who}joined: ${d.reason}`;
    case 'AGENT_MESSAGE': return `  ${(d.from + ' → ' + d.to).padEnd(30)} ${d.type}: ${d.reason}`;
    case 'GOAL_DRAFTED': return `  Goal Reader     draft ${d.attempt}: ${d.ok ? 'accepted by validator' : 'rejected (' + d.code + ')'}`;
    case 'HUMAN_QUESTION': return `? Goal Reader asks: ${d.question}`;
    case 'HUMAN_ANSWER': return `  answer (${d.by}): ${d.answer}`;
    case 'GOAL_VALIDATED': return `✓ goal accepted (structure only) → deliverables: ${d.deliverables.join(', ')}`;
    case 'GOAL_REJECTED': return `✗ goal rejected: ${d.code}`;
    case 'SOURCE_ADMITTED': return `  source ${d.file} v${d.version.replace(/^v/, '')} · ${d.rows} rows · ${d.digest.slice(0, 12)}`;
    case 'SOURCE_BLOCKED': return `✗ source ${d.sourceId}: ${d.code} ${d.message || ''}`;
    case 'PLAN_CREATED': return `◆ plan: ${d.tasks.map((t) => t.id).join(' → ')}${d.unsupported.length ? `  (cannot produce: ${d.unsupported.join(', ')})` : ''}`;
    case 'TASK_STARTED': return `  ${who}started ${e.taskId}`;
    case 'TASK_COMPLETED': return `  ${who}done    ${e.taskId} ${d.summary ? JSON.stringify(d.summary) : ''}`;
    case 'TASK_FAILED': return `✗ ${who}failed  ${e.taskId}: ${d.code} ${d.message}`;
    case 'TASK_SKIPPED': return `  ${who}skipped ${e.taskId}: ${d.reason}`;
    case 'HANDOFF': return `  ${who}← ${d.artifact} from ${d.from}`;
    case 'ARTIFACT_WRITTEN': return `  ${who}wrote   ${d.file}  ${d.digest.slice(0, 12)}`;
    case 'REVIEW_STARTED': return `◆ Reviewer      round ${d.round}: re-opening files and recomputing from sources`;
    case 'CHECK_RESULT': return `  ${d.status === 'PASS' ? '✓' : '✗'} ${d.id.padEnd(30)} ${d.status === 'PASS' ? '' : d.message}`;
    case 'VERIFICATION_FAILED': return `✗ review round ${d.round}: ${d.failed.length} check(s) failed`;
    case 'VERIFICATION_PASSED': return `✓ review round ${d.round}: ${d.passed}/${d.total} checks passed`;
    case 'REPAIR_SCHEDULED': return `◆ Repair        ${d.strategy} for ${d.artifact} (${d.checkIds.join(', ')})`;
    case 'ARTIFACT_REPAIRED': return `  Repair        ${d.from} → ${d.to}\n${d.changes.map((c) => `      ${c.session_id ?? c.field}: ${c.from} → ${c.to}`).join('\n')}`;
    case 'TASK_RERUN': return `  ${who}re-run  ${e.taskId} (input changed by repair)`;
    case 'RUN_FINISHED': return `■ ${d.status} · checks ${d.checksPassed}/${d.checksTotal} · repairs ${d.repairs}${d.reason ? ' · ' + d.reason : ''}`;
    default: return null;
  }
};

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0] || 'help';
  if (cmd === 'list') {
    for (const f of fs.readdirSync(EDU_DOMAIN.scenariosDir).filter((f) => f.endsWith('.json')).sort()) {
      const s = JSON.parse(fs.readFileSync(path.join(EDU_DOMAIN.scenariosDir, f), 'utf8'));
      console.log(`${s.id.padEnd(24)} ${s.title}`);
    }
    return 0;
  }
  if (cmd === 'providers') {
    loadLocalEnv();
    const { checkProviders } = await import('../engine/providers.mjs');
    const rows = await checkProviders(process.env);
    for (const r of rows) console.log(`${String(r.provider).padEnd(12)} ${String(r.model).padEnd(34)} text: ${String(r.text).padEnd(14)} schema: ${String(r.schema).padEnd(14)} ${r.ms ?? '-'} ms`);
    console.log(`profile: ${process.env.MODEL_PROFILE || 'demo'} (set MODEL_PROFILE=free for tests)`);
    return 0;
  }
  if (cmd === 'model-check') {
    loadLocalEnv();
    const { modelFromEnv } = await import('../engine/model.mjs');
    const m = modelFromEnv(process.env);
    if (!m.available) { console.log('No model key found. Put MODEL_API_KEY=... in repo/.env (see .env.example).'); return 3; }
    console.log(`Checking ${m.provider} · ${m.model} at ${m.baseUrl} (the key is not shown) ...`);
    try {
      const r = await m.chat({ agent: 'model-check', messages: [{ role: 'user', content: 'Reply with exactly: ready' }], maxTokens: 800, temperature: 0 });
      console.log(`OK · ${r.ms} ms · ${r.usage?.total ?? '?'} tokens · reply: ${JSON.stringify(String(r.text).slice(0, 40))} · message fields: ${Object.keys(r.message || {}).join(',')}`);
      const s = await m.chat({ agent: 'model-check', messages: [{ role: 'user', content: 'Give {"ok": true}' }], jsonSchema: { name: 'ok', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } }, maxTokens: 800, temperature: 0 });
      console.log(`Structured output OK · ${JSON.stringify(s.json)}`);
      return 0;
    } catch (err) {
      console.log(`FAILED · ${err.code || 'ERROR'} · ${err.message}`);
      return 2;
    }
  }
  if (cmd !== 'run' || !a.scenario) {
    console.log('usage: node cli/tace.mjs run --scenario <id> [--model off] [--pace ms] [--runs dir] [--run-id id] [--json]\n       node cli/tace.mjs list\n  agents use the model in repo/.env (MODEL_API_KEY) when present; --model off forces code only');
    return cmd === 'help' ? 0 : 1;
  }
  const scenario = loadScenario(String(a.scenario));
  const runsDir = path.resolve(repoRoot, a.runs ? String(a.runs) : 'runs');
  const runId = a['run-id'] ? String(a['run-id']) : stampRunId(scenario.id);
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error('bad run id');
  const runDir = path.join(runsDir, runId);
  const quiet = !!a.json;
  if (a.answer !== undefined && (a.answer === true || a.answer.trim().length < 1 || a.answer.length > 500)) throw new Error('--answer needs 1 to 500 characters of text');
  // --answer gives the same reply to every Goal Reader question (non-interactive). Without it, the run blocks on a question.
  const askHuman = a.answer !== undefined ? async () => String(a.answer) : null;
  loadLocalEnv();
  const result = await runMission({
    scenario, domain: EDU_DOMAIN, sourcesDir: EDU_DOMAIN.sourcesDir, runDir, runId,
    trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: a.pace ? Number(a.pace) : 0,
    model: a.model === 'off' ? 'off' : 'auto', askHuman,
    onEvent: quiet ? undefined : (e) => { const s = line(e); if (s) console.log(s); },
  });
  if (quiet) console.log(JSON.stringify({ runId: result.runId, status: result.status, checksPassed: result.checksPassed, checksTotal: result.checksTotal, repairs: result.repairs.length, runDir: result.runDir }));
  else console.log(`\nfiles: ${path.relative(repoRoot, path.join(runDir, 'artifacts'))}`);
  return { VERIFIED: 0, PARTIAL: 2, BLOCKED: 3 }[result.status] ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // exitCode (not exit()) lets open network handles close cleanly on Windows
  main().then((code) => { process.exitCode = code; }, (err) => {
    if (err.code === 'RUN_EXISTS') { console.error(err.message); process.exitCode = 4; return; }
    console.error(err.stack || err); process.exitCode = 1;
  });
}
