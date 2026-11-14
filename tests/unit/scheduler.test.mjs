import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { admitSources } from '../../engine/sources.mjs';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { RULES_VERSION, AT_RISK_MIN_GAPS, LATE_LOGIN_DAY } from '../../domains/education/rules.mjs';
import { scheduleMentors, freeSlots, allSlots } from '../../domains/education/scheduler.mjs';

const FIXTURES = fileURLToPath(new URL('../../fixtures/education-recovery/v1', import.meta.url));

function admitAll() {
  const res = admitSources(FIXTURES, EDU_SOURCE_SPECS);
  assert.equal(res.status, 'ADMITTED', JSON.stringify(res.problems));
  return res.sources;
}

/** Independent at-risk computation from the raw rows (does not use analyst.mjs). */
function computeAtRisk(sources) {
  const thr = new Map(sources.skills.rows.map((r) => [r.skill_id, Number(r.threshold)]));
  const gapsBy = new Map();
  sources.assessments.rows.forEach((r, i) => {
    const raw = String(r.score).trim();
    if (raw === '') return; // missing is not a gap
    const score = Number(raw);
    const t = thr.get(r.skill_id);
    if (score < t) {
      const list = gapsBy.get(r.trainee_id) ?? [];
      list.push({ skill_id: r.skill_id, score, threshold: t, shortfall: t - score, row: sources.assessments.rowNumbers[i] });
      gapsBy.set(r.trainee_id, list);
    }
  });
  const atRisk = [];
  for (const t of sources.trainees.rows) {
    const gaps = (gapsBy.get(t.trainee_id) ?? []).sort((a, b) => (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0));
    const late = Number(t.first_login_day) >= LATE_LOGIN_DAY;
    if (gaps.length >= AT_RISK_MIN_GAPS || (late && gaps.length >= 1)) {
      const priority = [...gaps].sort((a, b) => (b.shortfall - a.shortfall) || (a.skill_id < b.skill_id ? -1 : 1))[0];
      atRisk.push({ trainee_id: t.trainee_id, gaps, priority });
    }
  }
  return { atRisk, gapsBy };
}

