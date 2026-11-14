import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitSources } from '../../engine/sources.mjs';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { computeGaps } from '../../domains/education/analyst.mjs';
import { AT_RISK_MIN_GAPS, LATE_LOGIN_DAY } from '../../domains/education/rules.mjs';

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/education-recovery/v1');

function admit() {
  const res = admitSources(FIXTURE, EDU_SOURCE_SPECS);
  assert.equal(res.status, 'ADMITTED', JSON.stringify(res.problems));
  return res.sources;
}

function makeCtx(sources, taskId = 'compute_gaps') {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-analyst-'));
  return {
    taskId,
    sources,
    store: createArtifactStore(runDir),
    scenario: { id: 'test', inject: null },
    phase: 'initial',
    inputRefs: [],
    runDir,
  };
}

function digestOf(refs) {
  return refs.map((r) => `${r.name}@${r.version}:${r.digest}`);
}

// Independent recount: reads the raw CSV text and applies the rules without touching analyst.mjs.
function independentCount(text = {}) {
  const skills = parseCsv(fs.readFileSync(path.join(FIXTURE, 'skills.csv'), 'utf8'));
  const trainees = parseCsv(fs.readFileSync(path.join(FIXTURE, 'trainees.csv'), 'utf8'));
  const assess = parseCsv(fs.readFileSync(path.join(FIXTURE, 'assessments.csv'), 'utf8'));
  const threshold = new Map(skills.rows.map((s) => [s.skill_id, Number(s.threshold)]));
  const gapsBy = new Map(trainees.rows.map((t) => [t.trainee_id, 0]));
  let gaps = 0;
  let missing = 0;
  for (const r of assess.rows) {
    if (r.score.trim() === '') { missing += 1; continue; }
    if (Number(r.score) < threshold.get(r.skill_id)) {
      gaps += 1;
      gapsBy.set(r.trainee_id, gapsBy.get(r.trainee_id) + 1);
    }
  }
  let atRisk = 0;
  for (const t of trainees.rows) {
    const n = gapsBy.get(t.trainee_id);
    const late = Number(t.first_login_day) >= LATE_LOGIN_DAY;
    if (n >= AT_RISK_MIN_GAPS || (late && n >= 1)) atRisk += 1;
  }
  return { gaps, missing, atRisk, trainees: trainees.rows.length, assessRows: assess.rows.length };
}

test('analyst: independent recount matches the fixture (36 trainees, 6 missing, 14 at risk)', async () => {
  const counts = independentCount();
  assert.equal(counts.trainees, 36);
  assert.equal(counts.assessRows, 216);
  assert.equal(counts.missing, 6);
  assert.equal(counts.atRisk, 14);

  const ctx = makeCtx(admit());
  try {
    const res = await computeGaps(ctx);
    assert.equal(res.summary.trainees, 36);
    assert.equal(res.summary.gaps, counts.gaps);
    assert.equal(res.summary.missing, 6);
    assert.equal(res.summary.atRisk, 14);
  } finally {
    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  }
});

test('analyst: missing cells are never gaps and every gap row points at a below-threshold score', async () => {
  const sources = admit();
  const ctx = makeCtx(sources);
  try {
    const res = await computeGaps(ctx);
    const gaps = JSON.parse(ctx.store.read(res.artifacts[0]));
    const lines = fs.readFileSync(path.join(FIXTURE, 'assessments.csv'), 'utf8').split('\n');
    const thresholds = new Map(sources.skills.rows.map((s) => [s.skill_id, Number(s.threshold)]));
    let missingSeen = 0;
    for (const t of gaps.trainees) {
      for (const g of t.gaps) {
        const fields = lines[g.row - 1].split(',');
        assert.equal(fields[0], t.trainee_id, `row ${g.row} trainee`);
        assert.equal(fields[1], g.skill_id, `row ${g.row} skill`);
        assert.notEqual(fields[2], '');
        assert.ok(Number(fields[2]) < thresholds.get(g.skill_id), `row ${g.row} not below threshold`);
        assert.equal(g.score, Number(fields[2]));
      }
      for (const m of t.missing) {
        const fields = lines[m.row - 1].split(',');
        assert.equal(fields[2], '', `missing row ${m.row} must be empty`);
        assert.ok(!t.gaps.some((g) => g.skill_id === m.skill_id), 'missing cell also listed as gap');
      }
      missingSeen += t.missing.length;
    }
    assert.equal(missingSeen, 6);
  } finally {
    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  }
});

test('analyst: gap CSV re-parses with exact columns and one row per gap', async () => {
  const ctx = makeCtx(admit());
  try {
    const res = await computeGaps(ctx);
    const gaps = JSON.parse(ctx.store.read(res.artifacts[0]));
    const expectedGaps = gaps.trainees.reduce((n, t) => n + t.gaps.length, 0);
    const csvRef = res.artifacts[1];
    assert.equal(csvRef.kind, 'gap_analysis');
    const parsed = parseCsv(ctx.store.read(csvRef));
    assert.deepEqual(parsed.header, [
      'trainee_id', 'display_name', 'skill_id', 'score', 'threshold',
      'shortfall', 'at_risk', 'source_file', 'source_row',
    ]);
    assert.equal(parsed.rows.length, expectedGaps);
    assert.equal(parsed.rows.length, res.summary.gaps);
    for (const r of parsed.rows) {
      assert.equal(r.source_file, 'assessments.csv');
      assert.ok(r.at_risk === 'yes' || r.at_risk === 'no');
    }
  } finally {
    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  }
});

test('analyst: two runs in two stores give identical digests', async () => {
  const sources = admit();
  const a = makeCtx(sources);
  const b = makeCtx(sources);
  try {
    const ra = await computeGaps(a);
    const rb = await computeGaps(b);
    assert.deepEqual(digestOf(ra.artifacts), digestOf(rb.artifacts));
    assert.deepEqual(ra.summary, rb.summary);
  } finally {
    fs.rmSync(a.runDir, { recursive: true, force: true });
    fs.rmSync(b.runDir, { recursive: true, force: true });
  }
});
