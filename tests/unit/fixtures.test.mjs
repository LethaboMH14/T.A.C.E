import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../../fixtures/education-recovery/generate.mjs';
import { validate } from '../../fixtures/education-recovery/validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const v1 = join(root, 'fixtures', 'education-recovery', 'v1');
const FILES = ['skills.csv', 'trainees.csv', 'assessments.csv', 'mentors.csv', 'availability.csv', 'interventions.json'];

test('generating twice into two temp dirs gives identical bytes', () => {
  const a = mkdtempSync(join(tmpdir(), 'edu-a-'));
  const b = mkdtempSync(join(tmpdir(), 'edu-b-'));
  try {
    const ra = generate(a);
    const rb = generate(b);
    assert.equal(ra.seed, rb.seed);
    for (const f of FILES) assert.deepEqual(readFileSync(join(a, f)), readFileSync(join(b, f)), f);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('committed v1 files match a fresh generation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'edu-v1-'));
  try {
    generate(dir);
    for (const f of FILES) assert.deepEqual(readFileSync(join(dir, f)), readFileSync(join(v1, f)), f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validate() is ok on the real v1 directory', () => {
  const r = validate(v1);
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test('row counts are exact', () => {
  const { counts } = validate(v1);
  assert.equal(counts.trainees, 36);
  assert.equal(counts.assessmentRows, 216);
  assert.equal(counts.mentors, 3);
  assert.equal(counts.windows, 6);
  assert.equal(counts.interventions, 12);
});

test('exactly 6 missing cells, at least 2 in S3', () => {
  const { counts, s3 } = validate(v1);
  assert.equal(counts.missingCells, 6);
  assert.ok(s3.missing >= 2, `S3 missing ${s3.missing}`);
});

test('baseline at-risk count is between 10 and 14', () => {
  const { counts } = validate(v1);
  assert.ok(counts.atRisk >= 10 && counts.atRisk <= 14, `at-risk ${counts.atRisk}`);
});

test('S3 missing-as-zero mean differs from correct mean by at least 1.0', () => {
  const { s3 } = validate(v1);
  assert.ok(s3.diff >= 1.0, `diff ${s3.diff}`);
});
