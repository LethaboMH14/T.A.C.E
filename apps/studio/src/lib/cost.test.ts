import { describe, expect, it } from 'vitest';
import { formatUsd, priceOf, sumUsd, usd } from './cost';

describe('usd', () => {
  it('prices Meta calls per 1M tokens from the providers.mjs table', () => {
    // 2,123 prompt tokens at 1.25/M and 1,919 completion tokens at 4.25/M
    expect(usd('meta', 2123, 1919)).toBeCloseTo((2123 * 1.25 + 1919 * 4.25) / 1e6, 12);
  });

  it('accepts the meta-model-api label used by older ledgers', () => {
    expect(usd('meta-model-api', 1000000, 0)).toBe(1.25);
  });

  it('returns null when no price is published', () => {
    expect(usd('groq', 100, 100)).toBeNull();
    expect(usd('gemini', 100, 100)).toBeNull();
  });

  it('returns null for an unknown provider and for a missing split', () => {
    expect(usd('nope', 1, 1)).toBeNull();
    expect(usd('meta', null, 10)).toBeNull();
    expect(usd('meta', undefined, undefined)).toBeNull();
  });

  it('exposes no price for providers without one', () => {
    expect(priceOf(null)).toBeNull();
    expect(priceOf('meta')).toEqual({ inPerM: 1.25, outPerM: 4.25 });
  });
});

describe('sumUsd and formatUsd', () => {
  it('sums priced calls and counts the rest as unpriced', () => {
    const s = sumUsd([
      { provider: 'meta', prompt: 1000000, completion: 0 },
      { provider: 'groq', prompt: 5, completion: 5 },
    ]);
    expect(s).toEqual({ usd: 1.25, unpriced: 1 });
    expect(formatUsd(s, 2)).toBe('$1.25 (partial)');
  });

  it('says tokens only when nothing could be priced', () => {
    const s = sumUsd([{ provider: 'groq', prompt: 5, completion: 5 }]);
    expect(formatUsd(s, 1)).toBe('tokens only');
    expect(formatUsd(sumUsd([]), 0)).toBe('-');
  });
});
