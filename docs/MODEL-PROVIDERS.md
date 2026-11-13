# Model providers and routing

Code: `engine/providers.mjs`. Tests: `tests/unit/providers.test.mjs` (`node --test tests/unit/providers.test.mjs`).
The router reuses `engine/model.mjs` `createModel` for every provider. It adds fallback, a per-run budget, and provider names on events.

Verified by listing each provider's `/models` on 13 Nov 2026. Prices for Meta come from Meta's docs (13 Nov 2026). AIML price is unknown, so it counts toward tokens only.

## Providers

| Name | Base URL | Env key | Tier | Fast model | Strong model | Price per 1M in / out (USD) |
|---|---|---|---|---|---|---|
| `groq` | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | free | `openai/gpt-oss-20b` | `openai/gpt-oss-120b` | free tier |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta/openai` | `GEMINI_API_KEY` | free | `gemini-flash-lite-latest` | `gemini-flash-latest` | free tier |
| `openrouter` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | free | `openrouter/free` | `openrouter/free` | free models |
| `huggingface` | `https://router.huggingface.co/v1` | `HF_TOKEN` | free | `meta-llama/Llama-3.3-70B-Instruct` | same | free tier |
| `aiml` | `https://api.aimlapi.com/v1` | `AIML_API_KEY` | paid | `google/gemini-3.5-flash-lite` | `deepseek/deepseek-chat` | unknown (null) |
| `meta` | `https://api.meta.ai/v1` | `MODEL_API_KEY` (alias `LLAMA_API_KEY`) | paid | `muse-spark-1.3` | `muse-spark-1.3` | 1.25 / 4.25 |

A provider is "configured" only when its env key is non-empty. Unconfigured providers are skipped.

`reasoning_effort` is sent only to `meta`. Every other provider gets no such field.

## Profiles (`MODEL_PROFILE`, default `demo`)

| Profile | Order | Use |
|---|---|---|
| `free` | groq, gemini, openrouter, huggingface | tests and dev. Never paid. |
| `cheap` | groq, gemini, openrouter, aiml, meta | low-cost runs |
| `demo` | meta, groq, gemini, openrouter | best quality first, free fallbacks |
| `meta` | meta | Meta only |

`MODEL_PROVIDER=<name>` pins one provider and overrides the profile.

An agent asks for tier `fast` (default) or `strong` with `chat({..., quality: 'strong'})`.

## Fallback

On a retryable failure the router tries the next configured provider in the profile and calls `onFallback({agent, from, to, reason})`.

- Falls back: `MODEL_HTTP_429`, `MODEL_HTTP_5xx`, `MODEL_TIMEOUT`, `MODEL_NETWORK`, `MODEL_EMPTY`, `MODEL_BAD_JSON`, and `MODEL_HTTP_400` only when a `jsonSchema` or `tools` was sent.
- Falls back with reason `auth`: `MODEL_HTTP_401`, `MODEL_HTTP_403`.
- Other errors are thrown at once.
- When every provider fails, the router throws `MODEL_ALL_FAILED` with a message listing `provider:code`.

Per-provider retries are off (`maxRetries: 0`) so the fallback happens at once.

## Budget (per run)

| Env | Default | Meaning |
|---|---|---|
| `MODEL_RUN_MAX_TOKENS` | 200000 | total tokens across all providers in the run |
| `MODEL_RUN_MAX_USD` | 0.5 | USD spend, counted only for priced providers (meta) |

Before each call, if spent tokens or spent USD have reached the limit, the router throws `MODEL_BUDGET` without making a call. `MODEL_RUN_MAX_USD=0` blocks every call. Use it as a kill switch.

Spend is counted from the usage of successful calls only. A call that fails before a usage report adds nothing. `router.spent()` returns `{ tokens, usd, byProvider }`.

## Contributor mode (privacy, opt-in)

`MODEL_META_CONTRIBUTOR=1` switches `meta` to `muse-spark-1.3-contributor` at $0.10 / $0.20 per 1M tokens.

Meta may use the content of these calls for training. Use this mode only with synthetic data. It is OFF by default.

## Checking the live providers

`checkProviders(env)` makes one tiny text call (`Reply with exactly: ready`, maxTokens 400) and one tiny `json_schema` call to each configured provider. It returns `[{provider, model, text, schema, ms}]`, where `text` and `schema` are `ok` or an error code. It never returns a key.

## Security

- Keys are read from env and passed only to `createModel`. They are never logged, never returned, and never put in an error or event.
- Router errors use codes and plain messages. Server bodies are not copied into router errors.
- `createModel` redacts the key and `Bearer` tokens from server text (see `engine/model.mjs`).
