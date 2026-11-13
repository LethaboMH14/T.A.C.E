// Unit tests for the agent layer. The model is a scripted test double; messenger is the real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT, KIND } from '../../engine/contracts.mjs';
import { createMessenger } from '../../engine/messages.mjs';
import { createRegistry } from '../../engine/registry.mjs';
import { planTasks } from '../../engine/planner.mjs';
import { EDU_CAPABILITIES } from '../../domains/education/capabilities.mjs';
import { planRepairs } from '../../domains/education/repair.mjs';
import { normalizeGoalTurn } from '../../tools/gate02/normalize-turn.mjs';
import { SCENARIOS, TRUSTED_FIXTURE_CONTEXT } from '../../fixtures/education-recovery/scenarios.mjs';
import { readGoal } from '../../agents/goal-reader.mjs';
import { staffTeam } from '../../agents/supervisor.mjs';
import { explainReview } from '../../agents/reviewer-voice.mjs';

const baseline = SCENARIOS.find((s) => s.id === 'baseline');
const clone = (x) => JSON.parse(JSON.stringify(x));
const CATALOG = [
  { id: 'gap_analysis', description: 'Per-learner skill gaps' },
  { id: 'performance_summary', description: 'Cohort summary' },
  { id: 'improvement_plan', description: 'Support plan' },
  { id: 'mentor_schedule', description: 'Mentor sessions' },
  { id: 'message_drafts', description: 'Unsent drafts' },
];

function intakeFor(scenario) {
  const n = normalizeGoalTurn(
    { goal: scenario.goalText, sources: scenario.intakeSources.map((r) => ({ kind: 'upload', ref: r })) },
    TRUSTED_FIXTURE_CONTEXT,
  );
  assert.equal(n.status, 'NORMALIZED');
  return n.record;
}

/** Scripted fake model: returns queued responses in order; records every call. */
function scriptedModel(responses, { available = true } = {}) {
  const queue = [...responses];
  const calls = [];
  return {
    available,
    calls,
    chat: async (req) => {
      calls.push(req);
      if (queue.length === 0) throw new Error('scripted model: no response queued');
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return { json: next, text: JSON.stringify(next), usage: { prompt: 1, completion: 1, total: 2 } };
    },
  };
}

function collector() {
  const events = [];
  return { events, emit: (type, data, meta) => events.push({ type, data, meta }) };
}

// ---------------------------------------------------------------- goal reader

test('goal reader accepts a valid proposal on attempt 1', async () => {
  const intake = intakeFor(baseline);
  const model = scriptedModel([clone(baseline.proposal)]);
  const { events, emit } = collector();
  const messenger = createMessenger(emit);

  const r = await readGoal({ model, intake, catalog: CATALOG, messenger, emit });

  assert.equal(r.status, 'ACCEPTED');
  assert.equal(r.attempts, 1);
  assert.equal(r.proposal.deliverables.length, 5);
  const drafted = events.filter((e) => e.type === EVENT.GOAL_DRAFTED);
  assert.equal(drafted.length, 1);
  assert.equal(drafted[0].data.ok, true);
  const msgs = messenger.list();
  assert.deepEqual(msgs.map((m) => m.type), ['RESULT']);
  assert.equal(msgs[0].from, 'Goal Reader');
  assert.equal(msgs[0].to, 'Supervisor');
  // assemblePrompt output: developer text is sent as system; user payload stays user; catalog is added.
  const sent = model.calls[0].messages;
  assert.deepEqual(sent.map((m) => m.role), ['system', 'system', 'user', 'system']);
  assert.match(sent[3].content, /gap_analysis/);
  assert.match(sent[3].content, /anything else must be listed as unsupported/);
  assert.equal(model.calls[0].jsonSchema.name, 'goal_proposal');
  assert.equal(model.calls[0].jsonSchema.schema.$id, undefined);
});

