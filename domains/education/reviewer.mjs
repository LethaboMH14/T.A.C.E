// Education domain INDEPENDENT REVIEWER (H8).
// Recomputes every figure from the admitted raw sources and re-opens every latest artifact from
// disk (store.read re-checks sha256). Imports only engine/contracts.mjs, engine/csv.mjs,
// domains/education/rules.mjs and node built-ins. It must never import a worker module: the
// reviewer repeating a worker's code would repeat the worker's bug.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CHECK_STATUS, KIND } from '../../engine/contracts.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import {
  AT_RISK_MIN_GAPS,
  DAYS,
  DRAFT_STATUS,
  LATE_LOGIN_DAY,
  MEAN_DECIMALS,
  NUMBER_TOLERANCE,
  RULES_VERSION,
  SESSION_MINUTES,
  WEEK_OF,
} from './rules.mjs';

const NAMES = Object.freeze({
  gap: 'gap-analysis.csv',
  summaryJson: 'performance-summary.json',
  summaryMd: 'performance-summary.md',
  plan: 'improvement-plan.json',
  schedule: 'mentor-schedule.csv',
  drafts: 'unsent-message-drafts.json',
});

const TITLES = Object.freeze({
  C01_gaps_match: 'Gap analysis matches the raw assessment scores',
  C02_summary_numbers: 'Summary numbers match the raw scores',
  C03_summary_text_matches: 'Summary text shows the same means as the JSON',
  C04_schedule_no_overlap: 'No mentor is booked twice at the same time',
  C05_schedule_in_availability: 'Every booked session is inside a mentor availability window',
  C06_schedule_capacity: 'No mentor is booked beyond capacity',
  C07_schedule_skill_match: 'Each booked mentor teaches the session skill',
  C08_schedule_covers_at_risk: 'Every at-risk learner has a booked mentor session',
  C09_plan_refs: 'Every support item points to a real gap and a known activity',
  C10_drafts_unsent: 'Every message draft is still unsent',
  C11_drafts_match_schedule: 'Learner drafts match the booked schedule',
  C12_artifacts_intact: 'Every artifact re-reads with its recorded digest',
  C13_source_digests: 'Source inputs match the admitted files',
});

const GAP_COLUMNS = ['trainee_id', 'display_name', 'skill_id', 'score', 'threshold', 'shortfall', 'at_risk', 'source_file', 'source_row'];
const SCHEDULE_COLUMNS = ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'intervention_id', 'status'];
const NUMERIC_GAP_FIELDS = new Set(['score', 'threshold', 'shortfall', 'source_row']);
const SCORE_RE = /^[-+]?\d+(\.\d+)?$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => (v === null || v === undefined ? 'nothing' : String(v));

