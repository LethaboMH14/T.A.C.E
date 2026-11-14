import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../engine/registry.mjs';
import { planTasks, validateGraph, topoOrder, descendants } from '../../engine/planner.mjs';

// Fake capabilities only. No domain code.
const fake = (id, consumes, produces) => ({
  id, role: `Role ${id}`, label: `label ${id}`, consumes, produces, run: async () => ({}),
});
const capA = fake('a', [], ['x']);
const capB = fake('b', ['x'], ['y']);
const capC = fake('c', ['x'], ['z']);
const capD = fake('d', ['y', 'z'], ['w']);
const diamond = () => createRegistry([capA, capB, capC, capD]);

test('request w plans a,b,c,d in topo order with correct dependsOn', () => {
  const { tasks, unsupported } = planTasks(diamond(), ['w'], []);
  assert.deepEqual(tasks.map((t) => t.id), ['a', 'b', 'c', 'd']);
  const deps = Object.fromEntries(tasks.map((t) => [t.id, t.dependsOn]));
  assert.deepEqual(deps, { a: [], b: ['a'], c: ['a'], d: ['b', 'c'] });
  assert.deepEqual(unsupported, []);
  assert.equal(tasks[1].capabilityId, 'b');
  assert.deepEqual(tasks[3].consumes, ['y', 'z']);
  assert.deepEqual(tasks[3].produces, ['w']);
});

test('request y plans only a and b', () => {
  const { tasks, unsupported } = planTasks(diamond(), ['y'], []);
  assert.deepEqual(tasks.map((t) => t.id), ['a', 'b']);
  assert.deepEqual(unsupported, []);
});

test('request with no producer yields unsupported and no tasks', () => {
  const { tasks, unsupported } = planTasks(diamond(), ['q'], []);
  assert.deepEqual(tasks, []);
  assert.deepEqual(unsupported, ['q']);
});

test('available kind skips its producer', () => {
  const { tasks } = planTasks(diamond(), ['w'], ['x']);
  assert.deepEqual(tasks.map((t) => t.id), ['b', 'c', 'd']);
  assert.deepEqual(tasks.find((t) => t.id === 'b').dependsOn, []);
});

test('consumed kind with no producer makes the capability and requested kind unsupported', () => {
  const capE = fake('e', ['nope'], ['e']);
  const { tasks, unsupported } = planTasks(createRegistry([capE]), ['e'], []);
  assert.deepEqual(tasks, []);
  assert.deepEqual(unsupported, ['e', 'nope']);
});

test('producer cycle throws PLAN_CYCLE', () => {
  const capP = fake('p', ['b'], ['a']);
  const capQ = fake('q', ['a'], ['b']);
  assert.throws(() => planTasks(createRegistry([capP, capQ]), ['a'], []), { code: 'PLAN_CYCLE' });
});

test('producersOf returns producers sorted by id and the first one is chosen', () => {
  const capZ = fake('z', [], ['x']);
  const capM = fake('m', [], ['x']);
  const reg = createRegistry([capZ, capM]);
  assert.deepEqual(reg.producersOf('x').map((c) => c.id), ['m', 'z']);
  assert.deepEqual(planTasks(reg, ['x'], []).tasks.map((t) => t.id), ['m']);
});

test('descendants(a) is b, c, d', () => {
  const { tasks } = planTasks(diamond(), ['w'], []);
  assert.deepEqual(descendants(tasks, 'a'), ['b', 'c', 'd']);
  assert.deepEqual(descendants(tasks, 'd'), []);
});

test('topoOrder ties broken by id', () => {
  const tasks = [
    { id: 'c', dependsOn: [] },
    { id: 'a', dependsOn: [] },
    { id: 'b', dependsOn: ['a'] },
  ];
  assert.deepEqual(topoOrder(tasks), ['a', 'b', 'c']);
});

test('validateGraph throws DUPLICATE_TASK, UNKNOWN_DEPENDENCY and PLAN_CYCLE', () => {
  assert.throws(() => validateGraph([{ id: 'a', dependsOn: [] }, { id: 'a', dependsOn: [] }]), { code: 'DUPLICATE_TASK' });
  assert.throws(() => validateGraph([{ id: 'a', dependsOn: ['zz'] }]), { code: 'UNKNOWN_DEPENDENCY' });
  assert.throws(() => validateGraph([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }]), { code: 'PLAN_CYCLE' });
  assert.doesNotThrow(() => validateGraph([{ id: 'a', dependsOn: [] }]));
});

test('planning is deterministic regardless of request order', () => {
  const first = JSON.stringify(planTasks(diamond(), ['w', 'y'], []));
  const second = JSON.stringify(planTasks(diamond(), ['y', 'w'], []));
  assert.equal(first, second);
});

test('registry rejects bad capabilities with BAD_CAPABILITY', () => {
  assert.throws(() => createRegistry([fake('Bad-Id', [], ['x'])]), { code: 'BAD_CAPABILITY' });
  assert.throws(() => createRegistry([capA, capA]), { code: 'BAD_CAPABILITY' });
  assert.throws(() => createRegistry([fake('e', [], [])]), { code: 'BAD_CAPABILITY' });
  assert.throws(() => createRegistry([{ ...fake('f', [], ['x']), run: 'nope' }]), { code: 'BAD_CAPABILITY' });
});

test('registry all() is sorted and get() looks up by id', () => {
  const reg = createRegistry([capD, capA, capC, capB]);
  assert.deepEqual(reg.all().map((c) => c.id), ['a', 'b', 'c', 'd']);
  assert.equal(reg.get('c').id, 'c');
  assert.equal(reg.get('nope'), null);
});
