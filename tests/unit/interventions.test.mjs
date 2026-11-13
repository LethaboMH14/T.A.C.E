import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitSources } from '../../engine/sources.mjs';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { computeGaps } from '../../domains/education/analyst.mjs';
import { recommendInterventions } from '../../domains/education/interventions.mjs';

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/education-recovery/v1');

function admit() {
  const res = admitSources(FIXTURE, EDU_SOURCE_SPECS);
  assert.equal(res.status, 'ADMITTED', JSON.stringify(res.problems));
  return res.sources;
}

function makeCtx(sources, taskId = 'recommend_interventions') {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-interventions-'));
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

function cleanup(...ctxs) {
  for (const c of ctxs) fs.rmSync(c.runDir, { recursive: true, force: true });
}

function digestOf(refs) {
  return refs.map((r) => `${r.name}@${r.version}:${r.digest}`);
}

test('interventions: every gap has one practice item and each at-risk trainee has one mentor session for the priority skill', async () => {
  const sources = admit();
  const ctx = makeCtx(sources);
  try {
    const an = await computeGaps({ ...ctx, taskId: 'compute_gaps' });
    const res = await recommendInterventions(ctx);
    const gaps = JSON.parse(ctx.store.read(an.artifacts[0]));
    const plan = JSON.parse(ctx.store.read(res.artifacts[0]));

    for (const t of gaps.trainees) {
      for (const g of t.gaps) {
        const hits = plan.items.filter((i) => i.trainee_id === t.trainee_id && i.skill_id === g.skill_id && i.kind === 'practice');
        assert.equal(hits.length, 1, `${t.trainee_id} ${g.skill_id} practice count`);
        assert.equal(hits[0].source_row, g.row);
        assert.equal(hits[0].reason, `Score ${g.score} is below ${g.threshold} (assessments.csv line ${g.row})`);
      }
      const mentors = plan.items.filter((i) => i.trainee_id === t.trainee_id && i.kind === 'mentor_session');
      if (t.at_risk) {
        assert.equal(mentors.length, 1, `${t.trainee_id} mentor count`);
        assert.equal(mentors[0].skill_id, t.priority_skill);
      } else {
        assert.equal(mentors.length, 0, `${t.trainee_id} should have no mentor session`);
      }
    }

    const atRisk = gaps.trainees.filter((t) => t.at_risk).length;
    assert.equal(atRisk, 14);
    assert.equal(res.summary.mentorSessions, atRisk);
    assert.equal(res.summary.practice, gaps.trainees.reduce((n, t) => n + t.gaps.length, 0));
    assert.equal(res.summary.unresolved, 0);
    assert.equal(res.artifacts[1].kind, 'improvement_plan');
    assert.ok(ctx.store.read(res.artifacts[1]).includes('# Improvement plan'));
  } finally {
    cleanup(ctx);
  }
});

test('interventions: a gap on a skill with no intervention lands in unresolved, never invented', async () => {
  const sources = admit();
  const ctx = makeCtx(sources);
  try {
    const handMade = {
      rulesVersion: 'edu-rules-v1',
      trainees: [{
        trainee_id: 'L-01',
        display_name: 'Learner 01',
        first_login_day: 1,
        gaps: [{ skill_id: 'S9', score: 41, threshold: 60, shortfall: 19, row: 22 }],
        missing: [],
        at_risk: false,
        priority_skill: null,
      }],
    };
    ctx.store.write({
      kind: 'gaps', name: 'gaps.json', content: JSON.stringify(handMade, null, 2) + '\n',
      producer: 'compute_gaps', inputs: [],
    });
    const res = await recommendInterventions(ctx);
    const plan = JSON.parse(ctx.store.read(res.artifacts[0]));
    assert.deepEqual(plan.items, []);
    assert.equal(plan.unresolved.length, 1);
    assert.equal(plan.unresolved[0].trainee_id, 'L-01');
    assert.equal(plan.unresolved[0].skill_id, 'S9');
    assert.equal(res.summary.unresolved, 1);
    assert.equal(res.summary.items, 0);
  } finally {
    cleanup(ctx);
  }
});

test('interventions: two runs in two stores give identical digests', async () => {
  const sources = admit();
  const a = makeCtx(sources);
  const b = makeCtx(sources);
  try {
    await computeGaps({ ...a, taskId: 'compute_gaps' });
    await computeGaps({ ...b, taskId: 'compute_gaps' });
    const ra = await recommendInterventions(a);
    const rb = await recommendInterventions(b);
    assert.deepEqual(digestOf(ra.artifacts), digestOf(rb.artifacts));
    assert.deepEqual(ra.summary, rb.summary);
  } finally {
    cleanup(a, b);
  }
});
