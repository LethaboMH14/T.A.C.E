import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createTaceMcpServer } from '../../mcp/server.mjs';
import { parseCsv } from '../../engine/csv.mjs';

let runsDir;
let client;
let serverTransport;
let runId;

const EXPECTED_TOOLS = ['list_files', 'list_scenarios', 'read_file', 'review_run', 'run_mission'];

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args });
  const body = res.content[0].text;
  return { isError: !!res.isError, text: body, json: res.isError ? null : JSON.parse(body) };
}

before(async () => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-mcp-'));
  const server = createTaceMcpServer({ runsDir });
  const [clientTransport, srvTransport] = InMemoryTransport.createLinkedPair();
  serverTransport = srvTransport;
  await server.connect(serverTransport);
  client = new Client({ name: 'tace-test', version: '0.0.0' });
  await client.connect(clientTransport);
});

after(async () => {
  await client?.close();
  await serverTransport?.close();
  if (runsDir) fs.rmSync(runsDir, { recursive: true, force: true });
});

test('listTools returns the five TACE tools', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), EXPECTED_TOOLS);
});

test('list_scenarios includes inject_overlap', async () => {
  const r = await call('list_scenarios');
  assert.equal(r.isError, false);
  assert.ok(r.json.some((s) => s.id === 'inject_overlap' && typeof s.title === 'string'));
});

test('run_mission inject_overlap is VERIFIED and repaired at least once', async () => {
  const r = await call('run_mission', { scenario: 'inject_overlap' });
  assert.equal(r.isError, false, r.text);
  assert.equal(r.json.status, 'VERIFIED', r.text);
  assert.ok(r.json.repairs >= 1, r.text);
  assert.equal(r.json.checksPassed, r.json.checksTotal, r.text);
  runId = r.json.runId;
  assert.ok(fs.existsSync(path.join(runsDir, runId, 'artifacts', 'index.json')));
});

test('list_files includes mentor-schedule.csv v1 and v2', async () => {
  const r = await call('list_files', { runId });
  assert.equal(r.isError, false, r.text);
  const versions = r.json.filter((f) => f.name === 'mentor-schedule.csv').map((f) => f.version);
  assert.ok(versions.includes(1) && versions.includes(2), r.text);
});

test('read_file version 1 of mentor-schedule.csv shows the double booking', async () => {
  const r = await call('read_file', { runId, name: 'mentor-schedule.csv', version: 1 });
  assert.equal(r.isError, false, r.text);
  assert.equal(r.json.version, 1);
  const { rows } = parseCsv(r.json.text);
  const mb = rows.filter((x) => x.mentor_id === 'M-B' && x.status === 'BOOKED');
  const clashes = mb.filter((a, i) => mb.some((b, j) => j !== i && b.day === a.day && b.start === a.start));
  assert.equal(clashes.length, 2, `expected two M-B rows at the same day and start, got ${clashes.length}`);
});

test('read_file without version returns the latest version', async () => {
  const r = await call('read_file', { runId, name: 'mentor-schedule.csv' });
  assert.equal(r.isError, false, r.text);
  assert.equal(r.json.version, 2);
});

test('review_run returns all PASS for the run', async () => {
  const r = await call('review_run', { runId });
  assert.equal(r.isError, false, r.text);
  assert.ok(r.json.length > 0);
  const bad = r.json.filter((c) => c.status !== 'PASS');
  assert.deepEqual(bad, [], r.text);
});

test('bad runId returns isError, not a crash', async () => {
  const r = await call('review_run', { runId: '../etc' });
  assert.equal(r.isError, true);
  const r2 = await call('list_files', { runId: 'no-such-run' });
  assert.equal(r2.isError, true);
});

test('bad runId format on read_file returns isError', async () => {
  const r = await call('read_file', { runId: 'bad id!', name: 'mentor-schedule.csv' });
  assert.equal(r.isError, true);
});

test('unknown scenario returns isError', async () => {
  const r = await call('run_mission', { scenario: 'no_such_scenario' });
  assert.equal(r.isError, true);
});

test('malformed scenario id returns isError', async () => {
  const r = await call('run_mission', { scenario: '../evil' });
  assert.equal(r.isError, true);
});
