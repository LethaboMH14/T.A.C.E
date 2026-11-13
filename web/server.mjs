#!/usr/bin/env node
// Mission Studio server: zero dependencies.
// - Serves the static page from web/.
// - POST /api/runs {scenario, pace}  -> starts a REAL run in this process (engine/run.mjs).
// - GET  /api/runs                    -> recent runs from runs/.
// - GET  /api/runs/:id/events         -> Server-Sent Events: replays events.jsonl, then tails it live.
// - GET  /api/runs/:id/file?path=...  -> a file from that run's artifacts/ (read-only, path-checked).
// - GET  /api/sources/:file           -> an admitted fixture file (read-only), for Evidence X-Ray.
// The page only ever shows what these files say. Nothing here can send a message anywhere.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMission } from '../engine/run.mjs';
import { EDU_DOMAIN } from '../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../fixtures/education-recovery/scenarios.mjs';
import { safeJoin } from '../engine/artifacts.mjs';
import { loadScenario, stampRunId, loadLocalEnv } from '../cli/tace.mjs';
loadLocalEnv();

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const runsDir = path.resolve(repo, process.env.TACE_RUNS || 'runs');
const PORT = Number(process.env.PORT || 4173);
const active = new Map(); // runId -> promise

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8', '.csv': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const RUN_ID = /^[A-Za-z0-9_-]{1,80}$/;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function listRuns() {
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && RUN_ID.test(d.name)).map((d) => {
    const ev = path.join(runsDir, d.name, 'events.jsonl');
    let first = null; let last = null;
    if (fs.existsSync(ev)) {
      const lines = fs.readFileSync(ev, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length) { first = JSON.parse(lines[0]); last = JSON.parse(lines[lines.length - 1]); }
    }
    return { runId: d.name, scenarioId: first?.data?.scenarioId ?? null, title: first?.data?.title ?? null, startedAt: first?.ts ?? null, status: last?.type === 'RUN_FINISHED' ? last.data.status : (active.has(d.name) ? 'RUNNING' : 'INCOMPLETE') };
  }).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

function streamEvents(req, res, runId) {
  const file = path.join(runsDir, runId, 'events.jsonl');
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
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

function startRun(body) {
  const scenario = loadScenario(String(body.scenario || ''));
  const pace = Math.max(0, Math.min(3000, Number(body.pace ?? 650)));
  const runId = stampRunId(scenario.id);
  const runDir = path.join(runsDir, runId);
  const p = runMission({ scenario, domain: EDU_DOMAIN, sourcesDir: EDU_DOMAIN.sourcesDir, runDir, runId, trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: pace, model: body.model === 'off' ? 'off' : 'auto' })
    .catch((err) => { console.error(`[run ${runId}]`, err); })
    .finally(() => active.delete(runId));
  active.set(runId, p);
  return { runId, scenarioId: scenario.id, pace };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0] === 'api') {
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
          if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(res, 403, { error: 'cross-origin request refused' });
          if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'send JSON' });
          if (active.size > 0) return send(res, 409, { error: 'a run is already in progress; wait for it to finish' });
          let raw = ''; for await (const c of req) { raw += c; if (raw.length > 4096) return send(res, 413, { error: 'too large' }); }
          try { return send(res, 202, startRun(JSON.parse(raw || '{}'))); } catch (e) { return send(res, 400, { error: e.message }); }
        }
      }
      if (parts[1] === 'runs' && RUN_ID.test(parts[2] || '')) {
        const runId = parts[2];
        if (!fs.existsSync(path.join(runsDir, runId))) return send(res, 404, { error: 'no such run' });
        if (parts[3] === 'events') return streamEvents(req, res, runId);
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
