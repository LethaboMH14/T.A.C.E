// Checks the education-recovery v1 fixture: exact columns, row counts, unique ids, ranges,
// references, cohort constraints and display-name hygiene. Recomputes gaps from raw files.
// Run: node fixtures/education-recovery/validate.mjs   (exit 1 on any problem)
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AT_RISK_MIN_GAPS, DAYS, LATE_LOGIN_DAY } from '../../domains/education/rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const CSV_COLUMNS = {
  'skills.csv': ['skill_id', 'name', 'threshold'],
  'trainees.csv': ['trainee_id', 'display_name', 'first_login_day', 'sessions_attended', 'sessions_total'],
  'assessments.csv': ['trainee_id', 'skill_id', 'score'],
  'mentors.csv': ['mentor_id', 'display_name', 'skills', 'capacity'],
  'availability.csv': ['mentor_id', 'day', 'start', 'end'],
};
const JSON_FILES = ['interventions.json'];
const INTERVENTION_KEYS = ['intervention_id', 'skill_id', 'title', 'kind', 'minutes'];
const KINDS = ['mentor_session', 'practice'];

const EXPECT = {
  trainees: 36,
  skills: 6,
  assessmentRows: 216,
  mentors: 3,
  windows: 6,
  interventions: 12,
  missingCells: 6,
  missingS3Min: 2,
  atRiskMin: 10,
  atRiskMax: 14,
  s3MinDiffTenths: 10,
  sessionsTotal: 12,
};

const INT = /^-?\d+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const round1 = (x) => Math.round(x * 10) / 10;

function parseCsv(name, text, problems) {
  if (text.includes('\r')) problems.push(`${name}: CRLF line endings (LF required)`);
  if (!text.endsWith('\n')) problems.push(`${name}: missing final newline`);
  const lines = text.split('\n');
  lines.pop();
  lines.forEach((line, i) => {
    if (line !== line.trimEnd()) problems.push(`${name}: trailing space on line ${i + 1}`);
  });
  const want = CSV_COLUMNS[name];
  const header = (lines[0] ?? '').split(',');
  if (header.join(',') !== want.join(',')) {
    problems.push(`${name}: columns "${header.join(',')}" != "${want.join(',')}"`);
  }
  return lines.slice(1).map((line, i) => {
    const cells = line.split(',');
    if (cells.length !== want.length) problems.push(`${name}: line ${i + 2} has ${cells.length} fields`);
    return Object.fromEntries(want.map((c, j) => [c, cells[j] ?? '']));
  });
}

function checkUnique(label, list, key, problems) {
  const seen = new Set();
  for (const row of list) {
    if (seen.has(row[key])) problems.push(`${label}: duplicate ${key} ${row[key]}`);
    seen.add(row[key]);
  }
}

function checkDisplayName(label, value, problems) {
  if (value.includes('@')) problems.push(`${label}: display name contains '@'`);
  if (/\d{7,}/.test(value)) problems.push(`${label}: display name contains a 7+ digit run`);
}

