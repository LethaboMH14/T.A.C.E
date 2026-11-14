// Runs a planned task list in dependency layers. Deterministic code only.
// Each layer: every ready task is announced, then all ready tasks run concurrently.
// Events for a layer are emitted in sorted task-id order, so two runs give identical event logs
// whenever execute() is deterministic.

import { EVENT, TASK_STATE } from './contracts.mjs';
import { validateGraph } from './planner.mjs';

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

/**
 * @param {object[]} tasks  Task objects (see contracts.mjs), each with id, role, dependsOn
 * @param {{
 *   execute: (task: object, attempt: number) => Promise<any>,
 *   emit?: (type: string, data: object, meta: {taskId: string, role: string}) => void,
 *   maxAttempts?: number,
 *   only?: Set<string>|null
 * }} options
 * @returns {Promise<{status: 'COMPLETED'|'FAILED', states: Record<string,string>,
 *   results: Record<string,any>, failed: {id:string, code:string, message:string}[]}>}
 */
export async function runGraph(tasks, { execute, emit = () => {}, maxAttempts = 2, only = null } = {}) {
  if (typeof execute !== 'function') throw new Error('runGraph: execute must be a function');
  validateGraph(tasks);

  const attemptsAllowed = Math.max(1, maxAttempts);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = [...byId.keys()].sort();
  const inScope = new Set(only ? ids.filter((id) => only.has(id)) : ids);

  // Tasks outside `only` count as already completed for dependency purposes.
  const states = {};
  for (const id of ids) {
    states[id] = inScope.has(id) ? TASK_STATE.PENDING : TASK_STATE.COMPLETED;
  }
  const results = {};
  const failed = [];

  const children = new Map(ids.map((id) => [id, []]));
  for (const t of tasks) {
    for (const d of uniqueSorted(t.dependsOn ?? [])) children.get(d).push(t.id);
  }

  const metaOf = (task) => ({ taskId: task.id, role: task.role });

  function skipDescendants(failedId) {
    const found = new Set();
    const queue = [failedId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const child of children.get(current)) {
        if (!found.has(child)) {
          found.add(child);
          queue.push(child);
        }
      }
    }
    for (const id of [...found].sort()) {
      if (inScope.has(id) && states[id] === TASK_STATE.PENDING) {
        states[id] = TASK_STATE.SKIPPED;
        emit(EVENT.TASK_SKIPPED, { reason: `dependency failed: ${failedId}` }, metaOf(byId.get(id)));
      }
    }
  }

  async function attemptTask(task) {
    const events = [];
    let last = null;
    for (let attempt = 1; attempt <= attemptsAllowed; attempt++) {
      try {
        const result = await execute(task, attempt);
        return { id: task.id, events, ok: true, result };
      } catch (err) {
        last = {
          code: err?.code ?? 'TASK_ERROR',
          message: err?.message ?? String(err),
        };
        events.push({
          type: EVENT.TASK_FAILED,
          data: { code: last.code, message: last.message, attempt },
          meta: metaOf(task),
        });
      }
    }
    return { id: task.id, events, ok: false, error: last };
  }

  for (;;) {
    const ready = ids.filter(
      (id) => inScope.has(id) &&
        states[id] === TASK_STATE.PENDING &&
        byId.get(id).dependsOn.every((d) => states[d] === TASK_STATE.COMPLETED),
    );
    if (ready.length === 0) break;

    for (const id of ready) {
      states[id] = TASK_STATE.READY;
      emit(EVENT.TASK_READY, {}, metaOf(byId.get(id)));
    }
    for (const id of ready) {
      states[id] = TASK_STATE.RUNNING;
      emit(EVENT.TASK_STARTED, {}, metaOf(byId.get(id)));
    }

    const outcomes = await Promise.all(ready.map((id) => attemptTask(byId.get(id))));

    for (const outcome of outcomes) {
      const task = byId.get(outcome.id);
      for (const ev of outcome.events) emit(ev.type, ev.data, ev.meta);

      if (outcome.ok) {
        states[outcome.id] = TASK_STATE.COMPLETED;
        results[outcome.id] = outcome.result;
        emit(EVENT.TASK_COMPLETED, {
          summary: outcome.result?.summary ?? null,
          artifacts: (outcome.result?.artifacts ?? []).map((a) => `${a.name}@v${a.version}`),
        }, metaOf(task));
      } else {
        states[outcome.id] = TASK_STATE.FAILED;
        failed.push({ id: outcome.id, code: outcome.error.code, message: outcome.error.message });
        skipDescendants(outcome.id);
      }
    }
  }

  return {
    status: failed.length > 0 ? 'FAILED' : 'COMPLETED',
    states,
    results,
    failed,
  };
}
