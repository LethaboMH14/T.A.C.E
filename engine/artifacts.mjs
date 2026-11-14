// T.A.C.E artifact store — real files on disk, re-read and re-hashed before they are trusted.
// Node built-ins only (ADR-0008). Shapes come from ./contracts.mjs (ArtifactRef).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const MIME = Object.freeze({
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.ics': 'text/calendar',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
/** Extensions whose content is binary (a Buffer). Every other extension takes a string. */
const BINARY_EXT = new Set(['.xlsx']);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** sha256 hex. Strings are hashed as UTF-8 bytes. */
export function sha256(data) {
  return crypto.createHash('sha256').update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data).digest('hex');
}

/**
 * Join a relative path onto base, refusing anything that could leave base.
 * @returns {string} absolute path
 */
export function safeJoin(base, rel) {
  if (typeof rel !== 'string' || rel.includes('\0') || path.isAbsolute(rel)) {
    throw fail('PATH_ESCAPE', `refusing path: ${JSON.stringify(rel)}`);
  }
  const root = path.resolve(base);
  const target = path.resolve(root, rel);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw fail('PATH_ESCAPE', `path escapes base: ${JSON.stringify(rel)}`);
  }
  return target;
}

/**
 * @param {string} runDir
 */
export function createArtifactStore(runDir) {
  const root = path.resolve(runDir);
  const dir = path.join(root, 'artifacts');
  const indexPath = path.join(dir, 'index.json');
  fs.mkdirSync(dir, { recursive: true });

  /** Refs in write order (index.json). */
  function loadRefs() {
    if (!fs.existsSync(indexPath)) return [];
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }

  function writeIndexAtomic(refs) {
    const tmp = path.join(dir, `.index.json.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(refs, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, indexPath);
  }

  function byNameThenVersion(a, b) {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.version - b.version;
  }

  function abs(ref) {
    return safeJoin(root, ref.file);
  }

  function write({ kind, name, content, producer, inputs = [] }) {
    if (typeof name !== 'string' || !NAME_RE.test(name)) {
      throw fail('BAD_NAME', `bad artifact name: ${JSON.stringify(name)}`);
    }
    const ext = path.extname(name);
    if (!Object.hasOwn(MIME, ext)) {
      throw fail('BAD_NAME', `artifact name must end in .csv, .json, .md, .ics or .xlsx: ${name}`);
    }
    const binary = BINARY_EXT.has(ext);
    if (binary ? !Buffer.isBuffer(content) : typeof content !== 'string') {
      throw fail('BAD_CONTENT', binary ? `${ext} content must be a Buffer` : 'artifact content must be a string');
    }
    const stem = name.slice(0, -ext.length);
    if (stem.length === 0) throw fail('BAD_NAME', `bad artifact name: ${name}`);

    // version = highest existing version of this name + 1 (scan the folder, not the index)
    const versionRe = new RegExp(`^${escapeRe(stem)}\\.v(\\d+)${escapeRe(ext)}$`);
    let highest = 0;
    for (const f of fs.readdirSync(dir)) {
      const m = versionRe.exec(f);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    const version = highest + 1;

    const fileName = `${stem}.v${version}${ext}`;
    const relFile = `artifacts/${fileName}`;
    const target = safeJoin(root, relFile);
    if (fs.existsSync(target)) {
      throw fail('VERSION_EXISTS', `version already exists: ${relFile}`);
    }

    const expected = sha256(content);
    const tmp = path.join(dir, `.${fileName}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, target);

    const readBack = fs.readFileSync(target);
    if (sha256(readBack) !== expected) {
      throw fail('READBACK_MISMATCH', `bytes on disk differ from written content: ${relFile}`);
    }

    const ref = {
      kind,
      name,
      version,
      file: relFile,
      digest: sha256(readBack),
      bytes: readBack.length,
      mime: MIME[ext],
      producer,
      inputs: inputs.map((i) => ({ name: i.name, version: i.version, digest: i.digest })),
    };

    writeIndexAtomic([...loadRefs(), ref]);
    return ref;
  }

  function read(ref) {
    return readBuffer(ref).toString('utf8');
  }

  /** Raw bytes of a ref, re-hashed against its recorded digest before they are returned. */
  function readBuffer(ref) {
    const bytes = fs.readFileSync(abs(ref));
    if (sha256(bytes) !== ref.digest) {
      throw fail('DIGEST_MISMATCH', `file changed since it was written: ${ref.file}`);
    }
    return bytes;
  }

  function latestByKind(kind) {
    // most recently written ref of that kind (index is in write order)
    const matches = loadRefs().filter((r) => r.kind === kind);
    return matches.length ? matches[matches.length - 1] : null;
  }

  function latestByName(name) {
    const matches = loadRefs().filter((r) => r.name === name);
    if (!matches.length) return null;
    return matches.reduce((best, r) => (r.version > best.version ? r : best));
  }

  function list() {
    return loadRefs().slice().sort(byNameThenVersion);
  }

  return { write, read, readBuffer, latestByKind, latestByName, list, abs };
}
