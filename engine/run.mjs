// T.A.C.E mission runner (domain-neutral).
// goal -> G02 validation -> source admission -> plan -> real work -> independent review
//      -> targeted repair -> re-run downstream -> fresh review -> manifest.
// Every step is a ledger event; the UI only ever shows what this file wrote.
import fs from 'node:fs';
import path from 'node:path';
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

/**
 * @param {object} o
 * @param {object} o.scenario        scenario object (see contracts Scenario)
 * @param {object} o.domain          { capabilities, sourceSpecs, review, planRepairs, applyRepair, rulesVersion }
 * @param {string} o.sourcesDir      folder holding the admitted input files
 * @param {string} o.runDir          output folder for this run (created)
 * @param {string} o.runId
 * @param {object} o.trustedContext  server-side intake context (fixture-only here; not real auth)
 * @param {number} [o.paceMs]        optional real delay before each step so people can follow it live
 * @param {(e:object)=>void} [o.onEvent]
 */
export async function runMission({ scenario, domain, sourcesDir, runDir, runId, trustedContext, paceMs = 0, onEvent, clock }) {
  // One run = one empty folder. Re-using a folder would mix two runs' events and versions.
  if (fs.existsSync(runDir) && fs.readdirSync(runDir).length > 0) {
    throw Object.assign(new Error(`run folder already used: ${runDir} (pick a new --run-id)`), { code: 'RUN_EXISTS' });
  }
  fs.mkdirSync(runDir, { recursive: true });
  const ledger = openLedger(runDir, runId, clock ? { clock } : {});
  if (onEvent) ledger.on(onEvent);
  const emit = (type, data = {}, meta = {}) => ledger.append(type, data, meta);
  const store = createArtifactStore(runDir);
  const repairs = [];
  let checks = [];
  let unsupported = [];
  let admitted = {};

  const finish = (status, extra = {}) => {
    const passed = checks.filter((c) => c.status === CHECK_STATUS.PASS).length;
    const manifest = buildManifest({ runId, scenario, status, store, admitted, checks, repairs, unsupported, domain, extra });
    const mref = store.write({ kind: 'final_manifest', name: 'final-manifest.json', content: JSON.stringify(manifest, null, 2) + '\n', producer: 'runner' });
    emit(EVENT.ARTIFACT_WRITTEN, mref);
    emit(EVENT.RUN_FINISHED, { status, checksPassed: passed, checksTotal: checks.length, repairs: repairs.filter((r) => r.to || r.rerun).length, reason: extra.reason ?? null });
    ledger.close();
    return { runId, runDir, status, checksPassed: passed, checksTotal: checks.length, repairs, unsupported, manifest };
  };

  // A planted demo fault is declared in the ledger itself, so nobody has to trust the title.
  emit(EVENT.RUN_STARTED, { scenarioId: scenario.id, title: scenario.title, goalText: scenario.goalText, pacedMs: paceMs, contract: CONTRACT_VERSION, plantedFault: scenario.inject ?? null, changedConstraints: scenario.unavailable ?? null, excludedSources: scenario.excludeSources ?? null });
  await sleep(paceMs);

  // 1. Goal: the accepted G02 intake + proposal validators. Valid = structurally valid, NOT authorised.
  const intake = normalizeGoalTurn({ goal: scenario.goalText, sources: scenario.intakeSources.map((r) => ({ kind: 'upload', ref: r })) }, trustedContext);
  const verdict = intake.status === 'NORMALIZED' ? validateGoalProposal(scenario.proposal, intake.record) : intake;
  if (verdict.status !== 'PROPOSAL_VALID') {
    emit(EVENT.GOAL_REJECTED, { status: verdict.status, code: verdict.code });
    return finish(RUN_STATUS.BLOCKED, { reason: `Goal not accepted: ${verdict.code}` });
  }
  const deliverables = scenario.proposal.deliverables.map((d) => d.id);
  emit(EVENT.GOAL_VALIDATED, { status: verdict.status, code: verdict.code, deliverables, subgoals: verdict.candidateOrder, note: 'Structurally valid proposal. Not an authorisation to act.' });

  // 2. Sources: only the files this goal named; each gets an id, version and sha256.
  const specs = domain.sourceSpecs.filter((s) => scenario.intakeSources.includes(s.sourceId));
  const adm = admitSources(sourcesDir, specs, { exclude: scenario.excludeSources || [] });
  admitted = adm.sources;
  for (const id of Object.keys(adm.sources).sort()) {
    const s = adm.sources[id];
    emit(EVENT.SOURCE_ADMITTED, { sourceId: s.sourceId, file: path.basename(s.file), version: s.version, digest: s.digest, rows: s.rows ? s.rows.length : (Array.isArray(s.json) ? s.json.length : 1) });
  }
  for (const p of adm.problems) emit(EVENT.SOURCE_BLOCKED, p);

  // 3. Plan: only the tasks the requested deliverables need, given what was admitted.
  const registry = createRegistry(domain.capabilities);
  const available = Object.values(adm.sources).map((s) => s.kind);
  const plan = planTasks(registry, deliverables, available);
  unsupported = plan.unsupported;
  const tasks = plan.tasks;
  emit(EVENT.PLAN_CREATED, { tasks, unsupported, requested: deliverables });
  await sleep(paceMs);
  if (tasks.length === 0) {
    return finish(RUN_STATUS.BLOCKED, { reason: adm.problems.length ? `Missing input: ${adm.problems.map((p) => p.sourceId).join(', ')}` : 'No requested deliverable can be produced' });
  }

  // 4. Execute: each task gets real input files (hand-offs) and writes real output files.
  const producerOf = new Map(tasks.flatMap((t) => t.produces.map((k) => [k, t.id])));
  const sourceByKind = new Map(Object.values(adm.sources).map((s) => [s.kind, s]));
  let phase = 'initial';
  const execute = async (task, attempt) => {
    await sleep(paceMs);
    const inputRefs = [];
    for (const kind of task.consumes) {
      const src = sourceByKind.get(kind);
      if (src) { inputRefs.push({ name: path.basename(src.file), version: src.version, digest: src.digest }); continue; }
      const ref = primaryOf(store, kind);
      if (!ref) throw Object.assign(new Error(`missing input ${kind}`), { code: 'MISSING_INPUT' });
      inputRefs.push({ name: ref.name, version: ref.version, digest: ref.digest });
      if (attempt === 1) emit(EVENT.HANDOFF, { from: producerOf.get(kind) ?? ref.producer, to: task.id, kind, artifact: tag(ref), digest: ref.digest, status: 'READY_FOR_USE' }, { taskId: task.id, role: task.role });
    }
    const cap = registry.get(task.capabilityId);
    const result = await cap.run({ taskId: task.id, sources: adm.sources, store, scenario, phase, inputRefs });
    for (const ref of result.artifacts || []) emit(EVENT.ARTIFACT_WRITTEN, ref, { taskId: task.id, role: task.role });
    return result;
  };
  const graphEmit = (type, data, meta) => emit(type, data, meta);
  const first = await runGraph(tasks, { execute, emit: graphEmit });

  // 5. Independent review -> targeted repair -> re-run downstream -> fresh review.
  let status = first.status === 'COMPLETED' ? null : RUN_STATUS.PARTIAL;
  const reasons = first.failed.map((f) => `Step ${f.id} failed: ${f.message}`);
  for (let round = 1; ; round++) {
    await sleep(paceMs);
    emit(EVENT.REVIEW_STARTED, { round }, { taskId: 'review', role: 'Reviewer' });
    ({ checks } = await domain.review({ sources: adm.sources, store, scenario }));
    const cref = store.write({ kind: 'evidence_checks', name: 'evidence-checks.json', content: JSON.stringify({ round, checks }, null, 2) + '\n', producer: 'review' });
    for (const c of checks) emit(EVENT.CHECK_RESULT, c, { taskId: 'review', role: 'Reviewer' });
    emit(EVENT.ARTIFACT_WRITTEN, cref, { taskId: 'review', role: 'Reviewer' });
    const failed = checks.filter((c) => c.status !== CHECK_STATUS.PASS);
    if (checks.length === 0) { status = RUN_STATUS.PARTIAL; reasons.push('Nothing could be checked: no reviewable file was produced'); break; }
    if (failed.length === 0) {
      emit(EVENT.VERIFICATION_PASSED, { round, passed: checks.length, total: checks.length, note: status ? 'Every file that exists passed, but some steps did not finish' : null }, { taskId: 'review', role: 'Reviewer' });
      break;
    }
    emit(EVENT.VERIFICATION_FAILED, { round, failed: failed.map((c) => c.id), messages: failed.map((c) => c.message) }, { taskId: 'review', role: 'Reviewer' });
    if (round > REPAIR_BUDGET) { status = RUN_STATUS.PARTIAL; reasons.push(`Repair budget (${REPAIR_BUDGET} rounds) used up; still failing: ${failed.map((c) => c.id).join(', ')}`); break; }

    const jobs = domain.planRepairs(failed);
    const fixable = jobs.filter((j) => j.fixable);
    for (const j of jobs.filter((j) => !j.fixable)) { repairs.push({ round, kind: j.kind, checkIds: j.checkIds, unfixable: true, reason: j.reason }); reasons.push(j.reason); }
    if (fixable.length === 0) { status = RUN_STATUS.PARTIAL; break; }

    const rerun = new Set();
    let progressed = false;
    for (const job of fixable) {
      await sleep(paceMs);
      emit(EVENT.REPAIR_SCHEDULED, { round, checkIds: job.checkIds, artifact: job.kind, strategy: job.strategy }, { taskId: 'repair', role: 'Repair' });
      if (job.rerunSelf) {
        if (!tasks.some((t) => t.id === job.rerunSelf)) continue;
        rerun.add(job.rerunSelf);
        for (const d of descendants(tasks, job.rerunSelf)) rerun.add(d);
        repairs.push({ round, kind: job.kind, checkIds: job.checkIds, strategy: job.strategy, rerun: job.rerunSelf });
        progressed = true;
        continue;
      }
      let res;
      try {
        res = await domain.applyRepair({ store, sources: adm.sources, scenario }, job, failed.filter((c) => job.checkIds.includes(c.id)));
      } catch (err) {
        res = { unfixable: true, reason: `Repair could not run: ${err.code || ''} ${err.message}`.trim() };
      }
      if (res.unfixable) {
        repairs.push({ round, kind: job.kind, checkIds: job.checkIds, unfixable: true, reason: res.reason });
        reasons.push(res.reason);
        emit(EVENT.TASK_FAILED, { code: 'REPAIR_NOT_POSSIBLE', message: res.reason, attempt: 1 }, { taskId: 'repair', role: 'Repair' });
        continue;
      }
      progressed = true;
      repairs.push({ round, kind: job.kind, checkIds: job.checkIds, strategy: job.strategy, from: res.from, to: res.to, changes: res.changes });
      emit(EVENT.ARTIFACT_WRITTEN, res.toRef, { taskId: 'repair', role: 'Repair' });
      for (const extra of res.alsoWritten || []) emit(EVENT.ARTIFACT_WRITTEN, extra, { taskId: 'repair', role: 'Repair' });
      emit(EVENT.ARTIFACT_REPAIRED, { round, from: res.from, to: res.to, changes: res.changes, checkIds: job.checkIds }, { taskId: 'repair', role: 'Repair' });
      for (const producer of job.rerun) for (const d of descendants(tasks, producer)) rerun.add(d);
    }
    if (!progressed) { status = RUN_STATUS.PARTIAL; break; }
    if (rerun.size) {
      phase = 'rerun';
      for (const id of [...rerun].sort()) emit(EVENT.TASK_RERUN, { reason: 'input changed by repair', round }, { taskId: id, role: tasks.find((t) => t.id === id)?.role });
      await runGraph(tasks, { execute, emit: graphEmit, only: rerun });
    }
  }

  const repairsDone = repairs.filter((r) => r.to || r.rerun);
  const hist = store.write({ kind: 'repair_history', name: 'repair-history.json', content: JSON.stringify({ repairs }, null, 2) + '\n', producer: 'repair' });
  emit(EVENT.ARTIFACT_WRITTEN, hist, { taskId: 'repair', role: 'Repair' });

  const realUnsupported = unsupported.filter((k) => !k.startsWith('source:'));
  if (realUnsupported.length) reasons.push(`Cannot produce: ${realUnsupported.join(', ')}`);
  if (!status) status = realUnsupported.length ? RUN_STATUS.PARTIAL : RUN_STATUS.VERIFIED;
  return finish(status, { repairsApplied: repairsDone.length, reason: status === RUN_STATUS.VERIFIED ? null : [...new Set(reasons)].join(' · ') || null });
}