/** Build an improvement-plan.json-shaped object from the raw rows (practice per gap, mentor_session per at-risk). */
function buildPlan(sources) {
  const { atRisk, gapsBy } = computeAtRisk(sources);
  const ivs = sources.interventions.json;
  const iid = (skill, kind) => ivs.find((i) => i.skill_id === skill && i.kind === kind).intervention_id;
  const items = [];
  for (const [traineeId, gaps] of gapsBy) {
    for (const g of gaps) {
      items.push({
        trainee_id: traineeId, skill_id: g.skill_id, intervention_id: iid(g.skill_id, 'practice'), kind: 'practice',
        title: 'practice', reason: `Score ${g.score} is below ${g.threshold}`, source_row: g.row,
      });
    }
  }
  for (const a of atRisk) {
    items.push({
      trainee_id: a.trainee_id, skill_id: a.priority.skill_id, intervention_id: iid(a.priority.skill_id, 'mentor_session'),
      kind: 'mentor_session', title: 'mentor', reason: 'at risk', source_row: a.priority.row,
    });
  }
  items.sort((a, b) => (a.trainee_id < b.trainee_id ? -1 : a.trainee_id > b.trainee_id ? 1 : 0)
    || (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0)
    || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  return { rulesVersion: RULES_VERSION, items, unresolved: [] };
}

/**
 * Run the scheduler in a fresh temp store with a plan written to disk.
 * opts: { scenario, phase, sources }
 */
async function runSchedule({ scenario = {}, phase = 'initial', sources: srcOverride } = {}) {
  const sources = srcOverride ?? admitAll();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-sched-'));
  const store = createArtifactStore(dir);
  const plan = buildPlan(admitAll());
  const planRef = store.write({
    kind: 'improvement_plan',
    name: 'improvement-plan.json',
    content: `${JSON.stringify(plan, null, 2)}\n`,
    producer: 'recommend_interventions',
    inputs: [],
  });
  const inputRefs = [{ name: planRef.name, version: planRef.version, digest: planRef.digest }];
  const result = await scheduleMentors({ taskId: 'mentor_schedule', sources, store, scenario, phase, inputRefs });
  const ref = result.artifacts[0];
  const content = store.read(ref);
  const { rows } = parseCsv(content);
  return { dir, result, rows, content, ref, sources, plan };
}

function cleanup(run) {
  fs.rmSync(run.dir, { recursive: true, force: true });
}

function assertCommonRules(rows, sources, capacityOverride) {
  const booked = rows.filter((r) => r.status === 'BOOKED');
  const availability = sources.availability.rows;
  const mentors = new Map(sources.mentors.rows.map((m) => [m.mentor_id, m]));
  // no mentor has two sessions at the same day and start
  const keys = booked.map((r) => `${r.mentor_id}|${r.day}|${r.start}`);
  assert.equal(new Set(keys).size, keys.length, 'a mentor has two sessions at the same start');
  for (const r of booked) {
    const m = mentors.get(r.mentor_id);
    // skill
    assert.ok(String(m.skills).split(';').includes(r.skill_id), `${r.mentor_id} lacks ${r.skill_id}`);
    // inside a window
    const s = Number(r.start.slice(0, 2)) * 60 + Number(r.start.slice(3));
    const e = Number(r.end.slice(0, 2)) * 60 + Number(r.end.slice(3));
    assert.equal(e - s, 60, 'session is 60 minutes');
    const inside = availability.some((w) => w.mentor_id === r.mentor_id && w.day === r.day
      && Number(w.start.slice(0, 2)) * 60 + Number(w.start.slice(3)) <= s
      && e <= Number(w.end.slice(0, 2)) * 60 + Number(w.end.slice(3)));
    assert.ok(inside, `${r.session_id} is outside every window`);
  }
  // capacity
  const cap = capacityOverride ?? new Map(sources.mentors.rows.map((m) => [m.mentor_id, Number(m.capacity)]));
  for (const [id, n] of countBy(booked, (r) => r.mentor_id)) {
    const limit = capacityOverride ? capacityOverride.get(id) : cap.get(id);
    assert.ok(n <= limit, `${id} has ${n} sessions, capacity ${limit}`);
  }
}

function countBy(list, keyFn) {
  const m = new Map();
  for (const x of list) m.set(keyFn(x), (m.get(keyFn(x)) ?? 0) + 1);
  return m;
}

function overlapPairs(rows) {
  const booked = rows.filter((r) => r.status === 'BOOKED');
  return [...countBy(booked, (r) => `${r.mentor_id}|${r.day}|${r.start}`).values()].filter((n) => n > 1).length;
}

test('fixtures give 14 at-risk learners and 18 slots', async () => {
  const sources = admitAll();
  assert.equal(computeAtRisk(sources).atRisk.length, 14);
  assert.equal(allSlots('M-A', sources).length + allSlots('M-B', sources).length + allSlots('M-C', sources).length, 18);
});

test('baseline: every at-risk learner is BOOKED and the rules hold', async () => {
  const run = await runSchedule({ scenario: {} });
  try {
    assert.equal(run.rows.length, 14);
    assert.ok(run.rows.every((r) => r.status === 'BOOKED'), 'all rows BOOKED');
    assert.equal(run.result.summary.booked, 14);
    assert.equal(run.result.summary.unscheduled, 0);
    assert.equal(overlapPairs(run.rows), 0);
    assertCommonRules(run.rows, run.sources);
    assert.equal(run.ref.kind, 'mentor_schedule');
    assert.equal(run.ref.name, 'mentor-schedule.csv');
  } finally {
    cleanup(run);
  }
});

test('inject overlap (initial): M-B gets at least 2 bookings and exactly one shared slot', async () => {
  const run = await runSchedule({
    scenario: { inject: { kind: 'overlap', mentor_id: 'M-B' } },
    phase: 'initial',
  });
  try {
    const mb = run.rows.filter((r) => r.mentor_id === 'M-B' && r.status === 'BOOKED');
    assert.ok(mb.length >= 2, `M-B received only ${mb.length} booking(s); the overlap fault cannot fire with these fixtures`);
    assert.equal(overlapPairs(run.rows), 1, 'exactly one overlapping pair');
    const keys = mb.map((r) => `${r.day}|${r.start}`);
    assert.equal(keys[0], keys[1], 'second M-B booking reuses the first slot');
  } finally {
    cleanup(run);
  }
});

test('phase rerun with the same inject: no overlap', async () => {
  const run = await runSchedule({
    scenario: { inject: { kind: 'overlap', mentor_id: 'M-B' } },
    phase: 'rerun',
  });
  try {
    assert.equal(overlapPairs(run.rows), 0);
    assert.equal(run.result.summary.booked, 14);
    assertCommonRules(run.rows, run.sources);
  } finally {
    cleanup(run);
  }
});

test('unavailable M-B on Thu: no Thu session for M-B; unplaced learners are UNSCHEDULED', async () => {
  const run = await runSchedule({ scenario: { unavailable: [{ mentor_id: 'M-B', day: 'Thu' }] } });
  try {
    const bad = run.rows.filter((r) => r.mentor_id === 'M-B' && r.day === 'Thu');
    assert.equal(bad.length, 0, 'no M-B Thursday sessions');
    const unscheduled = run.rows.filter((r) => r.status === 'UNSCHEDULED');
    assert.equal(run.rows.length, 14);
    assert.equal(run.result.summary.booked + unscheduled.length, 14);
    for (const r of unscheduled) {
      assert.equal(r.mentor_id, '');
      assert.equal(r.day, '');
      assert.equal(r.start, '');
    }
    assertCommonRules(run.rows, run.sources);
    console.log(`mentor_unavailable: booked=${run.result.summary.booked} unscheduled=${unscheduled.length}`);
  } finally {
    cleanup(run);
  }
});

test('capacity 1 for every mentor: extra learners are UNSCHEDULED, never double-booked', async () => {
  const base = admitAll();
  const capOne = new Map(base.mentors.rows.map((m) => [m.mentor_id, 1]));
  const sources = {
    ...base,
    mentors: { ...base.mentors, rows: base.mentors.rows.map((r) => Object.freeze({ ...r, capacity: '1' })) },
  };
  const run = await runSchedule({ sources });
  try {
    const booked = run.rows.filter((r) => r.status === 'BOOKED');
    const unscheduled = run.rows.filter((r) => r.status === 'UNSCHEDULED');
    assert.equal(booked.length + unscheduled.length, 14);
    assert.ok(booked.length <= 3, `booked ${booked.length} exceeds 3 total capacity`);
    assert.ok(unscheduled.length >= 11);
    assert.equal(overlapPairs(run.rows), 0);
    assertCommonRules(run.rows, run.sources, capOne);
    for (const [, n] of countBy(booked, (r) => r.mentor_id)) assert.equal(n, 1);
  } finally {
    cleanup(run);
  }
});

test('two runs give identical schedule content and digest', async () => {
  const a = await runSchedule({ scenario: {} });
  const b = await runSchedule({ scenario: {} });
  try {
    const da = createHash('sha256').update(a.content).digest('hex');
    const db = createHash('sha256').update(b.content).digest('hex');
    assert.equal(da, db);
    assert.equal(a.ref.digest, b.ref.digest);
  } finally {
    cleanup(a);
    cleanup(b);
  }
});

test('freeSlots drops booked slots and unavailable days', () => {
  const sources = admitAll();
  const all = allSlots('M-B', sources);
  assert.deepEqual(all.map((s) => `${s.day} ${s.start}`), ['Tue 09:00', 'Tue 10:00', 'Tue 11:00', 'Thu 09:00', 'Thu 10:00', 'Thu 11:00']);
  const booked = [{ mentor_id: 'M-B', day: 'Tue', start: '10:00', status: 'BOOKED' }];
  assert.equal(freeSlots('M-B', booked, sources, {}).length, 5);
  const noThu = freeSlots('M-B', [], sources, { unavailable: [{ mentor_id: 'M-B', day: 'Thu' }] });
  assert.deepEqual(noThu.map((s) => s.day), ['Tue', 'Tue', 'Tue']);
  assert.equal(noThu[0].date, '2026-11-17');
});