export function validate(dir) {
  const problems = [];
  const digests = {};
  const text = {};
  for (const name of [...Object.keys(CSV_COLUMNS), ...JSON_FILES]) {
    try {
      const buf = readFileSync(join(dir, name));
      digests[name] = createHash('sha256').update(buf).digest('hex');
      text[name] = buf.toString('utf8');
    } catch (err) {
      problems.push(`${name}: cannot read (${err.code ?? err.message})`);
    }
  }
  const rows = {};
  for (const name of Object.keys(CSV_COLUMNS)) {
    if (name in text) rows[name] = parseCsv(name, text[name], problems);
  }

  // Skills
  const skillRows = rows['skills.csv'] ?? [];
  checkUnique('skills', skillRows, 'skill_id', problems);
  if (skillRows.length !== EXPECT.skills) problems.push(`skills: ${skillRows.length} rows, expected ${EXPECT.skills}`);
  const thresholds = new Map();
  for (const s of skillRows) {
    if (!INT.test(s.threshold)) problems.push(`skills: ${s.skill_id} threshold not an integer`);
    thresholds.set(s.skill_id, Number(s.threshold));
  }

  // Trainees
  const traineeRows = rows['trainees.csv'] ?? [];
  if (traineeRows.length !== EXPECT.trainees) problems.push(`trainees: ${traineeRows.length} rows, expected ${EXPECT.trainees}`);
  checkUnique('trainees', traineeRows, 'trainee_id', problems);
  const trainees = new Map();
  for (const t of traineeRows) {
    trainees.set(t.trainee_id, t);
    checkDisplayName(`trainees ${t.trainee_id}`, t.display_name, problems);
    const fld = Number(t.first_login_day);
    if (!INT.test(t.first_login_day) || fld < 1 || fld > 7) problems.push(`trainees ${t.trainee_id}: first_login_day out of 1..7`);
    const sa = Number(t.sessions_attended);
    if (!INT.test(t.sessions_attended) || sa < 0 || sa > 12) problems.push(`trainees ${t.trainee_id}: sessions_attended out of 0..12`);
    if (t.sessions_total !== String(EXPECT.sessionsTotal)) problems.push(`trainees ${t.trainee_id}: sessions_total must be ${EXPECT.sessionsTotal}`);
  }

  // Assessments
  const assessRows = rows['assessments.csv'] ?? [];
  if (assessRows.length !== EXPECT.assessmentRows) problems.push(`assessments: ${assessRows.length} rows, expected ${EXPECT.assessmentRows}`);
  const pairs = new Set();
  let missingCells = 0;
  let missingS3 = 0;
  for (const a of assessRows) {
    const key = `${a.trainee_id}|${a.skill_id}`;
    if (pairs.has(key)) problems.push(`assessments: duplicate pair ${key}`);
    pairs.add(key);
    if (!trainees.has(a.trainee_id)) problems.push(`assessments: unknown trainee ${a.trainee_id}`);
    if (!thresholds.has(a.skill_id)) problems.push(`assessments: unknown skill ${a.skill_id}`);
    if (a.score === '') {
      missingCells += 1;
      if (a.skill_id === 'S3') missingS3 += 1;
    } else if (!INT.test(a.score) || Number(a.score) < 20 || Number(a.score) > 100) {
      problems.push(`assessments ${key}: score "${a.score}" not an integer 20..100 or empty`);
    }
  }
  if (pairs.size !== EXPECT.assessmentRows) problems.push(`assessments: ${pairs.size} unique trainee/skill pairs, expected ${EXPECT.assessmentRows}`);
  if (missingCells !== EXPECT.missingCells) problems.push(`assessments: ${missingCells} missing cells, expected ${EXPECT.missingCells}`);
  if (missingS3 < EXPECT.missingS3Min) problems.push(`assessments: ${missingS3} missing in S3, expected >= ${EXPECT.missingS3Min}`);

  // Cohort constraints, recomputed from the raw rows with the real thresholds.
  const gaps = new Map([...trainees.keys()].map((id) => [id, 0]));
  let s3Sum = 0;
  let s3Present = 0;
  for (const a of assessRows) {
    if (a.score === '' || !INT.test(a.score)) continue;
    const v = Number(a.score);
    if (v < (thresholds.get(a.skill_id) ?? Infinity) && gaps.has(a.trainee_id)) gaps.set(a.trainee_id, gaps.get(a.trainee_id) + 1);
    if (a.skill_id === 'S3') {
      s3Sum += v;
      s3Present += 1;
    }
  }
  let atRisk = 0;
  for (const [id, n] of gaps) {
    const fld = Number(trainees.get(id)?.first_login_day ?? 0);
    if (n >= AT_RISK_MIN_GAPS || (fld >= LATE_LOGIN_DAY && n >= 1)) atRisk += 1;
  }
  if (atRisk < EXPECT.atRiskMin || atRisk > EXPECT.atRiskMax) problems.push(`cohort: at-risk ${atRisk} outside ${EXPECT.atRiskMin}..${EXPECT.atRiskMax}`);
  const s3Correct = s3Present ? round1(s3Sum / s3Present) : NaN;
  const s3ZeroFilled = round1(s3Sum / EXPECT.trainees);
  const s3DiffTenths = Math.abs(Math.round(s3Correct * 10) - Math.round(s3ZeroFilled * 10));
  if (!(s3DiffTenths >= EXPECT.s3MinDiffTenths)) problems.push(`cohort: S3 mean difference ${s3DiffTenths / 10} below 1.0`);

  // Mentors
  const mentorRows = rows['mentors.csv'] ?? [];
  if (mentorRows.length !== EXPECT.mentors) problems.push(`mentors: ${mentorRows.length} rows, expected ${EXPECT.mentors}`);
  checkUnique('mentors', mentorRows, 'mentor_id', problems);
  const mentors = new Set();
  for (const m of mentorRows) {
    mentors.add(m.mentor_id);
    checkDisplayName(`mentors ${m.mentor_id}`, m.display_name, problems);
    for (const sid of m.skills.split(';')) {
      if (!thresholds.has(sid)) problems.push(`mentors ${m.mentor_id}: unknown skill ${sid}`);
    }
    if (!INT.test(m.capacity) || Number(m.capacity) <= 0) problems.push(`mentors ${m.mentor_id}: capacity must be a positive integer`);
  }

  // Availability
  const windowRows = rows['availability.csv'] ?? [];
  if (windowRows.length !== EXPECT.windows) problems.push(`availability: ${windowRows.length} rows, expected ${EXPECT.windows}`);
  for (const w of windowRows) {
    if (!mentors.has(w.mentor_id)) problems.push(`availability: unknown mentor ${w.mentor_id}`);
    if (!DAYS.includes(w.day)) problems.push(`availability: day "${w.day}" not in ${DAYS.join(',')}`);
    if (!TIME.test(w.start) || !TIME.test(w.end) || !(w.start < w.end)) problems.push(`availability ${w.mentor_id} ${w.day}: bad window ${w.start}-${w.end}`);
  }

  // Interventions
  let interventions = [];
  if ('interventions.json' in text) {
    try {
      const parsed = JSON.parse(text['interventions.json']);
      if (!Array.isArray(parsed)) problems.push('interventions: top level is not an array');
      else interventions = parsed;
      if (text['interventions.json'] !== `${JSON.stringify(parsed, null, 2)}\n`) problems.push('interventions: not 2-space JSON with final newline');
    } catch (err) {
      problems.push(`interventions: invalid JSON (${err.message})`);
    }
  }
  if (interventions.length !== EXPECT.interventions) problems.push(`interventions: ${interventions.length} items, expected ${EXPECT.interventions}`);
  const interventionIds = interventions.map((i) => i.intervention_id);
  const sorted = [...interventionIds].sort();
  if (interventionIds.join('|') !== sorted.join('|')) problems.push('interventions: not sorted by intervention_id');
  checkUnique('interventions', interventions, 'intervention_id', problems);
  const coverage = new Map([...thresholds.keys()].map((k) => [k, 0]));
  for (const i of interventions) {
    if (Object.keys(i).sort().join(',') !== [...INTERVENTION_KEYS].sort().join(',')) problems.push(`interventions ${i.intervention_id}: keys ${Object.keys(i).join(',')}`);
    if (!coverage.has(i.skill_id)) problems.push(`interventions ${i.intervention_id}: unknown skill ${i.skill_id}`);
    else coverage.set(i.skill_id, coverage.get(i.skill_id) + 1);
    if (!KINDS.includes(i.kind)) problems.push(`interventions ${i.intervention_id}: unknown kind ${i.kind}`);
    if (!Number.isInteger(i.minutes) || i.minutes <= 0) problems.push(`interventions ${i.intervention_id}: minutes must be a positive integer`);
  }
  for (const [sid, n] of coverage) {
    if (n === 0) problems.push(`interventions: skill ${sid} has no intervention`);
  }

  const counts = {
    trainees: traineeRows.length,
    assessmentRows: assessRows.length,
    missingCells,
    atRisk,
    mentors: mentorRows.length,
    windows: windowRows.length,
    interventions: interventions.length,
  };
  const s3 = {
    present: s3Present,
    missing: missingS3,
    correctMean: s3Correct,
    zeroFilledMean: s3ZeroFilled,
    diff: s3DiffTenths / 10,
  };
  return { ok: problems.length === 0, problems, counts, digests, s3 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = validate(join(here, 'v1'));
  console.log(`trainees: ${r.counts.trainees}`);
  console.log(`assessment rows: ${r.counts.assessmentRows}`);
  console.log(`missing cells: ${r.counts.missingCells} (S3: ${r.s3.missing})`);
  console.log(`at-risk count: ${r.counts.atRisk}`);
  console.log(`mentors: ${r.counts.mentors}`);
  console.log(`availability windows: ${r.counts.windows}`);
  console.log(`interventions: ${r.counts.interventions}`);
  console.log(`S3 mean, present only: ${r.s3.correctMean}`);
  console.log(`S3 mean, missing as zero: ${r.s3.zeroFilledMean}`);
  console.log(`S3 difference: ${r.s3.diff}`);
  for (const [name, sha] of Object.entries(r.digests)) console.log(`sha256 ${sha}  ${name}`);
  for (const p of r.problems) console.error(`PROBLEM: ${p}`);
  console.log(r.ok ? 'VALID' : `INVALID (${r.problems.length} problems)`);
  process.exitCode = r.ok ? 0 : 1;
}
