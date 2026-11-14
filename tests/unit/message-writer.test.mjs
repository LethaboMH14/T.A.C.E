// Unit tests for domains/education/message-writer.mjs (AGENTS-SPEC §4).
// Real admitted fixtures + a real artifact store in a temp dir. The model is a SCRIPTED TEST DOUBLE
// defined in this file only: it returns canned JSON and records every call it receives.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { admitSources } from '../../engine/sources.mjs';
import { toCsv } from '../../engine/csv.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { draftMessagesWithModel } from '../../domains/education/message-writer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '..', '..', 'fixtures', 'education-recovery', 'v1');
const admitted = admitSources(FIXTURE, EDU_SOURCE_SPECS);
const sources = admitted.sources;

const SCHEDULE_HEADER = ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'intervention_id', 'status'];
// Hand-made schedule: 3 BOOKED sessions and 1 UNSCHEDULED row.
const SCHEDULE = [
  { session_id: 'S-01', trainee_id: 'L-03', skill_id: 'S4', mentor_id: 'M-B', day: 'Tue', date: '2026-11-17', start: '09:00', end: '10:00', intervention_id: 'I-S4-M', status: 'BOOKED' },
  { session_id: 'S-02', trainee_id: 'L-05', skill_id: 'S1', mentor_id: 'M-A', day: 'Mon', date: '2026-11-16', start: '09:00', end: '10:00', intervention_id: 'I-S1-M', status: 'BOOKED' },
  { session_id: 'S-03', trainee_id: 'L-07', skill_id: 'S3', mentor_id: 'M-B', day: 'Thu', date: '2026-11-19', start: '09:00', end: '10:00', intervention_id: 'I-S3-M', status: 'BOOKED' },
  { session_id: 'S-04', trainee_id: 'L-09', skill_id: 'S5', mentor_id: '', day: '', date: '', start: '', end: '', intervention_id: 'I-S5-M', status: 'UNSCHEDULED' },
];

const tmpDirs = [];
function newStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-msgwriter-'));
  tmpDirs.push(dir);
  return createArtifactStore(dir);
}
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * Scripted model double (test only). `replies` is an array of functions or JSON values, consumed in
 * order; a function receives the call and returns the JSON. Every call is recorded in `calls`.
 */
function scriptedModel(replies = [], { available = true } = {}) {
  const calls = [];
  let i = 0;
  return {
    available,
    provider: 'fake',
    model: 'scripted',
    calls,
    async chat(opts) {
      calls.push(opts);
      const r = replies[i] ?? replies[replies.length - 1];
      i += 1;
      const json = typeof r === 'function' ? r(opts) : r;
      return { json, usage: { prompt: 0, completion: 0, total: 0 } };
    },
  };
}

/** Correct-by-construction body from the facts in the prompt (the test double's "good" model). */
function goodDrafts(opts) {
  const facts = JSON.parse(opts.messages[1].content.slice(opts.messages[1].content.indexOf('{')));
  return {
    drafts: facts.sessions.map((f) => ({
      session_id: f.session_id,
      subject: `Your mentor session on ${f.day_label}`,
      body: `Hi ${f.learner_name}, you have a 1:1 mentor session on ${f.skill_name} with ${f.mentor_name} on ${f.day_label} at ${f.start}–${f.end}. Reply if this time does not work.`,
    })),
  };
}

function writeSchedule(store) {
  return store.write({
    kind: 'mentor_schedule', name: 'mentor-schedule.csv', content: toCsv(SCHEDULE_HEADER, SCHEDULE),
    producer: 'test', inputs: [],
  });
}

function ctxFor(store, model, extra = {}) {
  return {
    taskId: 'draft_messages', sources, store, scenario: {}, phase: 'initial',
    inputRefs: [{ name: 'mentor-schedule.csv', version: 1, digest: 'x' }], model, ...extra,
  };
}

