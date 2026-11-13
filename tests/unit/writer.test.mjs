import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { admitSources } from '../../engine/sources.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { AT_RISK_MIN_GAPS, LATE_LOGIN_DAY, RULES_VERSION } from '../../domains/education/rules.mjs';
import {
  writePerformanceSummary,
  renderSummaryMd,
  draftMessages,
  renderDraftsMd,
} from '../../domains/education/writer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const V1 = path.resolve(here, '..', '..', 'fixtures', 'education-recovery', 'v1');
const admitted = admitSources(V1, EDU_SOURCE_SPECS);
const sources = admitted.sources;

const tmpDirs = [];
function newStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-writer-'));
  tmpDirs.push(dir);
  return createArtifactStore(dir);
}
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const bySkill = (a, b) => (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0);
const byId = (a, b) => (a.trainee_id < b.trainee_id ? -1 : a.trainee_id > b.trainee_id ? 1 : 0);

/** Independent gap computation from the admitted raw rows (rules constants shared, code not). */
function buildGapsJson() {
  const thr = new Map(sources.skills.rows.map((r) => [r.skill_id, Number(r.threshold)]));
  const asRows = sources.assessments.rows.map((a, i) => ({ ...a, row: sources.assessments.rowNumbers[i] }));
  const trainees = sources.trainees.rows.map((t) => {
    const gaps = [];
    const missing = [];
    for (const a of asRows.filter((x) => x.trainee_id === t.trainee_id)) {
      if (a.score.trim() === '') {
        missing.push({ skill_id: a.skill_id, row: a.row });
        continue;
      }
      const score = Number(a.score);
      const threshold = thr.get(a.skill_id);
      if (score < threshold) {
        gaps.push({ skill_id: a.skill_id, score, threshold, shortfall: threshold - score, row: a.row });
      }
    }
    gaps.sort(bySkill);
    missing.sort(bySkill);
    const late = Number(t.first_login_day) >= LATE_LOGIN_DAY;
    const atRisk = gaps.length >= AT_RISK_MIN_GAPS || (late && gaps.length >= 1);
    let priority = null;
    if (atRisk) {
      priority = gaps
        .slice()
        .sort((a, b) => (b.threshold - b.score) - (a.threshold - a.score) || (a.skill_id < b.skill_id ? -1 : 1))[0]
        .skill_id;
    }
    return {
      trainee_id: t.trainee_id,
      display_name: t.display_name,
      first_login_day: Number(t.first_login_day),
      gaps,
      missing,
      at_risk: atRisk,
      priority_skill: priority,
    };
  }).sort(byId);
  return { rulesVersion: RULES_VERSION, trainees };
}

const GAPS = buildGapsJson();

function presentScores(skillId) {
  return sources.assessments.rows
    .filter((a) => a.skill_id === skillId && a.score.trim() !== '')
    .map((a) => Number(a.score));
}
const meanPresent = (id) => {
  const xs = presentScores(id);
  return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10;
};
const meanAsZero = (id) => {
  const xs = presentScores(id);
  return Math.round((xs.reduce((s, x) => s + x, 0) / sources.trainees.rows.length) * 10) / 10;
};

async function performanceRun({ phase = 'rerun', scenario = { inject: null } } = {}) {
  const store = newStore();
  const gapsRef = store.write({
    kind: 'gaps', name: 'gaps.json', content: `${JSON.stringify(GAPS, null, 2)}\n`, producer: 'compute_gaps',
  });
  const ctx = {
    taskId: 'performance_summary',
    sources,
    store,
    scenario,
    phase,
    inputRefs: [{ name: gapsRef.name, version: gapsRef.version, digest: gapsRef.digest }],
  };
  const out = await writePerformanceSummary(ctx);
  const json = JSON.parse(store.read(out.artifacts[0]));
  const md = store.read(out.artifacts[1]);
  return { store, out, json, md };
}

