#!/usr/bin/env node
// Mission Studio server: zero dependencies.
// - Serves the static page from web/.
// - POST /api/runs {scenario, pace}  -> starts a REAL run in this process (engine/run.mjs).
// - GET  /api/runs                    -> recent runs from runs/.
// - GET  /api/runs/:id/events         -> Server-Sent Events: replays events.jsonl, then tails it live.
// - GET  /api/runs/:id/file?path=...  -> a file from that run's artifacts/ (read-only, path-checked).
// - GET  /api/sources/:file           -> an admitted fixture file (read-only), for Evidence X-Ray.
// Coordinator sign-in: /api/auth/* (web/api/auth.mjs). Every other /api route needs the tace_staff cookie when the LMS is configured (STUDIO_LOGIN=off turns that off).
// The page only ever shows what these files say. Nothing here can send a message anywhere.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runMission } from '../engine/run.mjs';
import { EDU_DOMAIN } from '../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../fixtures/education-recovery/scenarios.mjs';
import { safeJoin } from '../engine/artifacts.mjs';
import { loadScenario, stampRunId, loadLocalEnv } from '../cli/tace.mjs';
import { createStaffGate } from './api/auth.mjs';
loadLocalEnv();
const staffGate = createStaffGate(process.env);

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const runsDir = path.resolve(repo, process.env.TACE_RUNS || 'runs');
const PORT = Number(process.env.PORT || 4173);
const active = new Map(); // runId -> promise
// runId -> the one open Goal Reader question waiting for a coordinator answer ({ id, done(text|null) })
const pendingAnswers = new Map();
const ASK_TIMEOUT_MS = 180000;

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8', '.csv': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const RUN_ID = /^[A-Za-z0-9_-]{1,80}$/;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function listRuns() {
  if (!fs.existsSync(runsDir)) return [];
  // Folders starting with "_" (e.g. runs/_lms snapshots) are not runs.
  return fs.readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && RUN_ID.test(d.name) && !d.name.startsWith('_')).map((d) => {
    const ev = path.join(runsDir, d.name, 'events.jsonl');
    let first = null; let finished = null; let delivered = null;
    if (fs.existsSync(ev)) {
      const events = fs.readFileSync(ev, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      first = events[0] ?? null;
      // Events may follow RUN_FINISHED (e.g. MESSAGES_DELIVERED), so look for the finish event itself.
      finished = events.findLast((e) => e.type === 'RUN_FINISHED') ?? null;
      delivered = events.findLast((e) => e.type === 'MESSAGES_DELIVERED') ?? null;
    }
    return { runId: d.name, scenarioId: first?.data?.scenarioId ?? null, title: first?.data?.title ?? null, startedAt: first?.ts ?? null,
      status: finished ? finished.data.status : (active.has(d.name) ? 'RUNNING' : 'INCOMPLETE'),
      delivered: delivered ? delivered.data.count : null };
  }).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

function streamEvents(req, res, runId) {
  const file = path.join(runsDir, runId, 'events.jsonl');
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write(':' + ' '.repeat(2048) + '\n\n'); // pushes the stream past proxy buffers (tunnels, CDNs)
  let offset = 0; let buf = ''; let done = false;
  const pump = () => {
    if (!fs.existsSync(file)) return;
    const size = fs.statSync(file).size;
    if (size <= offset) return;
    const fd = fs.openSync(file, 'r');
    const chunk = Buffer.alloc(size - offset);
    fs.readSync(fd, chunk, 0, chunk.length, offset);
    fs.closeSync(fd);
    offset = size;
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      res.write(`data: ${line}\n\n`);
      try { if (JSON.parse(line).type === 'RUN_FINISHED') done = true; } catch { /* partial line guard */ }
    }
  };
  pump();
  const timer = setInterval(() => { pump(); if (done) { res.write('event: end\ndata: {}\n\n'); clearInterval(timer); res.end(); } }, 120);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(timer); clearInterval(ping); });
}

/** Ledger events with seq > after, plus whether the run has finished. Same events as the SSE stream. */
function pollEvents(res, runId, after) {
  const file = path.join(runsDir, runId, 'events.jsonl');
  const min = Number.isFinite(after) ? after : 0;
  const events = [];
  let finished = false;
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let e; try { e = JSON.parse(line); } catch { continue; } // partial last line: picked up next poll
      if (e.type === 'RUN_FINISHED') finished = true;
      if (Number(e.seq) > min) events.push(e);
    }
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ events, finished, running: active.has(runId) }));
}

