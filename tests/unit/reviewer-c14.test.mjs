// Unit tests for check C14_drafts_text_matches in domains/education/reviewer.mjs.
// The drafts and schedule below are written by THIS file (its own text), not by any worker module.

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

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '..', '..', 'fixtures', 'education-recovery', 'v1');
const S = admitSources(FIXTURE, EDU_SOURCE_SPECS).sources;
const BASELINE = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'scenarios', 'baseline.json'), 'utf8'));

const SCHEDULE_HEADER = ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'intervention_id', 'status'];
const SCHEDULE = [
  { session_id: 'S-01', trainee_id: 'L-03', skill_id: 'S4', mentor_id: 'M-B', day: 'Tue', date: '2026-11-17', start: '09:00', end: '10:00', intervention_id: 'I-S4-M', status: 'BOOKED' },
  { session_id: 'S-02', trainee_id: 'L-05', skill_id: 'S1', mentor_id: 'M-A', day: 'Mon', date: '2026-11-16', start: '09:00', end: '10:00', intervention_id: 'I-S1-M', status: 'BOOKED' },
  { session_id: 'S-03', trainee_id: 'L-07', skill_id: 'S3', mentor_id: 'M-B', day: 'Thu', date: '2026-11-19', start: '09:00', end: '10:00', intervention_id: 'I-S3-M', status: 'BOOKED' },
  { session_id: 'S-04', trainee_id: 'L-09', skill_id: 'S5', mentor_id: '', day: '', date: '', start: '', end: '', intervention_id: 'I-S5-M', status: 'UNSCHEDULED' },
];

/** Learner body that is correct for a session (label, start–end, mentor name). */
const good = {
  'S-01': 'Hi Learner 03, you have a 1:1 mentor session on Data structures with Mentor B on Tue 17 Nov at 09:00–10:00. Reply if this time does not work.',
  'S-02': 'Hi Learner 05, you have a 1:1 mentor session on Variables and types with Mentor A on Mon 16 Nov at 09:00–10:00. Reply if this time does not work.',
  'S-03': 'Hi Learner 07, you have a 1:1 mentor session on Functions with Mentor B on Thu 19 Nov at 09:00–10:00. Reply if this time does not work.',
};

/** Builds a drafts artifact. `overrides` maps session_id -> replacement body. */
function draftsJson(overrides = {}) {
  const ids = ['S-01', 'S-02', 'S-03'];
  const learner = ids.map((sid, i) => ({
    draft_id: `D-0${i + 1}`, to_role: 'learner', to_id: SCHEDULE[i].trainee_id, session_id: sid,
    subject: 'Your mentor session', body: overrides[sid] ?? good[sid],
    day: SCHEDULE[i].day, date: SCHEDULE[i].date, start: SCHEDULE[i].start, mentor_id: SCHEDULE[i].mentor_id, status: 'UNSENT',
  }));
  const mentors = ['M-A', 'M-B'].map((mid, i) => ({
    draft_id: `D-0${4 + i}`, to_role: 'mentor', to_id: mid, session_id: '',
    subject: 'Your booked mentor sessions', body: `Hi ${mid}, summary.`,
    day: '', date: '', start: '', mentor_id: mid, status: 'UNSENT',
  }));
  return `${JSON.stringify({ status_all: 'UNSENT', drafts: [...learner, ...mentors] }, null, 2)}\n`;
}

function mkStore(draftsText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h8-c14-'));
  const store = createArtifactStore(dir);
  store.write({ kind: KIND.MENTOR_SCHEDULE, name: 'mentor-schedule.csv', content: toCsv(SCHEDULE_HEADER, SCHEDULE), producer: 'test', inputs: [] });
  if (draftsText !== null) {
    store.write({ kind: KIND.MESSAGE_DRAFTS, name: 'unsent-message-drafts.json', content: draftsText ?? draftsJson(), producer: 'test', inputs: [] });
  }
  return store;
}