function minutesOf(t) {
  const m = TIME_RE.exec(String(t ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function hhmm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function dateFor(day) {
  const i = DAYS.indexOf(day);
  if (i < 0) return null;
  const [y, m, d] = WEEK_OF.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
}

function roundMean(x) {
  const f = 10 ** MEAN_DECIMALS;
  return Math.round(x * f) / f;
}

/** Admitted CSV rows paired with their physical line number. */
function withRows(src) {
  return src.rows.map((r, i) => ({ r, row: src.rowNumbers[i] }));
}

function evidenceOf(sourceId, rows) {
  const seen = new Set();
  const out = [];
  for (const row of [...rows].sort((a, b) => a - b)) {
    if (row === null || row === undefined || seen.has(row)) continue;
    seen.add(row);
    out.push({ sourceId, row });
  }
  return out;
}

/** Independent recomputation from the admitted raw sources. */
function recompute(sources) {
  const trainees = withRows(sources.trainees).sort((a, b) => cmp(a.r.trainee_id, b.r.trainee_id));
  const skillRows = withRows(sources.skills).sort((a, b) => cmp(a.r.skill_id, b.r.skill_id));
  const assessments = withRows(sources.assessments);

  const cellOf = new Map();
  for (const a of assessments) cellOf.set(`${a.r.trainee_id}|${a.r.skill_id}`, a);

  const stats = new Map();
  for (const { r } of skillRows) {
    stats.set(r.skill_id, {
      skill_id: r.skill_id, name: r.name, threshold: Number(r.threshold),
      present: 0, missing: 0, below_threshold: 0, sum: 0,
    });
  }

  const invalid = [];
  const learners = [];
  const gaps = [];
  for (const t of trainees) {
    const learnerGaps = [];
    for (const { r: s } of skillRows) {
      const st = stats.get(s.skill_id);
      const cell = cellOf.get(`${t.r.trainee_id}|${s.skill_id}`);
      const raw = cell ? String(cell.r.score ?? '').trim() : '';
      if (raw === '') {
        st.missing += 1; // missing is NOT a gap and NOT zero
        continue;
      }
      if (!SCORE_RE.test(raw)) {
        invalid.push({ trainee_id: t.r.trainee_id, skill_id: s.skill_id, row: cell.row, value: raw });
        continue;
      }
      const score = Number(raw);
      st.present += 1;
      st.sum += score;
      if (score < st.threshold) {
        st.below_threshold += 1;
        learnerGaps.push({
          trainee_id: t.r.trainee_id, skill_id: s.skill_id, score,
          threshold: st.threshold, shortfall: st.threshold - score, row: cell.row,
        });
      }
    }
    const firstLogin = Number(t.r.first_login_day);
    const atRisk = learnerGaps.length >= AT_RISK_MIN_GAPS
      || (firstLogin >= LATE_LOGIN_DAY && learnerGaps.length >= 1);
    let priority = null;
    if (atRisk) {
      // largest (threshold - score); tie -> lowest skill_id (gaps are already in skill_id order)
      for (const g of learnerGaps) {
        if (priority === null || g.shortfall > priority.shortfall) priority = g;
      }
    }
    learners.push({
      trainee_id: t.r.trainee_id, display_name: t.r.display_name, first_login_day: firstLogin,
      row: t.row, gaps: learnerGaps, at_risk: atRisk,
      priority_skill: priority ? priority.skill_id : null,
    });
    gaps.push(...learnerGaps);
  }

  const skills = [...stats.values()].map((st) => ({
    skill_id: st.skill_id,
    name: st.name,
    threshold: st.threshold,
    mean: st.present ? roundMean(st.sum / st.present) : null,
    present: st.present,
    missing: st.missing,
    below_threshold: st.below_threshold,
  }));

  return {
    trainees: learners.length,
    assessedCells: skills.reduce((n, s) => n + s.present, 0),
    missingCells: skills.reduce((n, s) => n + s.missing, 0),
    skills,
    learners,
    learnerById: new Map(learners.map((l) => [l.trainee_id, l])),
    gaps,
    gapByKey: new Map(gaps.map((g) => [`${g.trainee_id}|${g.skill_id}`, g])),
    invalid,
    atRiskIds: learners.filter((l) => l.at_risk).map((l) => l.trainee_id),
    traineeRows: trainees,
    assessments,
  };
}

function buildModel(sources) {
  const missing = ['trainees', 'assessments', 'skills'].filter((id) => !sources[id]);
  if (missing.length) {
    return { model: null, problem: `source ${missing.join(', ')} was not admitted, so the reviewer cannot recompute these figures` };
  }
  try {
    return { model: recompute(sources), problem: null };
  } catch (err) {
    return { model: null, problem: `recomputation from the sources failed (${err.message})` };
  }
}

function requireModel(model, problem) {
  if (!model) throw new Error(problem);
  if (model.invalid.length) {
    throw new Error(`${model.invalid.length} source score(s) are not numbers (first: ${model.invalid[0].value} on line ${model.invalid[0].row}), so the figures cannot be recomputed`);
  }
}

function requireSource(src, id) {
  if (!src) throw new Error(`source ${id} was not admitted`);
  return src;
}

// ---- reading artifacts (re-open from disk; store.read re-verifies sha256) ----

function openText(store, ref) {
  try {
    return store.read(ref);
  } catch (err) {
    throw new Error(`${ref.name}@v${ref.version} could not be re-opened (${err.code ?? 'error'})`);
  }
}

function parseJsonArtifact(store, ref) {
  const text = openText(store, ref);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${ref.name} cannot be parsed as JSON`);
  }
}

/** Returns { csv, problem }. problem is set when required columns are absent (a FAIL, not UNKNOWN). */
function loadCsv(store, ref, columns) {
  const text = openText(store, ref);
  let csv;
  try {
    csv = parseCsv(text);
  } catch (err) {
    throw new Error(`${ref.name} cannot be parsed as CSV (${err.code ?? 'error'})`);
  }
  const missing = columns.filter((c) => !csv.header.includes(c));
  const problem = missing.length ? `${ref.name} is missing columns: ${missing.join(', ')}.` : null;
  return { csv, problem };
}

function scheduleRows(store, ref) {
  const { csv, problem } = loadCsv(store, ref, SCHEDULE_COLUMNS);
  if (problem) return { problem, rows: [] };
  return { problem: null, rows: csv.rows.map((r, i) => ({ r, row: csv.rowNumbers[i] })) };
}

// ---- result builders ----

const pass = (fields) => ({ status: CHECK_STATUS.PASS, ...fields });
const fail = (fields) => ({ status: CHECK_STATUS.FAIL, ...fields });
const unknown = (message) => ({ status: CHECK_STATUS.UNKNOWN, expected: null, observed: null, evidence: [], message });

function emit(checks, id, ref, kind, res) {
  const check = {
    id,
    title: TITLES[id],
    artifact: `${ref.name}@v${ref.version}`,
    kind,
    status: res.status,
    expected: res.expected ?? null,
    observed: res.observed ?? null,
    evidence: res.evidence ?? [],
    message: res.message,
  };
  if (res.detail !== undefined) check.detail = res.detail;
  checks.push(check);
}

function attempt(checks, id, ref, kind, fn) {
  let res;
  try {
    res = fn();
  } catch (err) {
    res = unknown(`Not checked: ${err.message}.`);
  }
  emit(checks, id, ref, kind, res);
}

function describeSummaryMismatch(m, model) {
  const mean = /^skills\.(S[^.]*)\.mean$/.exec(m.field);
  if (mean) {
    const name = model.skills.find((s) => s.skill_id === mean[1])?.name ?? '';
    return `The ${mean[1]} ${name} average should be ${show(m.expected)} (present scores only) but the report says ${show(m.observed)}`;
  }
  return `${m.field} should be ${show(m.expected)} but the report says ${show(m.observed)}`;
}

// ---- C01 ----
function checkGaps(store, ref, model, problem) {
  requireModel(model, problem);
  const { csv, problem: csvProblem } = loadCsv(store, ref, GAP_COLUMNS);
  if (csvProblem) return fail({ expected: GAP_COLUMNS.join(','), observed: csv.header.join(','), evidence: [], message: csvProblem });

  const seen = new Map();
  const mismatches = [];
  csv.rows.forEach((r, i) => {
    const key = `${r.trainee_id}|${r.skill_id}`;
    if (seen.has(key)) {
      mismatches.push({ trainee_id: r.trainee_id, skill_id: r.skill_id, field: 'row', expected: 'one row', observed: `duplicate on line ${csv.rowNumbers[i]}` });
    } else {
      seen.set(key, { r });
    }
  });

  const badKeys = new Set();
  for (const g of model.gaps) {
    const key = `${g.trainee_id}|${g.skill_id}`;
    const hit = seen.get(key);
    if (!hit) {
      mismatches.push({ trainee_id: g.trainee_id, skill_id: g.skill_id, field: 'row', expected: 'gap row', observed: 'absent' });
      badKeys.add(key);
      continue;
    }
    seen.delete(key);
    const learner = model.learnerById.get(g.trainee_id);
    const want = {
      score: g.score,
      threshold: g.threshold,
      shortfall: g.shortfall,
      at_risk: learner.at_risk ? 'yes' : 'no',
      source_file: 'assessments.csv',
      source_row: g.row,
    };
    for (const field of Object.keys(want)) {
      const got = hit.r[field];
      const same = NUMERIC_GAP_FIELDS.has(field) ? Number(got) === want[field] : got === want[field];
      if (!same) {
        mismatches.push({ trainee_id: g.trainee_id, skill_id: g.skill_id, field, expected: want[field], observed: got });
        badKeys.add(key);
      }
    }
  }
  for (const [key, { r }] of seen) {
    mismatches.push({ trainee_id: r.trainee_id, skill_id: r.skill_id, field: 'row', expected: 'no gap', observed: 'extra row' });
    badKeys.add(key);
  }

  const evidence = evidenceOf('assessments', model.gaps.map((g) => g.row));
  const expected = model.gaps.length;
  const observed = csv.rows.length;
  if (mismatches.length === 0) {
    return pass({ expected, observed, evidence, message: `All ${expected} gaps match the assessments rows.` });
  }
  const first = mismatches[0];
  return fail({
    expected,
    observed,
    evidence: evidenceOf('assessments', model.gaps.filter((g) => badKeys.has(`${g.trainee_id}|${g.skill_id}`)).map((g) => g.row)),
    detail: { mismatches },
    message: `${first.trainee_id} ${first.skill_id}: ${first.field} should be ${show(first.expected)} but the report says ${show(first.observed)}.${mismatches.length > 1 ? ` ${mismatches.length - 1} more gap row(s) also differ.` : ''}`,
  });
}

// ---- C02 ----
function checkSummaryNumbers(store, ref, model, problem) {
  requireModel(model, problem);
  const json = parseJsonArtifact(store, ref);
  if (!isPlainObject(json)) return fail({ message: 'performance-summary.json is not a JSON object.' });

  const mismatches = [];
  const scalar = (field, want) => {
    if (json[field] !== want) mismatches.push({ field, expected: want, observed: json[field] ?? null });
  };
  scalar('rulesVersion', RULES_VERSION);
  scalar('trainees', model.trainees);
  scalar('assessed_cells', model.assessedCells);
  scalar('missing_cells', model.missingCells);
  scalar('at_risk_count', model.atRiskIds.length);

  const ids = Array.isArray(json.at_risk_ids) ? json.at_risk_ids : null;
  const idsOk = ids !== null && ids.length === model.atRiskIds.length && ids.every((x, i) => x === model.atRiskIds[i]);
  if (!idsOk) mismatches.push({ field: 'at_risk_ids', expected: model.atRiskIds.join(','), observed: ids ? ids.join(',') : null });

  const jsonSkills = Array.isArray(json.skills) ? json.skills : [];
  const bySkill = new Map();
  for (const s of jsonSkills) if (isPlainObject(s)) bySkill.set(s.skill_id, s);
  for (const st of model.skills) {
    const js = bySkill.get(st.skill_id);
    if (!js) {
      mismatches.push({ field: `skills.${st.skill_id}`, expected: 'listed', observed: 'missing' });
      continue;
    }
    for (const f of ['name', 'threshold', 'present', 'missing', 'below_threshold']) {
      if (js[f] !== st[f]) mismatches.push({ field: `skills.${st.skill_id}.${f}`, expected: st[f], observed: js[f] ?? null });
    }
    const meanOk = st.mean === null
      ? js.mean === null
      : typeof js.mean === 'number' && Math.abs(js.mean - st.mean) <= NUMBER_TOLERANCE + 1e-9;
    if (!meanOk) mismatches.push({ field: `skills.${st.skill_id}.mean`, expected: st.mean, observed: js.mean ?? null });
  }
  for (const id of bySkill.keys()) {
    if (!model.skills.some((s) => s.skill_id === id)) mismatches.push({ field: `skills.${id}`, expected: 'not in the sources', observed: 'listed' });
  }

  if (mismatches.length === 0) {
    return pass({
      expected: model.atRiskIds.length,
      observed: json.at_risk_count,
      message: `All totals and skill figures match the raw scores (${model.assessedCells} present scores).`,
    });
  }

  const evidence = [];
  const assessRows = new Set();
  const traineeRows = new Set();
  for (const m of mismatches) {
    const sid = m.field.startsWith('skills.') ? m.field.split('.')[1] : null;
    if (sid) {
      for (const a of model.assessments) if (a.r.skill_id === sid) assessRows.add(a.row);
    } else if (m.field === 'assessed_cells' || m.field === 'missing_cells') {
      for (const a of model.assessments) assessRows.add(a.row);
    } else if (m.field.startsWith('at_risk')) {
      for (const l of model.learners) if (l.at_risk) traineeRows.add(l.row);
    } else if (m.field === 'trainees') {
      for (const t of model.traineeRows) traineeRows.add(t.row);
    }
  }
  evidence.push(...evidenceOf('assessments', [...assessRows]), ...evidenceOf('trainees', [...traineeRows]));

  const first = mismatches[0];
  return fail({
    expected: first.expected,
    observed: first.observed,
    evidence,
    detail: { mismatches },
    message: `${describeSummaryMismatch(first, model)}.${mismatches.length > 1 ? ` ${mismatches.length - 1} more figure(s) also differ.` : ''}`,
  });
}

// ---- C03 ----
function checkSummaryText(store, ref, model, problem, jsonRef) {
  requireModel(model, problem);
  if (!jsonRef) throw new Error('performance-summary.json is missing, so the report text has nothing to compare with');
  const md = openText(store, ref);
  const json = parseJsonArtifact(store, jsonRef);
  if (!Array.isArray(json.skills)) return fail({ message: 'performance-summary.json has no skills list to compare the report with.' });

  const tableRows = md.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => {
      const cells = l.split('|').map((c) => c.trim());
      if (cells[0] === '') cells.shift();
      if (cells.length && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });

  const mismatches = [];
  let matched = 0;
  for (const s of json.skills) {
    const row = tableRows.find((c) => c.length && c[0].split(/\s+/)[0] === s.skill_id);
    const cell = row ? row[1] : undefined;
    const ok = s.mean === null
      ? cell !== undefined && !/^-?\d/.test(cell)
      : cell !== undefined && Math.abs(Number(cell) - s.mean) < 1e-9;
    if (ok) matched += 1;
    else mismatches.push({ field: `report.${s.skill_id}.mean`, expected: s.mean, observed: cell ?? 'no row' });
  }

  if (mismatches.length === 0) {
    return pass({ expected: json.skills.length, observed: matched, message: 'Every skill row in the report shows the JSON mean.' });
  }
  const sids = new Set(mismatches.map((m) => m.field.split('.')[1]));
  const rows = [];
  for (const a of model.assessments) if (sids.has(a.r.skill_id)) rows.push(a.row);
  const first = mismatches[0];
  const sid = first.field.split('.')[1];
  return fail({
    expected: first.expected,
    observed: first.observed,
    evidence: evidenceOf('assessments', rows),
    detail: { mismatches },
    message: `The ${sid} row in the report should show ${show(first.expected)} but shows ${show(first.observed)}.`,
  });
}

// ---- C04 .. C08 (mentor schedule) ----
function checkNoOverlap(sch, names) {
  if (sch.problem) return fail({ message: sch.problem });
  const booked = sch.rows.filter((x) => x.r.status === 'BOOKED');
  const sorted = booked.slice().sort((a, b) => cmp(a.r.mentor_id, b.r.mentor_id)
    || cmp(a.r.day, b.r.day)
    || minutesOf(a.r.start) - minutesOf(b.r.start)
    || cmp(a.r.session_id, b.r.session_id));

  const conflicts = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i].r;
      const b = sorted[j].r;
      if (a.mentor_id !== b.mentor_id || a.day !== b.day) break;
      if (minutesOf(b.start) < minutesOf(a.start) + SESSION_MINUTES) {
        conflicts.push({ mentor_id: a.mentor_id, day: a.day, start: a.start, sessions: [a.session_id, b.session_id] });
      }
    }
  }
  if (conflicts.length === 0) {
    return pass({ expected: 0, observed: 0, message: `No mentor has overlapping sessions across ${booked.length} booked sessions.` });
  }
  const c = conflicts[0];
  return fail({
    expected: 0,
    observed: conflicts.length,
    detail: { conflicts },
    message: `${names.get(c.mentor_id) ?? c.mentor_id} is booked twice on ${c.day} at ${c.start} (${c.sessions[0]} and ${c.sessions[1]}).${conflicts.length > 1 ? ` ${conflicts.length - 1} more clash(es) exist.` : ''}`,
  });
}

function checkInAvailability(sch, src, scenario) {
  if (sch.problem) return fail({ message: sch.problem });
  const availability = withRows(requireSource(src.availability, 'availability'));
  const unavailable = Array.isArray(scenario?.unavailable) ? scenario.unavailable : [];
  const booked = sch.rows.filter((x) => x.r.status === 'BOOKED');
  const bad = [];
  const evidence = [];
  for (const { r, row } of booked) {
    const s = minutesOf(r.start);
    const e = s + SESSION_MINUTES;
    const wins = availability.filter((w) => w.r.mentor_id === r.mentor_id && w.r.day === r.day);
    const win = wins.find((w) => minutesOf(w.r.start) <= s && e <= minutesOf(w.r.end));
    let reason = null;
    if (!win) reason = 'outside every availability window';
    else {
      evidence.push(win.row);
      if (unavailable.some((u) => u.mentor_id === r.mentor_id && u.day === r.day)) reason = 'in a window the mentor cannot take';
      else if (r.end !== hhmm(e)) reason = `ending at ${r.end} instead of ${hhmm(e)}`;
      else if (r.date !== dateFor(r.day)) reason = `dated ${r.date} instead of ${dateFor(r.day)}`;
    }
    if (reason) bad.push({ session_id: r.session_id, mentor_id: r.mentor_id, day: r.day, start: r.start, reason });
    void row;
  }
  const ev = evidenceOf('availability', evidence);
  if (bad.length === 0) {
    return pass({ expected: booked.length, observed: booked.length, evidence: ev, message: `All ${booked.length} booked sessions sit inside availability windows.` });
  }
  const first = bad[0];
  return fail({
    expected: booked.length,
    observed: booked.length - bad.length,
    evidence: ev,
    detail: { mismatches: bad },
    message: `Session ${first.session_id} (${first.mentor_id}, ${first.day} ${first.start}) is ${first.reason}.${bad.length > 1 ? ` ${bad.length - 1} more session(s) also fail.` : ''}`,
  });
}

function checkCapacity(sch, src) {
  if (sch.problem) return fail({ message: sch.problem });
  const mentors = withRows(requireSource(src.mentors, 'mentors'));
  const byId = new Map(mentors.map((m) => [m.r.mentor_id, m]));
  const booked = sch.rows.filter((x) => x.r.status === 'BOOKED');
  const count = new Map();
  for (const { r } of booked) count.set(r.mentor_id, (count.get(r.mentor_id) ?? 0) + 1);

  const bad = [];
  const evidence = [];
  for (const [id, n] of [...count].sort((a, b) => cmp(a[0], b[0]))) {
    const m = byId.get(id);
    if (!m) {
      bad.push({ field: `mentors.${id}`, expected: 'a known mentor', observed: n });
      continue;
    }
    evidence.push(m.row);
    const cap = Number(m.r.capacity);
    if (!(n <= cap)) bad.push({ field: `mentors.${id}.sessions`, expected: cap, observed: n });
  }
  if (bad.length === 0) {
    return pass({ expected: count.size, observed: count.size, evidence: evidenceOf('mentors', evidence), message: 'Every mentor is within capacity.' });
  }
  const first = bad[0];
  return fail({
    expected: count.size,
    observed: count.size - bad.length,
    evidence: evidenceOf('mentors', evidence),
    detail: { mismatches: bad },
    message: `${first.field} should be ${show(first.expected)} but the schedule has ${show(first.observed)}.`,
  });
}

function checkSkillMatch(sch, src) {
  if (sch.problem) return fail({ message: sch.problem });
  const mentors = withRows(requireSource(src.mentors, 'mentors'));
  const byId = new Map(mentors.map((m) => [m.r.mentor_id, m]));
  const booked = sch.rows.filter((x) => x.r.status === 'BOOKED');
  const bad = [];
  const evidence = [];
  for (const { r } of booked) {
    const m = byId.get(r.mentor_id);
    if (m) evidence.push(m.row);
    const skills = m ? String(m.r.skills).split(';').map((s) => s.trim()).filter(Boolean) : [];
    if (!m || !skills.includes(r.skill_id)) {
      bad.push({ session_id: r.session_id, mentor_id: r.mentor_id, field: 'skill_id', expected: r.skill_id, observed: m ? m.r.skills : 'unknown mentor' });
    }
  }
  const ev = evidenceOf('mentors', evidence);
  if (bad.length === 0) return pass({ expected: booked.length, observed: booked.length, evidence: ev, message: `All ${booked.length} booked mentors teach the session skill.` });
  const first = bad[0];
  return fail({
    expected: booked.length,
    observed: booked.length - bad.length,
    evidence: ev,
    detail: { mismatches: bad },
    message: `Session ${first.session_id} needs ${first.expected}, but ${first.mentor_id} teaches ${show(first.observed)}.`,
  });
}

function checkCoversAtRisk(sch, model) {
  if (sch.problem) return fail({ message: sch.problem });
  const booked = new Set(sch.rows.filter((x) => x.r.status === 'BOOKED').map((x) => x.r.trainee_id));
  const uncovered = model.atRiskIds.filter((id) => !booked.has(id));
  const atRiskRows = model.learners.filter((l) => l.at_risk).map((l) => l.row);
  const ev = evidenceOf('trainees', atRiskRows);
  const covered = model.atRiskIds.length - uncovered.length;
  if (uncovered.length === 0) {
    return pass({ expected: model.atRiskIds.length, observed: covered, evidence: ev, message: `All ${model.atRiskIds.length} at-risk learners have a booked mentor session.` });
  }
  const first = uncovered[0];
  const name = model.learnerById.get(first)?.display_name ?? first;
  return fail({
    expected: model.atRiskIds.length,
    observed: covered,
    evidence: ev,
    detail: { uncovered },
    message: `${name} (${first}) is at risk but has no booked mentor session.${uncovered.length > 1 ? ` ${uncovered.length - 1} more at-risk learner(s) are uncovered.` : ''}`,
  });
}

// ---- C09 ----
function checkPlanRefs(store, ref, model, problem, src) {
  requireModel(model, problem);
  const plan = parseJsonArtifact(store, ref);
  if (!isPlainObject(plan) || !Array.isArray(plan.items)) return fail({ message: 'improvement-plan.json has no items list.' });
  const interventions = requireSource(src.interventions, 'interventions').json;
  const ivById = new Map((Array.isArray(interventions) ? interventions : []).map((iv) => [iv.intervention_id, iv]));

  const bad = [];
  const evidence = [];
  plan.items.forEach((item, index) => {
    const g = model.gapByKey.get(`${item?.trainee_id}|${item?.skill_id}`);
    let reason = null;
    if (!g) reason = 'is not a verified gap';
    else {
      evidence.push(g.row);
      const iv = ivById.get(item.intervention_id);
      if (!iv) reason = 'points to an unknown activity';
      else if (iv.skill_id !== item.skill_id) reason = `points to an activity for ${iv.skill_id}`;
      else if (iv.kind !== item.kind) reason = 'gives a kind that does not match the activity';
      else if (item.source_row !== undefined && Number(item.source_row) !== g.row) reason = `cites line ${item.source_row} but the score is on line ${g.row}`;
    }
    if (reason) bad.push({ index, trainee_id: item?.trainee_id ?? null, skill_id: item?.skill_id ?? null, intervention_id: item?.intervention_id ?? null, reason });
  });
  const ev = evidenceOf('assessments', evidence);
  const total = plan.items.length;
  if (bad.length === 0) return pass({ expected: total, observed: total, evidence: ev, message: `All ${total} support items point to a verified gap and a known activity.` });
  const first = bad[0];
  return fail({
    expected: total,
    observed: total - bad.length,
    evidence: ev,
    detail: { mismatches: bad },
    message: `Support item for ${first.trainee_id} ${first.skill_id} ${first.reason}.${bad.length > 1 ? ` ${bad.length - 1} more item(s) also fail.` : ''}`,
  });
}

// ---- C10 / C11 (drafts) ----
function checkDraftsUnsent(store, ref) {
  const drafts = parseJsonArtifact(store, ref);
  if (!isPlainObject(drafts) || !Array.isArray(drafts.drafts)) return fail({ message: 'unsent-message-drafts.json has no drafts list.' });
  const mismatches = [];
  if (drafts.status_all !== DRAFT_STATUS) mismatches.push({ field: 'status_all', expected: DRAFT_STATUS, observed: drafts.status_all ?? null });
  for (const d of drafts.drafts) {
    if (d?.status !== DRAFT_STATUS) mismatches.push({ draft_id: d?.draft_id ?? null, field: 'status', expected: DRAFT_STATUS, observed: d?.status ?? null });
  }
  if (mismatches.length === 0) {
    return pass({ expected: DRAFT_STATUS, observed: DRAFT_STATUS, message: `All ${drafts.drafts.length} drafts are UNSENT.` });
  }
  const first = mismatches[0];
  return fail({
    expected: DRAFT_STATUS,
    observed: first.observed,
    detail: { mismatches },
    message: first.draft_id
      ? `Draft ${first.draft_id} is marked ${show(first.observed)}; every draft must stay UNSENT.`
      : `${first.field} is ${show(first.observed)}; it must be UNSENT.`,
  });
}

function checkDraftsMatchSchedule(store, ref, schRef) {
  const drafts = parseJsonArtifact(store, ref);
  if (!isPlainObject(drafts) || !Array.isArray(drafts.drafts)) return fail({ message: 'unsent-message-drafts.json has no drafts list.' });
  if (!schRef) throw new Error('mentor-schedule.csv is missing, so learner drafts have nothing to match');
  const sch = scheduleRows(store, schRef);
  if (sch.problem) return fail({ message: sch.problem });
  const bySession = new Map();
  for (const { r } of sch.rows) {
    if (r.status === 'BOOKED' && !bySession.has(r.session_id)) bySession.set(r.session_id, r);
  }
  const learner = drafts.drafts.filter((d) => d?.to_role === 'learner');
  const mismatches = [];
  for (const d of learner) {
    const row = bySession.get(d.session_id);
    if (!row) {
      mismatches.push({ draft_id: d.draft_id, session_id: d.session_id ?? null, field: 'session_id', expected: 'a BOOKED session', observed: d.session_id ?? null });
      continue;
    }
    const want = { to_id: row.trainee_id, mentor_id: row.mentor_id, day: row.day, start: row.start };
    for (const field of Object.keys(want)) {
      if (d[field] !== want[field]) {
        mismatches.push({ draft_id: d.draft_id, session_id: d.session_id, field, expected: want[field], observed: d[field] ?? null });
      }
    }
  }
  if (mismatches.length === 0) {
    return pass({ expected: learner.length, observed: learner.length, message: `All ${learner.length} learner drafts match a booked session.` });
  }
  const first = mismatches[0];
  return fail({
    expected: learner.length,
    observed: learner.length - mismatches.length,
    detail: { mismatches },
    message: first.field === 'session_id'
      ? `Draft ${first.draft_id} refers to ${show(first.observed)}, which is not a booked session.`
      : `Draft ${first.draft_id} says ${first.field} is ${show(first.observed)}, but the latest schedule has ${show(first.expected)} for ${first.session_id}.`,
  });
}

// ---- C12 / C13 (all latest artifacts) ----
function latestPerName(store) {
  const best = new Map();
  for (const r of store.list()) {
    const cur = best.get(r.name);
    if (!cur || r.version > cur.version) best.set(r.name, r);
  }
  return [...best.values()].sort((a, b) => cmp(a.name, b.name));
}

function actualDigest(store, ref) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(store.abs(ref))).digest('hex');
  } catch {
    return 'unreadable';
  }
}

function checkIntact(store, ref) {
  try {
    store.read(ref);
    return pass({ expected: ref.digest, observed: ref.digest, message: 'Re-read from disk; the sha256 matches the recorded digest.' });
  } catch (err) {
    if (err.code === 'DIGEST_MISMATCH') {
      const actual = actualDigest(store, ref);
      return fail({
        expected: ref.digest,
        observed: actual,
        message: `${ref.file} changed after it was written: its digest is now ${actual.slice(0, 12)} but was ${ref.digest.slice(0, 12)}.`,
      });
    }
    return fail({ expected: ref.digest, observed: err.code ?? 'ERROR', message: `${ref.file} could not be re-opened (${err.code ?? 'error'}).` });
  }
}

function checkSourceDigests(ref, sources) {
  const admitted = new Map();
  for (const s of Object.values(sources)) {
    if (s && s.file) admitted.set(path.basename(s.file), s.digest);
  }
  const inputs = Array.isArray(ref.inputs) ? ref.inputs : [];
  const checked = inputs.filter((i) => admitted.has(i.name));
  const mismatches = checked
    .filter((i) => i.digest !== admitted.get(i.name))
    .map((i) => ({ field: i.name, expected: admitted.get(i.name), observed: i.digest ?? null }));
  if (mismatches.length === 0) {
    return pass({
      expected: checked.length,
      observed: checked.length,
      message: checked.length
        ? `Every source input (${checked.map((i) => i.name).join(', ')}) carries its admitted digest.`
        : 'No admitted source file is recorded as an input.',
    });
  }
  const first = mismatches[0];
  return fail({
    expected: first.expected,
    observed: first.observed,
    detail: { mismatches },
    message: `${ref.name} was built from ${first.field} with a digest that does not match the admitted file.`,
  });
}

/**
 * Independent review of the latest artifacts.
 * @param {{sources: Record<string, any>, store: any, scenario?: any}} ctx
 * @returns {Promise<{checks: object[]}>}
 */
export async function review(ctx) {
  const store = ctx.store;
  const sources = ctx.sources ?? {};
  const scenario = ctx.scenario ?? {};
  const checks = [];
  const { model, problem } = buildModel(sources);
  const names = new Map(sources.mentors ? withRows(sources.mentors).map((m) => [m.r.mentor_id, m.r.display_name]) : []);

  const gapRef = store.latestByName(NAMES.gap);
  if (gapRef) attempt(checks, 'C01_gaps_match', gapRef, KIND.GAP_ANALYSIS, () => checkGaps(store, gapRef, model, problem) );

  const sumRef = store.latestByName(NAMES.summaryJson);
  const sumMdRef = store.latestByName(NAMES.summaryMd);
  if (sumRef) attempt(checks, 'C02_summary_numbers', sumRef, KIND.PERFORMANCE_SUMMARY, () => checkSummaryNumbers(store, sumRef, model, problem));
  if (sumMdRef) attempt(checks, 'C03_summary_text_matches', sumMdRef, KIND.PERFORMANCE_SUMMARY, () => checkSummaryText(store, sumMdRef, model, problem, sumRef));

  const schRef = store.latestByName(NAMES.schedule);
  if (schRef) {
    const sch = () => scheduleRows(store, schRef);
    attempt(checks, 'C04_schedule_no_overlap', schRef, KIND.MENTOR_SCHEDULE, () => checkNoOverlap(sch(), names));
    attempt(checks, 'C05_schedule_in_availability', schRef, KIND.MENTOR_SCHEDULE, () => checkInAvailability(sch(), sources, scenario));
    attempt(checks, 'C06_schedule_capacity', schRef, KIND.MENTOR_SCHEDULE, () => checkCapacity(sch(), sources));
    attempt(checks, 'C07_schedule_skill_match', schRef, KIND.MENTOR_SCHEDULE, () => checkSkillMatch(sch(), sources));
    attempt(checks, 'C08_schedule_covers_at_risk', schRef, KIND.MENTOR_SCHEDULE, () => {
      requireModel(model, problem);
      return checkCoversAtRisk(sch(), model);
    });
  }

  const planRef = store.latestByName(NAMES.plan);
  if (planRef) attempt(checks, 'C09_plan_refs', planRef, KIND.IMPROVEMENT_PLAN, () => checkPlanRefs(store, planRef, model, problem, sources));

  const draftsRef = store.latestByName(NAMES.drafts);
  if (draftsRef) {
    attempt(checks, 'C10_drafts_unsent', draftsRef, KIND.MESSAGE_DRAFTS, () => checkDraftsUnsent(store, draftsRef));
    attempt(checks, 'C11_drafts_match_schedule', draftsRef, KIND.MESSAGE_DRAFTS, () => checkDraftsMatchSchedule(store, draftsRef, schRef));
  }

  // Integrity checks run on every latest file, then fold into ONE check per rule so the
  // headline count means "rules checked", with the per-file results kept in detail.files.
  const latest = latestPerName(store).filter((r) => !META_NAMES.has(r.name));
  for (const [id, title, fn] of [
    ['C12_artifacts_intact', 'Every saved file still matches its recorded fingerprint', (ref) => checkIntact(store, ref)],
    ['C13_source_digests', 'Every file was built from the admitted source versions', (ref) => checkSourceDigests(ref, sources)],
  ]) {
    if (!latest.length) continue;
    const per = [];
    for (const ref of latest) attempt(per, id, ref, ref.kind, () => fn(ref));
    checks.push(foldIntegrity(id, title, per));
  }

  checks.sort((a, b) => cmp(a.id, b.id) || cmp(a.artifact, b.artifact));
  return { checks };
}

// Runner bookkeeping files are not domain deliverables.
const META_NAMES = new Set(['evidence-checks.json', 'repair-history.json', 'final-manifest.json']);

function foldIntegrity(id, title, per) {
  const bad = per.filter((c) => c.status !== 'PASS');
  const status = bad.some((c) => c.status === 'FAIL') ? 'FAIL' : bad.length ? 'UNKNOWN' : 'PASS';
  const worst = bad.find((c) => c.status === 'FAIL') ?? bad[0];
  return {
    id, title,
    artifact: `${per.length} files`,
    kind: worst ? worst.kind : 'all',
    status,
    expected: per.length,
    observed: per.length - bad.length,
    evidence: bad.flatMap((c) => c.evidence ?? []),
    detail: { files: per.map((c) => ({ artifact: c.artifact, status: c.status, message: c.message })) },
    message: status === 'PASS' ? `${per.length} of ${per.length} files checked.` : `${bad.length} of ${per.length} files failed: ${worst.message}`,
  };
}