const PROFILES_OK = new Set(['demo', 'free', 'cheap', 'meta']);
const DAYS_OK = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
/** Validate "run again with a change" overrides. Unknown keys are rejected, never ignored. */
function checkOverrides(o) {
  if (o == null) return {};
  if (typeof o !== 'object' || Array.isArray(o)) throw new Error('overrides must be an object');
  for (const k of Object.keys(o)) if (!['unavailable', 'profile', 'provider'].includes(k)) throw new Error(`unknown override: ${k}`);
  const out = {};
  if (o.unavailable != null) {
    if (!Array.isArray(o.unavailable) || o.unavailable.length > 10) throw new Error('unavailable must be a short list');
    out.unavailable = o.unavailable.map((u) => {
      if (!u || !/^M-[A-Z]$/.test(u.mentor_id) || !DAYS_OK.has(u.day)) throw new Error('unavailable entries need mentor_id like M-B and day Mon..Fri');
      return { mentor_id: u.mentor_id, day: u.day };
    });
  }
  if (o.profile != null) { if (!PROFILES_OK.has(o.profile)) throw new Error('profile must be demo, free, cheap or meta'); out.profile = o.profile; }
  if (o.provider != null) { if (!/^[a-z]{2,20}$/.test(o.provider)) throw new Error('bad provider name'); out.provider = o.provider; }
  return out;
}

/**
 * Start a REAL run. body: { scenario: id } | { scenarioObject } (built and validated by an API module),
 * plus optional { model: 'off', pace, overrides }. Returns { runId, scenarioId, pace }.
 */
function startRun(body) {
  const base = body.scenarioObject ? body.scenarioObject : loadScenario(String(body.scenario || ''));
  const overrides = checkOverrides(body.overrides);
  const scenario = { ...base, ...(overrides.unavailable ? { unavailable: overrides.unavailable, title: `${base.title} (changed: ${overrides.unavailable.map((u) => `${u.mentor_id} away ${u.day}`).join(', ')})` } : {}) };
  const env = { ...process.env, ...(overrides.profile ? { MODEL_PROFILE: overrides.profile } : {}), ...(overrides.provider ? { MODEL_PROVIDER: overrides.provider } : {}) };
  const pace = Math.max(0, Math.min(3000, Number(body.pace ?? 650)));
  const runId = stampRunId(scenario.id);
  const runDir = path.join(runsDir, runId);
  // The run waits here for a coordinator answer (POST /api/runs/:id/answer). No answer in time = no answer.
  const askHuman = ({ id }) => new Promise((resolve) => {
    const done = (text) => {
      clearTimeout(timer);
      if (pendingAnswers.get(runId)?.id === id) pendingAnswers.delete(runId);
      resolve(text);
    };
    const timer = setTimeout(() => done(null), ASK_TIMEOUT_MS);
    pendingAnswers.set(runId, { id, done });
  });
  const p = runMission({ scenario, domain: EDU_DOMAIN, sourcesDir: body.sourcesDir || EDU_DOMAIN.sourcesDir, runDir, runId, trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: pace, model: body.model === 'off' ? 'off' : 'auto', env, askHuman, askTimeoutMs: ASK_TIMEOUT_MS })
    .catch((err) => { console.error(`[run ${runId}]`, err); })
    .finally(() => active.delete(runId));
  active.set(runId, p);
  return { runId, scenarioId: scenario.id, pace };
}

// Browsers on this machine, plus one exact public origin when the Studio is published (STUDIO_PUBLIC_ORIGIN, e.g. a tunnel URL).
const PUBLIC_ORIGIN = (process.env.STUDIO_PUBLIC_ORIGIN || '').replace(/\/+$/, '');
function allowedOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || (PUBLIC_ORIGIN !== '' && origin === PUBLIC_ORIGIN);
}

/** Same-origin JSON body reader for API modules (≤ maxBytes). Returns the parsed object or sends the error and returns null. */
async function readJson(req, res, maxBytes = 4096) {
  const origin = req.headers.origin;
  if (origin && !allowedOrigin(origin)) { send(res, 403, { error: 'cross-origin request refused' }); return null; }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) { send(res, 415, { error: 'send JSON' }); return null; }
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > maxBytes) { send(res, 413, { error: 'too large' }); return null; } }
  try { return JSON.parse(raw || '{}'); } catch { send(res, 400, { error: 'invalid JSON' }); return null; }
}

