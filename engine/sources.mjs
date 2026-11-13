// T.A.C.E runtime slice — admit synthetic input files with provenance (ADR-0008).
// Reads raw bytes, hashes them (sha256), parses, validates schema and keys. Never writes.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseCsv } from './csv.mjs';

/**
 * @param {string} baseDir
 * @param {Array<{sourceId:string, kind:string, file:string, version:string, format:'csv'|'json', requiredColumns?:string[], keyColumns?:string[]}>} specs
 * @param {{exclude?: string[], maxBytes?: number}} [opts]
 */
export function admitSources(baseDir, specs, { exclude = [], maxBytes = 1_000_000 } = {}) {
  const base = path.resolve(baseDir);
  const excluded = new Set(exclude);
  const sources = {};
  const problems = [];

  for (const spec of specs) {
    const id = spec.sourceId;
    const problem = (code, message) => problems.push({ sourceId: id, code, message });
    const before = problems.length;

    if (excluded.has(id)) {
      problem('MISSING_SOURCE', `${id} is excluded for this run`);
      continue;
    }

    const rel = String(spec.file ?? '');
    if (rel.includes('\0')) {
      problem('OUTSIDE_DIR', `${id}: file path contains a NUL byte`);
      continue;
    }
    const full = path.resolve(base, rel);
    if (full !== base && !full.startsWith(base + path.sep)) {
      problem('OUTSIDE_DIR', `${id}: ${rel} resolves outside the source directory`);
      continue;
    }

    const stat = fs.statSync(full, { throwIfNoEntry: false });
    if (!stat || !stat.isFile()) {
      problem('MISSING_SOURCE', `${id}: file ${rel} does not exist`);
      continue;
    }
    if (stat.size > maxBytes) {
      problem('TOO_LARGE', `${id}: ${stat.size} bytes exceeds limit of ${maxBytes}`);
      continue;
    }

    const bytes = fs.readFileSync(full);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const common = { sourceId: id, kind: spec.kind, file: full, version: spec.version, digest };

    if (spec.format === 'csv') {
      let parsed;
      try {
        parsed = parseCsv(bytes.toString('utf8'));
      } catch (err) {
        problem('PARSE_ERROR', `${id}: ${err.code ?? 'CSV_ERROR'}: ${err.message}`);
        continue;
      }
      const missing = (spec.requiredColumns ?? []).filter((c) => !parsed.header.includes(c));
      const missingKeys = (spec.keyColumns ?? []).filter((c) => !parsed.header.includes(c));
      if (missing.length || missingKeys.length) {
        problem('SCHEMA_MISMATCH', `${id}: missing columns ${[...missing, ...missingKeys].join(', ')}`);
        continue;
      }
      if (spec.keyColumns?.length) {
        const firstLine = new Map();
        for (let i = 0; i < parsed.rows.length; i += 1) {
          const key = JSON.stringify(spec.keyColumns.map((c) => parsed.rows[i][c]));
          const line = parsed.rowNumbers[i];
          if (firstLine.has(key)) {
            problem('DUPLICATE_KEY', `${id}: duplicate key ${key} on line ${line} (first seen on line ${firstLine.get(key)})`);
          } else {
            firstLine.set(key, line);
          }
        }
      }
      if (problems.length === before) {
        const rows = parsed.rows.map((r) => Object.freeze(r));
        sources[id] = Object.freeze({
          ...common,
          header: Object.freeze([...parsed.header]),
          rows: Object.freeze(rows),
          rowNumbers: Object.freeze([...parsed.rowNumbers]),
        });
      }
    } else if (spec.format === 'json') {
      let json;
      try {
        json = JSON.parse(bytes.toString('utf8'));
      } catch (err) {
        problem('PARSE_ERROR', `${id}: invalid JSON: ${err.message}`);
        continue;
      }
      if (problems.length === before) sources[id] = Object.freeze({ ...common, json });
    } else {
      problem('PARSE_ERROR', `${id}: unsupported format ${String(spec.format)}`);
    }
  }

  return { status: problems.length ? 'BLOCKED' : 'ADMITTED', sources, problems };
}

/** Provenance pointer for one row of an admitted CSV source. */
export function rowRef(source, index) {
  return { sourceId: source.sourceId, row: source.rowNumbers[index] };
}