const SCHEDULE_V1 = `session_id,trainee_id,skill_id,mentor_id,day,date,start,end,intervention_id,status
S-01,L-07,S3,M-B,Tue,2026-11-17,09:00,10:00,I-S3-M,BOOKED
S-02,L-12,S4,M-B,Thu,2026-11-19,10:00,11:00,I-S4-M,BOOKED
S-03,L-03,S1,M-A,Mon,2026-11-16,09:00,10:00,I-S1-M,BOOKED
S-04,L-20,S5,M-A,Wed,2026-11-18,13:00,14:00,I-S5-M,BOOKED
S-05,L-30,S2,,,,,,I-S2-M,UNSCHEDULED
`;

async function draftRun(scheduleTexts) {
  const store = newStore();
  let last = null;
  for (const text of scheduleTexts) {
    last = store.write({ kind: 'mentor_schedule', name: 'mentor-schedule.csv', content: text, producer: 'mentor_schedule' });
  }
  const ctx = {
    taskId: 'draft_messages',
    sources,
    store,
    scenario: { inject: null },
    phase: 'rerun',
    inputRefs: [{ name: last.name, version: last.version, digest: last.digest }],
  };
  const out = await draftMessages(ctx);
  const json = JSON.parse(store.read(out.artifacts[0]));
  const md = store.read(out.artifacts[1]);
  return { store, out, json, md };
}

test('fixtures admit cleanly with 216 assessment rows and 6 missing cells', () => {
  assert.equal(admitted.status, 'ADMITTED');
  assert.equal(sources.assessments.rows.length, 216);
  assert.equal(sources.assessments.rows.filter((a) => a.score.trim() === '').length, 6);
});

test('independent gaps give a baseline at-risk count between 10 and 14', () => {
  const n = GAPS.trainees.filter((t) => t.at_risk).length;
  assert.ok(n >= 10 && n <= 14, `at risk ${n}`);
});

test('summary means equal the independent present-only means; missing cells = 6', async () => {
  const { json, out } = await performanceRun();
  assert.equal(json.missing_cells, 6);
  assert.equal(json.assessed_cells, 210);
  assert.equal(out.summary.missing, 6);
  assert.equal(json.skills.length, 6);
  for (const s of json.skills) {
    assert.equal(s.mean, meanPresent(s.skill_id), `${s.skill_id} mean`);
  }
  assert.deepEqual(json.at_risk_ids, GAPS.trainees.filter((t) => t.at_risk).map((t) => t.trainee_id));
});

test('performance-summary.md shows each JSON mean with exactly one decimal', async () => {
  const { json, md, out } = await performanceRun();
  assert.deepEqual(out.artifacts.map((a) => a.kind), ['performance_summary', 'performance_summary']);
  assert.equal(md, renderSummaryMd(json));
  assert.ok(md.startsWith('# Cohort performance summary'));
  for (const s of json.skills) {
    const row = `| ${s.skill_id} ${s.name} | ${s.mean.toFixed(1)} | ${s.below_threshold} | ${s.missing} |`;
    assert.ok(md.includes(row), `missing row: ${row}`);
  }
});

test('injected wrong_aggregate on S3 at phase initial is wrong by at least 1.0', async () => {
  const scenario = { inject: { kind: 'wrong_aggregate', skill_id: 'S3' } };
  const { json } = await performanceRun({ phase: 'initial', scenario });
  const s3 = json.skills.find((s) => s.skill_id === 'S3');
  assert.equal(s3.mean, meanAsZero('S3'));
  assert.ok(Math.abs(s3.mean - meanPresent('S3')) >= 1.0, `S3 injected ${s3.mean} vs ${meanPresent('S3')}`);
  for (const s of json.skills.filter((x) => x.skill_id !== 'S3')) {
    assert.equal(s.mean, meanPresent(s.skill_id));
  }
});

test('same scenario at phase rerun gives the correct S3 mean', async () => {
  const scenario = { inject: { kind: 'wrong_aggregate', skill_id: 'S3' } };
  const { json } = await performanceRun({ phase: 'rerun', scenario });
  const s3 = json.skills.find((s) => s.skill_id === 'S3');
  assert.equal(s3.mean, meanPresent('S3'));
});

