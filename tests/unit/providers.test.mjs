// Unit tests for the provider router. Each provider is a real node:http mock server on 127.0.0.1,
// so the real createModel HTTP path runs. The fake key is distinctive so a leak is easy to spot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRouter, routerFromEnv, checkProviders, budgetFromEnv, PROVIDERS, PROFILES } from '../../engine/providers.mjs';

const KEY = 'sk-TACE-TEST-KEY-7f3a9c2e';
const ALL_KEYS = {
  MODEL_API_KEY: KEY, GROQ_API_KEY: KEY, GEMINI_API_KEY: KEY, OPENROUTER_API_KEY: KEY,
  HF_TOKEN: KEY, AIML_API_KEY: KEY,
};

function startMock(handler) {
  const requests = [];
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', async () => {
      let body = null;
      try { body = JSON.parse(raw); } catch { /* not JSON */ }
      requests.push({ headers: req.headers, body });
      const r = await handler({ body, n: requests.length });
      res.writeHead(r.status ?? 200, { 'content-type': 'application/json', ...(r.headers || {}) });
      res.end(typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
    });
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/v1`,
        requests,
        close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }),
      });
    });
  });
}

const ok = (text, usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }) => ({
  status: 200,
  body: { choices: [{ message: { role: 'assistant', content: text } }], usage },
});
const err = (status, body = 'upstream said no', headers = {}) => ({ status, body: { error: body }, headers });

function prov(name, url, extra = {}) {
  return { name, baseUrl: url, envKeys: [`${name.toUpperCase()}_KEY`], models: { fast: `${name}-fast`, strong: `${name}-strong` }, price: null, sendReasoningEffort: false, ...extra };
}

// Each test builds its own mock servers and closes them at the end.
async function withMocks(map, fn) {
  const mocks = {};
  for (const [name, handler] of Object.entries(map)) mocks[name] = await startMock(handler);
  try {
    await fn(mocks);
  } finally {
    for (const m of Object.values(mocks)) await m.close();
  }
}

const MSG = [{ role: 'user', content: 'hi' }];

test('profile order and PROFILES content', async () => {
  const names = ['groq', 'gemini', 'openrouter', 'aiml', 'meta', 'huggingface'];
  const providers = Object.fromEntries(names.map((n) => [n, prov(n, 'http://127.0.0.1:1/v1', { envKeys: [n === 'meta' ? 'MODEL_API_KEY' : `${n.toUpperCase()}_KEY`] })]));
  const env = { MODEL_API_KEY: KEY, GROQ_KEY: KEY, GEMINI_KEY: KEY, OPENROUTER_KEY: KEY, AIML_KEY: KEY, HUGGINGFACE_KEY: KEY };
  assert.deepEqual(createRouter({ providers, env, profile: 'cheap' }).chain, ['groq', 'gemini', 'openrouter', 'aiml', 'meta']);
  assert.deepEqual(createRouter({ providers, env, profile: 'demo' }).chain, ['meta', 'groq', 'gemini', 'openrouter']);
  assert.deepEqual(createRouter({ providers, env, profile: 'meta' }).chain, ['meta']);
  assert.deepEqual(createRouter({ providers, env, profile: 'free' }).chain, ['groq', 'gemini', 'openrouter']);
  assert.deepEqual(PROFILES.free, ['groq', 'gemini', 'openrouter']);
});

test('the free profile never contains a paid provider, even with every key set', () => {
  const r = routerFromEnv({ ...ALL_KEYS }, { profile: 'free' });
  assert.deepEqual(r.chain, ['groq', 'gemini', 'openrouter']);
  assert.ok(!r.chain.includes('meta') && !r.chain.includes('aiml'));
});

test('default profile is demo and meta is first when its key is set', () => {
  const r = routerFromEnv({ MODEL_API_KEY: KEY, GROQ_API_KEY: KEY });
  assert.equal(r.profile, 'demo');
  assert.deepEqual(r.chain, ['meta', 'groq']);
  assert.equal(r.provider, 'meta');
  assert.equal(r.model, 'muse-spark-1.3');
});

test('unconfigured providers are skipped; no keys means not available', async () => {
  const r = routerFromEnv({ GEMINI_API_KEY: KEY }, { profile: 'demo' });
  assert.deepEqual(r.chain, ['gemini']);
  assert.equal(r.provider, 'gemini');
  assert.equal(r.model, 'gemini-flash-lite-latest');
  const none = routerFromEnv({}, { profile: 'demo' });
  assert.equal(none.available, false);
  await assert.rejects(none.chat({ agent: 'x', messages: MSG }), (e) => e.code === 'MODEL_UNAVAILABLE');
});

test('an empty key counts as not configured', () => {
  assert.deepEqual(routerFromEnv({ GROQ_API_KEY: '   ', GEMINI_API_KEY: KEY }, { profile: 'free' }).chain, ['gemini']);
});

test('MODEL_PROVIDER pins one provider and overrides the profile', () => {
  const r = routerFromEnv({ ...ALL_KEYS, MODEL_PROVIDER: 'gemini' }, { profile: 'demo' });
  assert.deepEqual(r.chain, ['gemini']);
  assert.equal(r.profile, 'pin:gemini');
});

test('unknown MODEL_PROFILE and unknown MODEL_PROVIDER fail with MODEL_CONFIG', () => {
  assert.throws(() => routerFromEnv({}, { profile: 'nope' }), (e) => e.code === 'MODEL_CONFIG');
  assert.throws(() => routerFromEnv({ MODEL_PROVIDER: 'nope' }, {}), (e) => e.code === 'MODEL_CONFIG');
});

test('429 on the first provider falls back to the second, with the right events', async () => {
  // Injected providers reuse the real profile names (meta, groq) so the demo profile order applies.
  await withMocks({
    a: () => err(429, 'slow down', { 'retry-after': '0' }),
    b: () => ok('from b'),
  }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const calls = [];
    const falls = [];
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY }, onCall: (c) => calls.push(c), onFallback: (f) => falls.push(f) });
    assert.deepEqual(r.chain, ['meta', 'groq']);
    const res = await r.chat({ agent: 'goal', messages: MSG });
    assert.equal(res.text, 'from b');
    assert.equal(res.provider, 'groq');
    assert.equal(res.model, 'groq-fast');
    assert.deepEqual(falls, [{ agent: 'goal', from: 'meta:meta-fast', to: 'groq:groq-fast', reason: 'MODEL_HTTP_429' }]);
    assert.deepEqual(calls.map((c) => [c.provider, c.model, c.ok, c.error ?? null]), [
      ['meta', 'meta-fast', false, 'MODEL_HTTP_429'],
      ['groq', 'groq-fast', true, null],
    ]);
  });
});

test('5xx falls back too', async () => {
  await withMocks({ a: () => err(503), b: () => ok('fine') }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const falls = [];
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY }, onFallback: (f) => falls.push(f) });
    assert.equal((await r.chat({ agent: 'x', messages: MSG })).provider, 'groq');
    assert.equal(falls[0].reason, 'MODEL_HTTP_503');
  });
});

test('400 with a jsonSchema falls back (schema unsupported)', async () => {
  await withMocks({ a: () => err(400), b: () => ok('{"ok":true}') }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const falls = [];
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY }, onFallback: (f) => falls.push(f) });
    const res = await r.chat({ agent: 'x', messages: MSG, jsonSchema: { name: 'ok', schema: { type: 'object' } } });
    assert.equal(res.provider, 'groq');
    assert.equal(falls[0].reason, 'MODEL_HTTP_400');
  });
});

test('400 without a schema or tools does NOT fall back; the error is thrown', async () => {
  await withMocks({ a: () => err(400), b: () => ok('should not be reached') }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const falls = [];
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY }, onFallback: (f) => falls.push(f) });
    await assert.rejects(r.chat({ agent: 'x', messages: MSG }), (e) => e.code === 'MODEL_HTTP_400');
    assert.equal(b.requests.length, 0);
    assert.equal(falls.length, 0);
  });
});

test('401 falls back with reason auth', async () => {
  await withMocks({ a: () => err(401), b: () => ok('ok') }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const falls = [];
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY }, onFallback: (f) => falls.push(f) });
    const res = await r.chat({ agent: 'x', messages: MSG });
    assert.equal(res.provider, 'groq');
    assert.equal(falls[0].reason, 'auth');
  });
});

test('a timeout falls back with MODEL_TIMEOUT', async () => {
  await withMocks({
    a: () => new Promise((resolve) => setTimeout(() => resolve(ok('late')), 1500)),
    b: () => ok('quick'),
  }, async ({ a, b }) => {
    const providers = {
      meta: prov('meta', a.url, { envKeys: ['A_KEY'], timeoutMs: 100 }),
      groq: prov('groq', b.url, { envKeys: ['B_KEY'] }),
    };
    const falls = [];
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY }, onFallback: (f) => falls.push(f) });
    assert.equal((await r.chat({ agent: 'x', messages: MSG })).text, 'quick');
    assert.equal(falls[0].reason, 'MODEL_TIMEOUT');
  });
});

test('all providers failing throws MODEL_ALL_FAILED listing provider:code', async () => {
  await withMocks({ a: () => err(429), b: () => err(503) }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const r = createRouter({ providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY } });
    await assert.rejects(r.chat({ agent: 'x', messages: MSG }), (e) => {
      assert.equal(e.code, 'MODEL_ALL_FAILED');
      assert.match(e.message, /meta:MODEL_HTTP_429/);
      assert.match(e.message, /groq:MODEL_HTTP_503/);
      return true;
    });
  });
});

test('budget: tokens exceeded throws MODEL_BUDGET before any call is made', async () => {
  await withMocks({ a: () => ok('big', { prompt_tokens: 100, completion_tokens: 60, total_tokens: 160 }) }, async ({ a }) => {
    const providers = { groq: prov('groq', a.url, { envKeys: ['A_KEY'] }) };
    const r = createRouter({ providers, profile: 'free', env: { A_KEY: KEY }, budget: { maxTokens: 100, maxUsd: 1 } });
    await r.chat({ agent: 'x', messages: MSG });
    assert.equal(a.requests.length, 1);
    await assert.rejects(r.chat({ agent: 'x', messages: MSG }), (e) => e.code === 'MODEL_BUDGET');
    assert.equal(a.requests.length, 1, 'no second HTTP call after the budget is spent');
    assert.equal(r.spent().tokens, 160);
  });
});

test('USD is counted only for the priced provider; free tokens do not add USD', async () => {
  await withMocks({
    a: () => ok('free', { prompt_tokens: 5000, completion_tokens: 5000, total_tokens: 10000 }),
    b: () => ok('paid', { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }),
  }, async ({ a, b }) => {
    const providers = {
      groq: prov('groq', a.url, { envKeys: ['A_KEY'] }),
      meta: prov('meta', b.url, { envKeys: ['B_KEY'], price: { inPerM: 1.25, outPerM: 4.25 } }),
    };
    const free = createRouter({ providers, profile: 'free', env: { A_KEY: KEY, B_KEY: KEY }, budget: { maxTokens: 1e9, maxUsd: 1 } });
    await free.chat({ agent: 'x', messages: MSG });
    assert.equal(free.spent().usd, 0);
    assert.equal(free.spent().tokens, 10000);
    // 'free' has no meta; pin meta to exercise the priced path
    const pinned = createRouter({ providers, profile: 'free', env: { A_KEY: KEY, B_KEY: KEY, MODEL_PROVIDER: 'meta' }, budget: { maxTokens: 1e9, maxUsd: 1 } });
    await pinned.chat({ agent: 'x', messages: MSG });
    const s = pinned.spent();
    assert.ok(Math.abs(s.usd - 0.003375) < 1e-9, `usd was ${s.usd}`);
    assert.equal(s.byProvider.meta.tokens, 1500);
    assert.equal(s.byProvider.meta.usd, s.usd);
    assert.equal(s.byProvider.groq, undefined);
  });
});

test('budget: USD limit reached throws MODEL_BUDGET', async () => {
  await withMocks({ b: () => ok('paid', { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }) }, async ({ b }) => {
    const providers = { meta: prov('meta', b.url, { envKeys: ['B_KEY'], price: { inPerM: 1.25, outPerM: 4.25 } }) };
    const r = createRouter({ providers, profile: 'meta', env: { B_KEY: KEY }, budget: { maxTokens: 1e9, maxUsd: 0.001 } });
    await r.chat({ agent: 'x', messages: MSG });
    await assert.rejects(r.chat({ agent: 'x', messages: MSG }), (e) => e.code === 'MODEL_BUDGET');
    assert.equal(b.requests.length, 1);
  });
});

test('budgetFromEnv: defaults and overrides', () => {
  assert.deepEqual(budgetFromEnv({}), { maxTokens: 200000, maxUsd: 0.5 });
  assert.deepEqual(budgetFromEnv({ MODEL_RUN_MAX_TOKENS: '5000', MODEL_RUN_MAX_USD: '0.1' }), { maxTokens: 5000, maxUsd: 0.1 });
  assert.deepEqual(budgetFromEnv({ MODEL_RUN_MAX_TOKENS: 'abc' }), { maxTokens: 200000, maxUsd: 0.5 });
});

test('reasoning_effort is sent to meta only, never to other providers', async () => {
  await withMocks({ a: () => ok('m'), b: () => ok('g') }, async ({ a, b }) => {
    const providers = {
      meta: prov('meta', a.url, { envKeys: ['A_KEY'], sendReasoningEffort: true, reasoningEffort: 'low' }),
      groq: prov('groq', b.url, { envKeys: ['B_KEY'], sendReasoningEffort: false }),
    };
    const env = { A_KEY: KEY, B_KEY: KEY };
    const r = createRouter({ providers, profile: 'demo', env });
    await r.chat({ agent: 'x', messages: MSG });
    assert.equal(a.requests[0].body.reasoning_effort, 'low');
    const g = createRouter({ providers, profile: 'free', env: { B_KEY: KEY } });
    await g.chat({ agent: 'x', messages: MSG, reasoningEffort: 'high' });
    assert.equal(b.requests.length, 1);
    assert.equal('reasoning_effort' in b.requests[0].body, false);
  });
});

test('quality strong selects the strong model id', async () => {
  await withMocks({ a: () => ok('s') }, async ({ a }) => {
    const providers = { groq: prov('groq', a.url, { envKeys: ['A_KEY'] }) };
    const r = createRouter({ providers, profile: 'free', env: { A_KEY: KEY } });
    const res = await r.chat({ agent: 'x', messages: MSG, quality: 'strong' });
    assert.equal(a.requests[0].body.model, 'groq-strong');
    assert.equal(res.model, 'groq-strong');
  });
});

test('MODEL_META_CONTRIBUTOR=1 switches meta to the contributor model; off by default', () => {
  assert.equal(routerFromEnv({ MODEL_API_KEY: KEY }, { profile: 'meta' }).model, 'muse-spark-1.3');
  assert.equal(routerFromEnv({ MODEL_API_KEY: KEY, MODEL_META_CONTRIBUTOR: '1' }, { profile: 'meta' }).model, 'muse-spark-1.3-contributor');
});

test('the key never appears in a thrown message or in any event', async () => {
  const events = [];
  await withMocks({
    // The server echoes the key back in its error body; createModel must redact it.
    a: () => err(401, `bad key ${KEY}`),
    b: () => err(429, `echo ${KEY}`),
  }, async ({ a, b }) => {
    const providers = { meta: prov('meta', a.url, { envKeys: ['A_KEY'] }), groq: prov('groq', b.url, { envKeys: ['B_KEY'] }) };
    const r = createRouter({
      providers, profile: 'demo', env: { A_KEY: KEY, B_KEY: KEY },
      onCall: (c) => events.push(c), onFallback: (f) => events.push(f),
    });
    let thrown = null;
    try { await r.chat({ agent: 'x', messages: MSG }); } catch (e) { thrown = e; }
    assert.ok(thrown);
    assert.equal(thrown.code, 'MODEL_ALL_FAILED');
    assert.ok(!thrown.message.includes(KEY));
    assert.ok(!JSON.stringify(events).includes(KEY));
    assert.ok(!JSON.stringify(r.spent()).includes(KEY));
  });
});

test('checkProviders: one row per configured provider, text and schema ok, no key in output', async () => {
  await withMocks({
    a: ({ body }) => (body.response_format ? ok('{"ok":true}') : ok('ready')),
  }, async ({ a }) => {
    const providers = {
      meta: prov('meta', a.url, { envKeys: ['A_KEY'], sendReasoningEffort: true, reasoningEffort: 'low' }),
      groq: prov('groq', a.url, { envKeys: ['NOPE_KEY'] }),
    };
    const rows = await checkProviders({ A_KEY: KEY }, { providers });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].provider, 'meta');
    assert.equal(rows[0].model, 'meta-fast');
    assert.equal(rows[0].text, 'ok');
    assert.equal(rows[0].schema, 'ok');
    assert.equal(typeof rows[0].ms, 'number');
    assert.ok(!JSON.stringify(rows).includes(KEY));
    const textCall = a.requests[0].body;
    assert.equal(textCall.max_tokens, 400);
    assert.equal(textCall.reasoning_effort, 'low');
  });
});

test('checkProviders reports error codes per check, not exceptions', async () => {
  await withMocks({ a: () => err(401) }, async ({ a }) => {
    const providers = { groq: prov('groq', a.url, { envKeys: ['A_KEY'] }) };
    const rows = await checkProviders({ A_KEY: KEY }, { providers });
    assert.deepEqual([rows[0].text, rows[0].schema], ['MODEL_HTTP_401', 'MODEL_HTTP_401']);
  });
});
