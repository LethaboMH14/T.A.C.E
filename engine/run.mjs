// T.A.C.E mission runner (domain-neutral), orchestrated as a LangGraph state graph.
//
//   goal ─▶ sources ─▶ plan ─▶ execute ─▶ review ─┬─▶ finish
//     │                  │                  ▲      │
//     └──── blocked ─────┴────▶ finish      └─ repair ◀┘   (bounded by REPAIR_BUDGET)
//
// Agents (model-backed, optional) plug into nodes: Goal Reader (goal), Supervisor (plan),
// Reviewer voice (review), model Message Writer (inside execute). The model proposes; code
// decides: every model output passes the accepted G02 validators, the planner, or the
// independent code checks before it is used. Every step is a ledger event; the UI only
// ever shows what this file wrote.
import fs from 'node:fs';
import path from 'node:path';
import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import { EVENT, RUN_STATUS, CHECK_STATUS, REPAIR_BUDGET, CONTRACT_VERSION } from './contracts.mjs';
import { openLedger } from './ledger.mjs';
import { createArtifactStore } from './artifacts.mjs';
import { admitSources } from './sources.mjs';
import { createRegistry } from './registry.mjs';
import { planTasks, descendants } from './planner.mjs';
import { runGraph } from './graph.mjs';
import { normalizeGoalTurn } from '../tools/gate02/normalize-turn.mjs';
import { validateGoalProposal } from '../tools/gate02/goal-proposal.mjs';

const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const tag = (ref) => `${ref.name}@v${ref.version}`;
const last = (_a, b) => b;

