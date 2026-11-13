import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createModel, modelFromEnv } from '../../engine/model.mjs';

// Test double for the Meta Model API. Only used by tests, never by the app.
const FAKE_KEY = 'sk-test-SECRET-123';

function startMock(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const rec = { method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null };
      requests.push(rec);
      handler(rec, res, requests.length);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        requests,
        close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
      });
    });
  });
}

function json(res, status, obj, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

function okReply(content, extra = {}) {
  return {
    id: 'cmpl-1',
    choices: [{ index: 0, message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

const msgs = [{ role: 'user', content: 'hello' }];

test('request shape: headers, body fields, no tools, no response_format', async () => {
  const mock = await startMock((_r, res) => json(res, 200, okReply('hi')));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, model: 'test-model' });
    const out = await m.chat({ agent: 'Goal Reader', messages: msgs });
    assert.equal(out.text, 'hi');
    assert.equal(mock.requests.length, 1);
    const r = mock.requests[0];
    assert.equal(r.method, 'POST');
    assert.equal(r.url, '/v1/chat/completions');
    assert.equal(r.headers.authorization, `Bearer ${FAKE_KEY}`);
    assert.match(r.headers['content-type'], /application\/json/);
    assert.equal(r.body.model, 'test-model');
    assert.deepEqual(r.body.messages, msgs);
    assert.equal(r.body.temperature, 0.2);
    assert.equal(r.body.max_tokens, 1500);
    assert.equal('tool_choice' in r.body, false);
    assert.equal('tools' in r.body, false);
    assert.equal('response_format' in r.body, false);
  } finally {
    await mock.close();
  }
});

test('tools given: tool_choice auto is sent', async () => {
  const tools = [{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object' } } }];
  const mock = await startMock((_r, res) => json(res, 200, okReply('x')));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl });
    await m.chat({ agent: 'a', messages: msgs, tools });
    assert.deepEqual(mock.requests[0].body.tools, tools);
    assert.equal(mock.requests[0].body.tool_choice, 'auto');
  } finally {
    await mock.close();
  }
});

test('text reply and usage', async () => {
  const mock = await startMock((_r, res) => json(res, 200, okReply('plain text')));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl });
    const out = await m.chat({ agent: 'a', messages: msgs });
    assert.equal(out.text, 'plain text');
    assert.equal(out.json, null);
    assert.deepEqual(out.toolCalls, []);
    assert.deepEqual(out.usage, { prompt: 10, completion: 5, total: 15 });
    assert.equal(out.message.role, 'assistant');
    assert.equal(typeof out.ms, 'number');
  } finally {
    await mock.close();
  }
});

test('json_schema: response_format shape and fenced JSON parsed', async () => {
  const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };
  const mock = await startMock((_r, res) => json(res, 200, okReply('```json\n{"ok": true}\n```')));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl });
    const out = await m.chat({ agent: 'a', messages: msgs, jsonSchema: { name: 'verdict', schema } });
    assert.deepEqual(out.json, { ok: true });
    assert.deepEqual(mock.requests[0].body.response_format, {
      type: 'json_schema',
      json_schema: { name: 'verdict', schema },
    });
  } finally {
    await mock.close();
  }
});

test('json_schema: unfenced JSON parsed; invalid JSON -> MODEL_BAD_JSON', async () => {
  const schema = { type: 'object' };
  let body = '{"a":1}';
  const mock = await startMock((_r, res) => json(res, 200, okReply(body)));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, maxRetries: 0 });
    assert.deepEqual((await m.chat({ agent: 'a', messages: msgs, jsonSchema: { name: 'x', schema } })).json, { a: 1 });
    body = 'not json at all';
    await assert.rejects(
      m.chat({ agent: 'a', messages: msgs, jsonSchema: { name: 'x', schema } }),
      (err) => err.code === 'MODEL_BAD_JSON',
    );
  } finally {
    await mock.close();
  }
});

test('tool_calls parsed into {id, name, args}', async () => {
  const reply = okReply(null, {
    tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"id":"T-7"}' } }],
  });
  const mock = await startMock((_r, res) => json(res, 200, reply));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl });
    const out = await m.chat({ agent: 'a', messages: msgs, tools: [{ type: 'function', function: { name: 'lookup' } }] });
    assert.equal(out.text, '');
    assert.deepEqual(out.toolCalls, [{ id: 'call_1', name: 'lookup', args: { id: 'T-7' } }]);
    assert.equal(out.message.tool_calls[0].id, 'call_1');
  } finally {
    await mock.close();
  }
});

test('bad tool_call arguments JSON -> MODEL_BAD_JSON', async () => {
  const reply = okReply(null, {
    tool_calls: [{ id: 'c', type: 'function', function: { name: 'lookup', arguments: '{oops' } }],
  });
  const mock = await startMock((_r, res) => json(res, 200, reply));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, maxRetries: 0 });
    await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => err.code === 'MODEL_BAD_JSON');
  } finally {
    await mock.close();
  }
});

test('no choices -> MODEL_EMPTY', async () => {
  const mock = await startMock((_r, res) => json(res, 200, { choices: [] }));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl });
    await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => err.code === 'MODEL_EMPTY');
  } finally {
    await mock.close();
  }
});