// API route modules: every web/api/*.mjs exports `async handle(req, res, url, parts, ctx) -> boolean` (true = handled).
const apiCtx = { send, readJson, startRun, listRuns, runsDir, repo, active, env: process.env, RUN_ID, staffGate };
const apiDir = path.join(here, 'api');
const apiModules = [];
if (fs.existsSync(apiDir)) {
  for (const f of fs.readdirSync(apiDir).filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs')).sort()) {
    apiModules.push(await import(pathToFileURL(path.join(apiDir, f)).href));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0] === 'api') {
      // Coordinator sign-in: every /api route except /api/auth needs a valid tace_staff cookie (when login is required).
      if (parts[1] !== 'auth') {
        const gate = await staffGate.check(req);
        if (!gate.ok) return send(res, gate.status, gate.body);
      }
      if (req.method === 'GET' && parts[1] === 'scenarios') {
        const items = fs.readdirSync(EDU_DOMAIN.scenariosDir).filter((f) => f.endsWith('.json')).sort().map((f) => {
          const s = JSON.parse(fs.readFileSync(path.join(EDU_DOMAIN.scenariosDir, f), 'utf8'));
          return { id: s.id, title: s.title, goalText: s.goalText };
        });
        return send(res, 200, items);
      }
      if (parts[1] === 'runs' && parts.length === 2) {
        if (req.method === 'GET') return send(res, 200, listRuns());
        if (req.method === 'POST') {
          // Runs can call a paid model API: only same-origin JSON requests, one run at a time.
          const origin = req.headers.origin;
          if (origin && !allowedOrigin(origin)) return send(res, 403, { error: 'cross-origin request refused' });
          if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'send JSON' });
          if (active.size > 0) return send(res, 409, { error: 'a run is already in progress; wait for it to finish' });
          let raw = ''; for await (const c of req) { raw += c; if (raw.length > 4096) return send(res, 413, { error: 'too large' }); }
          // Allowlist: a browser may pick a scenario id, model off, pace and overrides. It can never send a scenario object.
          try { const b = JSON.parse(raw || '{}'); return send(res, 202, startRun({ scenario: b.scenario, model: b.model, pace: b.pace, overrides: b.overrides })); } catch (e) { return send(res, 400, { error: e.message }); }
        }
      }
      if (parts[1] === 'runs' && RUN_ID.test(parts[2] || '')) {
        const runId = parts[2];
        if (!fs.existsSync(path.join(runsDir, runId))) return send(res, 404, { error: 'no such run' });
        if (parts[3] === 'events') return streamEvents(req, res, runId);
        // Polling form of the same ledger: proxies like Cloudflare tunnels hold SSE back until the run ends.
        if (parts[3] === 'poll' && req.method === 'GET') return pollEvents(res, runId, Number(url.searchParams.get('after') ?? 0));
        if (parts[3] === 'answer' && req.method === 'POST') {
          // Same rules as POST /api/runs: same-origin JSON only.
          const origin = req.headers.origin;
          if (origin && !allowedOrigin(origin)) return send(res, 403, { error: 'cross-origin request refused' });
          if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'send JSON' });
          let raw = ''; for await (const c of req) { raw += c; if (raw.length > 4096) return send(res, 413, { error: 'too large' }); }
          let body; try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'bad JSON' }); }
          const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
          if (answer.length < 1 || answer.length > 500) return send(res, 400, { error: 'answer must be 1 to 500 characters' });
          const open = pendingAnswers.get(runId);
          if (!open || open.id !== String(body.id || '')) return send(res, 404, { error: 'no open question with that id (it may have expired)' });
          open.done(answer);
          return send(res, 200, { ok: true });
        }
        if (parts[3] === 'file') {
          const rel = url.searchParams.get('path') || '';
          if (!/^artifacts\/[a-z0-9][a-z0-9._-]*\.(csv|json|md)$/.test(rel)) return send(res, 400, { error: 'bad path' });
          const abs = safeJoin(path.join(runsDir, runId), rel);
          if (!fs.existsSync(abs)) return send(res, 404, { error: 'not found' });
          return send(res, 200, fs.readFileSync(abs), MIME[path.extname(abs)]);
        }
      }
      if (parts[1] === 'sources' && /^[a-z]+\.(csv|json)$/.test(parts[2] || '')) {
        const abs = safeJoin(EDU_DOMAIN.sourcesDir, parts[2]);
        if (!fs.existsSync(abs)) return send(res, 404, { error: 'not found' });
        return send(res, 200, fs.readFileSync(abs), MIME[path.extname(abs)]);
      }
      for (const m of apiModules) if (await m.handle(req, res, url, parts, apiCtx)) return;
      return send(res, 404, { error: 'unknown endpoint' });
    }

    // static: the React Mission Studio (apps/studio/dist) at "/", the zero-dependency page at "/classic"
    const studioDist = path.join(repo, 'apps', 'studio', 'dist');
    const useStudio = fs.existsSync(path.join(studioDist, 'index.html')) && !url.pathname.startsWith('/classic');
    const root = useStudio ? studioDist : here;
    let rel = url.pathname.replace(/^\/classic\/?/, '/');
    rel = rel === '/' ? 'index.html' : rel.slice(1);
    if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(rel) || rel.includes('..') || rel === 'server.mjs') return send(res, 404, 'not found', 'text/plain');
    let abs = safeJoin(root, rel);
    if (useStudio && (!fs.existsSync(abs) || fs.statSync(abs).isDirectory())) abs = path.join(studioDist, 'index.html'); // SPA fallback
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, fs.readFileSync(abs), MIME[path.extname(abs)] || 'application/octet-stream');
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`T.A.C.E Mission Studio → http://localhost:${PORT}`);
  console.log(`runs folder: ${path.relative(repo, runsDir) || '.'}`);
});
