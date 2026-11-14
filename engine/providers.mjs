// Model provider router. Several OpenAI-compatible providers behind the same chat() interface as
// engine/model.mjs. It reuses createModel per provider (no rewrite), falls back on retryable
// failures, and keeps a per-run token and USD budget.
//
// SECURITY: keys are read from env and passed only to createModel. They are never returned, logged,
// or put in an error message or event. Router errors carry a code and a plain message built from
// codes only. Model ids and prices were verified by listing each provider's /models on 13 Nov 2026
// (see docs/MODEL-PROVIDERS.md).
import { createModel } from './model.mjs';

// Price per 1M tokens in USD. null = unknown, so the call counts toward tokens only.
export const PROVIDERS = {
  groq: {
    name: 'groq', baseUrl: 'https://api.groq.com/openai/v1', envKeys: ['GROQ_API_KEY'], tier: 'free',
    models: { fast: 'openai/gpt-oss-20b', strong: 'openai/gpt-oss-120b' }, price: null, sendReasoningEffort: false,
  },
  gemini: {
    name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', envKeys: ['GEMINI_API_KEY'], tier: 'free',
    models: { fast: 'gemini-flash-lite-latest', strong: 'gemini-flash-latest' }, price: null, sendReasoningEffort: false,
  },
  openrouter: {
    name: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', envKeys: ['OPENROUTER_API_KEY'], tier: 'free',
    models: { fast: 'openrouter/free', strong: 'openrouter/free' }, price: null, sendReasoningEffort: false,
  },
  huggingface: {
    name: 'huggingface', baseUrl: 'https://router.huggingface.co/v1', envKeys: ['HF_TOKEN'], tier: 'free',
    models: { fast: 'meta-llama/Llama-3.3-70B-Instruct', strong: 'meta-llama/Llama-3.3-70B-Instruct' }, price: null, sendReasoningEffort: false,
  },
  aiml: {
    name: 'aiml', baseUrl: 'https://api.aimlapi.com/v1', envKeys: ['AIML_API_KEY'], tier: 'paid',
    models: { fast: 'google/gemini-3.5-flash-lite', strong: 'deepseek/deepseek-chat' }, price: null, sendReasoningEffort: false,
  },
  meta: {
    name: 'meta', baseUrl: 'https://api.meta.ai/v1', envKeys: ['MODEL_API_KEY', 'LLAMA_API_KEY'], tier: 'paid',
    models: { fast: 'muse-spark-1.3', strong: 'muse-spark-1.3' },
    price: { inPerM: 1.25, outPerM: 4.25 },
    // Only Meta takes reasoning_effort. Other providers may reject it, so they never receive it.
    sendReasoningEffort: true, reasoningEffort: 'low',
  },
};

// Opt-in only (MODEL_META_CONTRIBUTOR=1). Cheaper, but Meta may train on the content. Synthetic data only.
export const META_CONTRIBUTOR = Object.freeze({
  models: Object.freeze({ fast: 'muse-spark-1.3-contributor', strong: 'muse-spark-1.3-contributor' }),
  price: Object.freeze({ inPerM: 0.10, outPerM: 0.20 }),
});

export const PROFILES = Object.freeze({
  // huggingface is registered but left out: the account has no Inference Providers credits (HTTP 402 on every model, 13 Nov).
  free: ['groq', 'gemini', 'openrouter'],
  cheap: ['groq', 'gemini', 'openrouter', 'aiml', 'meta'],
  demo: ['meta', 'groq', 'gemini', 'openrouter'],
  meta: ['meta'],
});

// 402 credits exhausted, 404/410 model retired, 408 timeout, 422 unsupported parameter: try the next provider (live, 13 Nov).
const RETRYABLE = /^MODEL_(HTTP_(402|404|408|410|422|429|5\d\d)|TIMEOUT|NETWORK|EMPTY|BAD_JSON)$/;

