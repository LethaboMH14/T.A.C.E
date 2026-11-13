// Unit tests for the independent education reviewer (domains/education/reviewer.mjs).
// Real admitted fixtures + a real artifact store in a temp dir. The artifacts below are written by
// THIS test file (its own small producer code), not by any worker module, so the reviewer is
// checked against an independent reading of the rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitSources } from '../../engine/sources.mjs';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { toCsv } from '../../engine/csv.mjs';
import { CHECK_STATUS, KIND } from '../../engine/contracts.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { review } from '../../domains/education/reviewer.mjs';
import {
  AT_RISK_MIN_GAPS, DAYS, DRAFT_STATUS, LATE_LOGIN_DAY, RULES_VERSION, SESSION_MINUTES, WEEK_OF,
} from '../../domains/education/rules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../../fixtures/education-recovery/v1');

const admitted = admitSources(FIXTURE, EDU_SOURCE_SPECS);
assert.equal(admitted.status, 'ADMITTED', `fixtures must admit: ${JSON.stringify(admitted.problems)}`);
const S = admitted.sources;
const BASELINE = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'scenarios', 'baseline.json'), 'utf8'));

const GAP_HEADER = ['trainee_id', 'display_name', 'skill_id', 'score', 'threshold', 'shortfall', 'at_risk', 'source_file', 'source_row'];
const SCHEDULE_HEADER = ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'intervention_id', 'status'];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function dateFor(day) {
  const i = DAYS.indexOf(day);
  const [y, m, d] = WEEK_OF.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
}

/** Test-side computation of every figure from the admitted rows (independent of the reviewer). */
function figures() {
  const trainees = [...S.trainees.rows].sort((a, b) => cmp(a.trainee_id, b.trainee_id));
  const skills = [...S.skills.rows].sort((a, b) => cmp(a.skill_id, b.skill_id));
  const cells = new Map();
  S.assessments.rows.forEach((r, i) => cells.set(`${r.trainee_id}|${r.skill_id}`, { score: r.score, line: S.assessments.rowNumbers[i] }));
  const perSkill = new Map(skills.map((s) => [s.skill_id, { present: [], missing: 0, below: 0 }]));
  const gaps = [];
  const atRisk = [];
  for (const t of trainees) {
    const g = [];
    for (const s of skills) {
      const c = cells.get(`${t.trainee_id}|${s.skill_id}`);
      const ps = perSkill.get(s.skill_id);
      if (!c || c.score === '') { ps.missing += 1; continue; }
      const sc = Number(c.score);
      const th = Number(s.threshold);
      ps.present.push(sc);
      if (sc < th) {
        ps.below += 1;
        g.push({ trainee_id: t.trainee_id, display_name: t.display_name, skill_id: s.skill_id, score: sc, threshold: th, shortfall: th - sc, row: c.line });
      }
    }
    gaps.push(...g);
    if (g.length >= AT_RISK_MIN_GAPS || (Number(t.first_login_day) >= LATE_LOGIN_DAY && g.length >= 1)) {
      let pri = null;
      for (const x of g) if (!pri || x.shortfall > pri.shortfall) pri = x;
      atRisk.push({ trainee_id: t.trainee_id, display_name: t.display_name, priority: pri, gaps: g });
    }
  }
  const skillSummary = skills.map((s) => {
    const ps = perSkill.get(s.skill_id);
    const sum = ps.present.reduce((a, b) => a + b, 0);
    return {
      skill_id: s.skill_id,
      name: s.name,
      threshold: Number(s.threshold),
      mean: ps.present.length ? Math.round((sum / ps.present.length) * 10) / 10 : null,
      present: ps.present.length,
      missing: ps.missing,
      below_threshold: ps.below,
    };
  });
  return {
    trainees,
    gaps,
    atRisk,
    skillSummary,
    atRiskIds: atRisk.map((a) => a.trainee_id),
    assessed: skillSummary.reduce((n, s) => n + s.present, 0),
    missing: skillSummary.reduce((n, s) => n + s.missing, 0),
  };
}