// Plain, checkpointable graph state. Heavy objects (ledger, store, sources) live in the closure.
const MissionState = Annotation.Root({
  round: Annotation({ reducer: last, default: () => 0 }),
  next: Annotation({ reducer: last, default: () => null }),
  status: Annotation({ reducer: last, default: () => null }),
  trail: Annotation({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

/**
 * @param {object} o
 * @param {object} o.scenario        scenario object (see contracts Scenario)
 * @param {object} o.domain          { capabilities, sourceSpecs, review, planRepairs, applyRepair, rulesVersion, catalog? }
 * @param {string} o.sourcesDir      folder holding the admitted input files
 * @param {string} o.runDir          output folder for this run (must be new or empty)
 * @param {string} o.runId
 * @param {object} o.trustedContext  server-side intake context (fixture-only here; not real auth)
 * @param {number} [o.paceMs]        optional real delay before each step so people can follow it live
 * @param {'off'|'auto'|object} [o.model]  'off' = code only; 'auto' = model from env if a key is set; or a model object
 * @param {object} [o.env]           environment for 'auto' (defaults to process.env)
 * @param {(e:object)=>void} [o.onEvent]
 * @param {null|((q:{id:string, question:string, options:any[], whyAsked:string})=>Promise<string|null>|string|null)} [o.askHuman]
 *           asks a person one Goal Reader question; resolves with the answer text, or null (= no answer)
 * @param {number} [o.askTimeoutMs]  how long to wait for an answer before treating it as none (default 180000)
 */
export async function runMission({ scenario, domain, sourcesDir, runDir, runId, trustedContext, paceMs = 0, onEvent, clock, model = 'off', env = process.env, askHuman = null, askTimeoutMs = 180000 }) {
  if (fs.existsSync(runDir) && fs.readdirSync(runDir).length > 0) {
    throw Object.assign(new Error(`run folder already used: ${runDir} (pick a new --run-id)`), { code: 'RUN_EXISTS' });
  }
  fs.mkdirSync(runDir, { recursive: true });
  const ledger = openLedger(runDir, runId, clock ? { clock } : {});
  if (onEvent) ledger.on(onEvent);
  const emit = (type, data = {}, meta = {}) => ledger.append(type, data, meta);

  const M = {
    scenario, domain, store: createArtifactStore(runDir), emit,
    repairs: [], checks: [], unsupported: [], admitted: {}, reasons: [],
    tasks: [], registry: null, phase: 'initial', feedback: null, firstStatus: 'COMPLETED',
    intake: null, proposal: null, deliverables: [], model: null, messenger: null, blockedReason: null,
  };

  // ---------- agents: only when a model is configured; otherwise the run says "code only"
  if (model === 'auto') {
    // Provider router: profile order from MODEL_PROFILE (demo | free | cheap | meta), visible fallbacks, per-run budget.
    const { routerFromEnv } = await import('./providers.mjs');
    M.answeredBy = new Set();
    M.model = routerFromEnv(env, {
      onCall: (c) => { if (c.ok) M.answeredBy.add(`${c.provider}:${c.model}`); emit(EVENT.MODEL_CALL, c, { taskId: null, role: c.agent }); },
      onStart: (s) => emit(EVENT.MODEL_STARTED, s, { taskId: null, role: s.agent }),
      onFallback: (f) => emit(EVENT.MODEL_FALLBACK, f, { taskId: null, role: f.agent }),
    });
  } else if (model && typeof model === 'object') {
    M.model = model;
  }
  const agentsOn = !!M.model?.available;
  if (agentsOn) {
    const { createMessenger } = await import('./messages.mjs');
    M.messenger = createMessenger(emit);
  }

  // ---------- nodes
  async function goalNode() {
    emit(EVENT.RUN_STARTED, {
      scenarioId: scenario.id, title: scenario.title, goalText: scenario.goalText, pacedMs: paceMs, contract: CONTRACT_VERSION,
      plantedFault: scenario.inject ?? null, changedConstraints: scenario.unavailable ?? null, excludedSources: scenario.excludeSources ?? null,
      // In model mode this is the router's ORDER of preference, not who answered: every MODEL_CALL names the provider that did.
      agents: agentsOn ? { mode: 'model', provider: M.model.provider, model: M.model.model, profile: M.model.profile ?? null, chain: M.model.chain ?? [M.model.provider] } : { mode: 'code', note: model === 'off' ? 'Model turned off for this run' : 'No model key configured' },
    });
    await sleep(paceMs);
    const intake = normalizeGoalTurn({ goal: scenario.goalText, sources: scenario.intakeSources.map((r) => ({ kind: 'upload', ref: r })) }, trustedContext);
    if (intake.status !== 'NORMALIZED') {
      emit(EVENT.GOAL_REJECTED, { status: intake.status, code: intake.code });
      M.blockedReason = `Goal not accepted: ${intake.code}`;
      return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:rejected'] };
    }
    M.intake = intake.record;
    let proposal = scenario.proposal;
    let source = 'fixture';
    if (!agentsOn && !proposal) {
      // A free-text goal (prompt box) has no prepared contract: only the Goal Reader model can draft one.
      M.blockedReason = 'This goal was typed in free text, so a model must read it first. Configure a model key (see .env.example), or pick a prepared scenario.';
      return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:needs-model'] };
    }
    if (agentsOn) {
      const { readGoal } = await import('../agents/goal-reader.mjs');
      const MAX_CLARIFY_ROUNDS = 2;
      const clarifications = [];
      let asked = 0;
      let questionCount = 0;
      const askOne = async (q) => {
        if (!askHuman) return null;
        let timer;
        const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), askTimeoutMs); });
        try {
          const a = await Promise.race([Promise.resolve().then(() => askHuman(q)), timeout]);
          const text = typeof a === 'string' ? a.trim() : '';
          return text ? text.slice(0, 500) : null; // never invent an answer
        } catch { return null; } finally { clearTimeout(timer); }
      };
      try {
        let r = await readGoal({ model: M.model, intake: M.intake, catalog: domain.catalog || [], messenger: M.messenger, emit, domainContext: domain.goalContext || null, example: domain.goalExample || null, clarifications });
        while (r.status === 'NEEDS_CLARIFICATION') {
          const questions = r.questions.map((q) => ({ id: `Q-${++questionCount}`, question: q.question, code: q.code, options: q.options ?? [] }));
          for (const q of questions) emit(EVENT.HUMAN_QUESTION, { id: q.id, question: q.question, code: q.code, options: q.options, whyAsked: 'The Goal Reader marked this as blocking: the plan would change with the answer.' }, { taskId: null, role: 'Goal Reader' });
          const asks = questions.map((q) => q.question).join(' / ');
          if (asked >= MAX_CLARIFY_ROUNDS) {
            M.blockedReason = `Still unclear after ${MAX_CLARIFY_ROUNDS} question rounds: ${asks}`;
            return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:needs-answer'] };
          }
          if (!askHuman) {
            M.blockedReason = `Needs an answer before planning: ${asks}`;
            return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:needs-answer'] };
          }
          asked += 1;
          const answers = [];
          for (const q of questions) answers.push(await askOne(q));
          const missing = questions.filter((_, i) => answers[i] === null);
          if (missing.length) {
            M.blockedReason = `Needs an answer before planning (no answer given): ${missing.map((q) => q.question).join(' / ')}`;
            return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:needs-answer'] };
          }
          questions.forEach((q, i) => {
            emit(EVENT.HUMAN_ANSWER, { id: q.id, answer: answers[i], by: 'coordinator' }, { taskId: null, role: 'Coordinator' });
            clarifications.push({ question: q.question, answer: answers[i] });
          });
          r = await readGoal({ model: M.model, intake: M.intake, catalog: domain.catalog || [], messenger: M.messenger, emit, domainContext: domain.goalContext || null, example: domain.goalExample || null, clarifications });
        }
        if (r.status !== 'ACCEPTED') {
          M.blockedReason = String(r.code).startsWith('MODEL_')
            ? `The model service kept failing (${r.code}), so no goal contract was produced. Try again, or run with the model off.`
            : `The Goal Reader could not produce a goal contract the validator accepts (${r.code}). A person must rephrase the goal.`;
          return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:escalated'] };
        }
        proposal = r.proposal; source = 'model';
      } catch (err) {
        M.blockedReason = `Goal Reader failed: ${err.code || ''} ${err.message}`.trim();
        return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:model-error'] };
      }
    }
    const verdict = validateGoalProposal(proposal, M.intake);
    if (verdict.status !== 'PROPOSAL_VALID') {
      emit(EVENT.GOAL_REJECTED, { status: verdict.status, code: verdict.code });
      M.blockedReason = `Goal not accepted: ${verdict.code}`;
      return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['goal:invalid'] };
    }
    M.proposal = proposal;
    M.deliverables = proposal.deliverables.map((d) => d.id);
    emit(EVENT.GOAL_VALIDATED, { status: verdict.status, code: verdict.code, deliverables: M.deliverables, subgoals: verdict.candidateOrder, source, note: 'Structurally valid proposal. Not an authorisation to act.' });
    return { next: 'sources', trail: ['goal:ok'] };
  }

  async function sourcesNode() {
    const specs = domain.sourceSpecs.filter((s) => scenario.intakeSources.includes(s.sourceId));
    const adm = admitSources(sourcesDir, specs, { exclude: scenario.excludeSources || [] });
    M.admitted = adm.sources;
    for (const id of Object.keys(adm.sources).sort()) {
      const s = adm.sources[id];
      emit(EVENT.SOURCE_ADMITTED, { sourceId: s.sourceId, file: path.basename(s.file), version: s.version, digest: s.digest, rows: s.rows ? s.rows.length : (Array.isArray(s.json) ? s.json.length : 1) });
    }
    for (const p of adm.problems) emit(EVENT.SOURCE_BLOCKED, p);
    M.sourceProblems = adm.problems;
    return { next: 'plan', trail: ['sources'] };
  }

  async function planNode() {
    M.registry = createRegistry(domain.capabilities);
    const available = Object.values(M.admitted).map((s) => s.kind);
    const plan = planTasks(M.registry, M.deliverables, available);
    M.unsupported = plan.unsupported;
    M.tasks = plan.tasks;
    emit(EVENT.PLAN_CREATED, { tasks: M.tasks, unsupported: M.unsupported, requested: M.deliverables, by: 'planner (code)' });
    await sleep(paceMs);
    if (M.tasks.length === 0) {
      M.blockedReason = M.sourceProblems.length ? `Missing input: ${M.sourceProblems.map((p) => p.sourceId).join(', ')}` : 'No requested deliverable can be produced';
      return { next: 'finish', status: RUN_STATUS.BLOCKED, trail: ['plan:empty'] };
    }
    if (agentsOn) {
      const { staffTeam } = await import('../agents/supervisor.mjs');
      try {
        await staffTeam({ model: M.model, proposal: M.proposal, registry: M.registry, codePlan: plan, messenger: M.messenger, emit });
      } catch (err) {
        emitCodeStaffing(`Supervisor model failed (${err.code || err.message}); staffed by the planner`);
      }
    } else {
      emitCodeStaffing(null);
    }
    return { next: 'execute', trail: ['plan'] };
  }

  function emitCodeStaffing(note) {
    const dependents = (id) => M.tasks.filter((t) => t.dependsOn.includes(id)).map((t) => t.role);
    for (const t of M.tasks) {
      const delivers = t.produces.filter((k) => M.deliverables.includes(k));
      const reason = delivers.length ? `Produces ${delivers.join(', ')}` : `Needed by ${dependents(t.id).join(', ')}`;
      emit(EVENT.AGENT_JOINED, { agent: t.role, capabilityId: t.id, reason: note ? `${reason}. ${note}` : reason, by: 'planner' }, { taskId: t.id, role: t.role });
    }
  }

  const producerOf = () => new Map(M.tasks.flatMap((t) => t.produces.map((k) => [k, t.id])));
  const sourceByKind = () => new Map(Object.values(M.admitted).map((s) => [s.kind, s]));
  async function execute(task, attempt) {
    await sleep(paceMs);
    const inputRefs = [];
    const srcs = sourceByKind();
    for (const kind of task.consumes) {
      const src = srcs.get(kind);
      if (src) { inputRefs.push({ name: path.basename(src.file), version: src.version, digest: src.digest }); continue; }
      const ref = primaryOf(M.store, kind);
      if (!ref) throw Object.assign(new Error(`missing input ${kind}`), { code: 'MISSING_INPUT' });
      inputRefs.push({ name: ref.name, version: ref.version, digest: ref.digest });
      if (attempt === 1) emit(EVENT.HANDOFF, { from: producerOf().get(kind) ?? ref.producer, to: task.id, kind, artifact: tag(ref), digest: ref.digest, status: 'READY_FOR_USE' }, { taskId: task.id, role: task.role });
    }
    const cap = M.registry.get(task.capabilityId);
    const feedback = M.feedback?.[task.id] ?? null;
    const result = await cap.run({ taskId: task.id, sources: M.admitted, store: M.store, scenario, phase: M.phase, inputRefs, model: agentsOn ? M.model : null, feedback });
    for (const ref of result.artifacts || []) emit(EVENT.ARTIFACT_WRITTEN, ref, { taskId: task.id, role: task.role });
    return result;
  }

  async function executeNode() {
    const first = await runGraph(M.tasks, { execute, emit });
    M.firstStatus = first.status;
    for (const f of first.failed) M.reasons.push(`Step ${f.id} failed: ${f.message}`);
    return { next: 'review', trail: ['execute'] };
  }

  async function reviewNode(state) {
    const round = state.round + 1;
    await sleep(paceMs);
    emit(EVENT.REVIEW_STARTED, { round }, { taskId: 'review', role: 'Reviewer' });
    ({ checks: M.checks } = await domain.review({ sources: M.admitted, store: M.store, scenario }));
    const cref = M.store.write({ kind: 'evidence_checks', name: 'evidence-checks.json', content: JSON.stringify({ round, checks: M.checks }, null, 2) + '\n', producer: 'review' });
    for (const c of M.checks) emit(EVENT.CHECK_RESULT, c, { taskId: 'review', role: 'Reviewer' });
    emit(EVENT.ARTIFACT_WRITTEN, cref, { taskId: 'review', role: 'Reviewer' });
    const failed = M.checks.filter((c) => c.status !== CHECK_STATUS.PASS);
    const partialRun = M.firstStatus !== 'COMPLETED';
    if (M.checks.length === 0) { M.reasons.push('Nothing could be checked: no reviewable file was produced'); return { round, next: 'finish', status: RUN_STATUS.PARTIAL, trail: [`review:${round}:empty`] }; }
    if (failed.length === 0) {
      emit(EVENT.VERIFICATION_PASSED, { round, passed: M.checks.length, total: M.checks.length, note: partialRun ? 'Every file that exists passed, but some steps did not finish' : null }, { taskId: 'review', role: 'Reviewer' });
      return { round, next: 'finish', status: partialRun ? RUN_STATUS.PARTIAL : null, trail: [`review:${round}:pass`] };
    }
    emit(EVENT.VERIFICATION_FAILED, { round, failed: failed.map((c) => c.id), messages: failed.map((c) => c.message) }, { taskId: 'review', role: 'Reviewer' });
    M.failed = failed;
    M.jobs = domain.planRepairs(failed);
    if (agentsOn) {
      try {
        const { explainReview } = await import('../agents/reviewer-voice.mjs');
        await explainReview({ model: M.model, checks: failed, route: M.jobs, messenger: M.messenger });
      } catch (err) { /* the code route stands; the MODEL_CALL event already records the failure */ }
    }
    if (round > REPAIR_BUDGET) {
      M.reasons.push(`Repair budget (${REPAIR_BUDGET} rounds) used up; still failing: ${failed.map((c) => c.id).join(', ')}`);
      return { round, next: 'finish', status: RUN_STATUS.PARTIAL, trail: [`review:${round}:budget`] };
    }
    return { round, next: 'repair', status: partialRun ? RUN_STATUS.PARTIAL : null, trail: [`review:${round}:fail`] };
  }

  async function repairNode(state) {
    const round = state.round;
    const failed = M.failed;
    const jobs = M.jobs;
    const fixable = jobs.filter((j) => j.fixable);
    for (const j of jobs.filter((j) => !j.fixable)) { M.repairs.push({ round, kind: j.kind, checkIds: j.checkIds, unfixable: true, reason: j.reason }); M.reasons.push(j.reason); }
    if (fixable.length === 0) return { next: 'finish', status: RUN_STATUS.PARTIAL, trail: ['repair:none-fixable'] };

    const rerun = new Set();
    const rerunRepairs = [];
    M.feedback = {};
    let progressed = false;
    for (const job of fixable) {
      await sleep(paceMs);
      emit(EVENT.REPAIR_SCHEDULED, { round, checkIds: job.checkIds, artifact: job.kind, strategy: job.strategy }, { taskId: 'repair', role: 'Repair' });
      if (job.rerunSelf) {
        if (!M.tasks.some((t) => t.id === job.rerunSelf)) continue;
        rerun.add(job.rerunSelf);
        for (const d of descendants(M.tasks, job.rerunSelf)) rerun.add(d);
        M.feedback[job.rerunSelf] = failed.filter((c) => job.checkIds.includes(c.id)).flatMap((c) => c.detail?.problems ?? [{ checkId: c.id, issue: c.message }]);
        const entry = { round, kind: job.kind, checkIds: job.checkIds, strategy: job.strategy, rerun: job.rerunSelf };
        M.repairs.push(entry);
        rerunRepairs.push({ entry, before: primaryOf(M.store, job.kind) });
        progressed = true;
        continue;
      }
      let res;
      try {
        res = await domain.applyRepair({ store: M.store, sources: M.admitted, scenario, history: M.repairs }, job, failed.filter((c) => job.checkIds.includes(c.id)));
      } catch (err) {
        res = { unfixable: true, reason: `Repair could not run: ${err.code || ''} ${err.message}`.trim() };
      }
      if (res.unfixable) {
        M.repairs.push({ round, kind: job.kind, checkIds: job.checkIds, unfixable: true, reason: res.reason });
        M.reasons.push(res.reason);
        emit(EVENT.TASK_FAILED, { code: 'REPAIR_NOT_POSSIBLE', message: res.reason, attempt: 1 }, { taskId: 'repair', role: 'Repair' });
        continue;
      }
      progressed = true;
      M.repairs.push({ round, kind: job.kind, checkIds: job.checkIds, strategy: job.strategy, from: res.from, to: res.to, changes: res.changes });
      emit(EVENT.ARTIFACT_WRITTEN, res.toRef, { taskId: 'repair', role: 'Repair' });
      for (const extra of res.alsoWritten || []) emit(EVENT.ARTIFACT_WRITTEN, extra, { taskId: 'repair', role: 'Repair' });
      emit(EVENT.ARTIFACT_REPAIRED, { round, from: res.from, to: res.to, changes: res.changes, checkIds: job.checkIds }, { taskId: 'repair', role: 'Repair' });
      for (const producer of job.rerun) for (const d of descendants(M.tasks, producer)) rerun.add(d);
    }
    if (!progressed) return { next: 'finish', status: RUN_STATUS.PARTIAL, trail: ['repair:no-progress'] };
    if (rerun.size) {
      M.phase = 'rerun';
      for (const id of [...rerun].sort()) emit(EVENT.TASK_RERUN, { reason: M.feedback[id] ? 'checker feedback' : 'input changed by repair', round }, { taskId: id, role: M.tasks.find((t) => t.id === id)?.role });
      const again = await runGraph(M.tasks, { execute, emit, only: rerun });
      for (const f of again.failed) M.reasons.push(`Re-run of ${f.id} failed: ${f.message}`);
      // A re-run repair is a repair too: record which version it replaced, so the autopsy can show it.
      for (const { entry, before } of rerunRepairs) {
        const after = primaryOf(M.store, entry.kind);
        if (!after || (before && after.digest === before.digest)) continue;
        entry.from = before ? tag(before) : null; entry.to = tag(after);
        entry.changes = [{ field: 're-run', from: entry.from, to: entry.to, strategy: entry.strategy, reason: `Re-ran ${entry.rerun} with the checker's feedback` }];
        emit(EVENT.ARTIFACT_REPAIRED, { round, from: entry.from, to: entry.to, changes: entry.changes, checkIds: entry.checkIds, rerun: entry.rerun }, { taskId: 'repair', role: 'Repair' });
      }
    }
    M.feedback = null;
    return { next: 'review', trail: [`repair:${round}`] };
  }

  async function finishNode(state) {
    let status = state.status;
    if (M.repairs.length || M.checks.length) {
      const hist = M.store.write({ kind: 'repair_history', name: 'repair-history.json', content: JSON.stringify({ repairs: M.repairs }, null, 2) + '\n', producer: 'repair' });
      emit(EVENT.ARTIFACT_WRITTEN, hist, { taskId: 'repair', role: 'Repair' });
    }
    const realUnsupported = M.unsupported.filter((k) => !k.startsWith('source:'));
    if (status !== RUN_STATUS.BLOCKED && realUnsupported.length) M.reasons.push(`Cannot produce: ${realUnsupported.join(', ')}`);
    if (!status) status = realUnsupported.length ? RUN_STATUS.PARTIAL : RUN_STATUS.VERIFIED;
    const reason = status === RUN_STATUS.VERIFIED ? null : (M.blockedReason || [...new Set(M.reasons)].join(' · ') || null);
    const passed = M.checks.filter((c) => c.status === CHECK_STATUS.PASS).length;
    const manifest = buildManifest({ runId, scenario, status, store: M.store, admitted: M.admitted, checks: M.checks, repairs: M.repairs, unsupported: M.unsupported, domain, reason, agents: agentsOn ? { profile: M.model.profile ?? null, chain: M.model.chain ?? [M.model.provider], answeredBy: [...(M.answeredBy ?? [])] } : null });
    const mref = M.store.write({ kind: 'final_manifest', name: 'final-manifest.json', content: JSON.stringify(manifest, null, 2) + '\n', producer: 'runner' });
    emit(EVENT.ARTIFACT_WRITTEN, mref);
    emit(EVENT.RUN_FINISHED, { status, checksPassed: passed, checksTotal: M.checks.length, repairs: M.repairs.filter((r) => r.to || r.rerun).length, reason });
    M.result = { runId, runDir, status, checksPassed: passed, checksTotal: M.checks.length, repairs: M.repairs, unsupported: M.unsupported, manifest };
    return { status, next: null, trail: ['finish'] };
  }

  const route = (s) => s.next;
  const graph = new StateGraph(MissionState)
    .addNode('goal', goalNode)
    .addNode('sources', sourcesNode)
    .addNode('plan', planNode)
    .addNode('execute', executeNode)
    .addNode('review', reviewNode)
    .addNode('repair', repairNode)
    .addNode('finish', finishNode)
    .addEdge(START, 'goal')
    .addConditionalEdges('goal', route, { sources: 'sources', finish: 'finish' })
    .addEdge('sources', 'plan')
    .addConditionalEdges('plan', route, { execute: 'execute', finish: 'finish' })
    .addEdge('execute', 'review')
    .addConditionalEdges('review', route, { repair: 'repair', finish: 'finish' })
    .addConditionalEdges('repair', route, { review: 'review', finish: 'finish' })
    .addEdge('finish', END)
    .compile({ checkpointer: new MemorySaver() });

  try {
    await graph.invoke({}, { configurable: { thread_id: runId }, recursionLimit: 40 });
  } catch (err) {
    // A crash inside any node must still end the run honestly: a failure event, a reason, a manifest.
    const msg = `Engine error: ${err.code || ''} ${err.message}`.trim();
    try { emit(EVENT.TASK_FAILED, { code: err.code || 'ENGINE_ERROR', message: msg, attempt: 1 }, { taskId: 'engine', role: 'Engine' }); } catch { /* ledger itself failed */ }
    M.blockedReason = msg;
    if (!M.result) {
      try { await finishNode({ status: M.tasks.length ? RUN_STATUS.PARTIAL : RUN_STATUS.BLOCKED }); }
      catch { try { emit(EVENT.RUN_FINISHED, { status: RUN_STATUS.PARTIAL, checksPassed: 0, checksTotal: M.checks.length, repairs: 0, reason: msg }); } catch { /* nothing more we can do */ } }
    }
  } finally {
    ledger.close();
  }
  return M.result ?? { runId, runDir, status: RUN_STATUS.PARTIAL, checksPassed: 0, checksTotal: 0, repairs: [], unsupported: [], manifest: null };
}