test('renderSummaryMd is pure: same JSON gives the same text', async () => {
  const { json } = await performanceRun();
  assert.equal(renderSummaryMd(json), renderSummaryMd(JSON.parse(JSON.stringify(json))));
});

test('drafts: one per BOOKED row plus one per mentor with sessions, all UNSENT', async () => {
  const { json, out } = await draftRun([SCHEDULE_V1]);
  assert.equal(json.status_all, 'UNSENT');
  assert.equal(json.drafts.length, 6);
  assert.equal(out.summary.learnerDrafts, 4);
  assert.equal(out.summary.mentorDrafts, 2);
  for (const d of json.drafts) assert.equal(d.status, 'UNSENT');
  assert.deepEqual(json.drafts.filter((d) => d.to_role === 'learner').map((d) => d.to_id), ['L-07', 'L-12', 'L-03', 'L-20']);
  assert.deepEqual(json.drafts.filter((d) => d.to_role === 'mentor').map((d) => d.to_id), ['M-A', 'M-B']);
});

test('UNSCHEDULED rows get no learner draft; learner drafts match their schedule rows', async () => {
  const { json } = await draftRun([SCHEDULE_V1]);
  assert.ok(!json.drafts.some((d) => d.to_id === 'L-30'));
  const rows = new Map(
    SCHEDULE_V1.trim().split('\n').slice(1).map((line) => {
      const f = line.split(',');
      return [f[0], { trainee_id: f[1], mentor_id: f[3], day: f[4], date: f[5], start: f[6], end: f[7], status: f[9] }];
    }),
  );
  for (const d of json.drafts.filter((x) => x.to_role === 'learner')) {
    const row = rows.get(d.session_id);
    assert.equal(row.status, 'BOOKED');
    assert.equal(d.to_id, row.trainee_id);
    assert.equal(d.mentor_id, row.mentor_id);
    assert.equal(d.day, row.day);
    assert.equal(d.start, row.start);
    assert.equal(d.date, row.date);
  }
});

test('learner draft body uses display names, day label and times; no email addresses', async () => {
  const { json, md } = await draftRun([SCHEDULE_V1]);
  const first = json.drafts[0];
  const learnerName = sources.trainees.rows.find((r) => r.trainee_id === 'L-07').display_name;
  assert.equal(first.body, `Hi ${learnerName}, you have a 1:1 mentor session on Functions with Mentor B on Tue 17 Nov at 09:00–10:00. Reply if this time does not work.`);
  for (const d of json.drafts) assert.ok(!d.body.includes('@'));
  assert.ok(md.includes("UNSENT — needs a person's approval before anything is sent."));
  assert.equal(md, renderDraftsMd(json));
});

test('reading a v2 schedule uses the v2 times', async () => {
  const v2 = SCHEDULE_V1.replace('S-01,L-07,S3,M-B,Tue,2026-11-17,09:00,10:00', 'S-01,L-07,S3,M-B,Tue,2026-11-17,11:00,12:00');
  const { json } = await draftRun([SCHEDULE_V1, v2]);
  const d = json.drafts.find((x) => x.session_id === 'S-01');
  assert.equal(d.start, '11:00');
  assert.ok(d.body.includes('11:00–12:00'));
  assert.ok(!d.body.includes('09:00'));
});

test('deterministic digests across two runs', async () => {
  const a = await performanceRun();
  const b = await performanceRun();
  assert.equal(a.out.artifacts[0].digest, b.out.artifacts[0].digest);
  assert.equal(a.out.artifacts[1].digest, b.out.artifacts[1].digest);

  const c = await draftRun([SCHEDULE_V1]);
  const d = await draftRun([SCHEDULE_V1]);
  assert.equal(c.out.artifacts[0].digest, d.out.artifacts[0].digest);
  assert.equal(c.out.artifacts[1].digest, d.out.artifacts[1].digest);
});