test('correct output: both files written, every draft UNSENT, facts copied from the schedule', async () => {
  const store = newStore();
  writeSchedule(store);
  const model = scriptedModel([goodDrafts]);
  const res = await draftMessagesWithModel(ctxFor(store, model));

  assert.equal(res.artifacts.length, 2);
  const jsonRef = store.latestByName('unsent-message-drafts.json');
  const mdRef = store.latestByName('unsent-message-drafts.md');
  assert.ok(jsonRef && mdRef, 'both files exist');
  assert.equal(jsonRef.producer, 'draft_messages');
  assert.deepEqual(jsonRef.inputs.map((i) => i.name), ['mentor-schedule.csv']);

  const json = JSON.parse(store.read(jsonRef));
  assert.equal(json.status_all, 'UNSENT');
  assert.deepEqual(json.drafts.map((d) => d.draft_id), ['D-01', 'D-02', 'D-03', 'D-04', 'D-05']);
  assert.ok(json.drafts.every((d) => d.status === 'UNSENT'));

  const d1 = json.drafts[0];
  assert.equal(d1.to_role, 'learner');
  assert.equal(d1.to_id, 'L-03');
  assert.equal(d1.session_id, 'S-01');
  assert.equal(d1.day, 'Tue');
  assert.equal(d1.date, '2026-11-17');
  assert.equal(d1.start, '09:00');
  assert.equal(d1.mentor_id, 'M-B');
  assert.match(d1.body, /Tue 17 Nov/);
  assert.match(d1.body, /Mentor B/);

  const mentorDrafts = json.drafts.filter((d) => d.to_role === 'mentor');
  assert.deepEqual(mentorDrafts.map((d) => d.to_id), ['M-A', 'M-B']);
  assert.equal(mentorDrafts[1].session_id, '');

  assert.match(store.read(mdRef), /UNSENT/);
  assert.deepEqual(res.summary, {
    drafts: 5, learnerDrafts: 3, mentorDrafts: 2, writtenBy: 'fake:scripted',
  });
});

test('facts are copied by code even when the model body is wrong', async () => {
  const store = newStore();
  writeSchedule(store);
  const model = scriptedModel([() => ({
    drafts: [
      { session_id: 'S-01', subject: 'Hi', body: 'See you Friday at 14:00 with someone else.' },
      { session_id: 'S-02', subject: 'Hi', body: 'Wrong text.' },
      { session_id: 'S-03', subject: 'Hi', body: 'Also wrong.' },
    ],
  })]);
  await draftMessagesWithModel(ctxFor(store, model));
  const json = JSON.parse(store.read(store.latestByName('unsent-message-drafts.json')));
  const d1 = json.drafts[0];
  assert.equal(d1.body, 'See you Friday at 14:00 with someone else.', 'body is the model text, unchanged');
  assert.equal(d1.day, 'Tue');
  assert.equal(d1.date, '2026-11-17');
  assert.equal(d1.start, '09:00');
  assert.equal(d1.mentor_id, 'M-B');
  assert.equal(d1.session_id, 'S-01');
  assert.equal(d1.to_id, 'L-03');
  assert.equal(d1.status, 'UNSENT');
});

test('a session the model skipped throws MODEL_INCOMPLETE and writes nothing', async () => {
  const store = newStore();
  writeSchedule(store);
  const model = scriptedModel([() => ({
    drafts: [
      { session_id: 'S-01', subject: 'a', body: 'b' },
      { session_id: 'S-03', subject: 'a', body: 'b' },
    ],
  })]);
  await assert.rejects(
    draftMessagesWithModel(ctxFor(store, model)),
    (err) => err.code === 'MODEL_INCOMPLETE' && /S-02/.test(err.message),
  );
  assert.equal(store.latestByName('unsent-message-drafts.json'), null);
});

test('feedback is passed into the second call messages', async () => {
  const store = newStore();
  writeSchedule(store);
  const model = scriptedModel([goodDrafts, goodDrafts]);
  await draftMessagesWithModel(ctxFor(store, model));
  assert.equal(model.calls.length, 1);
  assert.equal(model.calls[0].messages.length, 2, 'first call has no feedback message');

  const feedback = [{ session_id: 'S-01', draft_id: 'D-01', issue: 'time_wrong', expected: '09:00', found: '10:00' }];
  await draftMessagesWithModel(ctxFor(store, model, { feedback }));
  assert.equal(model.calls.length, 2);
  const msgs = model.calls[1].messages;
  assert.equal(msgs.length, 3, 'second call adds one user message for the feedback');
  const fb = msgs[2];
  assert.equal(fb.role, 'user');
  assert.match(fb.content, /S-01/);
  assert.match(fb.content, /D-01/);
  assert.match(fb.content, /time_wrong/);
  assert.match(fb.content, /ALL drafts/);
  assert.equal(model.calls[1].jsonSchema.name, 'drafts');
});

test('model unavailable throws MODEL_UNAVAILABLE and calls nothing', async () => {
  const store = newStore();
  writeSchedule(store);
  const model = scriptedModel([goodDrafts], { available: false });
  await assert.rejects(
    draftMessagesWithModel(ctxFor(store, model)),
    (err) => err.code === 'MODEL_UNAVAILABLE',
  );
  assert.equal(model.calls.length, 0);
  assert.equal(store.latestByName('unsent-message-drafts.json'), null);
});
