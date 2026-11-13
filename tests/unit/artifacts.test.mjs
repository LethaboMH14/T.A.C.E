import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256, safeJoin, createArtifactStore } from '../../engine/artifacts.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tace-art-'));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('sha256 hashes strings as utf8 and matches file bytes', () => {
  const dir = tmpDir();
  try {
    const store = createArtifactStore(dir);
    const ref = store.write({ kind: 'gaps', name: 'gaps.json', content: '{"a":"é"}', producer: 't1' });
    const bytes = fs.readFileSync(path.join(dir, ref.file));
    assert.equal(ref.digest, sha256(bytes));
    assert.equal(ref.digest, sha256('{"a":"é"}'));
    assert.equal(ref.bytes, Buffer.byteLength('{"a":"é"}', 'utf8'));
  } finally {
    cleanup(dir);
  }
});

test('versions increment v1 -> v2 and v1 file is kept', () => {
  const dir = tmpDir();
  try {
    const store = createArtifactStore(dir);
    const v1 = store.write({ kind: 'gap_analysis', name: 'gap-analysis.csv', content: 'a,b\n1,2\n', producer: 't1' });
    const v2 = store.write({ kind: 'gap_analysis', name: 'gap-analysis.csv', content: 'a,b\n3,4\n', producer: 'repair' });
    assert.equal(v1.version, 1);
    assert.equal(v2.version, 2);
    assert.equal(v1.file, 'artifacts/gap-analysis.v1.csv');
    assert.equal(v2.file, 'artifacts/gap-analysis.v2.csv');
    assert.equal(v2.mime, 'text/csv');
    assert.ok(fs.existsSync(path.join(dir, v1.file)));
    assert.equal(store.read(v1), 'a,b\n1,2\n');
    assert.equal(store.latestByName('gap-analysis.csv').version, 2);
  } finally {
    cleanup(dir);
  }
});

test('read throws DIGEST_MISMATCH after the file is tampered with', () => {
  const dir = tmpDir();
  try {
    const store = createArtifactStore(dir);
    const ref = store.write({ kind: 'performance_summary', name: 'performance-summary.json', content: '{"ok":true}', producer: 't1' });
    assert.equal(store.read(ref), '{"ok":true}');
    fs.writeFileSync(path.join(dir, ref.file), '{"ok":false}', 'utf8');
    assert.throws(() => store.read(ref), (e) => e.code === 'DIGEST_MISMATCH');
  } finally {
    cleanup(dir);
  }
});

test('bad names and traversal are rejected with BAD_NAME', () => {
  const dir = tmpDir();
  try {
    const store = createArtifactStore(dir);
    const base = { kind: 'gaps', content: 'x', producer: 't1' };
    for (const name of ['../x.csv', 'Upper.csv', 'a/b.csv', 'noext', 'bad.txt', '.hidden.csv', '']) {
      assert.throws(() => store.write({ ...base, name }), (e) => e.code === 'BAD_NAME', name);
    }
    assert.equal(store.list().length, 0);
  } finally {
    cleanup(dir);
  }
});

test('safeJoin rejects escape, absolute and NUL paths', () => {
  const base = path.resolve(os.tmpdir(), 'tace-base');
  assert.equal(safeJoin(base, 'artifacts/a.csv'), path.join(base, 'artifacts', 'a.csv'));
  for (const rel of ['../x.csv', '../../etc/passwd', path.resolve(os.tmpdir(), 'evil.csv'), 'a\0b.csv', 'sub/../../up.csv']) {
    assert.throws(() => safeJoin(base, rel), (e) => e.code === 'PATH_ESCAPE', JSON.stringify(rel));
  }
});

test('index.json lists all refs', () => {
  const dir = tmpDir();
  try {
    const store = createArtifactStore(dir);
    store.write({ kind: 'gaps', name: 'gaps.json', content: '{}', producer: 't1' });
    store.write({ kind: 'gap_analysis', name: 'gap-analysis.csv', content: 'h\n', producer: 't2' });
    store.write({ kind: 'gap_analysis', name: 'gap-analysis.csv', content: 'h\n1\n', producer: 'repair' });
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'artifacts', 'index.json'), 'utf8'));
    assert.equal(index.length, 3);
    assert.deepEqual(index.map((r) => r.file).sort(), store.list().map((r) => r.file).sort());
    assert.deepEqual(
      store.list().map((r) => `${r.name}@v${r.version}`),
      ['gap-analysis.csv@v1', 'gap-analysis.csv@v2', 'gaps.json@v1'],
    );
    assert.equal(store.latestByKind('gap_analysis').version, 2);
    assert.equal(store.latestByKind('nope'), null);
    assert.equal(store.latestByName('nope.csv'), null);
  } finally {
    cleanup(dir);
  }
});

test('store works on a new nested directory and abs() stays inside it', () => {
  const dir = path.join(tmpDir(), 'new', 'nested');
  try {
    const store = createArtifactStore(dir);
    const ref = store.write({ kind: 'improvement_plan', name: 'improvement-plan.md', content: '# plan\n', producer: 't9' });
    assert.equal(store.abs(ref), path.join(path.resolve(dir), 'artifacts', 'improvement-plan.v1.md'));
    assert.equal(ref.mime, 'text/markdown');
    assert.equal(store.read(ref), '# plan\n');
  } finally {
    cleanup(path.resolve(dir, '..', '..'));
  }
});