test('goal reader: invalid first (extra field) then valid gives 2 drafts, 1 challenge, ACCEPTED', async () => {
  const intake = intakeFor(baseline);
  const bad = { ...clone(baseline.proposal), approved: true };
  const model = scriptedModel([bad, clone(baseline.proposal)]);
  const { events, emit } = collector();
  const messenger = createMessenger(emit);

  const r = await readGoal({ model, intake, catalog: CATALOG, messenger, emit });

  assert.equal(r.status, 'ACCEPTED');
  assert.equal(r.attempts, 2);
  const drafted = events.filter((e) => e.type === EVENT.GOAL_DRAFTED);
  assert.equal(drafted.length, 2);
  assert.equal(drafted[0].data.ok, false);
  assert.equal(drafted[0].data.code, 'INVALID_PROPOSAL_SHAPE');
  assert.equal(drafted[1].data.ok, true);
  const msgs = messenger.list();
  const challenges = msgs.filter((m) => m.type === 'CHALLENGE');
  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].from, 'Validator');
  assert.equal(challenges[0].to, 'Goal Reader');
  assert.equal(challenges[0].reason, 'Rejected: INVALID_PROPOSAL_SHAPE');
  // Retry message states only the code.
  const retry = model.calls[1].messages.at(-1);
  assert.equal(retry.role, 'user');
  assert.match(retry.content, /INVALID_PROPOSAL_SHAPE/);
  assert.equal(msgs.at(-1).type, 'RESULT');
});

test('goal reader: 3 invalid answers give ESCALATED', async () => {
  const intake = intakeFor(baseline);
  const bad = { ...clone(baseline.proposal), approved: true };
  const model = scriptedModel([bad, bad, bad]);
  const { events, emit } = collector();
  const messenger = createMessenger(emit);

  const r = await readGoal({ model, intake, catalog: CATALOG, messenger, emit });

  assert.equal(r.status, 'ESCALATED');
  assert.equal(r.proposal, null);
  assert.equal(r.attempts, 3);
  assert.equal(events.filter((e) => e.type === EVENT.GOAL_DRAFTED).length, 3);
  const msgs = messenger.list();
  assert.equal(msgs.filter((m) => m.type === 'CHALLENGE').length, 3);
  const last = msgs.at(-1);
  assert.equal(last.type, 'ESCALATE');
  assert.equal(last.to, 'Coordinator');
});

test('goal reader: deliverable outside the catalog is rejected by code', async () => {
  const intake = intakeFor(baseline);
  const off = clone(baseline.proposal);
  off.deliverables[0].id = 'budget_forecast';
  off.subgoals[0].deliverableIds[0] = 'budget_forecast';
  off.acceptanceCriteria[0].deliverableId = 'budget_forecast';
  const model = scriptedModel([off, clone(baseline.proposal)]);
  const { events, emit } = collector();
  const r = await readGoal({ model, intake, catalog: CATALOG, messenger: createMessenger(emit), emit });
  assert.equal(r.status, 'ACCEPTED');
  assert.equal(events.filter((e) => e.type === EVENT.GOAL_DRAFTED)[0].data.code, 'UNSUPPORTED_DELIVERABLE');
});

test('goal reader: model unavailable throws MODEL_UNAVAILABLE and sends nothing', async () => {
  const intake = intakeFor(baseline);
  const model = scriptedModel([], { available: false });
  const { events, emit } = collector();
  const messenger = createMessenger(emit);
  await assert.rejects(
    readGoal({ model, intake, catalog: CATALOG, messenger, emit }),
    (err) => err.code === 'MODEL_UNAVAILABLE',
  );
  assert.equal(model.calls.length, 0);
  assert.equal(messenger.list().length, 0);
  assert.equal(events.length, 0);
});

// ---------------------------------------------------------------- supervisor

const registry = createRegistry(EDU_CAPABILITIES);
const SOURCE_KINDS = [KIND.SRC_TRAINEES, KIND.SRC_ASSESSMENTS, KIND.SRC_SKILLS, KIND.SRC_MENTORS, KIND.SRC_AVAILABILITY, KIND.SRC_INTERVENTIONS];
const fullPlan = () => planTasks(registry, baseline.proposal.deliverables.map((d) => d.id), SOURCE_KINDS);
const hireAll = (plan, reasons = {}) => ({
  hires: plan.tasks.map((t) => ({ capabilityId: t.id, reason: reasons[t.id] ?? `Needed for ${t.label}` })),
});