/** Greedy, deterministic, test-side schedule (mentor by id, earliest free hour Mon to Fri). */
function schedule(F, unavailable = []) {
  const mentors = [...S.mentors.rows].sort((a, b) => cmp(a.mentor_id, b.mentor_id))
    .map((m) => ({ id: m.mentor_id, skills: m.skills.split(';'), cap: Number(m.capacity), load: 0 }));
  const windows = S.availability.rows.map((w) => ({ mentor_id: w.mentor_id, day: w.day, start: toMin(w.start), end: toMin(w.end) }));
  const order = [...F.atRisk].sort((a, b) => b.gaps.length - a.gaps.length || cmp(a.trainee_id, b.trainee_id));
  const used = new Set();
  const rows = [];
  order.forEach((a, idx) => {
    const sessionId = `S-${String(idx + 1).padStart(2, '0')}`;
    const skill = a.priority.skill_id;
    let slot = null;
    for (const m of mentors) {
      if (slot || !m.skills.includes(skill) || m.load >= m.cap) continue;
      for (const day of DAYS) {
        if (slot) break;
        if (unavailable.some((u) => u.mentor_id === m.id && u.day === day)) continue;
        const ws = windows.filter((w) => w.mentor_id === m.id && w.day === day).sort((x, y) => x.start - y.start);
        for (const w of ws) {
          for (let s = w.start; s + SESSION_MINUTES <= w.end; s += SESSION_MINUTES) {
            if (!slot && !used.has(`${m.id}|${day}|${s}`)) slot = { m, day, s };
          }
        }
      }
    }
    if (slot) {
      used.add(`${slot.m.id}|${slot.day}|${slot.s}`);
      slot.m.load += 1;
      rows.push({
        session_id: sessionId, trainee_id: a.trainee_id, skill_id: skill, mentor_id: slot.m.id,
        day: slot.day, date: dateFor(slot.day), start: hhmm(slot.s), end: hhmm(slot.s + SESSION_MINUTES),
        intervention_id: `I-${skill}-M`, status: 'BOOKED',
      });
    } else {
      rows.push({
        session_id: sessionId, trainee_id: a.trainee_id, skill_id: skill, mentor_id: '', day: '', date: '',
        start: '', end: '', intervention_id: `I-${skill}-M`, status: 'UNSCHEDULED',
      });
    }
  });
  return rows.sort((x, y) => cmp(x.session_id, y.session_id));
}

function buildContents(opts = {}) {
  const F = figures();
  const schedRows = schedule(F, opts.unavailable ?? []);
  const atRiskSet = new Set(F.atRiskIds);

  const gapCsv = toCsv(GAP_HEADER, F.gaps.map((g) => ({
    trainee_id: g.trainee_id, display_name: g.display_name, skill_id: g.skill_id, score: g.score,
    threshold: g.threshold, shortfall: g.shortfall, at_risk: atRiskSet.has(g.trainee_id) ? 'yes' : 'no',
    source_file: 'assessments.csv', source_row: g.row,
  })));

  const summary = {
    rulesVersion: RULES_VERSION,
    trainees: F.trainees.length,
    assessed_cells: F.assessed,
    missing_cells: F.missing,
    at_risk_count: F.atRiskIds.length,
    at_risk_ids: F.atRiskIds,
    skills: F.skillSummary,
  };
  if (opts.mutateSummary) opts.mutateSummary(summary);
  const summaryJson = `${JSON.stringify(summary, null, 2)}\n`;
  const summaryMd = [
    '# Performance summary',
    '',
    'Means use present scores only. Missing scores are flagged, not counted as zero.',
    '',
    '| Skill | Mean | Below threshold | Missing |',
    '|---|---|---|---|',
    ...summary.skills.map((s) => `| ${s.skill_id} ${s.name} | ${s.mean} | ${s.below_threshold} | ${s.missing} |`),
    '',
    '## At-risk learners',
    '',
    ...summary.at_risk_ids.map((id) => `- ${id}`),
    '',
  ].join('\n');

  const iv = (skill, kind) => S.interventions.json.find((x) => x.skill_id === skill && x.kind === kind);
  const items = [];
  for (const g of F.gaps) {
    items.push({
      trainee_id: g.trainee_id, skill_id: g.skill_id, intervention_id: iv(g.skill_id, 'practice').intervention_id,
      kind: 'practice', title: iv(g.skill_id, 'practice').title,
      reason: `Score ${g.score} is below ${g.threshold} (assessments.csv line ${g.row})`, source_row: g.row,
    });
  }
  for (const a of F.atRisk) {
    const p = a.priority;
    items.push({
      trainee_id: a.trainee_id, skill_id: p.skill_id, intervention_id: iv(p.skill_id, 'mentor_session').intervention_id,
      kind: 'mentor_session', title: iv(p.skill_id, 'mentor_session').title,
      reason: `Score ${p.score} is below ${p.threshold} (assessments.csv line ${p.row})`, source_row: p.row,
    });
  }
  items.sort((a, b) => cmp(a.trainee_id, b.trainee_id) || cmp(a.skill_id, b.skill_id) || cmp(a.kind, b.kind));
  const plan = { rulesVersion: RULES_VERSION, items, unresolved: [] };

  const booked = schedRows.filter((r) => r.status === 'BOOKED');
  const drafts = [];
  booked.forEach((r, idx) => drafts.push({
    draft_id: `D-${String(idx + 1).padStart(2, '0')}`, to_role: 'learner', to_id: r.trainee_id, session_id: r.session_id,
    subject: `Your mentor session on ${r.day} ${r.date}`,
    body: `Your mentor session is on ${r.day} ${r.date} at ${r.start} with ${r.mentor_id}.`,
    day: r.day, date: r.date, start: r.start, mentor_id: r.mentor_id, status: DRAFT_STATUS,
  }));
  const mentorIds = [...new Set(booked.map((r) => r.mentor_id))].sort(cmp);
  mentorIds.forEach((id, idx) => drafts.push({
    draft_id: `D-${String(booked.length + idx + 1).padStart(2, '0')}`, to_role: 'mentor', to_id: id, session_id: '',
    subject: `Your mentor sessions this week`, body: `You have ${booked.filter((r) => r.mentor_id === id).length} session(s).`,
    day: '', date: '', start: '', mentor_id: id, status: DRAFT_STATUS,
  }));
  const draftsObj = { status_all: DRAFT_STATUS, drafts };
  if (opts.mutateDrafts) opts.mutateDrafts(draftsObj);

  return {
    F,
    schedRows,
    contents: {
      'gap-analysis.csv': gapCsv,
      'performance-summary.json': summaryJson,
      'performance-summary.md': summaryMd,
      'improvement-plan.json': `${JSON.stringify(plan, null, 2)}\n`,
      'mentor-schedule.csv': toCsv(SCHEDULE_HEADER, schedRows),
      'unsent-message-drafts.json': `${JSON.stringify(draftsObj, null, 2)}\n`,
    },
  };
}

