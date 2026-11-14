import { describe, expect, it } from 'vitest';
import { qrMatrix } from './QrCode';

describe('qrMatrix', () => {
  it('is a square matrix with a finder pattern in the top-left corner', () => {
    const m = qrMatrix('https://portal.example/join');
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((r) => r.length === m.length)).toBe(true);
    expect(m[0]!.slice(0, 7).every(Boolean)).toBe(true);
    expect(m[1]![1]).toBe(false);
    expect(m[2]![2]).toBe(true);
  });
  it('is deterministic for the same text and different for another', () => {
    expect(qrMatrix('https://a.example')).toEqual(qrMatrix('https://a.example'));
    expect(qrMatrix('https://a.example')).not.toEqual(qrMatrix('https://b.example'));
  });
});
