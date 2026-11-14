// Deterministic, fully fictional synthetic cohort for the education-recovery fixture (v1).
// Every name is a placeholder ("Learner 01", "Mentor A") and every score is generated.
// Run as a script to write the real v1 files: node fixtures/education-recovery/generate.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AT_RISK_MIN_GAPS, LATE_LOGIN_DAY } from '../../domains/education/rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const BASE_SEED = 20261113;
export const TRAINEE_COUNT = 36;
export const MISSING_TOTAL = 6;
export const MISSING_IN_S3_MIN = 2;
export const AT_RISK_RANGE = Object.freeze([10, 14]);
export const S3_MIN_DIFF_TENTHS = 10; // 1.0 expressed in tenths, compared as integers
const THRESHOLD = 60;
const S3_INDEX = 2;

const SKILLS = [
  { skill_id: 'S1', name: 'Variables and types' },
  { skill_id: 'S2', name: 'Control flow' },
  { skill_id: 'S3', name: 'Functions' },
  { skill_id: 'S4', name: 'Data structures' },
  { skill_id: 'S5', name: 'Debugging' },
  { skill_id: 'S6', name: 'Git and version control' },
];

const MENTORS = [
  ['M-A', 'Mentor A', 'S1;S2;S3;S5', '6'],
  ['M-B', 'Mentor B', 'S2;S3;S4;S6', '6'],
  ['M-C', 'Mentor C', 'S1;S4;S5;S6', '6'],
];

const AVAILABILITY = [
  ['M-A', 'Mon', '09:00', '12:00'],
  ['M-A', 'Wed', '13:00', '16:00'],
  ['M-B', 'Tue', '09:00', '12:00'],
  ['M-B', 'Thu', '09:00', '12:00'],
  ['M-C', 'Mon', '13:00', '16:00'],
  ['M-C', 'Fri', '09:00', '12:00'],
];

const pad2 = (n) => String(n).padStart(2, '0');
const round1 = (x) => Math.round(x * 10) / 10;

/** mulberry32: small seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCohort(seed) {
  const rnd = mulberry32(seed);
  const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  const trainees = [];
  for (let i = 0; i < TRAINEE_COUNT; i += 1) {
    const roll = rnd();
    const struggling = rnd() < 0.4;
    let firstLoginDay;
    if (roll < 0.5) firstLoginDay = 1;
    else if (roll < 0.85) firstLoginDay = 2;
    else if (roll < 0.92) firstLoginDay = 3;
    else firstLoginDay = between(4, 7);
    trainees.push({
      trainee_id: `L-${pad2(i + 1)}`,
      display_name: `Learner ${pad2(i + 1)}`,
      first_login_day: firstLoginDay,
      sessions_attended: struggling ? between(4, 9) : between(8, 12),
      sessions_total: 12,
      struggling,
    });
  }

  // Flat cell index = trainee * SKILLS.length + skill index.
  const cells = [];
  for (let i = 0; i < TRAINEE_COUNT; i += 1) {
    for (let s = 0; s < SKILLS.length; s += 1) {
      const base = trainees[i].struggling ? 50 : 76;
      cells.push(Math.min(100, Math.max(20, base + between(-18, 18))));
    }
  }

  const missing = new Set();
  let s3Missing = 0;
  while (s3Missing < MISSING_IN_S3_MIN) {
    const idx = between(0, TRAINEE_COUNT - 1) * SKILLS.length + S3_INDEX;
    if (!missing.has(idx)) {
      missing.add(idx);
      s3Missing += 1;
    }
  }
  while (missing.size < MISSING_TOTAL) missing.add(between(0, cells.length - 1));

  const scores = cells.map((v, k) => (missing.has(k) ? null : v));
  return { seed, trainees, scores };
}

/** Implements the rules in domains/education/rules.mjs. Missing is not a gap and not zero. */
function evaluate({ trainees, scores }) {
  let missingCells = 0;
  let missingS3 = 0;
  let atRiskCount = 0;
  trainees.forEach((t, i) => {
    let gaps = 0;
    for (let s = 0; s < SKILLS.length; s += 1) {
      const v = scores[i * SKILLS.length + s];
      if (v === null) {
        missingCells += 1;
        if (s === S3_INDEX) missingS3 += 1;
      } else if (v < THRESHOLD) {
        gaps += 1;
      }
    }
    if (gaps >= AT_RISK_MIN_GAPS || (t.first_login_day >= LATE_LOGIN_DAY && gaps >= 1)) atRiskCount += 1;
  });

  let present = 0;
  let sum = 0;
  for (let i = 0; i < TRAINEE_COUNT; i += 1) {
    const v = scores[i * SKILLS.length + S3_INDEX];
    if (v !== null) {
      present += 1;
      sum += v;
    }
  }
  const s3Correct = round1(sum / present);
  const s3ZeroFilled = round1(sum / TRAINEE_COUNT);
  const s3DiffTenths = Math.abs(Math.round(s3Correct * 10) - Math.round(s3ZeroFilled * 10));

  const ok =
    missingCells === MISSING_TOTAL &&
    missingS3 >= MISSING_IN_S3_MIN &&
    atRiskCount >= AT_RISK_RANGE[0] &&
    atRiskCount <= AT_RISK_RANGE[1] &&
    s3DiffTenths >= S3_MIN_DIFF_TENTHS;
  return { ok, missingCells, missingS3, atRiskCount, s3Correct, s3ZeroFilled };
}

