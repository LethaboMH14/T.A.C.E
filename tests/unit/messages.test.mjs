import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMessenger } from '../../engine/messages.mjs';
import { EVENT } from '../../engine/contracts.mjs';

const base = { type: 'REQUEST', from: 'Planner', to: 'Analyst', reason: 'Need gap list' };

test('valid message is emitted with id M-001 and returned', () => {
  const events = [];
  const m = createMessenger((...args) => events.push(args));
  const msg = m.send({ ...base, about: { artifact: 'gaps.json@v1' } });
  assert.equal(msg.id, 'M-001');
  assert.equal(events.length, 1);
  assert.equal(events[0][0], EVENT.AGENT_MESSAGE);
  assert.equal(events[0][1].id, 'M-001');
  assert.deepEqual(events[0][2], { taskId: null, role: 'Planner' });
  assert.deepEqual(m.list(), [msg]);
});

test('ids increase M-001, M-002', () => {
  const m = createMessenger(() => {});
  assert.equal(m.send(base).id, 'M-001');
  assert.equal(m.send(base).id, 'M-002');
  assert.equal(m.list().length, 2);
});

test('bad type throws BAD_MESSAGE and emits nothing', () => {
  const events = [];
  const m = createMessenger((...a) => events.push(a));
  assert.throws(
    () => m.send({ ...base, type: 'SHOUT' }),
    (err) => err.code === 'BAD_MESSAGE' && /type/.test(err.message),
  );
  assert.equal(events.length, 0);
  assert.equal(m.list().length, 0);
});

test('extra top-level field is rejected (strict)', () => {
  const m = createMessenger(() => {});
  assert.throws(
    () => m.send({ ...base, extra: 1 }),
    (err) => err.code === 'BAD_MESSAGE',
  );
});

test('extra field inside about is rejected (strict)', () => {
  const m = createMessenger(() => {});
  assert.throws(
    () => m.send({ ...base, about: { artifact: 'x', surprise: true } }),
    (err) => err.code === 'BAD_MESSAGE',
  );
});

test('caller-supplied id is rejected, and a failed send does not consume an id', () => {
  const m = createMessenger(() => {});
  assert.throws(() => m.send({ ...base, id: 'M-999' }), (err) => err.code === 'BAD_MESSAGE');
  assert.throws(() => m.send({ ...base, reason: '' }), (err) => err.code === 'BAD_MESSAGE');
  assert.equal(m.send(base).id, 'M-001');
});
