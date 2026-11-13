// Unit tests for personal support: help requests, learner prefs, typed steps, and reviewer checks C18/C19.
// The sources below are hand-made objects (no files). The reviewer checks are run on drafts written by the
// workers and on drafts this file edits by hand, so each check is tested against its own failure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import { computeGaps } from '../../domains/education/analyst.mjs';
import { scheduleMentors } from '../../domains/education/scheduler.mjs';
import { draftMessages } from '../../domains/education/writer.mjs';
import { review } from '../../domains/education/reviewer.mjs';

/** A sources table from a header and array rows, shaped like engine/sources.mjs output. */
function table(header, rows) {
  return {
    header,
    rows: rows.map((r) => Object.freeze(Object.fromEntries(header.map((h, i) => [h, r[i]])))),
    rowNumbers: rows.map((_, i) => i + 2),
  };
}

/**
 * Two skills; T1 has no gap; T2 is at risk (2 gaps, S2 shortfall 30 > S1 shortfall 20);
 * T3 has one gap and is not at risk. Mentor M1 teaches S1 and S2 with capacity 5, Mon 09:00-12:00.
 */
function sources({ requests = null, prefs = null, memory = null } = {}) {
  const s = {
    trainees: table(['trainee_id', 'display_name', 'first_login_day', 'sessions_attended', 'sessions_total'], [
      ['T1', 'Ann', '1', '8', '12'],
      ['T2', 'Ben', '1', '5', '12'],
      ['T3', 'Cy', '2', '6', '12'],
    ]),
    assessments: table(['trainee_id', 'skill_id', 'score'], [
      ['T1', 'S1', '80'], ['T1', 'S2', '80'],
      ['T2', 'S1', '40'], ['T2', 'S2', '30'],
      ['T3', 'S1', '50'], ['T3', 'S2', ''],
    ]),
    skills: table(['skill_id', 'name', 'threshold'], [['S1', 'Variables and types', '60'], ['S2', 'Loops', '60']]),
    mentors: table(['mentor_id', 'display_name', 'skills', 'capacity'], [['M1', 'Mentor One', 'S1;S2', '5']]),
    availability: table(['mentor_id', 'day', 'start', 'end'], [['M1', 'Mon', '09:00', '12:00']]),
  };
  if (requests) s.help_requests = table(['request_id', 'trainee_id', 'skill_id', 'category', 'text', 'at'], requests);
  if (prefs) s.learner_prefs = table(['trainee_id', 'format', 'language'], prefs);
  if (memory) s.memory = table(['trainee_id', 'fact', 'source_run', 'at'], memory);
  return s;
}

const makeStore = () => createArtifactStore(fs.mkdtempSync(path.join(os.tmpdir(), 'tace-personal-')));
const ctx = (sources, store, taskId) => ({ taskId, sources, store, scenario: { inject: null }, phase: 'initial', inputRefs: [] });

/** Gaps, a plan with the given items, a schedule and drafts, all written to one store by the workers. */
async function pipeline(srcs, planItems = []) {
  const store = makeStore();
  const g = await computeGaps(ctx(srcs, store, 'compute_gaps'));
  store.write({
    kind: 'improvement_plan', name: 'improvement-plan.json',
    content: `${JSON.stringify({ rulesVersion: 'edu-rules-v1', items: planItems }, null, 2)}\n`, producer: 'recommend_interventions',
  });
  const sch = await scheduleMentors(ctx(srcs, store, 'mentor_schedule'));
  await draftMessages(ctx(srcs, store, 'draft_messages'));
  return {
    store,
    gaps: JSON.parse(store.read(g.artifacts[0])),
    schedule: parseCsv(store.read(sch.artifacts[0])),
    drafts: JSON.parse(store.read(store.latestByName('unsent-message-drafts.json'))),
  };
}

const T2_PLAN = [{ kind: 'mentor_session', trainee_id: 'T2', skill_id: 'S2', intervention_id: 'I-S2-M' }];
const learnerDraft = (drafts, traineeId) => drafts.drafts.find((d) => d.to_role === 'learner' && d.to_id === traineeId);

/** Writes a new version of the drafts artifact (what a worker or a repair would write). */
function rewriteDrafts(store, drafts) {
  return store.write({
    kind: 'message_drafts', name: 'unsent-message-drafts.json',
    content: `${JSON.stringify(drafts, null, 2)}\n`, producer: 'draft_messages',
  });
}

const checkById = (checks, id) => {
  const hits = checks.filter((c) => c.id === id);
  assert.equal(hits.length, 1, `exactly one ${id} check`);
  return hits[0];
};

