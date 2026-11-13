// Education domain: turns one LMS admin export (engine/lms.mjs, lms_admin_export) into the
// source files the engine already admits, plus three extra files the domain reads directly.
// Pure mapping + file writes. No wall-clock time in content, every list sorted, every CSV via toCsv
// (formula-guarded). Synthetic data only.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { toCsv } from '../../engine/csv.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const INTERVENTIONS_FIXTURE = path.join(here, '..', '..', 'fixtures', 'education-recovery', 'v1', 'interventions.json');
export const SESSIONS_TOTAL = 12;
const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const byString = (a, b) => (a === b ? 0 : (String(a) < String(b) ? -1 : 1));
const str = (v) => (v === null || v === undefined ? '' : String(v));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * @param {object} exportJson  result of lms_admin_export
 * @param {string} dir         output folder (created if missing; existing files are overwritten)
 * @returns {{at: string, files: {name: string, rows: number, digest: string}[], learners: number, helpRequests: number, defaultedLoginDay: number}}
 */
export function snapshot(exportJson, dir) {
  if (!exportJson || typeof exportJson !== 'object') throw Object.assign(new Error('export is not an object'), { code: 'LMS_BAD_EXPORT' });
  const profiles = Array.isArray(exportJson.profiles) ? exportJson.profiles : [];
  const skills = (Array.isArray(exportJson.skills) ? exportJson.skills : []).slice().sort((a, b) => byString(a.id, b.id));
  const latest = Array.isArray(exportJson.latest) ? exportJson.latest : [];
  const learners = profiles.filter((p) => p.kind === 'learner').slice().sort((a, b) => byString(a.id, b.id));
  const mentors = profiles.filter((p) => p.kind === 'mentor').slice().sort((a, b) => byString(a.id, b.id));
  const learnerIds = new Set(learners.map((p) => p.id));

  // Latest score per learner x skill. Two rows for the same pair means the export is inconsistent: fail loudly.
  const scoreOf = new Map();
  for (const r of latest) {
    if (!learnerIds.has(r.profile_id)) continue;
    const key = `${r.profile_id}|${r.skill_id}`;
    if (scoreOf.has(key)) throw Object.assign(new Error(`duplicate latest score for ${key}`), { code: 'LMS_DUPLICATE_LATEST' });
    scoreOf.set(key, r.score);
  }

  let defaultedLoginDay = 0;
  const trainees = learners.map((p) => {
    let day = Number.isInteger(p.first_login_day) && p.first_login_day >= 1 ? p.first_login_day : null;
    if (day === null) { day = 1; defaultedLoginDay += 1; } // seeded default; counted and reported, never silent
    return { trainee_id: p.id, display_name: str(p.display_name), first_login_day: day, sessions_attended: 0, sessions_total: SESSIONS_TOTAL };
  });
  const assessments = [];
  for (const p of learners) {
    for (const s of skills) {
      const score = scoreOf.get(`${p.id}|${s.id}`);
      assessments.push({ trainee_id: p.id, skill_id: s.id, score: score === undefined || score === null ? '' : score });
    }
  }
  const skillRows = skills.map((s) => ({ skill_id: s.id, name: str(s.name), threshold: s.threshold }));
  const mentorRows = mentors.map((m) => ({
    mentor_id: m.id,
    display_name: str(m.display_name),
    skills: (Array.isArray(m.mentor_skills) ? m.mentor_skills.slice().sort(byString) : []).join(';'),
    capacity: m.capacity,
  }));
  const availability = (Array.isArray(exportJson.availability) ? exportJson.availability : [])
    .map((w) => ({ mentor_id: w.mentor_id, day: w.day, start: w.start, end: w.end }))
    .sort((a, b) => byString(a.mentor_id, b.mentor_id)
      || (DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
      || byString(a.start, b.start));
  const help = (Array.isArray(exportJson.help) ? exportJson.help : [])
    .filter((h) => learnerIds.has(h.profile_id ?? h.trainee_id))
    .map((h, i) => ({
      request_id: str(h.id ?? h.request_id ?? `H-${String(i + 1).padStart(3, '0')}`),
      trainee_id: str(h.profile_id ?? h.trainee_id),
      skill_id: str(h.skill_id),
      category: str(h.category),
      text: str(h.text),
      at: str(h.at),
    }))
    .sort((a, b) => byString(a.at, b.at) || byString(a.request_id, b.request_id));
  const prefs = learners.map((p) => ({ trainee_id: p.id, format: str(p.prefs?.format), language: str(p.prefs?.language) }));
  const memory = (Array.isArray(exportJson.memory) ? exportJson.memory : [])
    .filter((m) => learnerIds.has(m.profile_id ?? m.trainee_id))
    .map((m) => ({ trainee_id: str(m.profile_id ?? m.trainee_id), fact: str(m.fact), source_run: str(m.source_run), at: str(m.at) }))
    .sort((a, b) => byString(a.trainee_id, b.trainee_id) || byString(a.at, b.at) || byString(a.fact, b.fact));

  const csvSpecs = [
    { name: 'trainees.csv', header: ['trainee_id', 'display_name', 'first_login_day', 'sessions_attended', 'sessions_total'], rows: trainees },
    { name: 'assessments.csv', header: ['trainee_id', 'skill_id', 'score'], rows: assessments },
    { name: 'skills.csv', header: ['skill_id', 'name', 'threshold'], rows: skillRows },
    { name: 'mentors.csv', header: ['mentor_id', 'display_name', 'skills', 'capacity'], rows: mentorRows },
    { name: 'availability.csv', header: ['mentor_id', 'day', 'start', 'end'], rows: availability },
    { name: 'help_requests.csv', header: ['request_id', 'trainee_id', 'skill_id', 'category', 'text', 'at'], rows: help },
    { name: 'learner_prefs.csv', header: ['trainee_id', 'format', 'language'], rows: prefs },
    { name: 'memory.csv', header: ['trainee_id', 'fact', 'source_run', 'at'], rows: memory },
  ];

  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const spec of csvSpecs) {
    const content = toCsv(spec.header, spec.rows);
    fs.writeFileSync(path.join(dir, spec.name), content, 'utf8');
    files.push({ name: spec.name, rows: spec.rows.length, digest: sha256(Buffer.from(content, 'utf8')) });
  }
  const interventions = fs.readFileSync(INTERVENTIONS_FIXTURE);
  fs.writeFileSync(path.join(dir, 'interventions.json'), interventions);
  files.push({ name: 'interventions.json', rows: JSON.parse(interventions.toString('utf8')).length, digest: sha256(interventions) });

  return { at: str(exportJson.at), files, learners: learners.length, helpRequests: help.length, defaultedLoginDay };
}