test('429 then 200 succeeds with two onCall records (ok false, then ok true)', async () => {
  const mock = await startMock((_r, res, n) => {
    if (n === 1) json(res, 429, { error: 'slow down' });
    else json(res, 200, okReply('after retry'));
  });
  const calls = [];
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, onCall: (c) => calls.push(c) });
    const out = await m.chat({ agent: 'Reviewer', messages: msgs });
    assert.equal(out.text, 'after retry');
    assert.equal(mock.requests.length, 2);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].ok, false);
    assert.equal(calls[0].error, 'MODEL_HTTP_429');
    assert.equal(calls[1].ok, true);
    assert.equal(calls[1].error, null);
    assert.equal(calls[1].provider, 'meta-model-api');
    assert.equal(calls[1].model, 'muse-spark-1.3');
    assert.equal(calls[1].agent, 'Reviewer');
    assert.deepEqual(calls[1].usage, { prompt: 10, completion: 5, total: 15 });
  } finally {
    await mock.close();
  }
});

test('500 x3 -> MODEL_HTTP_500 after 3 attempts', async () => {
  const mock = await startMock((_r, res) => json(res, 500, 'boom'));
  const calls = [];
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, maxRetries: 2, onCall: (c) => calls.push(c) });
    await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => err.code === 'MODEL_HTTP_500');
    assert.equal(mock.requests.length, 3);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((c) => c.ok === false && c.error === 'MODEL_HTTP_500'));
  } finally {
    await mock.close();
  }
});

test('400 is not retried', async () => {
  const mock = await startMock((_r, res) => json(res, 400, { error: 'bad tool_choice' }));
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, maxRetries: 2 });
    await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => err.code === 'MODEL_HTTP_400');
    assert.equal(mock.requests.length, 1);
  } finally {
    await mock.close();
  }
});

test('Retry-After header is honoured on 429', async () => {
  const mock = await startMock((_r, res, n) => {
    if (n === 1) json(res, 429, {}, { 'retry-after': '1' });
    else json(res, 200, okReply('ok'));
  });
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl });
    const t0 = Date.now();
    await m.chat({ agent: 'a', messages: msgs });
    assert.ok(Date.now() - t0 >= 900, 'waited about 1 second');
    assert.equal(mock.requests.length, 2);
  } finally {
    await mock.close();
  }
});

test('timeout -> MODEL_TIMEOUT', async () => {
  const mock = await startMock((_r, res) => {
    setTimeout(() => json(res, 200, okReply('late')), 2000).unref();
  });
  const calls = [];
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, timeoutMs: 100, maxRetries: 2, onCall: (c) => calls.push(c) });
    await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => err.code === 'MODEL_TIMEOUT');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].error, 'MODEL_TIMEOUT');
  } finally {
    await mock.close();
  }
});

test('no key -> MODEL_UNAVAILABLE and zero requests', async () => {
  const mock = await startMock((_r, res) => json(res, 200, okReply('should not happen')));
  try {
    const m = createModel({ apiKey: undefined, baseUrl: mock.baseUrl });
    assert.equal(m.available, false);
    await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => err.code === 'MODEL_UNAVAILABLE');
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('the key never appears in error messages or onCall payloads', async () => {
  const echo = `echoed ${FAKE_KEY} and Bearer ${FAKE_KEY}`;
  const mock = await startMock((_r, res) => json(res, 401, echo));
  const calls = [];
  try {
    const m = createModel({ apiKey: FAKE_KEY, baseUrl: mock.baseUrl, maxRetries: 0, onCall: (c) => calls.push(c) });
    let thrown;
    await m.chat({ agent: 'a', messages: msgs }).catch((e) => { thrown = e; });
    assert.equal(thrown.code, 'MODEL_HTTP_401');
    assert.ok(!thrown.message.includes(FAKE_KEY), 'error message leaks key');
    assert.ok(thrown.message.length <= 300);
    assert.ok(!JSON.stringify(calls).includes(FAKE_KEY), 'onCall leaks key');
    assert.ok(!JSON.stringify(thrown).includes(FAKE_KEY), 'error object leaks key');
  } finally {
    await mock.close();
  }
});

test('the key never appears when the network fails', async () => {
  const failing = async () => { throw new Error(`connect failed for ${FAKE_KEY}`); };
  const m = createModel({ apiKey: FAKE_KEY, baseUrl: 'http://127.0.0.1:1/v1', fetchImpl: failing, maxRetries: 0 });
  await assert.rejects(m.chat({ agent: 'a', messages: msgs }), (err) => {
    assert.equal(err.code, 'MODEL_NETWORK');
    assert.ok(!err.message.includes(FAKE_KEY));
    return true;
  });
});

test('modelFromEnv reads MODEL_API_KEY first, then LLAMA_API_KEY, plus base URL and name', () => {
  const a = modelFromEnv({ MODEL_API_KEY: 'k1', LLAMA_API_KEY: 'k2', MODEL_BASE_URL: 'http://x/v1', MODEL_NAME: 'm1' });
  assert.equal(a.available, true);
  assert.equal(a.baseUrl, 'http://x/v1');
  assert.equal(a.model, 'm1');

  const b = modelFromEnv({ LLAMA_API_KEY: 'k2' });
  assert.equal(b.available, true);
  assert.equal(b.baseUrl, 'https://api.meta.ai/v1');
  assert.equal(b.model, 'muse-spark-1.3');

  const c = modelFromEnv({});
  assert.equal(c.available, false);
});

test('modelFromEnv uses the key from env, not a hardcoded value', async () => {
  const mock = await startMock((_r, res) => json(res, 200, okReply('ok')));
  try {
    const m = modelFromEnv({ MODEL_API_KEY: FAKE_KEY, MODEL_BASE_URL: mock.baseUrl, MODEL_NAME: 'named' });
    await m.chat({ agent: 'a', messages: msgs });
    assert.equal(mock.requests[0].headers.authorization, `Bearer ${FAKE_KEY}`);
    assert.equal(mock.requests[0].body.model, 'named');
  } finally {
    await mock.close();
  }
});