const REQ_T1_S2 = ['R-01', 'T1', 'S2', 'explain', 'How do loops end? I keep missing the stop condition.', '2026-11-14T09:00'];

test('analyst: a learner who asked for help is supported though not at risk', async () => {
  const { gaps } = await pipeline(sources({ requests: [REQ_T1_S2] }));
  const t1 = gaps.trainees.find((t) => t.trainee_id === 'T1');
  assert.equal(t1.at_risk, false, 'the at-risk rule is unchanged by a request');
  assert.equal(t1.support_reason, 'requested');
  assert.equal(t1.priority_skill, 'S2', 'the requested skill is the priority');
  assert.deepEqual(t1.requested.map((r) => r.request_id), ['R-01']);
  const t2 = gaps.trainees.find((t) => t.trainee_id === 'T2');
  assert.equal(t2.at_risk, true);
  assert.equal(t2.support_reason, 'at_risk');
  assert.equal(t2.priority_skill, 'S2', 'no request: the existing largest-shortfall rule');
});

test('analyst: a request for a skill that is at risk makes that skill the priority (support_reason both)', async () => {
  const { gaps } = await pipeline(sources({ requests: [['R-02', 'T2', 'S1', 'explain', 'Variables confuse me', '2026-11-14T10:00']] }));
  const t2 = gaps.trainees.find((t) => t.trainee_id === 'T2');
  assert.equal(t2.at_risk, true);
  assert.equal(t2.support_reason, 'both');
  assert.equal(t2.priority_skill, 'S1', 'requested S1 overrides the largest shortfall (S2)');
});

test('an unknown requested skill is not a skill: the learner is supported with no priority from the request', async () => {
  const { gaps } = await pipeline(sources({ requests: [['R-03', 'T1', 'S9', 'other', 'Please call me', '2026-11-14T10:00']] }));
  const t1 = gaps.trainees.find((t) => t.trainee_id === 'T1');
  assert.equal(t1.support_reason, 'requested');
  assert.equal(t1.requested[0].skill_id, null);
  assert.equal(t1.priority_skill, null, 'no gaps and no skill: nothing to prioritise');
});

test('scheduler: a requested learner not at risk is booked, after the at-risk learners', async () => {
  const { schedule } = await pipeline(sources({ requests: [REQ_T1_S2] }), T2_PLAN);
  const t1 = schedule.rows.find((r) => r.trainee_id === 'T1');
  const t2 = schedule.rows.find((r) => r.trainee_id === 'T2');
  assert.equal(t1.status, 'BOOKED');
  assert.equal(t1.skill_id, 'S2');
  assert.equal(t1.mentor_id, 'M1');
  assert.equal(t2.status, 'BOOKED');
  assert.ok(t2.start < t1.start, `at-risk T2 (${t2.start}) is booked before requested T1 (${t1.start})`);
});

test('scheduler: a requested learner with no skill and no gap gets no schedule row (nothing to book, nothing invented)', async () => {
  const { schedule, drafts } = await pipeline(sources({ requests: [['R-04', 'T1', '', 'other', 'Any help?', '2026-11-14T10:00']] }));
  assert.equal(schedule.rows.find((r) => r.trainee_id === 'T1'), undefined);
  const d = learnerDraft(drafts, 'T1');
  assert.equal(d.session_id, '', 'a draft for an unbooked requester has no session');
  assert.equal(d.payload.session, null);
});

test('drafts: prefs default to text and en when no learner_prefs file exists', async () => {
  const { drafts } = await pipeline(sources({ requests: [REQ_T1_S2] }), T2_PLAN);
  for (const d of drafts.drafts.filter((x) => x.to_role === 'learner')) {
    assert.equal(d.format, 'text');
    assert.equal(d.language, 'en');
    assert.equal(d.payload.machine_translated, false);
    assert.equal(d.payload.reviewer_note, undefined);
  }
});

test('drafts: a non-English preference sets language, machine_translated and the reviewer note', async () => {
  const srcs = sources({ requests: [REQ_T1_S2], prefs: [['T1', 'audio', 'zu']] });
  const { drafts } = await pipeline(srcs, T2_PLAN);
  const t1 = learnerDraft(drafts, 'T1');
  assert.equal(t1.format, 'audio');
  assert.equal(t1.language, 'zu');
  assert.equal(t1.payload.machine_translated, true);
  assert.equal(t1.payload.reviewer_note, 'needs a fluent reviewer');
  // code mode keeps English text; the fields carry the language
  assert.match(t1.body, /Hi Ann/);
});

