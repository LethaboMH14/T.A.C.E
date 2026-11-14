// Supervisor: the model proposes who to hire and why. Code compares that with the planner's
// backward chain. The final team is always the code plan.
import { EVENT } from '../engine/contracts.mjs';

const HIRE_SCHEMA = Object.freeze({
  name: 'staffing',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['hires'],
    properties: {
      hires: {
        type: 'array',
        maxItems: 32,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['capabilityId', 'reason'],
          properties: {
            capabilityId: { type: 'string' },
            reason: { type: 'string', minLength: 1, maxLength: 240 },
          },
        },
      },
    },
  },
});

const MAX_ROUNDS = 2;

function coded(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const cut = (s, n = 500) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * Which deliverable a task serves: the deliverable it produces, else the first dependent task
 * (repeated until a deliverable is reached). Deterministic: sorted ties.
 */
function neededBy(id, plan, deliverableIds) {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  let current = id;
  const seen = new Set();
  while (!seen.has(current)) {
    seen.add(current);
    const task = byId.get(current);
    if (!task) break;
    const direct = task.produces.filter((k) => deliverableIds.has(k)).sort();
    if (direct.length) return direct[0];
    const dependents = plan.tasks
      .filter((t) => t.dependsOn.includes(current))
      .map((t) => t.id)
      .sort();
    if (!dependents.length) break;
    current = dependents[0];
  }
  return 'the goal';
}

/**
 * @param {{model, proposal, registry, codePlan:{tasks:object[]}, messenger, emit}} args
 * @returns {Promise<{tasks, hires:{capabilityId, role, reason, source}[], matched:boolean, rounds:number}>}
 */
export async function staffTeam({ model, proposal, registry, codePlan, messenger, emit }) {
  if (!model || model.available !== true) {
    throw coded('MODEL_UNAVAILABLE', 'No model configured. The team was not staffed by a model.');
  }

  const deliverableIds = new Set(proposal.deliverables.map((d) => d.id));
  const plannedIds = codePlan.tasks.map((t) => t.id).sort();
  const plannedSet = new Set(plannedIds);

  const capabilities = registry.all().map((c) => ({
    id: c.id, role: c.role, label: c.label, consumes: c.consumes, produces: c.produces,
  }));
  const system = {
    role: 'system',
    content:
      'You staff a team of deterministic workers for one goal. Choose only from the capability list. ' +
      'Return JSON {"hires":[{"capabilityId","reason"}]} with one hire for each capability the goal needs, ' +
      'each reason one short sentence. Planner feedback may follow; then return the corrected full list.',
  };
  const user = {
    role: 'user',
    content: JSON.stringify({
      deliverables: proposal.deliverables.map((d) => ({ id: d.id, description: d.description })),
      subgoals: proposal.subgoals.map((s) => ({ id: s.id, outcome: s.outcome, deliverableIds: s.deliverableIds })),
      capabilities,
    }),
  };

  const diff = (hires) => {
    const hired = new Set(hires.map((h) => h.capabilityId));
    return {
      missing: plannedIds.filter((id) => !hired.has(id)),
      extra: [...hired].filter((id) => !plannedSet.has(id)).sort(),
    };
  };

  const messages = [system, user];
  let hires = [];
  let rounds = 0;
  let last = null;

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    rounds = round;
    const out = await model.chat({ agent: 'Supervisor', messages, jsonSchema: HIRE_SCHEMA });
    const list = out.json && Array.isArray(out.json.hires) ? out.json.hires : [];
    hires = [];
    const seenIds = new Set();
    for (const h of list) {
      if (!h || typeof h.capabilityId !== 'string' || seenIds.has(h.capabilityId)) continue;
      seenIds.add(h.capabilityId);
      hires.push({ capabilityId: h.capabilityId, reason: String(h.reason ?? '') });
    }
    last = diff(hires);
    if (last.missing.length === 0 && last.extra.length === 0) break;
    if (round === MAX_ROUNDS) break;

    const lines = [];
    if (last.missing.length) {
      lines.push(...last.missing.map((id) => `missing ${id}: needed by ${neededBy(id, codePlan, deliverableIds)}`));
    }
    if (last.extra.length) {
      lines.push(...last.extra.map((id) => `unneeded ${id}: not in the plan for these deliverables`));
    }
    messenger.send({
      type: 'CHALLENGE', from: 'Planner', to: 'Supervisor',
      reason: cut(`Team does not match the plan: ${lines.join('; ')}`),
      body: { missing: last.missing, extra: last.extra },
    });
    messages.push({
      role: 'user',
      content: `Planner feedback: ${lines.join('; ')}. Return the corrected full hires list.`,
    });
  }

  const matched = last !== null && last.missing.length === 0 && last.extra.length === 0;
  messenger.send({
    type: 'DECISION', from: 'Planner', to: 'Supervisor',
    reason: cut(matched
      ? `Model team matched the code plan (${plannedIds.length} task(s)). Code plan is the team.`
      : `Model team did not match the code plan after ${rounds} round(s). Code plan is the team. ` +
        `Missing: ${last.missing.join(', ') || 'none'}; extra: ${last.extra.join(', ') || 'none'}.`),
    body: { matched, rounds, tasks: plannedIds },
  });

  const hireById = new Map(hires.map((h) => [h.capabilityId, h]));
  const finalHires = codePlan.tasks.map((task) => {
    const fromModel = hireById.get(task.id);
    const modelReason = fromModel && fromModel.reason.trim();
    if (modelReason) {
      return { capabilityId: task.id, role: task.role, reason: cut(modelReason), source: 'model' };
    }
    return {
      capabilityId: task.id,
      role: task.role,
      reason: cut(`Needed by ${neededBy(task.id, codePlan, deliverableIds)}`),
      source: 'dependency',
    };
  });

  for (const h of finalHires) {
    emit(EVENT.AGENT_JOINED, { agent: h.role, capabilityId: h.capabilityId, reason: h.reason, by: h.source },
      { taskId: h.capabilityId, role: h.role });
  }

  return { tasks: codePlan.tasks, hires: finalHires, matched, rounds };
}
