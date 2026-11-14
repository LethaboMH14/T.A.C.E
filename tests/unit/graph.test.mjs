import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../engine/registry.mjs';
import { planTasks } from '../../engine/planner.mjs';
import { runGraph } from '../../engine/graph.mjs';
import { EVENT, TASK_STATE } from '../../engine/contracts.mjs';

// Fake capabilities only. No domain code.
const fake = (id, consumes, produces) => ({
  id, role: `Role ${id}`, label: `label ${id}`, consumes, produces, run: async () => ({}),
});
const tasksFor = () => {
  const reg = createRegistry([
    fake('a', [], ['x']),
    fake('b', ['x'], ['y']),
    fake('c', ['x'], ['z']),
    fake('d', ['y', 'z'], ['w']),
  ]);
  return planTasks(reg, ['w'], []).tasks;
};

function recorder() {
  const events = [];
  const emit = (type, data, meta) => events.push({ type, data, meta });
  return { events, emit };
}

const okExecute = async (task) => ({ summary: `${task.id} done` });

test('b and c run in the same layer', async () => {
  const { events, emit } = recorder();
  const res = await runGraph(tasksFor(), { execute: okExecute, emit });
  assert.equal(res.status, 'COMPLETED');
  const startedB = events.findIndex((e) => e.type === EVENT.TASK_STARTED && e.meta.taskId === 'b');
  const startedC = events.findIndex((e) => e.type === EVENT.TASK_STARTED && e.meta.taskId === 'c');
  const firstDone = events.findIndex((e) => e.type === EVENT.TASK_COMPLETED && (e.meta.taskId === 'b' || e.meta.taskId === 'c'));
  assert.ok(startedB >= 0 && startedC >= 0);
  assert.ok(startedB < firstDone && startedC < firstDone, 'both started before either completed');
  assert.deepEqual(res.states, { a: 'COMPLETED', b: 'COMPLETED', c: 'COMPLETED', d: 'COMPLETED' });
  assert.equal(events.find((e) => e.type === EVENT.TASK_COMPLETED && e.meta.taskId === 'a').data.summary, 'a done');
});

test('failure in b skips d, c still completes, status FAILED', async () => {
  const { events, emit } = recorder();
  const execute = async (task) => {
    if (task.id === 'b') {
      const err = new Error('b broke');
      err.code = 'BOOM';
      throw err;
    }
    return { summary: task.id };
  };
  const res = await runGraph(tasksFor(), { execute, emit });
  assert.equal(res.status, 'FAILED');
  assert.deepEqual(res.states, { a: 'COMPLETED', b: 'FAILED', c: 'COMPLETED', d: 'SKIPPED' });
  assert.deepEqual(res.failed, [{ id: 'b', code: 'BOOM', message: 'b broke' }]);
  const skipped = events.find((e) => e.type === EVENT.TASK_SKIPPED);
  assert.equal(skipped.meta.taskId, 'd');
  assert.equal(skipped.data.reason, 'dependency failed: b');
  assert.ok(events.some((e) => e.type === EVENT.TASK_COMPLETED && e.meta.taskId === 'c'));
});

test('task that throws once then succeeds completes with one TASK_FAILED', async () => {
  const { events, emit } = recorder();
  const execute = async (task, attempt) => {
    if (task.id === 'b' && attempt === 1) throw new Error('flaky');
    return { summary: task.id };
  };
  const res = await runGraph(tasksFor(), { execute, emit });
  assert.equal(res.status, 'COMPLETED');
  assert.equal(res.states.b, TASK_STATE.COMPLETED);
  const failures = events.filter((e) => e.type === EVENT.TASK_FAILED);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].meta.taskId, 'b');
  assert.equal(failures[0].data.attempt, 1);
  assert.equal(failures[0].data.code, 'TASK_ERROR');
});

test('only = {d} runs only d', async () => {
  const { events, emit } = recorder();
  const ran = [];
  const execute = async (task) => {
    ran.push(task.id);
    return { summary: task.id };
  };
  const res = await runGraph(tasksFor(), { execute, emit, only: new Set(['d']) });
  assert.equal(res.status, 'COMPLETED');
  assert.deepEqual(ran, ['d']);
  assert.deepEqual(res.results, { d: { summary: 'd' } });
  assert.ok(events.every((e) => e.meta.taskId === 'd'));
});

test('event order is identical across two runs', async () => {
  const run = async () => {
    const { events, emit } = recorder();
    const execute = async (task, attempt) => {
      if (task.id === 'c' && attempt === 1) throw new Error('once');
      if (task.id === 'b') throw Object.assign(new Error('always'), { code: 'X' });
      return { summary: task.id };
    };
    await runGraph(tasksFor(), { execute, emit });
    return JSON.stringify(events);
  };
  assert.equal(await run(), await run());
});