const KIND_OF = {
  'gap-analysis.csv': KIND.GAP_ANALYSIS,
  'performance-summary.json': KIND.PERFORMANCE_SUMMARY,
  'performance-summary.md': KIND.PERFORMANCE_SUMMARY,
  'improvement-plan.json': KIND.IMPROVEMENT_PLAN,
  'mentor-schedule.csv': KIND.MENTOR_SCHEDULE,
  'unsent-message-drafts.json': KIND.MESSAGE_DRAFTS,
};

const INPUTS_OF = {
  'gap-analysis.csv': ['assessments.csv', 'skills.csv', 'trainees.csv'],
  'performance-summary.json': ['assessments.csv', 'skills.csv', 'trainees.csv'],
  'performance-summary.md': ['assessments.csv', 'skills.csv', 'trainees.csv'],
  'improvement-plan.json': ['interventions.json', 'assessments.csv'],
  'mentor-schedule.csv': ['mentors.csv', 'availability.csv'],
  'unsent-message-drafts.json': ['mentor-schedule.csv'],
};

function sourceByBasename(name) {
  const src = Object.values(S).find((s) => path.basename(s.file) === name);
  if (!src) throw new Error(`no admitted source ${name}`);
  return src;
}

/** Write one artifact with the admitted digests as inputs. badInput = {input, digest} to corrupt one. */
function put(store, name, content, badInput) {
  const inputs = INPUTS_OF[name]
    .filter((n) => Object.values(S).some((src) => path.basename(src.file) === n))
    .map((n) => ({
      name: n,
      version: 1,
      digest: badInput && badInput.input === n ? badInput.digest : sourceByBasename(n).digest,
    }));
  return store.write({ kind: KIND_OF[name], name, content, producer: 'test', inputs });
}

function writeAll(store, opts = {}) {
  const { contents } = buildContents(opts);
  const only = opts.only ?? Object.keys(contents);
  const refs = {};
  for (const name of Object.keys(contents)) {
    if (!only.includes(name)) continue;
    refs[name] = put(store, name, contents[name], opts.badInputFor?.[name]);
  }
  return refs;
}

