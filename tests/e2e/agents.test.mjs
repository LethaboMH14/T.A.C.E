// Agent mode, end to end through the LangGraph runner, with a SCRIPTED model (test double).
// Proves the wiring: Goal Reader -> G02 validator -> Supervisor -> workers (model Message Writer)
// -> independent review (C14 catches a wrong time) -> feedback re-run -> fresh review -> VERIFIED.
// The live demo uses the real Meta Model API through engine/model.mjs instead of this double.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMission } from '../../engine/run.mjs';
import { EDU_DOMAIN } from '../../domains/education/index.mjs';
import { TRUSTED_FIXTURE_CONTEXT, SCENARIOS } from '../../fixtures/education-recovery/scenarios.mjs';

function scriptedModel({ wrongTimeFirst }) {
  const calls = [];
  let writerCalls = 0;
  return {
    available: true, provider: 'scripted-test-double', model: 'none', calls,
    async chat({ agent, messages }) {
      calls.push(agent);
      const usage = { prompt: 10, completion: 10, total: 20 };
      if (agent === 'Goal Reader') return { json: structuredClone(SCENARIOS[0].proposal), text: '', toolCalls: [], usage, ms: 1 };
      if (agent === 'Supervisor') {
        const ids = ['compute_gaps', 'performance_summary', 'recommend_interventions', 'mentor_schedule', 'draft_messages'];
        return { json: { hires: ids.map((capabilityId) => ({ capabilityId, reason: `Needed for the goal (${capabilityId})` })) }, text: '', toolCalls: [], usage, ms: 1 };
      }
      if (agent === 'Message Writer') {
        writerCalls++;
        const facts = JSON.parse(messages.find((m) => m.role === 'user' && m.content.startsWith('Facts for')).content.replace(/^[^\n]*\n/, '')).sessions;
        const drafts = facts.map((f, i) => {
          const start = wrongTimeFirst && writerCalls === 1 && i === 0 ? '11:30' : f.start; // a realistic model slip
          return { session_id: f.session_id, subject: `Mentor session on ${f.day_label}`, body: `Hi ${f.learner_name}, you have a ${f.skill_name} session with ${f.mentor_name} on ${f.day_label} at ${start}. Reply if that time does not work.` };
        });
        return { json: { drafts }, text: '', toolCalls: [], usage, ms: 1 };
      }
      if (agent === 'Reviewer') return { json: { verdicts: [] }, text: '', toolCalls: [], usage, ms: 1 };
      throw Object.assign(new Error(`unexpected agent ${agent}`), { code: 'TEST_UNEXPECTED' });
    },
  };
}

async function run(model, scenarioId = 'baseline') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-agents-'));
  const runDir = path.join(dir, 'run');
  const scenario = JSON.parse(fs.readFileSync(path.join(EDU_DOMAIN.scenariosDir, `${scenarioId}.json`), 'utf8'));
  const result = await runMission({ scenario, domain: EDU_DOMAIN, sourcesDir: EDU_DOMAIN.sourcesDir, runDir, runId: 'agents', trustedContext: TRUSTED_FIXTURE_CONTEXT, model });
  const events = fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return { result, events, runDir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('AGENTS-01 model mode: goal drafted by the model, team staffed, drafts written by the model, VERIFIED', async () => {
  const model = scriptedModel({ wrongTimeFirst: false });
  const { result, events, cleanup } = await run(model);
  try {
    assert.equal(result.status, 'VERIFIED');
    const started = events.find((e) => e.type === 'RUN_STARTED');
    assert.equal(started.data.agents.mode, 'model');
    assert.equal(events.find((e) => e.type === 'GOAL_VALIDATED').data.source, 'model');
    assert.ok(events.some((e) => e.type === 'GOAL_DRAFTED' && e.data.ok));
    assert.equal(events.filter((e) => e.type === 'AGENT_JOINED').length, 5);
    assert.ok(events.some((e) => e.type === 'AGENT_MESSAGE'));
    assert.ok(model.calls.includes('Message Writer'));
    assert.equal(result.manifest.orchestration, 'langgraph');
  } finally { cleanup(); }
});

test('AGENTS-02 model writes a wrong time: C14 catches it, writer re-runs with feedback, re-check passes', async () => {
  const model = scriptedModel({ wrongTimeFirst: true });
  const { result, events, cleanup } = await run(model);
  try {
    const failed = events.find((e) => e.type === 'VERIFICATION_FAILED');
    assert.ok(failed, 'the reviewer must fail round 1');
    assert.ok(failed.data.failed.includes('C14_drafts_text_matches'));
    const rerun = events.find((e) => e.type === 'TASK_RERUN' && e.taskId === 'draft_messages');
    assert.ok(rerun);
    assert.equal(rerun.data.reason, 'checker feedback');
    assert.equal(model.calls.filter((a) => a === 'Message Writer').length, 2);
    assert.ok(events.some((e) => e.type === 'VERIFICATION_PASSED' && e.data.round === 2));
    assert.equal(result.status, 'VERIFIED');
  } finally { cleanup(); }
});

test('AGENTS-03 code mode stays honest: no model calls, labelled code only', async () => {
  const { result, events, cleanup } = await run('off');
  try {
    assert.equal(result.status, 'VERIFIED');
    assert.equal(events.find((e) => e.type === 'RUN_STARTED').data.agents.mode, 'code');
    assert.equal(events.filter((e) => e.type === 'MODEL_CALL').length, 0);
    assert.equal(events.find((e) => e.type === 'GOAL_VALIDATED').data.source, 'fixture');
  } finally { cleanup(); }
});

test('AGENTS-04 auto mode with no key: runs as code only and says so', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-agents-'));
  try {
    const scenario = JSON.parse(fs.readFileSync(path.join(EDU_DOMAIN.scenariosDir, 'baseline.json'), 'utf8'));
    const r = await runMission({ scenario, domain: EDU_DOMAIN, sourcesDir: EDU_DOMAIN.sourcesDir, runDir: path.join(dir, 'r'), runId: 'nokey', trustedContext: TRUSTED_FIXTURE_CONTEXT, model: 'auto', env: {} });
    const started = JSON.parse(fs.readFileSync(path.join(dir, 'r', 'events.jsonl'), 'utf8').split('\n')[0]);
    assert.equal(started.data.agents.mode, 'code');
    assert.match(started.data.agents.note, /No model key/);
    assert.equal(r.status, 'VERIFIED');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
