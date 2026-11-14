// Load and persistence test for the live learner portal (Supabase RPCs).
// Usage: node tools/lms/load.mjs [--users N] [--seed S]
//   N: default 120, max 200. S: default clock-derived. The seed is always written to the output.
// Reads LMS_URL, LMS_PUBLISHABLE_KEY, LMS_ADMIN_TOKEN from repo/.env. Never prints env values.
// The run always ends with lms_admin_reset (finally) and then verifies 36 learners + 3 mentors + 0 claimed.
// Errors are recorded exactly as observed (HTTP status and message). Nothing is retried.
// Writes runs/_load/<timestamp>.json (git-ignored) and prints markdown tables to stdout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLmsClient } from '../../engine/lms.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}

export const DEFAULT_USERS = 120;
export const MAX_USERS = 200;
export const RACE_PROFILE = 'L-05';
export const RACE_ATTEMPTS = 10;
export const RACE_MESSAGE = 'That profile is taken or the PIN is wrong';
export const EXPECT = { learners: 36, mentors: 3, claimed: 0 };
// Declared before any run. It is a chosen budget for a phone on a classroom network, not a measured requirement.
export const P95_BUDGET_MS = 1000;
export const CLIENT_TIMEOUT_MS = Number(process.env.LOAD_TIMEOUT_MS || 8000);
const RACE_LABEL = 'lms_login (claim race)';
const PERSIST_LOGIN_LABEL = 'lms_login (persistence)';
const RPC_ORDER = [
  'lms_list_profiles', 'lms_create_profile', PERSIST_LOGIN_LABEL, RACE_LABEL, 'lms_me', 'lms_quiz',
  'lms_submit_quiz', 'lms_submit_mark', 'lms_request_help', 'lms_set_prefs', 'lms_inbox',
  'lms_admin_export', 'lms_admin_feed', 'lms_admin_reset',
];
const orderOf = (n) => { const i = RPC_ORDER.indexOf(n); return i < 0 ? RPC_ORDER.length : i; };
const cmp = (a, b) => { const x = String(a); const y = String(b); return x < y ? -1 : x > y ? 1 : 0; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const r3 = (x) => Math.round(x * 1000) / 1000;

export function parseArgs(argv) {
  const out = { users: DEFAULT_USERS, seed: null, rampMs: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--users') out.users = argv[++i];
    else if (a === '--seed') out.seed = argv[++i];
    else if (a === '--ramp-ms') out.rampMs = Number(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  const u = Number(out.users);
  if (!Number.isInteger(u) || u < 1 || u > MAX_USERS) throw new Error(`--users must be an integer from 1 to ${MAX_USERS}`);
  out.users = u;
  // --ramp-ms spreads user arrivals evenly over that window (0 = everyone at the same instant, the worst case).
  if (!Number.isInteger(out.rampMs) || out.rampMs < 0 || out.rampMs > 600000) throw new Error('--ramp-ms must be an integer from 0 to 600000');
  if (out.seed === null) out.seed = Date.now() % 4294967296;
  const s = Number(out.seed);
  if (!Number.isInteger(s) || s < 0 || s > 4294967295) throw new Error('--seed must be an integer from 0 to 4294967295');
  out.seed = s;
  return out;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// Everything random comes from one seeded stream, drawn in a fixed order, so the plan does not depend on timing.
export function buildPlan(n, seed) {
  const rng = mulberry32(seed);
  const digits = () => { const len = randInt(rng, 4, 6); return Array.from({ length: len }, () => String(randInt(rng, 0, 9))).join(''); };
  const users = [];
  for (let i = 1; i <= n; i++) {
    const nnn = String(i).padStart(3, '0');
    users.push({ index: i, nnn, name: `Load ${nnn}`, pin: digits(), mark: randInt(rng, 0, 100) });
  }
  const racePins = new Set();
  while (racePins.size < RACE_ATTEMPTS) racePins.add(digits());
  const planHash = crypto.createHash('sha256')
    .update(JSON.stringify([users.map((u) => [u.name, u.mark]), RACE_ATTEMPTS]))
    .digest('hex');
  return { seed, users, racePins: [...racePins], planHash };
}

// Nearest-rank percentile on an ascending array.
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function summarise(calls, wallMs) {
  const rowFor = (name, cs) => {
    const ms = cs.map((c) => c.ms).sort((a, b) => a - b);
    const errors = cs.filter((c) => !c.ok).length;
    return {
      rpc: name, count: cs.length, ok: cs.length - errors, errors,
      p50: r1(percentile(ms, 50)), p95: r1(percentile(ms, 95)), p99: r1(percentile(ms, 99)),
      max: r1(ms.length ? ms[ms.length - 1] : null),
      perSec: wallMs ? r1(cs.length / (wallMs / 1000)) : null,
    };
  };
  const byName = new Map();
  for (const c of calls) {
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push(c);
  }
  const rows = [...byName.keys()].sort((a, b) => orderOf(a) - orderOf(b) || cmp(a, b)).map((k) => rowFor(k, byName.get(k)));
  const overall = rowFor('ALL', calls);
  const eg = new Map();
  for (const c of calls) {
    if (c.ok) continue;
    const key = JSON.stringify([c.name, c.status, c.code, c.message]);
    eg.set(key, (eg.get(key) ?? 0) + 1);
  }
  const errorGroups = [...eg].map(([k, count]) => {
    const [rpc, status, code, message] = JSON.parse(k);
    return { rpc, status, code, message, count };
  }).sort((a, b) => b.count - a.count || orderOf(a.rpc) - orderOf(b.rpc) || cmp(a.rpc, b.rpc) || cmp(a.message, b.message));
  return { rows, overall, errorGroups };
}

// Wraps the client. Every call is timed and recorded with its phase. Nothing is retried here.
function makeApi(client) {
  const calls = [];
  const api = { calls, phase: 'preflight' };
  const timed = async (label, fn) => {
    const t0 = performance.now();
    try {
      const v = await fn();
      calls.push({ phase: api.phase, name: label, ms: r3(performance.now() - t0), ok: true, status: null, code: null, message: null });
      return v;
    } catch (e) {
      calls.push({ phase: api.phase, name: label, ms: r3(performance.now() - t0), ok: false, status: e.status ?? null, code: e.code ?? null, message: String(e.message) });
      throw e;
    }
  };
  api.rpc = (fn, args = {}, label = fn) => timed(label, () => client.rpc(fn, args));
  api.admin = (fn, args = {}, label = fn) => timed(label, () => client.admin(fn, args));
  return api;
}

const same = (a, b) => a != null && b != null && Number(a) === Number(b);
const latestOf = (me, skill) => me?.skills?.find((s) => s.id === skill)?.latest ?? null;

// One virtual user: create, use every feature, throw the token away, log in again, check what persisted.
async function runUser(u, api) {
  const out = { index: u.index, name: u.name, id: null, pass: false, failures: [], quizScore: null, markScore: null, ms: null };
  const t0 = performance.now();
  let at = 'lms_create_profile';
  try {
    let token = null;
    const created = await api.rpc('lms_create_profile', { p_name: u.name, p_pin: u.pin });
    out.id = created?.id ?? null;
    token = created?.token ?? null;
    if (!out.id || !token) throw new Error('create returned no id or token');

    at = 'lms_me';
    const me0 = await api.rpc('lms_me', { p_token: token });
    if (me0?.profile?.id !== out.id) out.failures.push('initial lms_me: profile id differs from create');

    at = 'lms_quiz';
    const quiz = await api.rpc('lms_quiz', { p_token: token, p_skill: 'S1' });
    if (!Array.isArray(quiz) || quiz.length === 0) throw new Error('quiz returned no questions');

    at = 'lms_submit_quiz';
    const sub = await api.rpc('lms_submit_quiz', { p_token: token, p_skill: 'S1', p_answers: quiz.map(() => 0), p_minutes: 5 });
    out.quizScore = sub?.score ?? null;

    at = 'lms_submit_mark';
    await api.rpc('lms_submit_mark', { p_token: token, p_skill: 'S2', p_score: u.mark, p_minutes: 15 });
    out.markScore = u.mark;

    at = 'lms_request_help';
    await api.rpc('lms_request_help', { p_token: token, p_skill: 'S3', p_category: 'concept', p_text: `Load test question ${u.nnn}` });

    at = 'lms_set_prefs';
    await api.rpc('lms_set_prefs', { p_token: token, p_format: 'visual', p_language: 'zu' });

    at = 'lms_inbox';
    await api.rpc('lms_inbox', { p_token: token });

    // Persistence: discard the session token, log in again with the same id and PIN, read the profile back.
    token = null;
    at = PERSIST_LOGIN_LABEL;
    const again = await api.rpc('lms_login', { p_id: out.id, p_pin: u.pin }, PERSIST_LOGIN_LABEL);
    at = 'lms_me (after login)';
    const me = await api.rpc('lms_me', { p_token: again }, 'lms_me');
    const checks = [
      ['profile id', out.id, me?.profile?.id],
      ['S1 latest score', out.quizScore, latestOf(me, 'S1')?.score],
      ['S2 latest score', out.markScore, latestOf(me, 'S2')?.score],
      ['help count', 1, Array.isArray(me?.help) ? me.help.length : null],
      ['prefs', { format: 'visual', language: 'zu' }, me?.profile?.prefs ? { format: me.profile.prefs.format, language: me.profile.prefs.language } : null],
    ];
    for (const [label, expected, actual] of checks) {
      const pass = label === 'S1 latest score' || label === 'S2 latest score' ? same(expected, actual)
        : JSON.stringify(expected) === JSON.stringify(actual);
      if (!pass) out.failures.push(`persistence ${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    }
  } catch (e) {
    out.failures.push(`${at}: ${e.message}`);
  }
  out.pass = out.failures.length === 0;
  out.ms = r3(performance.now() - t0);
  return out;
}

// Ten concurrent logins on one unclaimed profile, each with a different PIN.
async function runRace(api, pins) {
  const settled = await Promise.all(pins.map((pin, i) =>
    api.rpc('lms_login', { p_id: RACE_PROFILE, p_pin: pin }, RACE_LABEL)
      .then((tok) => ({ i, ok: typeof tok === 'string' && tok.length > 0, message: null }))
      .catch((e) => ({ i, ok: false, message: String(e.message) }))));
  const wins = settled.filter((s) => s.ok);
  const losses = settled.filter((s) => !s.ok);
  const messageCounts = new Map();
  for (const l of losses) messageCounts.set(l.message, (messageCounts.get(l.message) ?? 0) + 1);
  const lossMessages = [...messageCounts].map(([message, count]) => ({ message, count })).sort((a, b) => b.count - a.count || cmp(a.message, b.message));
  const expectedLosses = losses.filter((l) => l.message?.includes(RACE_MESSAGE)).length;
  let winnerRelogin = null;
  if (wins.length === 1) {
    try {
      const tok = await api.rpc('lms_login', { p_id: RACE_PROFILE, p_pin: pins[wins[0].i] }, RACE_LABEL);
      winnerRelogin = typeof tok === 'string' && tok.length > 0;
    } catch { winnerRelogin = false; }
  }
  const pass = wins.length === 1 && expectedLosses === RACE_ATTEMPTS - 1 && winnerRelogin === true;
  return {
    attempts: pins.length, successes: wins.length, losses: losses.length,
    lossesWithExpectedMessage: expectedLosses, lossMessages,
    winnerPosition: wins.length === 1 ? wins[0].i + 1 : null, winnerRelogin, pass,
  };
}

async function measureAdmin(api) {
  const ex = await api.admin('lms_admin_export', {});
  const f = await api.admin('lms_admin_feed', { p_after_attempt: 0, p_after_help: 0 });
  const len = (v) => (Array.isArray(v) ? v.length : null);
  return {
    export: {
      bytes: Buffer.byteLength(JSON.stringify(ex)),
      profiles: len(ex.profiles), skills: len(ex.skills), latest: len(ex.latest),
      minutesKeys: ex.minutes && typeof ex.minutes === 'object' ? Object.keys(ex.minutes).length : null,
      help: len(ex.help), availability: len(ex.availability), memory: len(ex.memory),
    },
    feed: { attempts: len(f.attempts), help: len(f.help), claimed: f.claimed ?? null },
  };
}

function environment() {
  const cpus = os.cpus();
  let commit = null;
  try { commit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
  return {
    node: process.version, platform: process.platform, osRelease: os.release(), arch: os.arch(),
    cpuModel: cpus[0]?.model ?? null, logicalCpus: cpus.length, totalMemGiB: r1(os.totalmem() / 2 ** 30),
    repoCommit: commit,
  };
}

const sast = (d) => `${new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(d)} SAST`;

// Core run. Takes an injected client so the harness can be checked against a fake backend.
export async function runLoad({ users, seed, client, rampMs = 0 }) {
  const args = { rampMs };
  const startedAt = new Date();
  const T0 = performance.now();
  const plan = buildPlan(users, seed);
  const api = makeApi(client);
  const result = {
    meta: {
      startedAtIso: startedAt.toISOString(), startedAtSast: sast(startedAt),
      command: `node tools/lms/load.mjs --users ${users} --seed ${seed}`,
      ...environment(),
    },
    config: { users, seed, rampMs: args.rampMs, maxUsers: MAX_USERS, raceAttempts: RACE_ATTEMPTS, p95BudgetMs: P95_BUDGET_MS, clientTimeoutMs: CLIENT_TIMEOUT_MS, planHash: plan.planHash },
    preflight: null, loadWallMs: null, totalWallMs: null,
    users: [], race: null, unique: null, perRpcLoad: null, admin: null, adminError: null,
    reset: { ok: false, error: null }, verify: null, verdict: null, runError: null, calls: null,
  };
  let userResults = [];
  let race = null;
  try {
    api.phase = 'preflight';
    const before = await api.rpc('lms_list_profiles', {}, 'lms_list_profiles');
    const raceRow = before.find((p) => p.id === RACE_PROFILE);
    if (!raceRow) throw new Error(`preflight: ${RACE_PROFILE} is not in the profile list`);
    if (raceRow.claimed) throw new Error(`preflight: ${RACE_PROFILE} is already claimed, so the claim race cannot run`);
    result.preflight = {
      profiles: before.length,
      learners: before.filter((p) => p.kind === 'learner').length,
      mentors: before.filter((p) => p.kind === 'mentor').length,
      claimed: before.filter((p) => p.claimed).length,
    };
    api.phase = 'load';
    const L0 = performance.now();
    [userResults, race] = await Promise.all([
      Promise.all(plan.users.map((u, i) => new Promise((r) => setTimeout(r, Math.floor((i * (args.rampMs || 0)) / plan.users.length))).then(() => runUser(u, api)))),
      runRace(api, plan.racePins),
    ]);
    result.loadWallMs = r3(performance.now() - L0);
    api.phase = 'admin';
    try { result.admin = await measureAdmin(api); } catch (e) { result.adminError = String(e.message); }
  } catch (e) {
    result.runError = String(e.message);
  } finally {
    api.phase = 'reset';
    try { await api.admin('lms_admin_reset', {}, 'lms_admin_reset'); result.reset = { ok: true, error: null }; }
    catch (e) { result.reset = { ok: false, error: String(e.message) }; }
    api.phase = 'verify';
    const createdIds = new Set(userResults.map((u) => u.id).filter(Boolean));
    try {
      const after = await api.rpc('lms_list_profiles', {}, 'lms_list_profiles');
      const learners = after.filter((p) => p.kind === 'learner').length;
      const mentors = after.filter((p) => p.kind === 'mentor').length;
      const claimed = after.filter((p) => p.claimed).length;
      result.verify = {
        learners, mentors, claimed, createdIdsStillListed: after.filter((p) => createdIds.has(p.id)).length,
        error: null,
        pass: learners === EXPECT.learners && mentors === EXPECT.mentors && claimed === EXPECT.claimed,
      };
    } catch (e) {
      result.verify = { learners: null, mentors: null, claimed: null, createdIdsStillListed: null, error: String(e.message), pass: false };
    }
  }

  result.totalWallMs = r3(performance.now() - T0);
  const loadCalls = api.calls.filter((c) => c.phase === 'load');
  const nonRace = loadCalls.filter((c) => c.name !== RACE_LABEL);
  const summary = summarise(loadCalls, result.loadWallMs ? result.loadWallMs : null);
  result.perRpcLoad = summary;
  const adminCalls = api.calls.filter((c) => c.phase === 'admin' || c.phase === 'reset' || c.phase === 'verify');
  result.adminRows = summarise(adminCalls, null).rows;
  result.users = userResults;
  result.race = race;
  const ids = userResults.map((u) => u.id).filter(Boolean);
  // Distinctness is judged over the ids that were created. Failed creates are counted separately (usersFailed).
  result.unique = { created: ids.length, distinct: new Set(ids).size, pass: new Set(ids).size === ids.length };
  result.calls = api.calls;

  const usersFailed = userResults.filter((u) => !u.pass).length;
  const p95 = summary.overall.p95;
  const failures = [];
  if (result.runError) failures.push(`run aborted: ${result.runError}`);
  if (usersFailed) failures.push(`${usersFailed} of ${users} users failed a step or a persistence check`);
  if (!race) failures.push('claim race did not run');
  else if (!race.pass) failures.push(`claim race: ${race.successes} successes, ${race.lossesWithExpectedMessage} of ${race.losses} losses had the expected message, winner re-login ${race.winnerRelogin}`);
  if (!result.unique.pass) failures.push(`unique ids: ${result.unique.distinct} distinct of ${result.unique.created} created`);
  if (result.adminError) failures.push(`admin measurement: ${result.adminError}`);
  if (!result.reset.ok) failures.push(`lms_admin_reset: ${result.reset.error}`);
  if (!result.verify?.pass) failures.push(`reset verification: ${JSON.stringify({ learners: result.verify?.learners, mentors: result.verify?.mentors, claimed: result.verify?.claimed, error: result.verify?.error })}`);
  const functionalPass = failures.length === 0;
  const latencyPass = p95 !== null && p95 <= P95_BUDGET_MS;
  if (!latencyPass) failures.push(`p95 ${p95} ms over the ${P95_BUDGET_MS} ms budget (all load-phase calls)`);
  result.verdict = {
    functionalPass, latencyPass, pass: functionalPass && latencyPass,
    userErrorCalls: nonRace.filter((c) => !c.ok).length, p95, failures,
  };
  return result;
}

export function mdTable(headers, rows) {
  const esc = (v) => (v == null ? '-' : String(v).replace(/\|/g, '/').replace(/\n/g, ' '));
  const line = (cells) => `| ${cells.map(esc).join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

export function printReport(r) {
  const out = [];
  out.push(`## Load test: ${r.config.users} users, seed ${r.config.seed}, ${r.meta.startedAtSast}`);
  out.push(`plan hash ${r.config.planHash.slice(0, 16)} · load wall ${r.loadWallMs} ms · total wall ${r.totalWallMs} ms`);
  out.push('');
  out.push('### Table 1: load phase (all users and claim race, concurrent)');
  out.push(mdTable(['RPC', 'count', 'ok', 'errors', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms', 'calls/s'],
    [...r.perRpcLoad.rows, { ...r.perRpcLoad.overall, rpc: 'ALL' }]
      .map((x) => [x.rpc, x.count, x.ok, x.errors, x.p50, x.p95, x.p99, x.max, x.perSec])));
  out.push('');
  out.push('### Table 2: admin (once, before reset), reset and verification');
  out.push(mdTable(['RPC', 'count', 'ok', 'errors', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms'],
    r.adminRows.map((x) => [x.rpc, x.count, x.ok, x.errors, x.p50, x.p95, x.p99, x.max])));
  out.push('');
  out.push(`admin export: ${r.admin?.export ? JSON.stringify(r.admin.export) : `error ${r.adminError}`}`);
  out.push(`admin feed: ${r.admin?.feed ? JSON.stringify(r.admin.feed) : 'n/a'}`);
  out.push('');
  out.push('### Errors grouped by message (load phase)');
  if (!r.perRpcLoad.errorGroups.length) out.push('none');
  else out.push(mdTable(['RPC', 'HTTP', 'code', 'message', 'count'],
    r.perRpcLoad.errorGroups.map((g) => [g.rpc, g.status, g.code, g.message, g.count])));
  out.push('');
  out.push('### Checks');
  const usersPass = r.users.filter((u) => u.pass).length;
  out.push(`- persistence and profile flow: ${usersPass} of ${r.users.length} users pass`);
  out.push(`- claim race (${RACE_PROFILE}, ${r.race?.attempts} parallel logins): ${r.race?.successes} success, ${r.race?.losses} fail, ${r.race?.lossesWithExpectedMessage} with the expected message, winner re-login ${r.race?.winnerRelogin} -> ${r.race?.pass ? 'PASS' : 'FAIL'}`);
  out.push(`- profile creates succeeded: ${r.unique.created} of ${r.config.users}`);
  out.push(`- unique profile ids: ${r.unique.distinct} distinct of ${r.unique.created} created -> ${r.unique.pass ? 'PASS' : 'FAIL'}`);
  out.push(`- lms_admin_reset: ${r.reset.ok ? 'ok' : `FAILED ${r.reset.error}`}`);
  out.push(`- after reset: ${r.verify?.learners} learners, ${r.verify?.mentors} mentors, ${r.verify?.claimed} claimed, ${r.verify?.createdIdsStillListed} load-created profiles still listed -> ${r.verify?.pass ? 'PASS' : 'FAIL'}`);
  out.push('');
  out.push(`VERDICT: ${r.verdict.pass ? 'PASS' : 'FAIL'} · functional ${r.verdict.functionalPass ? 'PASS' : 'FAIL'} · p95 ${r.verdict.p95} ms vs budget ${P95_BUDGET_MS} ms ${r.verdict.latencyPass ? 'PASS' : 'FAIL'} · user-flow error calls ${r.verdict.userErrorCalls}`);
  for (const f of r.verdict.failures) out.push(`  - ${f}`);
  console.log(out.join('\n'));
}

function writeRun(r, users) {
  const dir = path.join(ROOT, 'runs', '_load');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${r.meta.startedAtIso.replace(/[:.]/g, '-')}-u${String(users).padStart(3, '0')}.json`);
  fs.writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
  return file;
}

export function limitInflight(client, cap) {
  let active = 0; const queue = [];
  const take = () => new Promise((res) => { if (active < cap) { active++; res(); } else queue.push(res); });
  const give = () => { const next = queue.shift(); if (next) next(); else active--; };
  const wrap = (fn) => async (...a) => { await take(); try { return await fn(...a); } finally { give(); } };
  return { ...client, rpc: wrap(client.rpc.bind(client)), admin: wrap(client.admin.bind(client)) };
}

async function main() {
  const { users, seed, rampMs } = parseArgs(process.argv.slice(2));
  const raw = createLmsClient(process.env, { timeoutMs: CLIENT_TIMEOUT_MS });
  // One laptop cannot open 150 TLS connections at once (Supabase edge logs showed every request that arrived got 200;
  // the rest never left this machine). LOAD_MAX_INFLIGHT caps in-flight requests so the test measures the server,
  // the way 150 separate phones would each hold one connection. 0 = no cap.
  const cap = Number(process.env.LOAD_MAX_INFLIGHT || 0);
  const client = cap > 0 ? limitInflight(raw, cap) : raw;
  if (!client.adminConfigured) throw new Error('LMS admin is not configured (see .env)');
  const r = await runLoad({ users, seed, client, rampMs });
  const file = writeRun(r, users);
  printReport(r);
  console.log(`json: ${file}`);
  process.exitCode = r.verdict.pass ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(`load test aborted: ${e.message}`); process.exitCode = 2; });
}
