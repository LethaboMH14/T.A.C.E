// End-to-end personal support: a temp copy of the fixtures plus three live snapshot files, run through the
// full weekly check-in mission in code mode (model off). The live files are only read because the scenario
// lists them in intakeSources; the fixture runs elsewhere do not list them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMission } from '../../engine/run.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import { EDU_DOMAIN } from '../../domains/education/index.mjs';
import { EDU_SOURCE_SPECS, EDU_OPTIONAL_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../../fixtures/education-recovery/scenarios.mjs';
import { loadScenario, readIndex, latestRef, readRef } from './helpers.mjs';

const FIXTURE_DIR = new URL('../../fixtures/education-recovery/v1/', import.meta.url);
const ALL_SIX = ['trainees', 'assessments', 'skills', 'mentors', 'availability', 'interventions'];
const LIVE = ['help_requests', 'learner_prefs', 'memory'];

const HELP_REQUESTS = [
  'request_id,trainee_id,skill_id,category,text,at',
  'R-01,L-16,S4,explain,"I keep losing track of data structures in the labs, could we go over them?",2026-11-14T09:00',
  'R-02,L-03,S4,debugging,"=cmd|\' /C calc\'!A0",2026-11-14T10:00',
  'R-03,L-12,,other,"Can I get my plan in Zulu, as audio?",2026-11-14T11:00',
  '',
].join('\n');
const LEARNER_PREFS = 'trainee_id,format,language\nL-12,audio,zu\n';
const MEMORY = 'trainee_id,fact,source_run,at\nL-12,"Prefers short messages",run-2026-11-10,2026-11-10T08:00\n';

/** A temp folder with the fixture CSVs and the three live files. */
function liveSourcesDir(tmp) {
  fs.cpSync(FIXTURE_DIR, tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'help_requests.csv'), HELP_REQUESTS);
  fs.writeFileSync(path.join(tmp, 'learner_prefs.csv'), LEARNER_PREFS);
  fs.writeFileSync(path.join(tmp, 'memory.csv'), MEMORY);
  return tmp;
}

async function runLive(tmp, runDir) {
  const base = loadScenario('weekly_checkin');
  const scenario = { ...base, intakeSources: [...ALL_SIX, ...LIVE] };
  const domain = { ...EDU_DOMAIN, sourceSpecs: [...EDU_SOURCE_SPECS, ...EDU_OPTIONAL_SOURCE_SPECS] };
  return runMission({
    scenario, domain, sourcesDir: tmp, runDir, runId: 'personal-e2e',
    trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: 0, model: 'off',
  });
}

async function withTemp(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-personal-e2e-'));
  try {
    return await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('live snapshot: VERIFIED, C18 and C19 PASS, requester not at risk is booked, zu draft is marked', async () => {
  await withTemp(async (root) => {
    const src = liveSourcesDir(path.join(root, 'src'));
    const runDir = path.join(root, 'run');
    const res = await runLive(src, runDir);
    assert.equal(res.status, 'VERIFIED', `run status ${res.status}: ${res.manifest?.reason ?? ''}`);

    const index = readIndex(runDir);
    const checks = JSON.parse(readRef(runDir, latestRef(index, 'evidence-checks.json'))).checks;
    for (const id of ['C18_requests_answered', 'C19_privacy_in_drafts']) {
      const c = checks.find((x) => x.id === id);
      assert.ok(c, `${id} is emitted`);
      assert.equal(c.status, 'PASS', `${id}: ${c.message}`);
    }

    // the requester who is NOT at risk gets a BOOKED session
    const schedule = parseCsv(readRef(runDir, latestRef(index, 'mentor-schedule.csv')));
    const l16 = schedule.rows.find((r) => r.trainee_id === 'L-16');
    assert.equal(l16.status, 'BOOKED', 'L-16 asked for help and is booked although not at risk');
    assert.equal(l16.skill_id, 'S4');

    const drafts = JSON.parse(readRef(runDir, latestRef(index, 'unsent-message-drafts.json')));
    const zu = drafts.drafts.find((d) => d.to_role === 'learner' && d.to_id === 'L-12');
    assert.ok(zu, 'L-12 has a learner draft');
    assert.equal(zu.language, 'zu');
    assert.equal(zu.format, 'audio');
    assert.equal(zu.payload.machine_translated, true);
    assert.equal(zu.payload.reviewer_note, 'needs a fluent reviewer');
    assert.equal(zu.session_id, '', 'L-12 has no booked session (no skill, no gap)');
    assert.equal(zu.payload.memory[0].fact, 'Prefers short messages');

    const booked16 = drafts.drafts.find((d) => d.to_role === 'learner' && d.to_id === 'L-16');
    assert.equal(booked16.session_id, l16.session_id);
    assert.equal(booked16.steps[0].skill_id, 'S4');
  });
});

test('formula-like request text is quoted as plain text and nothing is evaluated or written to a CSV', async () => {
  await withTemp(async (root) => {
    const src = liveSourcesDir(path.join(root, 'src'));
    const runDir = path.join(root, 'run');
    const res = await runLive(src, runDir);
    assert.equal(res.status, 'VERIFIED');
    const index = readIndex(runDir);
    const drafts = JSON.parse(readRef(runDir, latestRef(index, 'unsent-message-drafts.json')));
    const l03 = drafts.drafts.find((d) => d.to_role === 'learner' && d.to_id === 'L-03');
    assert.ok(l03.why.includes("You asked: '=cmd|' /C calc'!A0'"), l03.why);
    // requested S4 is also L-03's gap skill (a requested non-gap priority would break the Monday brief, see report)
    assert.deepEqual(l03.what_to_work_on, ['Data structures']);
    // no artifact is a CSV that could carry the text as a spreadsheet formula
    const csvNames = index.filter((r) => r.name.endsWith('.csv')).map((r) => r.name);
    assert.ok(csvNames.every((n) => n !== 'help-requests.csv'), 'request text is never copied into a CSV');
  });
});