function mkStore() {
  return createArtifactStore(fs.mkdtempSync(path.join(os.tmpdir(), 'h8-reviewer-')));
}

const byId = (checks, id) => checks.filter((c) => c.id === id);
const one = (checks, id, artifactPrefix) => {
  const hits = checks.filter((c) => c.id === id && (artifactPrefix === undefined || c.artifact.startsWith(artifactPrefix)));
  assert.equal(hits.length, 1, `expected exactly one ${id} check for ${artifactPrefix ?? 'any'}, got ${hits.length}`);
  return hits[0];
};

test('all-correct set: every emitted check passes', async (t) => {
  const store = mkStore();
  writeAll(store);
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const notPass = checks.filter((c) => c.status !== CHECK_STATUS.PASS);
  assert.deepEqual(notPass.map((c) => `${c.id} ${c.artifact}: ${c.message}`), []);
  const ids = [...new Set(checks.map((c) => c.id))].sort();
  for (const id of ['C01_gaps_match', 'C02_summary_numbers', 'C03_summary_text_matches', 'C04_schedule_no_overlap',
    'C05_schedule_in_availability', 'C06_schedule_capacity', 'C07_schedule_skill_match', 'C08_schedule_covers_at_risk',
    'C09_plan_refs', 'C10_drafts_unsent', 'C11_drafts_match_schedule', 'C12_artifacts_intact', 'C13_source_digests']) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  t.diagnostic(`PASS ids: ${ids.join(', ')} (${checks.length} checks)`);
});

test('two Mentor B sessions at the same slot: C04 FAIL, then v2 fixed passes', async () => {
  const store = mkStore();
  const { schedRows } = buildContents();
  writeAll(store, { only: Object.keys(buildContents().contents).filter((n) => n !== 'mentor-schedule.csv') });

  const mB = schedRows.filter((r) => r.mentor_id === 'M-B' && r.status === 'BOOKED');
  assert.ok(mB.length >= 2, 'baseline must book at least two M-B sessions');
  const [first, second] = mB;
  const bad = schedRows.map((r) => ({ ...r }));
  const target = bad.find((r) => r.session_id === second.session_id);
  target.day = first.day;
  target.date = first.date;
  target.start = first.start;
  target.end = first.end;
  put(store, 'mentor-schedule.csv', toCsv(SCHEDULE_HEADER, bad));

  let res = await review({ sources: S, store, scenario: BASELINE });
  const c04 = one(res.checks, 'C04_schedule_no_overlap', 'mentor-schedule.csv@v1');
  assert.equal(c04.status, CHECK_STATUS.FAIL);
  const pair = [first.session_id, second.session_id].sort();
  assert.deepEqual(c04.detail.conflicts[0].sessions, pair);
  assert.equal(c04.detail.conflicts[0].mentor_id, 'M-B');
  assert.match(c04.message, /Mentor B is booked twice on /);
  assert.match(c04.message, new RegExp(`\\(${pair[0]} and ${pair[1]}\\)`));

  put(store, 'mentor-schedule.csv', toCsv(SCHEDULE_HEADER, schedRows));
  res = await review({ sources: S, store, scenario: BASELINE });
  const c04v2 = one(res.checks, 'C04_schedule_no_overlap', 'mentor-schedule.csv@v2');
  assert.equal(c04v2.status, CHECK_STATUS.PASS);
  assert.equal(byId(res.checks, 'C04_schedule_no_overlap').length, 1, 'only the latest version is reviewed');
});

test('summary S3 mean 60.9: C02 FAIL with expected/observed and assessment evidence for S3', async () => {
  const store = mkStore();
  writeAll(store, { mutateSummary: (s) => { s.skills.find((x) => x.skill_id === 'S3').mean = 60.9; } });
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const c02 = one(checks, 'C02_summary_numbers', 'performance-summary.json@v1');
  assert.equal(c02.status, CHECK_STATUS.FAIL);
  const m = c02.detail.mismatches.find((x) => x.field === 'skills.S3.mean');
  assert.ok(m, 'S3 mean mismatch is listed');
  assert.equal(m.observed, 60.9);
  assert.equal(c02.expected, m.expected);
  assert.equal(c02.observed, 60.9);
  assert.match(c02.message, new RegExp(`The S3 Functions average should be ${String(m.expected).replace('.', '\\.')} \\(present scores only\\) but the report says 60\\.9`));
  assert.ok(c02.evidence.length > 0 && c02.evidence.every((e) => e.sourceId === 'assessments'));
  const s3Rows = S.assessments.rows.map((r, i) => (r.skill_id === 'S3' ? S.assessments.rowNumbers[i] : null)).filter((x) => x !== null);
  assert.deepEqual(c02.evidence.map((e) => e.row).sort((a, b) => a - b), s3Rows.sort((a, b) => a - b));
});

