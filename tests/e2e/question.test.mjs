// "One smart question": the Goal Reader asks a blocking question, the run pauses, a coordinator answer
// comes back, the goal is re-read with that answer, and the run continues. The model is a scripted
// test double; the runner, validator and ledger are the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMission } from '../../engine/run.mjs';
import { EDU_DOMAIN } from '../../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT, SCENARIOS } from '../../fixtures/education-recovery/scenarios.mjs';

const VAGUE = SCENARIOS.find((s) => s.id === 'vague_goal');
const ANSWER = 'Learners with 2 or more gaps';
const QUESTION = 'Which learners count as struggling?';

/** A Goal Reader reply that the validator reads as NEEDS_CLARIFICATION (one blocking uncertainty). */
function unclearProposal() {
  const p = structuredClone(VAGUE.proposal);
  p.uncertainties = [{ code: 'AMBIGUOUS_REFERENCE', question: QUESTION, blocking: true }];
  return p;
}

/** Scripted model: Goal Reader replies in order; the other agents get fixed, valid replies. */
function scriptedModel(goalReplies) {
  const queue = [...goalReplies];
  const calls = [];
  const usage = { prompt: 1, completion: 1, total: 2 };
  return {
    available: true, provider: 'scripted-test-double', model: 'none', calls,
    async chat({ agent, messages }) {
      calls.push({ agent, messages });
      if (agent === 'Goal Reader') {
        if (queue.length === 0) throw Object.assign(new Error('no Goal Reader reply queued'), { code: 'TEST_UNEXPECTED' });
        return { json: queue.shift(), text: '', toolCalls: [], usage, ms: 1 };
      }
      if (agent === 'Supervisor') {
        const ids = ['compute_gaps', 'performance_summary', 'recommend_interventions', 'mentor_schedule', 'draft_messages'];
        return { json: { hires: ids.map((capabilityId) => ({ capabilityId, reason: `Needed for the goal (${capabilityId})` })) }, text: '', toolCalls: [], usage, ms: 1 };
      }
      if (agent === 'Message Writer') {
        const facts = JSON.parse(messages.find((m) => m.role === 'user' && m.content.startsWith('Facts for')).content.replace(/^[^\n]*\n/, '')).sessions;
        const drafts = facts.map((f) => ({ session_id: f.session_id, subject: `Mentor session on ${f.day_label}`, body: `Hi ${f.learner_name}, you have a ${f.skill_name} session with ${f.mentor_name} on ${f.day_label} at ${f.start}. Reply if that time does not work.` }));
        return { json: { drafts }, text: '', toolCalls: [], usage, ms: 1 };
      }
      if (agent === 'Reviewer voice') return { json: { verdicts: [] }, text: '', toolCalls: [], usage, ms: 1 };
      throw Object.assign(new Error(`unexpected agent ${agent}`), { code: 'TEST_UNEXPECTED' });
    },
  };
}

async function run({ model, askHuman, askTimeoutMs }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-question-'));
  const runDir = path.join(dir, 'run');
  try {
    const result = await runMission({
      scenario: VAGUE, domain: EDU_DOMAIN, sourcesDir: EDU_DOMAIN.sourcesDir, runDir, runId: 'question',
      trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: 0, model, askHuman, askTimeoutMs,
    });
    const events = fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    return { result, events };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('QUESTION-01 blocking question is asked, answered, the goal is re-read with the answer, and the run is VERIFIED', async () => {
  const model = scriptedModel([unclearProposal(), structuredClone(VAGUE.proposal)]);
  const asked = [];
  const askHuman = async (q) => { asked.push(q.question); return ANSWER; };
  const { result, events } = await run({ model, askHuman });

  assert.deepEqual(asked, [QUESTION]);
  const qIdx = events.findIndex((e) => e.type === 'HUMAN_QUESTION');
  const aIdx = events.findIndex((e) => e.type === 'HUMAN_ANSWER');
  assert.ok(qIdx >= 0, 'HUMAN_QUESTION must be emitted');
  assert.ok(aIdx > qIdx, 'HUMAN_ANSWER must come after HUMAN_QUESTION');
  assert.equal(events[qIdx].data.question, QUESTION);
  assert.equal(events[aIdx].data.answer, ANSWER);
  assert.equal(events[aIdx].data.by, 'coordinator');
  assert.equal(events[aIdx].data.id, events[qIdx].data.id);

  const goalCalls = model.calls.filter((c) => c.agent === 'Goal Reader');
  assert.equal(goalCalls.length, 2, 'the goal is read again after the answer');
  assert.ok(goalCalls[1].messages.some((m) => m.content.includes(ANSWER)), 'the second read carries the answer');
  assert.ok(events.some((e) => e.type === 'GOAL_VALIDATED'), 'the goal is accepted after the answer');

  assert.equal(result.status, 'VERIFIED');
});

test('QUESTION-02 no answer given: BLOCKED, and the reason names the question', async () => {
  const model = scriptedModel([unclearProposal()]);
  const { result, events } = await run({ model, askHuman: async () => null });

  assert.equal(result.status, 'BLOCKED');
  assert.ok(events.some((e) => e.type === 'HUMAN_QUESTION'));
  assert.ok(!events.some((e) => e.type === 'HUMAN_ANSWER'), 'no answer event for a missing answer');
  assert.equal(model.calls.filter((c) => c.agent === 'Goal Reader').length, 1, 'the goal is not re-read without an answer');
  const finished = events.find((e) => e.type === 'RUN_FINISHED');
  assert.match(finished.data.reason, /Which learners count as struggling\?/);
});

test('QUESTION-03 no askHuman at all: BLOCKED with the question in the reason (unchanged behaviour)', async () => {
  const model = scriptedModel([unclearProposal()]);
  const { result, events } = await run({ model, askHuman: null });

  assert.equal(result.status, 'BLOCKED');
  assert.ok(events.some((e) => e.type === 'HUMAN_QUESTION'));
  assert.ok(!events.some((e) => e.type === 'HUMAN_ANSWER'));
  assert.match(result.manifest.reason, /Which learners count as struggling\?/);
});

test('QUESTION-04 an answer that never arrives in time counts as no answer', async () => {
  const model = scriptedModel([unclearProposal()]);
  const { result, events } = await run({ model, askHuman: () => new Promise(() => {}), askTimeoutMs: 20 });

  assert.equal(result.status, 'BLOCKED');
  assert.ok(!events.some((e) => e.type === 'HUMAN_ANSWER'));
  assert.equal(model.calls.filter((c) => c.agent === 'Goal Reader').length, 1);
});