test('supervisor: model missing a dependency gives CHALLENGE + DECISION, final tasks equal the code plan', async () => {
  const plan = fullPlan();
  const ids = plan.tasks.map((t) => t.id);
  assert.ok(ids.includes('recommend_interventions'));
  const missing = hireAll(plan);
  missing.hires = missing.hires.filter((h) => h.capabilityId !== 'recommend_interventions');
  const model = scriptedModel([missing, hireAll(plan)]);
  const { events, emit } = collector();
  const messenger = createMessenger(emit);

  const r = await staffTeam({ model, proposal: baseline.proposal, registry, codePlan: plan, messenger, emit });

  assert.deepEqual(r.tasks, plan.tasks);
  assert.equal(r.matched, true);
  const msgs = messenger.list();
  const challenge = msgs.find((m) => m.type === 'CHALLENGE');
  assert.equal(challenge.from, 'Planner');
  assert.equal(challenge.to, 'Supervisor');
  assert.match(challenge.reason, /missing recommend_interventions: needed by improvement_plan/);
  const decision = msgs.find((m) => m.type === 'DECISION');
  assert.equal(decision.from, 'Planner');
  assert.match(decision.reason, /matched the code plan/);
  // Revision feedback went back to the model.
  assert.match(model.calls[1].messages.at(-1).content, /missing recommend_interventions/);
});

test('supervisor: the final team is the code plan even when the model never matches', async () => {
  const plan = fullPlan();
  const short = hireAll(plan);
  short.hires = short.hires.slice(1);
  const model = scriptedModel([short, short]);
  const { emit } = collector();
  const messenger = createMessenger(emit);
  const r = await staffTeam({ model, proposal: baseline.proposal, registry, codePlan: plan, messenger, emit });
  assert.equal(r.matched, false);
  assert.deepEqual(r.tasks, plan.tasks);
  assert.equal(r.hires.length, plan.tasks.length);
  const decision = messenger.list().find((m) => m.type === 'DECISION');
  assert.match(decision.reason, /did not match/);
});

test('supervisor: extra hire gives CHALLENGE listing the unneeded id', async () => {
  const plan = planTasks(registry, ['gap_analysis', 'performance_summary'], SOURCE_KINDS);
  assert.deepEqual(plan.tasks.map((t) => t.id), ['compute_gaps', 'performance_summary']);
  const extra = {
    hires: [
      { capabilityId: 'compute_gaps', reason: 'Finds the gaps' },
      { capabilityId: 'performance_summary', reason: 'Summarises the cohort' },
      { capabilityId: 'mentor_schedule', reason: 'Books mentors' },
    ],
  };
  const model = scriptedModel([extra, { hires: extra.hires.slice(0, 2) }]);
  const { emit } = collector();
  const messenger = createMessenger(emit);
  const proposal = { ...baseline.proposal, deliverables: baseline.proposal.deliverables.slice(0, 2) };
  const r = await staffTeam({ model, proposal, registry, codePlan: plan, messenger, emit });
  const challenge = messenger.list().find((m) => m.type === 'CHALLENGE');
  assert.match(challenge.reason, /unneeded mentor_schedule/);
  assert.deepEqual(challenge.body.extra, ['mentor_schedule']);
  assert.equal(r.matched, true);
});

test('supervisor: model reasons are kept where they match; AGENT_JOINED count equals tasks', async () => {
  const plan = fullPlan();
  const reasons = { compute_gaps: 'Compares scores with the skill thresholds' };
  const model = scriptedModel([hireAll(plan, reasons)]);
  const { events, emit } = collector();
  const messenger = createMessenger(emit);
  const r = await staffTeam({ model, proposal: baseline.proposal, registry, codePlan: plan, messenger, emit });
  const joined = events.filter((e) => e.type === EVENT.AGENT_JOINED);
  assert.equal(joined.length, plan.tasks.length);
  assert.equal(joined.length, r.hires.length);
  const gaps = r.hires.find((h) => h.capabilityId === 'compute_gaps');
  assert.equal(gaps.reason, 'Compares scores with the skill thresholds');
  assert.equal(gaps.source, 'model');
  assert.equal(joined[0].data.reason, gaps.reason);
  assert.equal(joined[0].data.by, 'model');
  assert.deepEqual(joined[0].meta, { taskId: 'compute_gaps', role: 'Analyst' });
});

test('supervisor: a hire the model did not make gets a dependency reason', async () => {
  const plan = fullPlan();
  const withoutSchedule = { hires: plan.tasks.filter((t) => t.id !== 'mentor_schedule').map((t) => ({ capabilityId: t.id, reason: 'x' })) };
  const model = scriptedModel([withoutSchedule, withoutSchedule]);
  const { emit } = collector();
  const r = await staffTeam({ model, proposal: baseline.proposal, registry, codePlan: plan, messenger: createMessenger(emit), emit });
  const ms = r.hires.find((h) => h.capabilityId === 'mentor_schedule');
  assert.equal(ms.reason, 'Needed by mentor_schedule');
});

