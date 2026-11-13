// USD cost of model calls. Prices are copied from engine/providers.mjs (PROVIDERS[*].price), per 1M tokens.
// Source: engine/providers.mjs; Meta docs, 13 Nov 2026.
// null = no price published for that provider. Such calls count as tokens only. Nothing is guessed.

export interface Price {
  inPerM: number;
  outPerM: number;
}

export const PRICES: Record<string, Price | null> = {
  groq: null,
  gemini: null,
  openrouter: null,
  huggingface: null,
  aiml: null,
  meta: { inPerM: 1.25, outPerM: 4.25 },
};

// engine/model.mjs labels the Meta client 'meta-model-api' in some ledgers. It is the same provider as PRICES.meta.
const PROVIDER_ALIAS: Record<string, string> = { 'meta-model-api': 'meta' };

export function priceOf(provider: string | null | undefined): Price | null {
  if (!provider) return null;
  const key = PROVIDER_ALIAS[provider] ?? provider;
  return Object.hasOwn(PRICES, key) ? (PRICES[key] ?? null) : null;
}

const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/**
 * USD for one call. Needs the prompt/completion split from the MODEL_CALL usage.
 * Returns null when the provider has no published price or the split is missing (totals alone are not enough).
 */
export function usd(
  provider: string | null | undefined,
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined,
): number | null {
  const p = priceOf(provider);
  if (!p || !isCount(promptTokens) || !isCount(completionTokens)) return null;
  return (promptTokens * p.inPerM + completionTokens * p.outPerM) / 1e6;
}

export interface PricedCall {
  provider: string | null;
  prompt: number | null;
  completion: number | null;
}

/**
 * Sum over calls. usd is null when no call could be priced. `unpriced` counts calls that could not be priced,
 * so the UI can say "partial" instead of showing a total that looks complete.
 */
export function sumUsd(calls: PricedCall[]): { usd: number | null; unpriced: number } {
  let total = 0;
  let priced = 0;
  for (const c of calls) {
    const v = usd(c.provider, c.prompt, c.completion);
    if (v === null) continue;
    total += v;
    priced += 1;
  }
  return { usd: priced ? total : null, unpriced: calls.length - priced };
}

/** Plain-text USD for the UI. "tokens only" when no call could be priced. */
export function formatUsd(s: { usd: number | null; unpriced: number }, calls: number): string {
  if (s.usd === null) return calls ? 'tokens only' : '-';
  const text = `$${s.usd.toFixed(s.usd < 0.01 ? 4 : 2)}`;
  return s.unpriced > 0 ? `${text} (partial)` : text;
}
