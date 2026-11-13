// Goal Reader: the model drafts a goal proposal, code decides whether it is usable.
// Domain-neutral. The model never executes anything and never approves anything.
import { readFileSync } from 'node:fs';
import { EVENT } from '../engine/contracts.mjs';
import { assemblePrompt } from '../tools/gate02/prompt-assembly.mjs';
import { validateGoalProposal } from '../tools/gate02/goal-proposal.mjs';

const rawSchema = JSON.parse(
  readFileSync(new URL('../tools/gate02/goal-proposal.schema.json', import.meta.url), 'utf8'),
);
const { $schema: _draft, $id: _id, ...schema } = rawSchema;
const JSON_SCHEMA = Object.freeze({ name: 'goal_proposal', schema });

function coded(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** assemblePrompt returns system, developer, user. The developer text is sent as a second system message. */
function toChatMessages(assembled) {
  return assembled.messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'system',
    content: m.content,
  }));
}

function catalogMessage(catalog) {
  const list = [...catalog]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => ({ id: c.id, description: c.description }));
  return {
    role: 'system',
    content:
      'Deliverable ids the engine can produce: ' + JSON.stringify(list) + '. ' +
      'Use only these deliverable ids; anything else must be listed as unsupported in uncertainties.',
  };
}

function deliverableIdsOf(json) {
  const list = json && Array.isArray(json.deliverables) ? json.deliverables : [];
  return list
    .map((d) => (d && typeof d.id === 'string' ? d.id : null))
    .filter((x) => x !== null)
    .sort();
}

/**
 * @returns {Promise<{status:'ACCEPTED', proposal, validation, attempts} | {status:'ESCALATED', proposal:null, attempts, code}>}
 * @throws code MODEL_UNAVAILABLE when no model is configured (nothing is invented)
 */
export async function readGoal({ model, intake, catalog, messenger, emit, maxAttempts = 3 }) {
  if (!model || model.available !== true) {
    throw coded('MODEL_UNAVAILABLE', 'No model configured. The goal was not drafted.');
  }
  const assembled = assemblePrompt(intake);
  if (assembled.status !== 'ASSEMBLED') {
    throw coded('ASSEMBLY_REJECTED', `Prompt assembly rejected: ${assembled.code}`);
  }

  const known = new Set(catalog.map((c) => c.id));
  const base = [...toChatMessages(assembled), catalogMessage(catalog)];
  const retries = [];
  let lastCode = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let json = null;
    let validated = null;
    let ok = false;
    let code;
    let proposal = null;

    try {
      const out = await model.chat({
        agent: 'Goal Reader',
        messages: [...base, ...retries],
        jsonSchema: JSON_SCHEMA,
      });
      json = out.json;
      validated = validateGoalProposal(json, intake);
      const ids = deliverableIdsOf(json);
      if (validated.status === 'REJECTED_PROPOSAL') {
        code = validated.code;
      } else if (ids.some((i) => !known.has(i))) {
        code = 'UNSUPPORTED_DELIVERABLE';
      } else {
        ok = true;
        code = validated.code;
        proposal = validated.proposal;
      }
    } catch (err) {
      if (err && err.code === 'MODEL_UNAVAILABLE') throw err;
      code = (err && err.code) || 'MODEL_ERROR';
    }

    const deliverables = validated && validated.proposal
      ? validated.proposal.deliverables.map((d) => d.id).sort()
      : deliverableIdsOf(json);
    emit(EVENT.GOAL_DRAFTED, { attempt, ok, code, deliverables });

    if (ok) {
      messenger.send({
        type: 'RESULT', from: 'Goal Reader', to: 'Supervisor',
        reason: `Goal proposal accepted with ${deliverables.length} deliverable(s).`,
        body: { deliverables, status: validated.status, code },
      });
      return { status: 'ACCEPTED', proposal, validation: { status: validated.status, code }, attempts: attempt };
    }

    lastCode = code;
    messenger.send({
      type: 'CHALLENGE', from: 'Validator', to: 'Goal Reader',
      reason: `Rejected: ${code}`, body: { code },
    });
    retries.push({
      role: 'user',
      content: `Rejected with code ${code}. Return the corrected full JSON proposal only.`,
    });
  }

  messenger.send({
    type: 'ESCALATE', from: 'Goal Reader', to: 'Coordinator',
    reason: `No valid goal proposal after ${maxAttempts} attempt(s). Last code: ${lastCode}.`,
    body: { code: lastCode, attempts: maxAttempts },
  });
  return { status: 'ESCALATED', proposal: null, attempts: maxAttempts, code: lastCode };
}