test('supervisor: model unavailable throws MODEL_UNAVAILABLE', async () => {
  const plan = fullPlan();
  const model = scriptedModel([], { available: false });
  const { emit } = collector();
  await assert.rejects(
    staffTeam({ model, proposal: baseline.proposal, registry, codePlan: plan, messenger: createMessenger(emit), emit }),
    (e) => e.code === 'MODEL_UNAVAILABLE',
  );
});

// ---------------------------------------------------------------- reviewer voice

const failedSchedule = {
  id: 'C04_schedule_no_overlap', title: 'No mentor is booked twice at the same time', kind: 'mentor_schedule',
  status: 'FAIL', expected: 0, observed: 2, message: 'M-B is booked twice on Tue 10:00.',
};
const passing = { id: 'C01_gaps_match', title: 'Gaps match', kind: 'gap_analysis', status: 'PASS', expected: 1, observed: 1, message: 'ok' };

test('reviewer voice: route mismatch gives DECISION from Engine and keeps the code route', async () => {
  const route = planRepairs([failedSchedule]);
  assert.equal(route[0].fixable, true);
  const model = scriptedModel([{
    verdicts: [{ checkId: 'C04_schedule_no_overlap', verdict: 'Mentor B has two sessions at once. A person should confirm which to move.', proposedRoute: 'person' }],
  }]);
  const { emit } = collector();
  const messenger = createMessenger(emit);

  const r = await explainReview({ model, checks: [failedSchedule, passing], route, messenger });

  assert.equal(r.routeAgreed, false);
  assert.equal(r.verdicts.length, 1);
  assert.equal(r.verdicts[0].route, 'repair');
  assert.equal(r.verdicts[0].proposedRoute, 'person');
  const msgs = messenger.list();
  const decision = msgs.find((m) => m.type === 'DECISION');
  assert.equal(decision.from, 'Engine');
  assert.equal(decision.to, 'Reviewer');
  assert.match(decision.reason, /Kept the repair route/);
  const result = msgs.find((m) => m.type === 'RESULT');
  assert.equal(result.from, 'Reviewer');
  assert.equal(result.to, 'Repair');
  // Only failed checks go to the model.
  const sent = JSON.parse(model.calls[0].messages[1].content);
  assert.deepEqual(sent.checks.map((c) => c.checkId), ['C04_schedule_no_overlap']);
});

test('reviewer voice: agreement sends no DECISION and routes a person-only check to Coordinator', async () => {
  const unknown = { ...failedSchedule, id: 'C02_summary_numbers', kind: 'performance_summary', status: 'UNKNOWN', message: 'file unreadable' };
  const route = planRepairs([unknown]);
  assert.equal(route[0].fixable, false);
  const model = scriptedModel([{
    verdicts: [{ checkId: 'C02_summary_numbers', verdict: 'The summary file could not be read.', proposedRoute: 'person' }],
  }]);
  const { emit } = collector();
  const messenger = createMessenger(emit);
  const r = await explainReview({ model, checks: [unknown], route, messenger });
  assert.equal(r.routeAgreed, true);
  const msgs = messenger.list();
  assert.equal(msgs.some((m) => m.type === 'DECISION'), false);
  assert.equal(msgs[0].to, 'Coordinator');
});

test('reviewer voice: no failed checks means no model call', async () => {
  const model = scriptedModel([]);
  const { emit } = collector();
  const messenger = createMessenger(emit);
  const r = await explainReview({ model, checks: [passing], route: [], messenger });
  assert.deepEqual(r, { verdicts: [], routeAgreed: true, unexplained: [] });
  assert.equal(model.calls.length, 0);
});

test('reviewer voice: model unavailable throws MODEL_UNAVAILABLE', async () => {
  const model = scriptedModel([], { available: false });
  await assert.rejects(
    explainReview({ model, checks: [failedSchedule], route: planRepairs([failedSchedule]), messenger: createMessenger(() => {}) }),
    (e) => e.code === 'MODEL_UNAVAILABLE',
  );
});
