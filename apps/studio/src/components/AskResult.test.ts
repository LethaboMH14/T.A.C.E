import { describe, expect, it } from 'vitest';
import { filesHash, parseCite } from './AskResult';

describe('parseCite', () => {
  it('splits a name@vN label', () => {
    expect(parseCite('gap-analysis.csv@v2')).toEqual({ label: 'gap-analysis.csv@v2', name: 'gap-analysis.csv', version: 2 });
  });
  it('rejects anything that is not name@vN', () => {
    expect(parseCite('gap-analysis.csv')).toBeNull();
    expect(parseCite('../secret@v1')).toBeNull();
    expect(parseCite('a.csv@1')).toBeNull();
  });
});

describe('filesHash', () => {
  it('points a cite at the run Files view', () => {
    expect(filesHash('custom-20261113-101010')).toBe('#/files/custom-20261113-101010');
  });
});
