// Meta Model API client (OpenAI-compatible Chat Completions). Global fetch, no SDK.
// Contract: engine/AGENTS-SPEC.md section 1. Rule: the model proposes, code decides.
//
// SECURITY: the API key must never appear in a thrown error message, an onCall payload,
// or any returned value. Error text from the server is redacted (Bearer tokens and the
// key itself) and truncated to 200 characters.

const PROVIDER = 'meta-model-api';
const RETRY_AFTER_CAP_MS = 10000;
const BACKOFF_CAP_MS = 4000;

class ModelError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    Object.assign(this, extra);
  }
}

function modelError(code, message, extra = {}) {
  return new ModelError(code, message, extra);
}

function redact(text, apiKey) {
  let s = String(text ?? '');
  s = s.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  if (apiKey) s = s.split(apiKey).join('[redacted]');
  return s.slice(0, 200);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt) {
  const base = Math.min(500 * 2 ** attempt, BACKOFF_CAP_MS);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(base + jitter, BACKOFF_CAP_MS);
}

function parseRetryAfter(value) {
  if (value == null) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1000, RETRY_AFTER_CAP_MS);
}

function stripFences(text) {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : trimmed;
}

export function modelFromEnv(env = process.env, opts = {}) {
  return createModel({
    apiKey: env.MODEL_API_KEY || env.LLAMA_API_KEY || undefined,
    baseUrl: env.MODEL_BASE_URL || undefined,
    model: env.MODEL_NAME || undefined,
    ...opts,
  });
}

export function createModel({
  apiKey,
  baseUrl = 'https://api.meta.ai/v1',
  model = 'muse-spark-1.3',
  timeoutMs = 45000,
  maxRetries = 2,
  fetchImpl = fetch,
  onCall = () => {},
} = {}) {
  const base = String(baseUrl).replace(/\/+$/, '');
  const available = !!apiKey;

  function report(agent, data) {
    try {
      onCall({ agent, provider: PROVIDER, model, ...data });
    } catch {
      // A broken observer must never break a model call.
    }
  }

  async function attemptOnce(payload) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const raw = await res.text();
      if (!res.ok) {
        const snippet = redact(raw, apiKey);
        const retryable = res.status === 429 || res.status >= 500;
        throw modelError(
          `MODEL_HTTP_${res.status}`,
          `Model API request failed with HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`,
          { status: res.status, retryable, retryAfterMs: parseRetryAfter(res.headers?.get?.('retry-after')) },
        );
      }
      return raw;
    } catch (err) {
      if (timedOut) {
        throw modelError('MODEL_TIMEOUT', `Model API did not answer within ${timeoutMs} ms`);
      }
      if (err instanceof ModelError) throw err;
      throw modelError('MODEL_NETWORK', `Model API network error: ${redact(err?.message, apiKey)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  function parseReply(raw, jsonSchema) {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw modelError('MODEL_BAD_JSON', 'Model API returned a body that is not JSON');
    }
    const choice = Array.isArray(body?.choices) ? body.choices[0] : undefined;
    const message = choice?.message;
    if (!message) throw modelError('MODEL_EMPTY', 'Model API returned no choices');

    const text = message.content ?? '';
    const toolCalls = (message.tool_calls ?? []).map((tc) => {
      let args;
      try {
        args = typeof tc.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : (tc.function?.arguments ?? {});
      } catch {
        throw modelError('MODEL_BAD_JSON', `Tool call arguments for ${tc.function?.name} are not valid JSON`);
      }
      return { id: tc.id, name: tc.function?.name, args };
    });

    let json = null;
    if (jsonSchema) {
      try {
        json = JSON.parse(stripFences(text));
      } catch {
        throw modelError('MODEL_BAD_JSON', `Model reply is not valid JSON for schema ${jsonSchema.name}`);
      }
    }

    const u = body.usage;
    const usage = u
      ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 }
      : null;

    return { text, json, toolCalls, usage, message };
  }

  async function chat({
    agent,
    messages,
    tools,
    jsonSchema,
    temperature = 0.2,
    maxTokens = 1500,
  } = {}) {
    if (!available) {
      throw modelError('MODEL_UNAVAILABLE', 'No model API key is configured (set MODEL_API_KEY)');
    }

    const payload = { model, messages, temperature, max_tokens: maxTokens };
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }
    if (jsonSchema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: { name: jsonSchema.name, schema: jsonSchema.schema },
      };
    }

    const started = Date.now();
    for (let attempt = 0; ; attempt++) {
      const callStart = Date.now();
      try {
        const raw = await attemptOnce(payload);
        const result = parseReply(raw, jsonSchema);
        report(agent, { ok: true, ms: Date.now() - callStart, usage: result.usage, error: null });
        return { ...result, ms: Date.now() - started };
      } catch (err) {
        const code = err.code || 'MODEL_ERROR';
        report(agent, { ok: false, ms: Date.now() - callStart, usage: null, error: code });
        if (err.retryable && attempt < maxRetries) {
          const wait = err.retryAfterMs ?? backoffMs(attempt);
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
  }

  return { available, provider: PROVIDER, model, baseUrl: base, chat };
}
