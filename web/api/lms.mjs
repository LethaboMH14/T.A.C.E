// T.A.C.E LMS routes (live class portal bridge). All JSON, same-origin POSTs via ctx.readJson.
//   GET  /api/lms/status            configured flag, public URL, counts, notification channels (no secrets)
//   GET  /api/lms/live              Server-Sent Events: new attempts and help requests, plus a counts event
//   POST /api/lms/run               {goal?, model?:'off'} -> export -> snapshot -> real run -> 202
//   POST /api/runs/:id/deliver      {confirm:true, notify?:true} -> deliver the run's drafts to portal inboxes, remember facts,
//                                   then "check your portal" email/SMS to opted-in people only (counts only)
//   POST /api/lms/reset             {confirm:'RESET'} -> clear audience activity (demo reset)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createLmsClient } from '../../engine/lms.mjs';
import { createNotifier, notifyRecipients } from '../../engine/notify.mjs';
import { openLedger } from '../../engine/ledger.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import { EVENT, RUN_STATUS } from '../../engine/contracts.mjs';
import { snapshot } from '../../domains/education/lms-snapshot.mjs';
import { EDU_DOMAIN } from '../../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../../fixtures/education-recovery/scenarios.mjs';
import { normalizeGoalTurn } from '../../tools/gate02/normalize-turn.mjs';
import { validateGoalProposal } from '../../tools/gate02/goal-proposal.mjs';
import { stampRunId } from '../../cli/tace.mjs';

const RUN_ID = /^[A-Za-z0-9_-]{1,80}$/;
const ARTIFACT_FILE = /^artifacts\/[a-z0-9][a-z0-9._-]*\.(csv|json|md|ics|xlsx)$/;
const SIX = ['trainees', 'assessments', 'skills', 'mentors', 'availability', 'interventions'];
const NINE = [...SIX, 'help_requests', 'learner_prefs', 'memory'];
const POLL_MS = 2000;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const byString = (a, b) => (a === b ? 0 : (String(a) < String(b) ? -1 : 1));
const isId = (v) => (typeof v === 'number' && Number.isSafeInteger(v)) || (typeof v === 'string' && /^\d{1,15}$/.test(v));
const toNum = (v) => (typeof v === 'number' ? v : Number(v));

let starting = false;          // guards POST /api/lms/run against two exports racing
const delivering = new Set();  // run ids whose delivery is in flight

// Intake for the weekly check-in: all nine names if the G02 validator accepts the proposal with them, else the original six.
function weeklyScenario() {
  const base = JSON.parse(fs.readFileSync(path.join(EDU_DOMAIN.scenariosDir, 'weekly_checkin.json'), 'utf8'));
  const n = normalizeGoalTurn({ goal: base.goalText, sources: NINE.map((r) => ({ kind: 'upload', ref: r })) }, TRUSTED_FIXTURE_CONTEXT);
  const nineOk = n.status === 'NORMALIZED' && validateGoalProposal(base.proposal, n.record).status === 'PROPOSAL_VALID';
  return { base, intakeSources: nineOk ? NINE : SIX };
}

function buildScenario(goal) {
  const { base, intakeSources } = weeklyScenario();
  if (goal) {
    // Free-text goal: no prepared proposal, so the Goal Reader model must draft one (model off = blocked, honestly).
    return { id: 'live_lms', title: `Live class: ${goal.slice(0, 60)}`, goalText: goal, intakeSources: NINE, proposal: null, inject: null };
  }
  return { id: 'live_lms', title: 'Live class: weekly check-in', goalText: base.goalText, intakeSources, proposal: base.proposal, inject: null };
}

function lmsOf(ctx) { return createLmsClient(ctx.env); }