// A kind may have a data file and a readable rendering (e.g. .json + .md). The hand-off is the data file.
function primaryOf(store, kind) {
  const latest = new Map();
  for (const r of store.list()) if (r.kind === kind) latest.set(r.name, r);
  const refs = [...latest.values()];
  const rank = (r) => (r.name.endsWith('.json') ? 0 : r.name.endsWith('.csv') ? 1 : 2);
  refs.sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1));
  return refs[0] ?? null;
}

function buildManifest({ runId, scenario, status, store, admitted, checks, repairs, unsupported, domain, extra }) {
  const all = store.list();
  const latest = new Map();
  for (const r of all) latest.set(r.name, r);
  const strip = (r) => ({ kind: r.kind, file: r.file, version: r.version, digest: r.digest, bytes: r.bytes, producer: r.producer });
  return {
    contract: CONTRACT_VERSION,
    rulesVersion: domain.rulesVersion,
    runId, scenarioId: scenario.id, status,
    sources: Object.keys(admitted).sort().map((id) => ({ sourceId: id, file: path.basename(admitted[id].file), version: admitted[id].version, digest: admitted[id].digest })),
    artifacts: [...latest.values()].filter((r) => r.name !== 'final-manifest.json').sort((a, b) => (a.name < b.name ? -1 : 1)).map((r) => ({ name: r.name, ...strip(r) })),
    supersededVersions: all.filter((r) => latest.get(r.name) !== r).map((r) => ({ name: r.name, ...strip(r) })),
    checks: { passed: checks.filter((c) => c.status === CHECK_STATUS.PASS).length, total: checks.length, failed: checks.filter((c) => c.status !== CHECK_STATUS.PASS).map((c) => c.id) },
    repairs: repairs.map((r) => ({ round: r.round, kind: r.kind, checkIds: r.checkIds, from: r.from ?? null, to: r.to ?? null, rerun: r.rerun ?? null, unfixable: !!r.unfixable, reason: r.reason ?? null })),
    plantedFault: scenario.inject ?? null,
    unsupported,
    reason: extra.reason ?? null,
    honesty: 'Workers are deterministic code. Synthetic data only. Nothing was sent.',
  };
}