function buildInterventions() {
  const out = [];
  for (const { skill_id: sid, name } of SKILLS) {
    const lower = name.toLowerCase();
    out.push({ intervention_id: `I-${sid}-M`, skill_id: sid, title: `1:1 mentor session: ${lower}`, kind: 'mentor_session', minutes: 60 });
    out.push({ intervention_id: `I-${sid}-P`, skill_id: sid, title: `Guided practice set: ${lower}`, kind: 'practice', minutes: 45 });
  }
  return out.sort((a, b) => (a.intervention_id < b.intervention_id ? -1 : a.intervention_id > b.intervention_id ? 1 : 0));
}

const csvText = (header, rows) => `${[header.join(','), ...rows.map((r) => r.join(','))].join('\n')}\n`;

function renderFiles({ trainees, scores }) {
  return {
    'skills.csv': csvText(
      ['skill_id', 'name', 'threshold'],
      SKILLS.map((s) => [s.skill_id, s.name, THRESHOLD]),
    ),
    'trainees.csv': csvText(
      ['trainee_id', 'display_name', 'first_login_day', 'sessions_attended', 'sessions_total'],
      trainees.map((t) => [t.trainee_id, t.display_name, t.first_login_day, t.sessions_attended, t.sessions_total]),
    ),
    'assessments.csv': csvText(
      ['trainee_id', 'skill_id', 'score'],
      trainees.flatMap((t, i) => SKILLS.map((s, k) => [t.trainee_id, s.skill_id, scores[i * SKILLS.length + k] ?? ''])),
    ),
    'mentors.csv': csvText(['mentor_id', 'display_name', 'skills', 'capacity'], MENTORS),
    'availability.csv': csvText(['mentor_id', 'day', 'start', 'end'], AVAILABILITY),
    'interventions.json': `${JSON.stringify(buildInterventions(), null, 2)}\n`,
  };
}

/**
 * Writes the cohort to outDir. Tries BASE_SEED, BASE_SEED+1, ... and keeps the first seed
 * whose baseline meets every constraint. Same seed in, same bytes out.
 */
export function generate(outDir) {
  for (let seed = BASE_SEED, tries = 0; tries < 1000; seed += 1, tries += 1) {
    const cohort = buildCohort(seed);
    const report = evaluate(cohort);
    if (report.ok) {
      mkdirSync(outDir, { recursive: true });
      for (const [name, text] of Object.entries(renderFiles(cohort))) {
        writeFileSync(join(outDir, name), text, 'utf8');
      }
      return { seed, tries: tries + 1, ...report };
    }
  }
  throw new Error('no seed in range satisfies the cohort constraints');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = generate(join(here, 'v1'));
  console.log(`seed: ${r.seed} (seeds tried: ${r.tries})`);
  console.log(`at-risk baseline: ${r.atRiskCount}`);
  console.log(`S3 mean, present scores only: ${r.s3Correct}`);
  console.log(`S3 mean, missing as zero: ${r.s3ZeroFilled}`);
  console.log(`missing cells: ${r.missingCells} (in S3: ${r.missingS3})`);
  console.log(`written to: ${join(here, 'v1')}`);
}
