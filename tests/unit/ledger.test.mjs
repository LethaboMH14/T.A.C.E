import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLedger } from '../../engine/ledger.mjs';
import { EVENT } from '../../engine/contracts.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tace-ledger-'));
}

test('seq increments 1,2,3 and fields are stored', () => {
  const dir = tmpDir();
  const ledger = openLedger(dir, 'run-1', { clock: () => '2026-01-01T00:00:00.000Z' });
  try {
    const a = ledger.append(EVENT.RUN_STARTED, { scenarioId: 's1' });
    const b = ledger.append(EVENT.TASK_STARTED, { x: 1 }, { taskId: 'analyst', role: 'Analyst' });
    const c = ledger.append(EVENT.RUN_FINISHED, { status: 'VERIFIED' });
    assert.deepEqual([a.seq, b.seq, c.seq], [1, 2, 3]);
    assert.equal(b.taskId, 'analyst');
    assert.equal(b.role, 'Analyst');
    assert.equal(a.taskId, null);
    assert.equal(a.role, null);
    assert.equal(a.runId, 'run-1');
    assert.deepEqual(ledger.all().map((e) => e.seq), [1, 2, 3]);
    assert.deepEqual(ledger.all()[0].data, { scenarioId: 's1' });
  } finally {
    ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('unknown event type throws UNKNOWN_EVENT and nothing is written', () => {
  const dir = tmpDir();
  const ledger = openLedger(dir, 'run-2');
  try {
    assert.throws(() => ledger.append('NOT_A_TYPE', {}), (e) => e.code === 'UNKNOWN_EVENT');
    assert.equal(ledger.all().length, 0);
  } finally {
    ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('events.jsonl lines equal ledger.all()', () => {
  const dir = tmpDir();
  const ledger = openLedger(dir, 'run-3');
  try {
    ledger.append(EVENT.RUN_STARTED, { goalText: 'g' });
    ledger.append(EVENT.ARTIFACT_WRITTEN, { file: 'artifacts/x.v1.csv' }, { taskId: 't' });
    const lines = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines, ledger.all());
  } finally {
    ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('injected clock is used for ts', () => {
  const dir = tmpDir();
  let n = 0;
  const ledger = openLedger(dir, 'run-4', { clock: () => `T${++n}` });
  try {
    const a = ledger.append(EVENT.RUN_STARTED);
    const b = ledger.append(EVENT.RUN_FINISHED);
    assert.equal(a.ts, 'T1');
    assert.equal(b.ts, 'T2');
    assert.deepEqual(a.data, {});
  } finally {
    ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('subscriber is called; throwing subscriber is ignored; unsubscribe works', () => {
  const dir = tmpDir();
  const ledger = openLedger(dir, 'run-5');
  try {
    const seen = [];
    ledger.on(() => {
      throw new Error('boom');
    });
    const off = ledger.on((e) => seen.push(e.type));
    const ev = ledger.append(EVENT.TASK_COMPLETED, { artifacts: [] });
    assert.equal(ev.seq, 1);
    assert.deepEqual(seen, [EVENT.TASK_COMPLETED]);
    off();
    ledger.append(EVENT.RUN_FINISHED, {});
    assert.deepEqual(seen, [EVENT.TASK_COMPLETED]);
    assert.equal(ledger.all().length, 2);
  } finally {
    ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