test('drafts: typed steps in the required order, on the weakest gap skill', async () => {
  const { drafts } = await pipeline(sources({ requests: [REQ_T1_S2] }), T2_PLAN);
  const t2 = learnerDraft(drafts, 'T2');
  assert.deepEqual(t2.steps.map((s) => s.type), ['worked_example', 'retrieval_quiz', 'if_then_plan']);
  assert.equal(t2.steps[0].skill_id, 'S2', 'weakest gap skill (shortfall 30)');
  assert.equal(t2.steps[2].text.startsWith('If '), true);
  assert.deepEqual(t2.payload.steps, t2.steps, 'payload.steps has the same shape');
});

test('drafts: why quotes the learner request, truncated to 140 characters, and what_to_work_on names the requested skill', async () => {
  const long = 'x'.repeat(200);
  const { drafts } = await pipeline(sources({ requests: [['R-05', 'T1', 'S2', 'explain', long, '2026-11-14T10:00']] }), T2_PLAN);
  const t1 = learnerDraft(drafts, 'T1');
  assert.ok(t1.why.includes(`You asked: '${'x'.repeat(140)}'`));
  assert.ok(!t1.why.includes('x'.repeat(141)));
  assert.deepEqual(t1.what_to_work_on, ['Loops']);
});

test('formula-like request text is kept as plain text, never evaluated', async () => {
  const { drafts } = await pipeline(sources({ requests: [['R-06', 'T2', 'S2', 'other', "=cmd|' /C calc'!A0", '2026-11-14T11:00']] }), T2_PLAN);
  const t2 = learnerDraft(drafts, 'T2');
  assert.ok(t2.why.includes("You asked: '=cmd|' /C calc'!A0'"));
});

test('C18 PASS on honest drafts; FAIL naming the request when its draft ignores the requested skill', async () => {
  const srcs = sources({ requests: [REQ_T1_S2, ['R-07', 'T3', '', 'other', 'Can we talk about it?', '2026-11-14T12:00']] });
  const { store, drafts } = await pipeline(srcs, T2_PLAN);
  const ok = await review({ sources: srcs, store, scenario: { inject: null } });
  assert.equal(checkById(ok.checks, 'C18_requests_answered').status, 'PASS');

  const broken = JSON.parse(JSON.stringify(drafts));
  learnerDraft(broken, 'T1').what_to_work_on = [];
  rewriteDrafts(store, broken);
  const bad = await review({ sources: srcs, store, scenario: { inject: null } });
  const c18 = checkById(bad.checks, 'C18_requests_answered');
  assert.equal(c18.status, 'FAIL');
  assert.deepEqual(c18.detail.problems.map((p) => p.request_id), ['R-01']);
  assert.equal(c18.detail.problems[0].session_id, learnerDraft(drafts, 'T1').session_id);
});

test('C19 PASS on honest drafts; FAIL when a draft names another learner', async () => {
  const srcs = sources({ requests: [REQ_T1_S2] });
  const { store, drafts } = await pipeline(srcs, T2_PLAN);
  const ok = await review({ sources: srcs, store, scenario: { inject: null } });
  assert.equal(checkById(ok.checks, 'C19_privacy_in_drafts').status, 'PASS');

  const leaky = JSON.parse(JSON.stringify(drafts));
  learnerDraft(leaky, 'T1').body += ' Also, Ben is in your group.';
  rewriteDrafts(store, leaky);
  const bad = await review({ sources: srcs, store, scenario: { inject: null } });
  const c19 = checkById(bad.checks, 'C19_privacy_in_drafts');
  assert.equal(c19.status, 'FAIL');
  assert.ok(c19.detail.problems.some((p) => p.issue === 'other_learner_named' && p.found === 'T2'));
});

test('C19 catches a phone number and a link in a draft', async () => {
  const srcs = sources({ requests: [REQ_T1_S2] });
  const { store, drafts } = await pipeline(srcs, T2_PLAN);
  const leaky = JSON.parse(JSON.stringify(drafts));
  learnerDraft(leaky, 'T1').nudge_sms = 'Call +27 82 555 1234 or see https://example.com/plan';
  rewriteDrafts(store, leaky);
  const bad = await review({ sources: srcs, store, scenario: { inject: null } });
  const issues = checkById(bad.checks, 'C19_privacy_in_drafts').detail.problems.map((p) => p.issue);
  assert.ok(issues.includes('contact_or_link'));
  assert.ok(issues.includes('contact_or_phone'));
});

test('C18 and C19 are not emitted when the optional files were not admitted (fixture runs)', async () => {
  const srcs = sources();
  const { store } = await pipeline(srcs, T2_PLAN);
  const res = await review({ sources: srcs, store, scenario: { inject: null } });
  assert.equal(res.checks.filter((c) => c.id === 'C18_requests_answered' || c.id === 'C19_privacy_in_drafts').length, 0);
});