function readIndex(runDir) {
  const p = path.join(runDir, 'artifacts', 'index.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
}
function latestRef(refs, name) {
  let best = null;
  for (const r of refs) if (r && r.name === name && Number.isInteger(r.version) && (!best || r.version > best.version)) best = r;
  return best;
}
// Read one artifact and re-check its sha256 against the index before any use.
function readRef(runDir, ref) {
  if (!ARTIFACT_FILE.test(ref.file)) throw Object.assign(new Error(`bad artifact path for ${ref.name}`), { code: 'BAD_ARTIFACT' });
  const buf = fs.readFileSync(path.join(runDir, ref.file));
  if (sha256(buf) !== ref.digest) throw Object.assign(new Error(`${ref.name} changed on disk after the run wrote it`), { code: 'ARTIFACT_DIGEST' });
  return buf;
}
function readEvents(runDir, runId) {
  const L = openLedger(runDir, runId);
  try { return L.all(); } finally { L.close(); }
}
function appendEvent(runDir, runId, type, data) {
  const L = openLedger(runDir, runId);
  try { return L.append(type, data, { role: 'LMS' }); } finally { L.close(); }
}
function waitForRunStart(runDir, ms) {
  const file = path.join(runDir, 'events.jsonl');
  return new Promise((resolve) => {
    const started = Date.now();
    const look = () => {
      if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(`"type":"${EVENT.RUN_STARTED}"`)) return resolve(true);
      if (Date.now() - started > ms) return resolve(false);
      setTimeout(look, 50);
    };
    look();
  });
}

// ---------- notifications (Brevo): built per request from the environment, like the LMS client
function notifierOf(ctx) { return createNotifier(ctx.env); }

// ---------- GET /api/lms/status
async function status(req, res, ctx) {
  let notifier;
  try { notifier = notifierOf(ctx); } catch (e) { return ctx.send(res, 500, { error: e.message }); }
  const st = notifier.status();
  const notifyState = { notify: { email: { connected: st.email.connected }, sms: { connected: st.sms.connected } }, portalUrl: notifier.portalUrl };
  const c = lmsOf(ctx);
  if (!c.configured) return ctx.send(res, 200, { configured: false, url: null, counts: null, ...notifyState });
  try {
    const profiles = await c.rpc('lms_list_profiles');
    let attemptsLive = null; let help = null;
    if (c.adminConfigured) {
      const f = await c.admin('lms_admin_feed', { p_after_attempt: 0, p_after_help: 0 });
      attemptsLive = f.attempts.length; help = f.help.length;
    }
    return ctx.send(res, 200, {
      configured: true, url: c.url,
      counts: { profiles: profiles.length, claimed: profiles.filter((p) => p.claimed).length, attempts_live: attemptsLive, help },
      ...notifyState,
    });
  } catch (e) {
    return ctx.send(res, 502, { configured: true, url: c.url, counts: null, error: e.message, ...notifyState });
  }
}

