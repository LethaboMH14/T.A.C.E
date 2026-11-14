import { describe, expect, it } from 'vitest';
import { cellsFromWindows, nextSkill, pickVoice, recognitionLang, scoreBar, windowsFromCells, minutesBetween, pinValid } from './helpers';

describe('availability windows', () => {
  it('merges adjacent hours into one window per run, Mon to Fri', () => {
    const cells = new Set(['Thu|14', 'Thu|15', 'Thu|16', 'Mon|8', 'Mon|10']);
    expect(windowsFromCells(cells)).toEqual([
      { day: 'Mon', start: '08:00', end: '09:00' },
      { day: 'Mon', start: '10:00', end: '11:00' },
      { day: 'Thu', start: '14:00', end: '17:00' },
    ]);
  });

  it('round-trips windows from the database, including Postgres seconds', () => {
    const cells = cellsFromWindows([{ day: 'Thu', start: '14:00:00', end: '16:00:00' }]);
    expect([...cells].sort()).toEqual(['Thu|14', 'Thu|15']);
    expect(windowsFromCells(cells)).toEqual([{ day: 'Thu', start: '14:00', end: '16:00' }]);
  });

  it('ignores windows outside the Mon-Fri, 08:00-17:00 grid', () => {
    expect(cellsFromWindows([{ day: 'Sat', start: '09:00', end: '10:00' }, { day: 'Mon', start: '17:00', end: '18:00' }]).size).toBe(0);
  });
});

describe('score bar', () => {
  it('fills to the score and marks the threshold', () => {
    expect(scoreBar(72, 60)).toEqual({ fill: 72, markAt: 60, status: 'ok' });
    expect(scoreBar(41, 60).status).toBe('bad');
    expect(scoreBar(60, 60).status).toBe('ok');
  });
  it('clamps out-of-range values and reports no score', () => {
    expect(scoreBar(130, 60).fill).toBe(100);
    expect(scoreBar(null, 60)).toEqual({ fill: 0, markAt: 60, status: 'none' });
  });
});

describe('small helpers', () => {
  it('never reports less than one minute', () => {
    expect(minutesBetween(0, 10_000)).toBe(1);
    expect(minutesBetween(0, 7 * 60_000 + 20_000)).toBe(7);
  });
  it('validates PINs as 4 to 8 digits', () => {
    expect(pinValid('2468')).toBe(true);
    expect(pinValid('123')).toBe(false);
    expect(pinValid('12a4')).toBe(false);
  });
  it('picks a voice only when the language tag matches', () => {
    const voices = [{ lang: 'en-ZA', name: 'a' }, { lang: 'af_ZA', name: 'b' }];
    expect(pickVoice(voices, 'af')?.name).toBe('b');
    expect(pickVoice(voices, 'zu')).toBeNull();
  });
});

describe('speech language tags', () => {
  it('maps each supported language to a South African tag and falls back to en-ZA', () => {
    expect(recognitionLang('zu')).toBe('zu-ZA');
    expect(recognitionLang('nso')).toBe('nso-ZA');
    expect(recognitionLang('xx')).toBe('en-ZA');
    expect(recognitionLang(undefined)).toBe('en-ZA');
  });
});

describe('next skill', () => {
  it('picks an unscored skill first, otherwise the largest gap below the pass mark', () => {
    expect(nextSkill([{ id: 'S1', threshold: 60, latest: { score: 80 } }, { id: 'S2', threshold: 60, latest: null }])?.id).toBe('S2');
    expect(nextSkill([{ id: 'S1', threshold: 60, latest: { score: 58 } }, { id: 'S2', threshold: 60, latest: { score: 40 } }])?.id).toBe('S2');
    expect(nextSkill([])).toBeNull();
  });
});
