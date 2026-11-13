// T.A.C.E ledger — append-only event log in SQLite (node:sqlite), mirrored to events.jsonl.
// There is deliberately no update or delete API.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EVENT } from './contracts.mjs';

const KNOWN = new Set(Object.values(EVENT));

/**
 * @param {string} runDir
 * @param {string} runId
 * @param {{clock?: () => string}} [opts]
 */
export function openLedger(runDir, runId, { clock = () => new Date().toISOString() } = {}) {
  const root = path.resolve(runDir);
  fs.mkdirSync(root, { recursive: true });
  const db = new DatabaseSync(path.join(root, 'ledger.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      type TEXT NOT NULL,
      task_id TEXT,
      role TEXT,
      data TEXT NOT NULL
    );
  `);
  const insert = db.prepare(
    'INSERT INTO events (run_id, ts, type, task_id, role, data) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const selectAll = db.prepare(
    'SELECT seq, run_id, ts, type, task_id, role, data FROM events ORDER BY seq ASC',
  );
  const jsonlPath = path.join(root, 'events.jsonl');
  const subscribers = new Set();
  let closed = false;

  function append(type, data = {}, meta = {}) {
    if (closed) throw Object.assign(new Error('ledger is closed'), { code: 'LEDGER_CLOSED' });
    if (!KNOWN.has(type)) {
      throw Object.assign(new Error(`unknown event type: ${type}`), { code: 'UNKNOWN_EVENT' });
    }
    const ts = clock();
    const taskId = meta.taskId ?? null;
    const role = meta.role ?? null;
    const json = JSON.stringify(data);
    const res = insert.run(runId, ts, type, taskId, role, json);
    const event = {
      seq: Number(res.lastInsertRowid),
      runId,
      ts,
      type,
      taskId,
      role,
      data: JSON.parse(json),
    };
    fs.appendFileSync(jsonlPath, JSON.stringify(event) + '\n', 'utf8');
    for (const fn of [...subscribers]) {
      try {
        fn(event);
      } catch {
        // a broken subscriber must never break the ledger
      }
    }
    return event;
  }

  function on(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function all() {
    return selectAll.all().map((row) => ({
      seq: Number(row.seq),
      runId: row.run_id,
      ts: row.ts,
      type: row.type,
      taskId: row.task_id,
      role: row.role,
      data: JSON.parse(row.data),
    }));
  }

  function close() {
    if (!closed) {
      closed = true;
      db.close();
    }
  }

  return { append, on, all, close };
}