async function c14(draftsText) {
  const store = mkStore(draftsText);
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  const hits = checks.filter((c) => c.id === 'C14_drafts_text_matches');
  assert.equal(hits.length, 1, 'exactly one C14 check');
  return hits[0];
}

test('correct learner bodies: C14 PASS', async () => {
  const c = await c14(draftsJson());
  assert.equal(c.status, CHECK_STATUS.PASS, c.message);
  assert.equal(c.kind, KIND.MESSAGE_DRAFTS);
  assert.match(c.message, /All 3 learner drafts/);
});

test('body with a wrong time 10:00 (not the start 09:00): C14 FAIL naming that draft', async () => {
  const c = await c14(draftsJson({
    'S-01': 'Hi Learner 03, you have a session on Data structures with Mentor B on Tue 17 Nov at 10:00. Reply if this time does not work.',
  }));
  assert.equal(c.status, CHECK_STATUS.FAIL);
  assert.equal(c.message, 'Draft D-01 says 10:00 but the session starts at 09:00.');
  const p = c.detail.problems;
  assert.ok(p.every((x) => x.draft_id === 'D-01' && x.session_id === 'S-01'), 'only the wrong draft is named');
  assert.ok(p.some((x) => x.issue === 'start_missing' && x.expected === '09:00' && x.found === '10:00'));
});

test('a stray time that is neither start nor end: C14 FAIL with time_wrong', async () => {
  const c = await c14(draftsJson({
    'S-02': 'Hi Learner 05, session with Mentor A on Mon 16 Nov at 09:00 and again at 11:30. Reply if needed.',
  }));
  assert.equal(c.status, CHECK_STATUS.FAIL);
  const p = c.detail.problems.find((x) => x.issue === 'time_wrong');
  assert.ok(p, 'time_wrong problem present');
  assert.equal(p.draft_id, 'D-02');
  assert.equal(p.found, '11:30');
  assert.equal(c.message, 'Draft D-02 says 11:30 but the session starts at 09:00.');
});

test('body missing the mentor name: C14 FAIL', async () => {
  const c = await c14(draftsJson({
    'S-03': 'Hi Learner 07, you have a 1:1 mentor session on Functions on Thu 19 Nov at 09:00–10:00. Reply if this time does not work.',
  }));
  assert.equal(c.status, CHECK_STATUS.FAIL);
  const p = c.detail.problems.find((x) => x.issue === 'mentor_missing');
  assert.ok(p);
  assert.equal(p.draft_id, 'D-03');
  assert.equal(p.expected, 'Mentor B');
  assert.equal(c.message, 'Draft D-03 does not name the mentor Mentor B.');
});

test('extra weekday Friday in a Tuesday session: C14 FAIL', async () => {
  const c = await c14(draftsJson({
    'S-01': 'Hi Learner 03, you have a session with Mentor B on Tue 17 Nov at 09:00–10:00, not Friday. Reply if needed.',
  }));
  assert.equal(c.status, CHECK_STATUS.FAIL);
  const p = c.detail.problems.find((x) => x.issue === 'weekday_wrong');
  assert.ok(p);
  assert.equal(p.draft_id, 'D-01');
  assert.equal(p.found, 'Friday');
  assert.equal(p.expected, 'Tue');
});

test('no drafts artifact: C14 is not emitted', async () => {
  const store = mkStore(null);
  const { checks } = await review({ sources: S, store, scenario: BASELINE });
  assert.equal(checks.filter((c) => c.id === 'C14_drafts_text_matches').length, 0);
});

test('a body in the writer wording (start–end range, mentor, day label) passes C14', async () => {
  const body = 'Hi Learner 05, you have a 1:1 mentor session on Variables and types with Mentor A on Mon 16 Nov at 09:00–10:00. Reply if this time does not work.';
  const c = await c14(draftsJson({ 'S-02': body }));
  assert.equal(c.status, CHECK_STATUS.PASS, c.message);
});