test('a draft with status SENT: C10 FAIL', async () => {
  const store = mkStore();
  writeAll(store, { mutateDrafts: (d) => { d.drafts[0].status = 'SENT'; } });
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const c10 = one(checks, 'C10_drafts_unsent');
  assert.equal(c10.status, CHECK_STATUS.FAIL);
  assert.equal(c10.observed, 'SENT');
  assert.match(c10.message, /is marked SENT/);
});

test('learner draft time differs from the schedule: C11 FAIL', async () => {
  const store = mkStore();
  writeAll(store, {
    mutateDrafts: (d) => {
      const learner = d.drafts.find((x) => x.to_role === 'learner');
      learner.start = '17:30';
    },
  });
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const c11 = one(checks, 'C11_drafts_match_schedule');
  assert.equal(c11.status, CHECK_STATUS.FAIL);
  assert.ok(c11.detail.mismatches.some((m) => m.field === 'start' && m.observed === '17:30'));
});

test('file changed on disk after writing: C12 FAIL and its content checks are UNKNOWN', async () => {
  const store = mkStore();
  writeAll(store);
  const ref = store.latestByName('gap-analysis.csv');
  fs.writeFileSync(store.abs(ref), 'trainee_id\nL-01\n', 'utf8');
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const c12 = one(checks, 'C12_artifacts_intact');
  assert.equal(c12.status, CHECK_STATUS.FAIL);
  assert.match(c12.message, /changed after it was written/);
  assert.equal(fileOf(c12, 'gap-analysis.csv@v1').status, CHECK_STATUS.FAIL);
  const c01 = one(checks, 'C01_gaps_match', 'gap-analysis.csv@v1');
  assert.equal(c01.status, CHECK_STATUS.UNKNOWN);
});

test('an input recorded with a wrong digest for assessments.csv: C13 FAIL', async () => {
  const store = mkStore();
  writeAll(store, { badInputFor: { 'gap-analysis.csv': { input: 'assessments.csv', digest: 'f'.repeat(64) } } });
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const c13 = one(checks, 'C13_source_digests');
  assert.equal(c13.status, CHECK_STATUS.FAIL);
  assert.equal(fileOf(c13, 'gap-analysis.csv@v1').status, CHECK_STATUS.FAIL);
  assert.match(c13.message, /1 of \d+ files failed/);
  assert.equal(fileOf(c13, 'performance-summary.json@v1').status, CHECK_STATUS.PASS);
});

// C12/C13 are folded into one check each; per-file results live in detail.files.
function fileOf(check, artifact) {
  const f = check.detail.files.find((x) => x.artifact === artifact);
  assert.ok(f, `no per-file result for ${artifact}`);
  return f;
}

test('missing artifacts: their checks are not emitted', async () => {
  const store = mkStore();
  writeAll(store, { only: ['gap-analysis.csv'] });
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const ids = [...new Set(checks.map((c) => c.id))].sort();
  assert.deepEqual(ids, ['C01_gaps_match', 'C12_artifacts_intact', 'C13_source_digests']);
  assert.equal(checks.find((c) => c.id === 'C01_gaps_match').status, CHECK_STATUS.PASS);

  const empty = mkStore();
  const none = await review({ sources: S, store: empty, scenario: BASELINE });
  assert.deepEqual(none.checks, []);
});

test('malformed JSON artifact: UNKNOWN with a message, never a throw', async () => {
  const store = mkStore();
  writeAll(store, { only: ['gap-analysis.csv'] });
  put(store, 'performance-summary.json', '{not json', undefined);
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const c02 = one(checks, 'C02_summary_numbers', 'performance-summary.json@v1');
  assert.equal(c02.status, CHECK_STATUS.UNKNOWN);
  assert.match(c02.message, /cannot be parsed as JSON/);
  const c12 = one(checks, 'C12_artifacts_intact');
  assert.equal(fileOf(c12, 'performance-summary.json@v1').status, CHECK_STATUS.PASS);
});
