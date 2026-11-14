import { DAYS, HOURS, LANGUAGES } from './constants';
import type { Window } from './types';

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const pad2 = (n: number) => String(n).padStart(2, '0');

// Accepts "14:00" or "14:00:00" (Postgres time) and returns the hour as a number, or null.
export function parseHour(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) : null;
}

// Hour cells (key "Mon|14") covered by availability windows, limited to the grid.
export function cellsFromWindows(windows: Window[]): Set<string> {
  const cells = new Set<string>();
  for (const w of windows) {
    const a = parseHour(w.start);
    const b = parseHour(w.end);
    if (a === null || b === null || !(DAYS as readonly string[]).includes(w.day)) continue;
    for (const h of HOURS) if (h >= a && h < b) cells.add(`${w.day}|${h}`);
  }
  return cells;
}

// Merge adjacent selected hours on each day into windows, Mon to Fri, earliest first.
export function windowsFromCells(cells: Set<string>): Window[] {
  const out: Window[] = [];
  for (const day of DAYS) {
    const hours = HOURS.filter((h) => cells.has(`${day}|${h}`));
    let i = 0;
    while (i < hours.length) {
      let j = i;
      while (j + 1 < hours.length && hours[j + 1] === hours[j] + 1) j++;
      out.push({ day, start: `${pad2(hours[i])}:00`, end: `${pad2(hours[j] + 1)}:00` });
      i = j + 1;
    }
  }
  return out;
}

export function toggleCell(cells: Set<string>, key: string): Set<string> {
  const next = new Set(cells);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

// Score bar math: fill width and the threshold marker, both as percentages of the bar.
export function scoreBar(score: number | null | undefined, threshold: number) {
  const t = clamp(threshold, 0, 100);
  if (score === null || score === undefined || Number.isNaN(score)) return { fill: 0, markAt: t, status: 'none' as const };
  const s = clamp(score, 0, 100);
  return { fill: s, markAt: t, status: s >= threshold ? ('ok' as const) : ('bad' as const) };
}

export const pinValid = (pin: string) => /^\d{4,8}$/.test(pin);

export const nameValid = (name: string) => {
  const n = name.trim();
  return n.length >= 1 && n.length <= 40;
};

// Real minutes on the clock, never less than one minute for a finished attempt.
export const minutesBetween = (startMs: number, endMs: number) => Math.max(1, Math.round((endMs - startMs) / 60000));

export const formatClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

export const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

// Pick a speech voice whose language tag starts with the language code, or null (show text instead).
export function pickVoice<T extends { lang: string }>(voices: T[], code: string): T | null {
  const want = code.toLowerCase();
  return voices.find((v) => v.lang.toLowerCase().replace('_', '-').split('-')[0] === want) ?? null;
}

export const shortTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const sourceLabel = (source: string) =>
  ({ quiz: 'quiz', self_reported: 'self-reported', baseline: 'baseline', seed: 'baseline' } as Record<string, string>)[source] ?? source;

// BCP 47 tag for speech recognition, from the person's language preference. Unknown codes fall back to en-ZA.
const RECOGNITION_TAGS: Record<string, string> = {
  en: 'en-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  af: 'af-ZA',
  st: 'st-ZA',
  tn: 'tn-ZA',
  nso: 'nso-ZA',
  ts: 'ts-ZA',
  ve: 've-ZA',
  ss: 'ss-ZA',
  nr: 'nr-ZA',
};
export const recognitionLang = (code: string | undefined): string => (code && RECOGNITION_TAGS[code]) || 'en-ZA';

// The skill that needs the most work next: no score yet first, then the lowest score relative to its pass mark.
export function nextSkill<T extends { id: string; threshold: number; latest: { score: number } | null }>(skills: T[]): T | null {
  if (skills.length === 0) return null;
  const gap = (s: T) => (s.latest ? s.latest.score - s.threshold : -Infinity);
  return [...skills].sort((a, b) => gap(a) - gap(b) || a.id.localeCompare(b.id))[0];
}
