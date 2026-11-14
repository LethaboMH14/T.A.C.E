// Shared helpers for the end-to-end mission tests. Node built-ins only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { runMission } from '../../engine/run.mjs';
import { EDU_DOMAIN } from '../../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../../fixtures/education-recovery/scenarios.mjs';
import { parseCsv } from '../../engine/csv.mjs';

const SCENARIOS = new URL('../../fixtures/education-recovery/v1/scenarios/', import.meta.url);

export function loadScenario(id) {
  return JSON.parse(fs.readFileSync(new URL(`${id}.json`, SCENARIOS), 'utf8'));
}

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Creates a fresh temp folder, runs fn(tmp), always removes the folder. */
export async function withTempDir(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-e2e-'));
  try {
    return await fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Runs a mission into runDir (must not exist yet) with the fixture source folder and trusted context. */
export async function runScenario({ scenario, domain = EDU_DOMAIN, runDir, runId = 'e2e' }) {
  return runMission({
    scenario, domain, sourcesDir: EDU_DOMAIN.sourcesDir, runDir, runId,
    trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: 0,
  });
}

export function readEvents(runDir) {
  return fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function readIndex(runDir) {
  const p = path.join(runDir, 'artifacts', 'index.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
}

/** Highest-version ref for a file name, or null. */
export function latestRef(index, name) {
  const m = index.filter((r) => r.name === name);
  return m.length ? m.reduce((a, b) => (b.version > a.version ? b : a)) : null;
}

export function refPath(runDir, ref) {
  return path.join(runDir, ref.file);
}

export function readRef(runDir, ref) {
  return fs.readFileSync(refPath(runDir, ref), 'utf8');
}

export function readLatestCsv(runDir, name) {
  const ref = latestRef(readIndex(runDir), name);
  if (!ref) return null;
  return parseCsv(readRef(runDir, ref));
}

export function readLatestJson(runDir, name) {
  const ref = latestRef(readIndex(runDir), name);
  if (!ref) return null;
  return JSON.parse(readRef(runDir, ref));
}

/** Index of the first event at or after `from` matching pred, or -1. */
export function findFrom(events, from, pred) {
  for (let i = from; i < events.length; i++) if (pred(events[i])) return i;
  return -1;
}

/** Every file under a folder, recursively, as absolute paths. */
export function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}
