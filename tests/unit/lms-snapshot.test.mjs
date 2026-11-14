import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../../domains/education/lms-snapshot.mjs';
import { EDU_SOURCE_SPECS } from '../../domains/education/sources.mjs';
import { admitSources } from '../../engine/sources.mjs';
import { parseCsv } from '../../engine/csv.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const sample = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'lms-export.sample.json'), 'utf8'));
const fixtureDir = path.join(root, 'fixtures', 'education-recovery', 'v1');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lms-snap-'));
const headerOf = (file) => fs.readFileSync(file, 'utf8').split('\n')[0].split(',');

// A copy of the export with one learner's latest score removed, one help request with a formula-like text,
// and one memory fact. Synthetic only.
function withActivity(base) {
  const ex = structuredClone(base);
  ex.latest = ex.latest.filter((r) => !(r.profile_id === 'L-02' && r.skill_id === 'S3'));
  ex.help = [{ id: 7, profile_id: 'L-01', skill_id: 'S3', category: 'concept', text: '=HYPERLINK("http://example.test","x")', at: '2026-11-13T10:00:00+00:00' }];
  ex.memory = [{ profile_id: 'L-01', fact: 'Asked for help: concept on S3', source_run: 'r1', at: '2026-11-13T10:01:00+00:00' }];
  return ex;
}

test('CSV columns equal the headers the engine already admits', () => {
  const dir = tmp();
  snapshot(sample, dir);
  for (const name of ['trainees', 'assessments', 'skills', 'mentors', 'availability']) {
    assert.deepEqual(headerOf(path.join(dir, `${name}.csv`)), headerOf(path.join(fixtureDir, `${name}.csv`)), name);
  }
  assert.deepEqual(headerOf(path.join(dir, 'help_requests.csv')), ['request_id', 'trainee_id', 'skill_id', 'category', 'text', 'at']);
  assert.deepEqual(headerOf(path.join(dir, 'learner_prefs.csv')), ['trainee_id', 'format', 'language']);
  assert.deepEqual(headerOf(path.join(dir, 'memory.csv')), ['trainee_id', 'fact', 'source_run', 'at']);
});

test('mapping: learners, 12 sessions, empty score when none, mentor skills joined', () => {
  const dir = tmp();
  const r = snapshot(sample, dir);
  assert.equal(r.learners, 36);
  assert.equal(r.helpRequests, 0);
  const trainees = parseCsv(fs.readFileSync(path.join(dir, 'trainees.csv'), 'utf8')).rows;
  assert.equal(trainees.length, 36);
  assert.equal(trainees[0].sessions_attended, '0');
  assert.equal(trainees[0].sessions_total, '12');
  const assess = parseCsv(fs.readFileSync(path.join(dir, 'assessments.csv'), 'utf8')).rows;
  assert.equal(assess.length, 36 * 6);
  const gap = assess.find((a) => a.trainee_id === 'L-01' && a.skill_id === 'S1');
  assert.equal(gap.score, '72');
  const mentors = parseCsv(fs.readFileSync(path.join(dir, 'mentors.csv'), 'utf8')).rows;
  assert.equal(mentors.find((m) => m.mentor_id === 'M-A').skills, 'S1;S2;S3;S5');
});

test('missing latest score is an empty cell, never zero', () => {
  const ex = structuredClone(sample);
  ex.latest = ex.latest.filter((r) => !(r.profile_id === 'L-03' && r.skill_id === 'S4'));
  const dir = tmp();
  snapshot(ex, dir);
  const row = parseCsv(fs.readFileSync(path.join(dir, 'assessments.csv'), 'utf8')).rows
    .find((a) => a.trainee_id === 'L-03' && a.skill_id === 'S4');
  assert.equal(row.score, '');
});

test('deterministic: same export gives identical digests, regardless of input order', () => {
  const a = snapshot(withActivity(sample), tmp());
  const shuffled = withActivity(sample);
  shuffled.profiles.reverse();
  shuffled.latest.reverse();
  const b = snapshot(shuffled, tmp());
  assert.deepEqual(a.files, b.files);
});

test('formula guard: help text starting with = is neutralised in the CSV', () => {
  const dir = tmp();
  snapshot(withActivity(sample), dir);
  const text = fs.readFileSync(path.join(dir, 'help_requests.csv'), 'utf8');
  assert.ok(!/(^|,)=HYPERLINK/m.test(text), 'raw formula must not start a cell');
  assert.ok(text.includes("'=HYPERLINK"), 'formula is prefixed with an apostrophe');
});

test('help rows are mapped with the requested columns and counted', () => {
  const dir = tmp();
  const r = snapshot(withActivity(sample), dir);
  assert.equal(r.helpRequests, 1);
  const row = parseCsv(fs.readFileSync(path.join(dir, 'help_requests.csv'), 'utf8')).rows[0];
  assert.equal(row.request_id, '7');
  assert.equal(row.trainee_id, 'L-01');
  assert.equal(row.category, 'concept');
});

test('the engine admits the snapshot with the education source specs', () => {
  const dir = tmp();
  snapshot(withActivity(sample), dir);
  const adm = admitSources(dir, EDU_SOURCE_SPECS);
  assert.equal(adm.status, 'ADMITTED', JSON.stringify(adm.problems));
});

test('a missing first_login_day is defaulted and counted, not silent', () => {
  const ex = structuredClone(sample);
  delete ex.profiles.find((p) => p.id === 'L-04').first_login_day;
  const r = snapshot(ex, tmp());
  assert.equal(r.defaultedLoginDay, 1);
});

test('duplicate latest rows for one learner and skill are refused', () => {
  const ex = structuredClone(sample);
  ex.latest.push({ ...ex.latest[0] });
  assert.throws(() => snapshot(ex, tmp()), { code: 'LMS_DUPLICATE_LATEST' });
});