/** The mission graph's shape, for docs and the UI (no execution). */
export const MISSION_GRAPH = Object.freeze({
  nodes: ['goal', 'sources', 'plan', 'execute', 'review', 'repair', 'finish'],
  edges: [['goal', 'sources'], ['goal', 'finish'], ['sources', 'plan'], ['plan', 'execute'], ['plan', 'finish'], ['execute', 'review'], ['review', 'repair'], ['review', 'finish'], ['repair', 'review'], ['repair', 'finish']],
});

// A kind may have a data file and a readable rendering (e.g. .json + .md). The hand-off is the data file.
function primaryOf(store, kind) {
  const latest = new Map();
  for (const r of store.list()) if (r.kind === kind) latest.set(r.name, r);
  const refs = [...latest.values()];
  const rank = (r) => (r.name.endsWith('.json') ? 0 : r.name.endsWith('.csv') ? 1 : 2);
  refs.sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1));
  return refs[0] ?? null;
}

function buildManifest({ runId, scenario, status, store, admitted, checks, repairs, unsupported, domain, reason, agents }) {
  const all = store.list();
  const latest = new Map();
  for (const r of all) latest.set(r.name, r);
  const strip = (r) => ({ kind: r.kind, file: r.file, version: r.version, digest: r.digest, bytes: r.bytes, producer: r.producer });
  return {
    contract: CONTRACT_VERSION,
    rulesVersion: domain.rulesVersion,
    runId, scenarioId: scenario.id, status,
    orchestration: 'langgraph',
    agents: agents ?? 'code only (no model)',
    sources: Object.keys(admitted).sort().map((id) => ({ sourceId: id, file: path.basename(admitted[id].file), version: admitted[id].version, digest: admitted[id].digest })),
    artifacts: [...latest.values()].filter((r) => r.name !== 'final-manifest.json').sort((a, b) => (a.name < b.name ? -1 : 1)).map((r) => ({ name: r.name, ...strip(r) })),
    supersededVersions: all.filter((r) => latest.get(r.name) !== r).map((r) => ({ name: r.name, ...strip(r) })),
    checks: { passed: checks.filter((c) => c.status === CHECK_STATUS.PASS).length, total: checks.length, failed: checks.filter((c) => c.status !== CHECK_STATUS.PASS).map((c) => c.id) },
    repairs: repairs.map((r) => ({ round: r.round, kind: r.kind, checkIds: r.checkIds, from: r.from ?? null, to: r.to ?? null, rerun: r.rerun ?? null, unfixable: !!r.unfixable, reason: r.reason ?? null })),
    plantedFault: scenario.inject ?? null,
    unsupported,
    reason,
    honesty: agents
      ? `Model agents answered via ${agents.answeredBy?.length ? agents.answeredBy.join(', ') : 'no successful call'} (router profile ${agents.profile ?? 'n/a'}). Model decisions (goal contract, team, repair route, draft wording) are checked by code before use; explanatory text (join reasons, verdicts) is shown as the model wrote it. The numbers, schedule and checks are code. Synthetic data only. Nothing was sent.`
      : 'Workers are deterministic code. Synthetic data only. Nothing was sent.',
  };
}