function fail(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function numOr(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Per-run budget from env. MODEL_RUN_MAX_USD=0 blocks every call (kill switch). */
export function budgetFromEnv(env = process.env) {
  return {
    maxTokens: numOr(env.MODEL_RUN_MAX_TOKENS, 200000),
    maxUsd: numOr(env.MODEL_RUN_MAX_USD, 0.5),
  };
}

/** First non-empty key among the provider's env names, or null (= not configured). */
export function keyFor(provider, env = process.env) {
  for (const name of provider.envKeys) {
    const v = env[name];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

/** Applies the contributor-mode opt-in to a copy of the registry. */
export function resolveProviders(env, providers) {
  if (env.MODEL_META_CONTRIBUTOR !== '1' || !providers.meta) return providers;
  return {
    ...providers,
    meta: { ...providers.meta, models: { ...META_CONTRIBUTOR.models }, price: { ...META_CONTRIBUTOR.price } },
  };
}

function classify(code, schemaSent) {
  if (code === 'MODEL_HTTP_401' || code === 'MODEL_HTTP_403') return { fallback: true, reason: 'auth' };
  if (RETRYABLE.test(code)) return { fallback: true, reason: code };
  // A 400 is only "the provider cannot do this feature" when we sent a schema or tools.
  if (code === 'MODEL_HTTP_400' && schemaSent) return { fallback: true, reason: code };
  return { fallback: false, reason: code };
}

function modelFor(provider, quality) {
  return quality === 'strong' ? provider.models.strong : provider.models.fast;
}

/**
 * Builds the router. Same chat() shape as createModel, plus `quality: 'fast' | 'strong'` (default fast).
 * Returns { available, provider, model, profile, chain, chat, spent }.
 * Tests inject `providers` (pointed at local mock servers) and `fetchImpl`.
 */
export function createRouter({
  providers = PROVIDERS,
  profile,
  env = process.env,
  onCall = () => {},
  onStart = () => {},
  onFallback = () => {},
  budget,
  fetchImpl = (...args) => fetch(...args),
  maxRetries = 0, // the router does the fallback; per-provider retries would only delay it
  timeoutMs = 45000,
} = {}) {
  const profileName = String(profile || env.MODEL_PROFILE || 'demo');
  if (!Object.hasOwn(PROFILES, profileName)) {
    throw fail('MODEL_CONFIG', `MODEL_PROFILE must be one of: ${Object.keys(PROFILES).join(', ')}`);
  }
  const pool = resolveProviders(env, providers);
  const pinned = String(env.MODEL_PROVIDER || '').trim();
  if (pinned && !Object.hasOwn(pool, pinned)) {
    throw fail('MODEL_CONFIG', `MODEL_PROVIDER must be one of: ${Object.keys(pool).join(', ')}`);
  }
  const order = pinned ? [pinned] : PROFILES[profileName];
  const chain = order.filter((n) => Object.hasOwn(pool, n) && keyFor(pool[n], env)).map((n) => pool[n]);
  const limits = { ...budgetFromEnv(env), ...(budget || {}) };

  const spentState = { tokens: 0, usd: 0, byProvider: {} };
  const clients = new Map();

  function clientFor(p, modelId) {
    const id = `${p.name}|${modelId}`;
    if (!clients.has(id)) {
      clients.set(id, createModel({
        apiKey: keyFor(p, env),
        baseUrl: p.baseUrl,
        model: modelId,
        timeoutMs: p.timeoutMs ?? timeoutMs,
        maxRetries,
        fetchImpl,
        reasoningEffort: null,
        onCall: (c) => onCall({ ...c, provider: p.name, model: modelId }),
      }));
    }
    return clients.get(id);
  }

  function checkBudget() {
    if (spentState.tokens >= limits.maxTokens) {
      throw fail('MODEL_BUDGET', `Run token budget used up (${spentState.tokens} of ${limits.maxTokens} tokens). Raise MODEL_RUN_MAX_TOKENS to continue.`);
    }
    if (spentState.usd >= limits.maxUsd) {
      throw fail('MODEL_BUDGET', `Run spend limit reached ($${spentState.usd.toFixed(4)} of $${limits.maxUsd}). Raise MODEL_RUN_MAX_USD to continue.`);
    }
  }

  function account(p, usage) {
    const tokens = usage?.total ?? 0;
    const row = (spentState.byProvider[p.name] ??= { tokens: 0, usd: 0 });
    spentState.tokens += tokens;
    row.tokens += tokens;
    if (p.price && usage) {
      const usd = ((usage.prompt ?? 0) * p.price.inPerM + (usage.completion ?? 0) * p.price.outPerM) / 1e6;
      spentState.usd += usd;
      row.usd += usd;
    }
  }

  async function chat(args = {}) {
    const { quality, reasoningEffort: wantEffort, agent, ...rest } = args;
    if (chain.length === 0) {
      throw fail('MODEL_UNAVAILABLE', 'No model provider is configured. Set a provider key (see docs/MODEL-PROVIDERS.md).');
    }
    const schemaSent = !!rest.jsonSchema || (Array.isArray(rest.tools) && rest.tools.length > 0);
    const failures = [];
    for (let i = 0; i < chain.length; i++) {
      const p = chain[i];
      const modelId = modelFor(p, quality);
      checkBudget();
      const effort = p.sendReasoningEffort ? (wantEffort ?? p.reasoningEffort ?? null) : null;
      try {
        onStart({ agent, provider: p.name, model: modelId });
        const res = await clientFor(p, modelId).chat({ agent, ...rest, reasoningEffort: effort });
        account(p, res.usage);
        return { ...res, provider: p.name, model: modelId };
      } catch (err) {
        const code = String(err?.code || 'MODEL_ERROR');
        failures.push(`${p.name}:${code}`);
        const verdict = classify(code, schemaSent);
        if (!verdict.fallback) throw err; // createModel already redacted this error
        const next = chain[i + 1];
        if (next) {
          onFallback({ agent, from: `${p.name}:${modelId}`, to: `${next.name}:${modelFor(next, quality)}`, reason: verdict.reason });
        }
      }
    }
    throw fail('MODEL_ALL_FAILED', `All model providers failed: ${failures.join(', ')}`, { failures });
  }

  const first = chain[0];
  return {
    available: chain.length > 0,
    provider: first ? first.name : null,
    model: first ? first.models.fast : null,
    profile: pinned ? `pin:${pinned}` : profileName,
    chain: chain.map((p) => p.name),
    chat,
    spent() {
      const byProvider = {};
      for (const k of Object.keys(spentState.byProvider).sort()) {
        const r = spentState.byProvider[k];
        byProvider[k] = { tokens: r.tokens, usd: Number(r.usd.toFixed(6)) };
      }
      return { tokens: spentState.tokens, usd: Number(spentState.usd.toFixed(6)), byProvider };
    },
  };
}

/** Router from env: MODEL_PROFILE (default demo), MODEL_PROVIDER (pin), MODEL_RUN_MAX_*, MODEL_META_CONTRIBUTOR. */
export function routerFromEnv(env = process.env, opts = {}) {
  return createRouter({ env, ...opts });
}

async function probe(fn) {
  try {
    return await fn();
  } catch (err) {
    return String(err?.code || 'MODEL_ERROR');
  }
}

/**
 * Live check of every configured provider: one tiny text call and one tiny json_schema call on the
 * fast model. Returns [{ provider, model, text, schema, ms }] where text/schema is 'ok' or an error code.
 * Keys are never included in the result.
 */
export async function checkProviders(env = process.env, { providers = PROVIDERS, fetchImpl = (...args) => fetch(...args), timeoutMs = 45000 } = {}) {
  const pool = resolveProviders(env, providers);
  const rows = [];
  for (const p of Object.values(pool)) {
    const key = keyFor(p, env);
    if (!key) continue;
    const model = p.models.fast;
    const client = createModel({
      apiKey: key, baseUrl: p.baseUrl, model, timeoutMs: p.timeoutMs ?? timeoutMs, maxRetries: 0, fetchImpl, reasoningEffort: null,
    });
    const effort = p.sendReasoningEffort ? p.reasoningEffort : null;
    const started = Date.now();
    const text = await probe(async () => {
      const r = await client.chat({
        agent: 'provider-check',
        messages: [{ role: 'user', content: 'Reply with exactly: ready' }],
        maxTokens: 400, temperature: 0, reasoningEffort: effort,
      });
      return /ready/i.test(r.text) ? 'ok' : 'MODEL_BAD_REPLY';
    });
    const schema = await probe(async () => {
      const r = await client.chat({
        agent: 'provider-check',
        messages: [{ role: 'user', content: 'Return the JSON object {"ok": true}.' }],
        jsonSchema: { name: 'ok', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } },
        maxTokens: 400, temperature: 0, reasoningEffort: effort,
      });
      return typeof r.json?.ok === 'boolean' ? 'ok' : 'MODEL_BAD_JSON';
    });
    rows.push({ provider: p.name, model, text, schema, ms: Date.now() - started });
  }
  return rows;
}