// ---------- GET /api/lms/live (Server-Sent Events)
function live(req, res, ctx, url) {
  const c = lmsOf(ctx);
  if (!c.adminConfigured) return ctx.send(res, 503, { configured: c.configured, error: 'LMS admin is not configured' });
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive', 'x-content-type-options': 'nosniff', 'x-accel-buffering': 'no' });
  res.write(':' + ' '.repeat(2048) + '\n\n'); // pushes the stream past proxy buffers (tunnels, CDNs)
  let closed = false;
  let busy = false;
  let afterAttempt = 0; let afterHelp = 0; let totalAttempts = 0; let totalHelp = 0;
  const seen = new Set();
  let names = new Map();
  let lastCounts = '';
  // Each update carries a comment pad so proxies that buffer small chunks (e.g. a Cloudflare tunnel) forward it at once.
  const PAD = `:${' '.repeat(4096)}\n\n`;
  const write = (event, data) => { if (!closed) res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n${PAD}`); };
  const refreshNames = async () => {
    const ps = await c.rpc('lms_list_profiles');
    names = new Map(ps.map((p) => [p.id, p.display_name]));
  };
  const maxId = (rows, key) => rows.reduce((m, r) => (isId(r[key]) && toNum(r[key]) > m ? toNum(r[key]) : m), 0);
  const pushCounts = (claimed) => {
    const counts = { claimed, attempts: totalAttempts, help: totalHelp };
    const key = JSON.stringify(counts);
    if (key !== lastCounts) { lastCounts = key; write('counts', counts); }
  };

  async function tick() {
    if (busy || closed) return;
    busy = true;
    try {
      const f = await c.admin('lms_admin_feed', { p_after_attempt: afterAttempt, p_after_help: afterHelp });
      const attempts = Array.isArray(f.attempts) ? f.attempts : [];
      const helps = Array.isArray(f.help) ? f.help : [];
      if (attempts.length || helps.length) await refreshNames().catch(() => {});
      for (const a of attempts) {
        const id = a.attempt_id ?? a.id;
        const key = `attempt:${id ?? JSON.stringify(a)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        totalAttempts += 1;
        if (isId(id)) afterAttempt = Math.max(afterAttempt, toNum(id));
        const learner = a.profile_id ?? a.trainee_id ?? null;
        write(null, { type: 'attempt', id: id ?? null, learner, name: names.get(learner) ?? learner, skill: a.skill_id ?? null, score: a.score ?? null, source: a.source ?? null, at: a.at ?? null });
      }
      for (const h of helps) {
        const id = h.help_id ?? h.request_id ?? h.id;
        const key = `help:${id ?? JSON.stringify(h)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        totalHelp += 1;
        if (isId(id)) afterHelp = Math.max(afterHelp, toNum(id));
        const learner = h.profile_id ?? h.trainee_id ?? null;
        write(null, { type: 'help', id: id ?? null, learner, name: names.get(learner) ?? learner, skill: h.skill_id ?? null, category: h.category ?? null, text: h.text ?? null, at: h.at ?? null });
      }
      pushCounts(f.claimed ?? null);
    } catch (e) {
      write('error', { message: e.message });
    } finally {
      busy = false;
    }
  }

  // Start from "now": what is already there is counted, not replayed. Explicit cursors in the URL override.
  const qa = url.searchParams.get('after_attempt') || ''; const qh = url.searchParams.get('after_help') || '';
  (async () => {
    try {
      const f0 = await c.admin('lms_admin_feed', { p_after_attempt: 0, p_after_help: 0 });
      totalAttempts = f0.attempts.length; totalHelp = f0.help.length;
      afterAttempt = /^\d{1,15}$/.test(qa) ? Number(qa) : maxId(f0.attempts, 'attempt_id');
      afterHelp = /^\d{1,15}$/.test(qh) ? Number(qh) : maxId(f0.help, 'help_id');
      await refreshNames().catch(() => {});
      pushCounts(f0.claimed ?? null);
    } catch (e) {
      write('error', { message: e.message });
    }
  })();
  const timer = setInterval(tick, POLL_MS);
  const ping = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, 15000);
  res.on('close', () => { closed = true; clearInterval(timer); clearInterval(ping); });
  return true;
}

// ---------- POST /api/lms/run
async function runLive(req, res, ctx) {
  const body = await ctx.readJson(req, res);
  if (body === null) return;
  if (starting || ctx.active.size > 0) return ctx.send(res, 409, { error: 'a run is already in progress; wait for it to finish' });
  let goal = null;
  if (body.goal !== undefined && body.goal !== null) {
    if (typeof body.goal !== 'string' || body.goal.length > 500) return ctx.send(res, 400, { error: 'goal must be text of at most 500 characters' });
    goal = body.goal.trim() || null;
  }
  if (body.model !== undefined && body.model !== 'off') return ctx.send(res, 400, { error: "model must be 'off' or left out" });
  const c = lmsOf(ctx);
  if (!c.adminConfigured) return ctx.send(res, 503, { error: 'LMS admin is not configured' });

  starting = true;
  try {
    const stamp = stampRunId('live_lms');
    const snapDir = path.join(ctx.runsDir, '_lms', stamp);
    const runDir = path.join(ctx.runsDir, stamp);
    if (fs.existsSync(snapDir) || fs.existsSync(runDir)) return ctx.send(res, 409, { error: 'a live run started in this same second; try again' });
    const exportJson = await c.admin('lms_admin_export');
    const snap = snapshot(exportJson, snapDir);
    const rel = `runs/_lms/${stamp}`;
    const started = ctx.startRun({ scenarioObject: buildScenario(goal), sourcesDir: snapDir, model: body.model === 'off' ? 'off' : 'auto' });
    const runPath = path.join(ctx.runsDir, started.runId);
    await waitForRunStart(runPath, 5000);
    const snapData = { at: snap.at, dir: rel, files: snap.files, learners: snap.learners, helpRequests: snap.helpRequests, defaultedLoginDay: snap.defaultedLoginDay };
    appendEvent(runPath, started.runId, EVENT.LMS_SNAPSHOT, snapData);
    return ctx.send(res, 202, { runId: started.runId, scenarioId: started.scenarioId, snapshot: snapData });
  } catch (e) {
    return ctx.send(res, 500, { error: e.message });
  } finally {
    starting = false;
  }
}

// ---------- POST /api/runs/:id/deliver
// "Check your portal" email/SMS, after the inbox write. Only people the database says opted in are contacted.
// The ledger and the response carry counts and error codes, never addresses.
async function notifyDelivered(ctx, c, runDir, runId, notifyOn, ids, displayNameOf) {
  if (!notifyOn) return { email: 'skipped', sms: 'skipped', counts: null };
  const notifier = notifierOf(ctx);
  const st = notifier.status();
  if (!st.email.connected && !st.sms.connected) return { email: 'not_connected', sms: 'not_connected', counts: null };
  const contacts = await c.admin('lms_admin_contacts', { p_ids: ids });
  if (!Array.isArray(contacts)) throw new Error('lms_admin_contacts returned no list');
  const people = contacts.slice().sort((a, b) => byString(a.profile_id, b.profile_id)).map((x) => ({
    displayName: displayNameOf.get(x.profile_id), email: x.email || null, phone: x.phone || null,
  }));
  const { counts, errors } = await notifyRecipients(notifier, people, { concurrency: 5 });
  appendEvent(runDir, runId, EVENT.NOTIFICATIONS_SENT, { email: counts.email, sms: counts.sms, channel: 'email_sms', approvedBy: 'coordinator' });
  const state = (ch) => {
    if (!st[ch].connected) return 'not_connected';
    const { sent, failed } = counts[ch];
    if (sent + failed === 0) return 'skipped';
    if (failed === 0) return 'sent';
    return sent === 0 ? 'failed' : 'partial';
  };
  return { email: state('email'), sms: state('sms'), counts, errors };
}

function loadSnapshot(ctx, snapEv) {
  const dir = String(snapEv.data.dir || '');
  const abs = path.resolve(ctx.repo, dir);
  if (!dir.startsWith('runs/_lms/') || !abs.startsWith(path.resolve(ctx.runsDir) + path.sep)) {
    throw Object.assign(new Error('snapshot folder is outside runs/_lms'), { code: 'BAD_SNAPSHOT' });
  }
  for (const f of snapEv.data.files || []) {
    const buf = fs.readFileSync(path.join(abs, f.name));
    if (sha256(buf) !== f.digest) throw Object.assign(new Error(`snapshot file ${f.name} changed after the run started`), { code: 'SNAPSHOT_DIGEST' });
  }
  const csv = (n) => parseCsv(fs.readFileSync(path.join(abs, n), 'utf8')).rows;
  return {
    skills: csv('skills.csv'), trainees: csv('trainees.csv'), assessments: csv('assessments.csv'),
    mentors: csv('mentors.csv'), prefs: csv('learner_prefs.csv'), help: csv('help_requests.csv'),
  };
}

async function deliver(req, res, ctx, runId) {
  const body = await ctx.readJson(req, res);
  if (body === null) return;
  if (body.confirm !== true) return ctx.send(res, 400, { error: 'send {"confirm": true} to deliver this run to the portal inboxes' });
  if (body.notify !== undefined && typeof body.notify !== 'boolean') return ctx.send(res, 400, { error: 'notify must be true or false (default true)' });
  if (ctx.active.has(runId)) return ctx.send(res, 409, { error: 'run is still in progress' });
  if (delivering.has(runId)) return ctx.send(res, 409, { error: 'delivery of this run is already in progress' });
  const c = lmsOf(ctx);
  if (!c.adminConfigured) return ctx.send(res, 503, { error: 'LMS admin is not configured' });
  const runDir = path.join(ctx.runsDir, runId);
  if (!fs.existsSync(path.join(runDir, 'events.jsonl'))) return ctx.send(res, 404, { error: 'no such run' });
  const events = readEvents(runDir, runId);
  if (events.some((e) => e.type === EVENT.MESSAGES_DELIVERED)) return ctx.send(res, 409, { error: 'this run was already delivered' });

  delivering.add(runId);
  try {
    const refs = readIndex(runDir);
    const mref = latestRef(refs, 'final-manifest.json');
    if (!mref) return ctx.send(res, 409, { error: 'run has no final manifest yet' });
    const manifest = JSON.parse(readRef(runDir, mref).toString('utf8'));
    if (manifest.status !== RUN_STATUS.VERIFIED && manifest.status !== RUN_STATUS.PARTIAL) {
      return ctx.send(res, 409, { error: `run status is ${manifest.status}; only VERIFIED or PARTIAL runs can be delivered` });
    }
    const snapEv = events.filter((e) => e.type === EVENT.LMS_SNAPSHOT).pop();
    if (!snapEv) return ctx.send(res, 409, { error: 'this run was not started from the live LMS (no LMS snapshot)' });
    const snap = loadSnapshot(ctx, snapEv);

    const dref = latestRef(refs, 'unsent-message-drafts.json');
    if (!dref) return ctx.send(res, 409, { error: 'this run has no message drafts' });
    const draftsBuf = readRef(runDir, dref);
    const draftsDigest = sha256(draftsBuf);
    const drafts = JSON.parse(draftsBuf.toString('utf8'));
    const draftRows = Array.isArray(drafts.drafts) ? drafts.drafts : [];
    if (drafts.status_all !== 'UNSENT' || draftRows.some((d) => d.status !== 'UNSENT')) return ctx.send(res, 409, { error: 'drafts are not all UNSENT; refusing to deliver' });
    if (draftRows.length === 0) return ctx.send(res, 409, { error: 'the drafts file is empty; nothing to deliver' });

    const planRef = latestRef(refs, 'improvement-plan.json');
    const planItems = planRef ? (JSON.parse(readRef(runDir, planRef).toString('utf8')).items || []) : [];
    const schedRef = latestRef(refs, 'mentor-schedule.csv');
    const sched = schedRef ? parseCsv(readRef(runDir, schedRef).toString('utf8')).rows : [];
    const sessionById = new Map(sched.map((r) => [r.session_id, r]));
    const skillName = new Map(snap.skills.map((s) => [s.skill_id, s.name]));
    const traineeName = new Map(snap.trainees.map((t) => [t.trainee_id, t.display_name]));
    const mentorName = new Map(snap.mentors.map((m) => [m.mentor_id, m.display_name]));
    const prefOf = new Map(snap.prefs.map((p) => [p.trainee_id, p]));
    const scoreOf = new Map(snap.assessments.map((r) => [`${r.trainee_id}|${r.skill_id}`, r.score === '' ? null : Number(r.score)]));
    const dayLabel = (r) => `${r.day} ${r.date}`;
    const snapAt = typeof snapEv.data.at === 'string' ? snapEv.data.at.slice(0, 10) : '';

    const skillsFor = (trainee) => snap.skills.slice().sort((a, b) => byString(a.skill_id, b.skill_id)).map((s) => {
      const score = scoreOf.get(`${trainee}|${s.skill_id}`) ?? null;
      const threshold = Number(s.threshold);
      return { skill_id: s.skill_id, name: s.name, score, threshold, below: score !== null && score < threshold };
    });

    const messages = [];
    const learnerDrafts = draftRows.filter((x) => x.to_role === 'learner');
    const mentorDrafts = draftRows.filter((x) => x.to_role === 'mentor');
    for (const d of learnerDrafts) {
      const pref = prefOf.get(d.to_id) || { format: 'text', language: 'en' };
      const row = sessionById.get(d.session_id);
      // The inbox message reads as a short letter: the reviewed draft, then why, then what to work on this week.
      // Every sentence comes from the verified draft; nothing new is written here.
      const work = Array.isArray(d.what_to_work_on) ? d.what_to_work_on.filter((x) => typeof x === 'string' && x) : [];
      const letter = [
        d.body,
        typeof d.why === 'string' && d.why ? `Why this plan: ${d.why}` : null,
        work.length ? `This week, work on: ${work.join(', ')}.` : null,
        'Your study steps are below. Reply to your coordinator if anything here is wrong.',
      ].filter(Boolean).join('\n\n');
      const skillById = new Map(skillsFor(d.to_id).map((s) => [s.skill_id, s]));
      const niceDate = (iso) => { const t = Date.parse(`${iso}T00:00:00Z`); return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : iso; };
      const when = row ? `Before your session on ${row.day} ${niceDate(row.date)} at ${row.start}` : undefined;
      const withWho = row ? (mentorName.get(row.mentor_id) ?? row.mentor_id) : undefined;
      const draftSteps = Array.isArray(d.steps) ? d.steps.map((s) => {
        if (!s || typeof s !== 'object') return null;
        if (s.type === 'if_then_plan') return { type: s.type, title: s.text, why: 'Deciding in advance makes it easier to follow through.' };
        const sk = skillById.get(s.skill_id);
        return {
          type: s.type, title: s.title, body: s.body, when, with: withWho,
          why: sk && sk.score !== null ? `Your ${sk.name} score is ${sk.score}; the pass mark is ${sk.threshold}.` : undefined,
        };
      }).filter(Boolean) : [];
      messages.push({
        profile_id: d.to_id, kind: 'plan', subject: d.subject, body: letter,
        format: pref.format || 'text', language: pref.language || 'en',
        payload: {
          skills: skillsFor(d.to_id),
          // Prefer the draft's own study steps (worked example, quick quiz, if-then plan); fall back to the plan items.
          steps: draftSteps.length ? draftSteps
            : planItems.filter((i) => i.trainee_id === d.to_id).map((i) => ({ skill_id: i.skill_id, title: i.title, why: i.reason, when, with: withWho })),
          session: row ? { mentor: mentorName.get(row.mentor_id) ?? row.mentor_id, day_label: dayLabel(row), start: row.start, end: row.end } : null,
          machine_translated: false,
        },
      });
    }
    for (const d of mentorDrafts) {
      const mine = sched.filter((r) => r.mentor_id === d.to_id);
      messages.push({
        profile_id: d.to_id, kind: 'plan', subject: d.subject, body: d.body, format: 'text', language: 'en',
        payload: {
          role: 'mentor',
          sessions: mine.map((r) => ({ learner: traineeName.get(r.trainee_id) ?? r.trainee_id, skill: skillName.get(r.skill_id) ?? r.skill_id, day_label: dayLabel(r), start: r.start, end: r.end })),
          machine_translated: false,
        },
      });
    }

    // Facts remembered per learner: below-threshold scores, help requests, booked sessions. Derived in code.
    const facts = [];
    for (const t of snap.trainees.slice().sort((a, b) => byString(a.trainee_id, b.trainee_id))) {
      for (const s of skillsFor(t.trainee_id)) {
        if (s.below) facts.push({ profile_id: t.trainee_id, fact: `Below threshold in ${s.skill_id} (${s.score}) on ${snapAt}` });
      }
      for (const h of snap.help.filter((x) => x.trainee_id === t.trainee_id)) {
        facts.push({ profile_id: t.trainee_id, fact: `Asked for help: ${h.category || 'other'} on ${h.skill_id || 'no skill'}` });
      }
    }
    for (const d of learnerDrafts) {
      const row = sessionById.get(d.session_id);
      if (row) facts.push({ profile_id: d.to_id, fact: `Booked with ${mentorName.get(row.mentor_id) ?? row.mentor_id}, ${row.day} ${row.start}` });
    }

    const got = await c.admin('lms_admin_deliver', { p_run: runId, p_messages: messages });
    const delivered = Number.isInteger(got) ? got : messages.length;
    appendEvent(runDir, runId, EVENT.MESSAGES_DELIVERED, {
      count: delivered, learners: learnerDrafts.length, mentors: mentorDrafts.length, draftsDigest,
      approvedBy: 'coordinator', channel: 'portal_inbox',
    });

    let remembered = 0; let rememberError = null;
    if (facts.length) {
      try {
        const r = await c.admin('lms_admin_remember', { p_run: runId, p_facts: facts });
        remembered = Number.isInteger(r) ? r : facts.length;
      } catch (e) { rememberError = e.message; }
    }

    // The inbox write has already succeeded, so a notification failure is reported in the response and never undoes it.
    const displayNameOf = new Map([...traineeName, ...mentorName]);
    const ids = [...new Set(messages.map((m) => m.profile_id))].sort(byString);
    let notify;
    try {
      notify = await notifyDelivered(ctx, c, runDir, runId, body.notify !== false, ids, displayNameOf);
    } catch (e) {
      notify = { email: 'failed', sms: 'failed', counts: null, error: e.message };
    }
    return ctx.send(res, 200, { delivered, remembered, learners: learnerDrafts.length, mentors: mentorDrafts.length, draftsDigest, rememberError, notify });
  } catch (e) {
    return ctx.send(res, 500, { error: e.message, code: e.code ?? null });
  } finally {
    delivering.delete(runId);
  }
}

// ---------- POST /api/lms/reset
async function reset(req, res, ctx) {
  const body = await ctx.readJson(req, res);
  if (body === null) return;
  if (body.confirm !== 'RESET') return ctx.send(res, 400, { error: 'send {"confirm": "RESET"} to clear audience activity' });
  const c = lmsOf(ctx);
  if (!c.adminConfigured) return ctx.send(res, 503, { error: 'LMS admin is not configured' });
  try {
    await c.admin('lms_admin_reset');
    return ctx.send(res, 200, { ok: true });
  } catch (e) {
    return ctx.send(res, 502, { error: e.message });
  }
}

export async function handle(req, res, url, parts, ctx) {
  if (parts[0] !== 'api') return false;
  if (parts[1] === 'lms') {
    const route = parts.slice(2).join('/');
    if (req.method === 'GET' && route === 'status') { await status(req, res, ctx); return true; }
    if (req.method === 'GET' && route === 'live') { live(req, res, ctx, url); return true; }
    if (req.method === 'POST' && route === 'run') { await runLive(req, res, ctx); return true; }
    if (req.method === 'POST' && route === 'reset') { await reset(req, res, ctx); return true; }
    ctx.send(res, 404, { error: 'unknown LMS endpoint' });
    return true;
  }
  if (parts[1] === 'runs' && parts.length === 4 && parts[3] === 'deliver' && RUN_ID.test(parts[2] || '')) {
    if (req.method !== 'POST') { ctx.send(res, 405, { error: 'POST only' }); return true; }
    await deliver(req, res, ctx, parts[2]);
    return true;
  }
  return false;
}
