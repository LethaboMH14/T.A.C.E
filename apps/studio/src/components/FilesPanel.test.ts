import { describe, expect, it } from 'vitest';
import { failedFileNames, isVerifiedLatest, sortFileNames, verifiedSeq } from './FilesPanel';

const check = (id: string, round: number, seq: number, artifact: string) => ({
  id,
  round,
  seq,
  artifact,
  title: id,
  kind: 'csv',
  status: 'PASS' as const,
  expected: null,
  observed: null,
  evidence: [],
  message: '',
});

describe('verifiedSeq and the verified-version rule', () => {
  it('is null before the mission passes', () => {
    expect(verifiedSeq({ passed: null, checks: {} })).toBeNull();
  });

  it('uses the smallest seq of the passing round, ignoring earlier rounds', () => {
    const seq = verifiedSeq({
      passed: { round: 2, passed: 2, total: 2 },
      checks: {
        C04: check('C04', 1, 40, 'mentor-schedule.csv@v1'),
        C05: check('C05', 2, 70, 'mentor-schedule.csv@v2'),
        C06: check('C06', 2, 72, 'gap-analysis.csv@v1'),
      },
    });
    expect(seq).toBe(70);
  });

  it('marks the latest version verified only when it was written before the passing checks', () => {
    expect(isVerifiedLatest('mentor-schedule.csv', 60, 70)).toBe(true);
    expect(isVerifiedLatest('mentor-schedule.csv', 75, 70)).toBe(false);
    expect(isVerifiedLatest('mentor-schedule.csv', 60, null)).toBe(false);
  });

  it('never marks record files as verified deliverables', () => {
    expect(isVerifiedLatest('repair-history.json', 1, 70)).toBe(false);
    expect(isVerifiedLatest('final-manifest.json', 1, 70)).toBe(false);
  });
});

describe('failedFileNames', () => {
  it('collects the base file names targeted by failing checks', () => {
    const names = failedFileNames({
      rounds: [{ round: 1, failed: ['C04'], messages: [], checks: [] }],
      checks: { C04: check('C04', 1, 40, 'mentor-schedule.csv@v1') },
    });
    expect([...names]).toEqual(['mentor-schedule.csv']);
  });
});

describe('sortFileNames', () => {
  it('follows the web ORDER and puts unknown names last, by name', () => {
    expect(sortFileNames(['zeta.txt', 'final-manifest.json', 'gap-analysis.csv', 'alpha.txt'])).toEqual([
      'gap-analysis.csv',
      'final-manifest.json',
      'alpha.txt',
      'zeta.txt',
    ]);
  });
});
