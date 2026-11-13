import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { admitSources, rowRef } from '../../engine/sources.mjs';

function makeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tace-sources-'));
}

const csvSpec = (overrides = {}) => ({
  sourceId: 'assessments',
  kind: 'source:assessments',
  file: 'assessments.csv',
  version: 'v1',
  format: 'csv',
  requiredColumns: ['trainee_id', 'score'],
  keyColumns: ['trainee_id', 'skill_id'],
  ...overrides,
});

test('admits a csv source with correct digest, rows and rowNumbers', () => {
  const dir = makeDir();
  try {
    const bytes = 'trainee_id,skill_id,score\nT1,S1,40\n"T2","S1",55\nT3,S2,=HYPERLINK("x")\n';
    fs.writeFileSync(path.join(dir, 'assessments.csv'), bytes);
    const res = admitSources(dir, [csvSpec()]);
    assert.equal(res.status, 'ADMITTED');
    assert.deepEqual(res.problems, []);
    const src = res.sources.assessments;
    assert.equal(src.digest, createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
    assert.equal(src.file, path.resolve(dir, 'assessments.csv'));
    assert.equal(src.version, 'v1');
    assert.equal(src.rows.length, 3);
    assert.deepEqual(src.rowNumbers, [2, 3, 4]);
    assert.equal(src.rows[2].score, '=HYPERLINK("x")');
    assert.deepEqual(rowRef(src, 1), { sourceId: 'assessments', row: 3 });
    assert.ok(Object.isFrozen(src.rows));
    assert.ok(Object.isFrozen(src.rows[0]));
    assert.ok(Object.isFrozen(src.rowNumbers));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing file gives BLOCKED with MISSING_SOURCE', () => {
  const dir = makeDir();
  try {
    const res = admitSources(dir, [csvSpec()]);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'MISSING_SOURCE');
    assert.equal(res.problems[0].sourceId, 'assessments');
    assert.equal(res.sources.assessments, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('excluded source gives MISSING_SOURCE even when the file exists', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'assessments.csv'), 'trainee_id,skill_id,score\nT1,S1,1\n');
    const res = admitSources(dir, [csvSpec()], { exclude: ['assessments'] });
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'MISSING_SOURCE');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('path escaping the base directory gives OUTSIDE_DIR', () => {
  const dir = makeDir();
  try {
    const res = admitSources(dir, [csvSpec({ file: '../x.csv' })]);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'OUTSIDE_DIR');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing required column gives SCHEMA_MISMATCH', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'assessments.csv'), 'trainee_id,skill_id\nT1,S1\n');
    const res = admitSources(dir, [csvSpec()]);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'SCHEMA_MISMATCH');
    assert.match(res.problems[0].message, /score/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('duplicate key gives DUPLICATE_KEY naming the line', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'assessments.csv'), 'trainee_id,skill_id,score\nT1,S1,1\nT2,S1,2\nT1,S1,3\n');
    const res = admitSources(dir, [csvSpec()]);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'DUPLICATE_KEY');
    assert.match(res.problems[0].message, /line 4/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('csv parse error gives PARSE_ERROR with the csv error code', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'assessments.csv'), 'trainee_id,skill_id,score\nT1,"S1,1\n');
    const res = admitSources(dir, [csvSpec()]);
    assert.equal(res.problems[0].code, 'PARSE_ERROR');
    assert.match(res.problems[0].message, /CSV_UNCLOSED_QUOTE/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json source is admitted with parsed json and digest', () => {
  const dir = makeDir();
  try {
    const bytes = '{"mentors":[{"id":"M1"}]}';
    fs.writeFileSync(path.join(dir, 'mentors.json'), bytes);
    const res = admitSources(dir, [{
      sourceId: 'mentors', kind: 'source:mentors', file: 'mentors.json', version: 'v1', format: 'json',
    }]);
    assert.equal(res.status, 'ADMITTED');
    assert.deepEqual(res.sources.mentors.json, { mentors: [{ id: 'M1' }] });
    assert.equal(res.sources.mentors.digest, createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid json gives PARSE_ERROR', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'bad.json'), '{nope');
    const res = admitSources(dir, [{
      sourceId: 'bad', kind: 'source:mentors', file: 'bad.json', version: 'v1', format: 'json',
    }]);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'PARSE_ERROR');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('oversize file gives TOO_LARGE', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'assessments.csv'), 'trainee_id,skill_id,score\nT1,S1,1\n');
    const res = admitSources(dir, [csvSpec()], { maxBytes: 10 });
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.problems[0].code, 'TOO_LARGE');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('blocked source is not admitted but other sources still are', () => {
  const dir = makeDir();
  try {
    fs.writeFileSync(path.join(dir, 'mentors.json'), '[1]');
    const res = admitSources(dir, [
      csvSpec(),
      { sourceId: 'mentors', kind: 'source:mentors', file: 'mentors.json', version: 'v1', format: 'json' },
    ]);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.sources.assessments, undefined);
    assert.deepEqual(res.sources.mentors.json, [1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
