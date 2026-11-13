// POST /api/ask {text}: the gate. One model call classifies the request; code then acts on the kind.
//   mission   -> a REAL new run (custom scenario, Goal Reader drafts the contract)
//   question  -> answer from the latest finished run's files, with cites
//   off_topic -> the product's own help text
// Keys are read from ctx.env by engine/providers.mjs and are never logged or returned.
import fs from 'node:fs';
import path from 'node:path';
import { routerFromEnv } from '../../engine/providers.mjs';
import { safeJoin } from '../../engine/artifacts.mjs';
import { classify, answer, MAX_TEXT, label } from '../../agents/gate.mjs';

// Files the answer may draw on, in the order they are shown to the model.
export const ANSWER_FILES = Object.freeze([
  'gap-analysis.csv',
  'performance-summary.md',
  'mentor-schedule.csv',
  'unsent-message-drafts.md',
  'monday-brief.md',
]);

const HELP = 'I help a bootcamp coordinator find learners who are slipping, book mentors and draft messages. '
  + 'Try: "Who is at risk this week and why?" or "Book mentors for the struggling learners and draft messages, do not send anything."';

const NO_MODEL = 'Free-text goals need a model; set a key or pick a scenario';
const FINISHED = new Set(['VERIFIED', 'PARTIAL']);

function errorReply(err, fallback) {
  // Only codes and our own plain messages reach the page; provider text is never echoed.
  const code = String(err?.code || '');
  if (code === 'MODEL_CONFIG') return `Model settings are invalid (${String(err.message)}).`;
  if (code === 'TEXT_TOO_LONG' || code === 'TEXT_EMPTY') return String(err.message);
  return `${fallback}${code ? ` (${code})` : ''}`;
}

/** Latest FINISHED run's answer files, read under the run's artifacts folder with path checks. */
export function readAnswerFiles(ctx, runId) {
  if (!ctx.RUN_ID.test(runId)) return [];
  const runDir = path.join(ctx.runsDir, runId);
  const indexPath = path.join(runDir, 'artifacts', 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  const refs = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const out = [];
  for (const name of ANSWER_FILES) {
    const versions = refs.filter((r) => r && r.name === name && Number.isInteger(r.version));
    if (versions.length === 0) continue;
    const latest = versions.reduce((a, b) => (b.version > a.version ? b : a));
    if (!/^artifacts\/[a-z0-9][a-z0-9._-]*\.(csv|json|md)$/.test(latest.file)) continue;
    const abs = safeJoin(runDir, latest.file);
    if (!fs.existsSync(abs)) continue;
    out.push({ name, version: latest.version, text: fs.readFileSync(abs, 'utf8') });
  }
  return out;
}

export async function handle(req, res, url, parts, ctx) {
  if (parts[1] !== 'ask') return false;
  if (req.method !== 'POST') { ctx.send(res, 405, { error: 'POST only' }); return true; }

  const body = await ctx.readJson(req, res);
  if (body === null) return true; // readJson has already answered
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) { ctx.send(res, 400, { error: 'text is required' }); return true; }
  if (text.length > MAX_TEXT) { ctx.send(res, 200, { kind: null, error: `Keep the request under ${MAX_TEXT} characters.` }); return true; }

  let model;
  try { model = routerFromEnv(ctx.env); } catch (err) { ctx.send(res, 200, { kind: null, error: errorReply(err, 'Model settings are invalid') }); return true; }
  if (!model.available) { ctx.send(res, 200, { kind: null, error: NO_MODEL }); return true; }

  let verdict;
  try { verdict = await classify({ model, text }); } catch (err) {
    ctx.send(res, 200, { kind: null, error: errorReply(err, 'The model could not read that request. Try again or pick a scenario') });
    return true;
  }
  const base = { kind: verdict.kind, reason: verdict.reason, provider: verdict.provider, model: verdict.model };

  if (verdict.kind === 'mission') {
    // Same rule as POST /api/runs: one run at a time.
    if (ctx.active.size > 0) { ctx.send(res, 409, { ...base, error: 'a run is already in progress; wait for it to finish' }); return true; }
    try {
      const started = ctx.startRun({
        scenarioObject: {
          id: 'custom',
          title: `Goal: ${verdict.title}`,
          goalText: text,
          intakeSources: ['trainees', 'assessments', 'skills', 'mentors', 'availability', 'interventions'],
          proposal: null,
          inject: null,
        },
      });
      ctx.send(res, 200, { ...base, runId: started.runId });
    } catch (err) {
      ctx.send(res, 200, { ...base, error: errorReply(err, 'The run could not start') });
    }
    return true;
  }

  if (verdict.kind === 'question') {
    const finished = ctx.listRuns().filter((r) => FINISHED.has(r.status));
    if (finished.length === 0) { ctx.send(res, 200, { ...base, error: 'No finished run to answer from yet' }); return true; }
    const runId = finished[0].runId;
    const files = readAnswerFiles(ctx, runId);
    if (files.length === 0) { ctx.send(res, 200, { ...base, runId, error: 'The latest finished run has no answer files yet' }); return true; }
    try {
      const a = await answer({ model, text, files });
      ctx.send(res, 200, { ...base, runId, answer: a.answer, cites: a.cites, provider: a.provider ?? base.provider, model: a.model ?? base.model, labels: files.map(label) });
    } catch (err) {
      ctx.send(res, 200, { ...base, runId, error: errorReply(err, 'The model could not answer from the files') });
    }
    return true;
  }

  ctx.send(res, 200, { ...base, answer: HELP });
  return true;
}
