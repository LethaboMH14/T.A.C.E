// Education domain INDEPENDENT REVIEWER (H8).
// Recomputes every figure from the admitted raw sources and re-opens every latest artifact from
// disk (store.read re-checks sha256). Imports only engine/contracts.mjs, engine/csv.mjs,
// domains/education/rules.mjs and node built-ins. It must never import a worker module: the
// reviewer repeating a worker's code would repeat the worker's bug.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs'; // a PARSER, used here only to read the .xlsx back (not worker code)
import { CHECK_STATUS, KIND } from '../../engine/contracts.mjs';
import { parseCsv } from '../../engine/csv.mjs';
import {
  AT_RISK_MIN_GAPS,
  DAYS,
  DRAFT_STATUS,
  LATE_LOGIN_DAY,
  MEAN_DECIMALS,
  NUMBER_TOLERANCE,
  REQUEST_QUOTE_MAX,
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
  calendar: 'mentor-sessions.ics',
  xlsx: 'mentor-schedule.xlsx',
  brief: 'monday-brief.md',
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
  C14_drafts_text_matches: 'Learner draft text states the booked day, start time and mentor',
  C15_calendar_matches_schedule: 'Calendar file has one event per booked session and nothing else',
  C16_xlsx_matches_schedule: 'Spreadsheet schedule rows equal the latest schedule file',
  C17_brief_numbers_match: 'Monday brief figures equal the recomputed counts',
  C18_requests_answered: 'Every help request has a learner draft that answers it',
  C19_privacy_in_drafts: 'Drafts carry no other learner name and no contact details',
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

function checkDraftsMatchSchedule(store, ref, schRef, sources) {
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
  // A learner who asked for help and has no booked session has a draft with NO session fields.
  const requesters = new Set(sources?.help_requests ? withRows(sources.help_requests).map(({ r }) => r.trainee_id) : []);
  const bookedTrainees = new Set([...bySession.values()].map((r) => r.trainee_id));
  for (const d of learner) {
    if (!d.session_id && requesters.has(d.to_id) && !bookedTrainees.has(d.to_id)) {
      for (const field of ['day', 'date', 'start', 'mentor_id']) {
        if ((d[field] ?? '') !== '') mismatches.push({ draft_id: d.draft_id, session_id: '', field, expected: '', observed: d[field] });
      }
      continue;
    }
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

// ---- C14 (learner draft text) ----
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Any weekday name in the text, full or short. Matched case-sensitively as a whole word.
const WEEKDAY_WORD_RE = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tues?|Wed|Thu(?:rs?)?|Fri|Sat|Sun)\b/g;
const CLOCK_RE = /\b(\d{1,2}):(\d{2})\b/g;

/** "2026-11-17" -> "Tue 17 Nov", computed here (not shared with any worker). */
function dayLabelOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) throw new Error(`booked row has a date that is not ISO: ${JSON.stringify(iso)}`);
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAY_SHORT[dt.getUTCDay()]} ${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]}`;
}

/** Problems in one learner draft body, against its booked session. Each has a plain message. */
function draftProblems(d, row, mentorName) {
  const body = typeof d.body === 'string' ? d.body : '';
  const id = d.draft_id ?? '?';
  const label = dayLabelOf(row.date);
  const startMin = minutesOf(row.start);
  const endMin = minutesOf(row.end);
  const startHm = hhmm(startMin);
  const out = [];
  const base = { session_id: d.session_id ?? null, draft_id: d.draft_id ?? null };

  if (!body.includes(label)) {
    out.push({ ...base, issue: 'day_label_missing', expected: label, found: null,
      say: `Draft ${id} does not give the day ${label}.` });
  }

  const times = [...body.matchAll(CLOCK_RE)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (!times.includes(startMin)) {
    const first = times.length ? hhmm(times[0]) : null;
    out.push({ ...base, issue: 'start_missing', expected: startHm, found: first,
      say: first
        ? `Draft ${id} says ${first} but the session starts at ${startHm}.`
        : `Draft ${id} does not give the start time ${startHm}.` });
  }
  for (const t of times) {
    if (t !== startMin && t !== endMin) {
      out.push({ ...base, issue: 'time_wrong', expected: startHm, found: hhmm(t),
        say: `Draft ${id} says ${hhmm(t)} but the session starts at ${startHm}.` });
    }
  }

  for (const m of body.matchAll(WEEKDAY_WORD_RE)) {
    if (m[1].slice(0, 3) !== row.day) {
      out.push({ ...base, issue: 'weekday_wrong', expected: row.day, found: m[1],
        say: `Draft ${id} says ${m[1]} but the session is on ${row.day}.` });
    }
  }

  if (!body.includes(mentorName)) {
    out.push({ ...base, issue: 'mentor_missing', expected: mentorName, found: null,
      say: `Draft ${id} does not name the mentor ${mentorName}.` });
  }

  // Model-written text is untrusted: the subject gets the same time/weekday rules, and neither
  // field may carry contact details or links (prompt-only rules are not enough).
  const subject = typeof d.subject === 'string' ? d.subject : '';
  for (const t of [...subject.matchAll(CLOCK_RE)].map((m) => Number(m[1]) * 60 + Number(m[2]))) {
    if (t !== startMin && t !== endMin) out.push({ ...base, issue: 'subject_time_wrong', expected: startHm, found: hhmm(t), say: `Draft ${id} subject says ${hhmm(t)} but the session starts at ${startHm}.` });
  }
  for (const m of subject.matchAll(WEEKDAY_WORD_RE)) {
    if (m[1].slice(0, 3) !== row.day) out.push({ ...base, issue: 'subject_weekday_wrong', expected: row.day, found: m[1], say: `Draft ${id} subject says ${m[1]} but the session is on ${row.day}.` });
  }
  for (const [field, text] of [['subject', subject], ['body', body]]) {
    const hit = text.match(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{8,}\d/);
    if (hit) out.push({ ...base, issue: 'contact_or_link', expected: 'no links, emails or phone numbers', found: hit[0].slice(0, 40), say: `Draft ${id} ${field} contains "${hit[0].slice(0, 40)}"; drafts may not carry links, emails or phone numbers.` });
  }
  if (body.length > 1200) out.push({ ...base, issue: 'too_long', expected: '≤ 1200 characters', found: body.length, say: `Draft ${id} is ${body.length} characters; keep drafts short.` });
  return out;
}

function checkDraftsText(store, ref, schRef, names) {
  const drafts = parseJsonArtifact(store, ref);
  if (!isPlainObject(drafts) || !Array.isArray(drafts.drafts)) return fail({ message: 'unsent-message-drafts.json has no drafts list.' });
  if (!schRef) throw new Error('mentor-schedule.csv is missing, so draft text has nothing to check against');
  const sch = scheduleRows(store, schRef);
  if (sch.problem) return fail({ message: sch.problem });
  const bySession = new Map();
  for (const { r } of sch.rows) {
    if (r.status === 'BOOKED' && !bySession.has(r.session_id)) bySession.set(r.session_id, r);
  }

  const learner = drafts.drafts.filter((d) => d?.to_role === 'learner');
  const problems = [];
  for (const d of learner) {
    const row = bySession.get(d.session_id);
    if (!row) continue; // a draft for an unbooked session is C11's finding
    if (!names.has(row.mentor_id)) throw new Error(`mentor ${row.mentor_id} is not in the mentors source`);
    problems.push(...draftProblems(d, row, names.get(row.mentor_id)));
  }

  if (problems.length === 0) {
    return pass({ expected: learner.length, observed: learner.length, evidence: [], message: `All ${learner.length} learner drafts give the day, start time and mentor.` });
  }
  const first = problems[0];
  const shown = problems.map(({ say, ...p }) => p);
  return fail({
    expected: first.expected,
    observed: first.found,
    evidence: [],
    detail: { problems: shown },
    message: `${first.say ?? first.issue}${problems.length > 1 ? ` ${problems.length - 1} more problem(s) in the drafts.` : ''}`,
  });
}

// ---- C18 / C19 (personal support in the drafts). Own code: repeats the quote rule, never worker code. ----
const collapseSpaces = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const draftKey = (d) => d.session_id || `REQ-${d.to_id}`;

function checkRequestsAnswered(store, ref, sources) {
  const drafts = parseJsonArtifact(store, ref);
  if (!isPlainObject(drafts) || !Array.isArray(drafts.drafts)) return fail({ message: 'unsent-message-drafts.json has no drafts list.' });
  const skillName = new Map(withRows(sources.skills).map(({ r }) => [r.skill_id, r.name]));
  const learner = drafts.drafts.filter((d) => d?.to_role === 'learner');
  const requests = withRows(sources.help_requests);
  const problems = [];
  for (const { r } of requests) {
    const mine = learner.filter((d) => d.to_id === r.trainee_id);
    const name = skillName.get(String(r.skill_id ?? '').trim()); // undefined when blank or unknown
    const quote = `You asked: '${collapseSpaces(r.text).slice(0, REQUEST_QUOTE_MAX)}'`;
    const answered = mine.some((d) => (name !== undefined
      ? Array.isArray(d.what_to_work_on) && d.what_to_work_on.includes(name)
      : typeof d.why === 'string' && d.why.includes(quote)));
    if (answered) continue;
    const draft = mine[0] ?? null;
    const need = name !== undefined ? `include "${name}" in what_to_work_on` : 'quote the request in why';
    problems.push({
      request_id: r.request_id,
      draft_id: draft?.draft_id ?? null,
      session_id: draft ? draftKey(draft) : `REQ-${r.trainee_id}`,
      issue: 'request_unanswered',
      expected: need,
      found: draft ? 'draft does not do that' : 'no learner draft',
      message: `Help request ${r.request_id} has no draft that answers it: the draft must ${need}.`,
    });
  }
  if (problems.length === 0) {
    return pass({ expected: requests.length, observed: requests.length, evidence: [], message: `All ${requests.length} help requests have a learner draft that answers them.` });
  }
  return fail({
    expected: requests.length,
    observed: requests.length - problems.length,
    evidence: [],
    detail: { problems },
    message: `${problems[0].message}${problems.length > 1 ? ` ${problems.length - 1} more request(s) unanswered.` : ''}`,
  });
}

const PRIVACY_TEXT_FIELDS = ['subject', 'body', 'why', 'nudge_sms', 'nudge_email'];
const LINK_OR_EMAIL_RE = /https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RUN_RE = /\+?\d[\d\s().-]{6,}\d/g;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (s, flags) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(s)}(?![\\p{L}\\p{N}])`, flags);

/** Every string a draft carries (text fields, skill names, step texts; not the step type or skill_id). */
function draftTexts(d) {
  const out = PRIVACY_TEXT_FIELDS.map((k) => d[k]).filter((v) => typeof v === 'string');
  if (Array.isArray(d.what_to_work_on)) out.push(...d.what_to_work_on.filter((v) => typeof v === 'string'));
  if (Array.isArray(d.steps)) {
    for (const st of d.steps) {
      if (!st || typeof st !== 'object') continue;
      for (const [k, v] of Object.entries(st)) {
        if (k !== 'type' && k !== 'skill_id' && typeof v === 'string') out.push(v);
      }
    }
  }
  return out;
}

function checkPrivacy(store, ref, sources) {
  const drafts = parseJsonArtifact(store, ref);
  if (!isPlainObject(drafts) || !Array.isArray(drafts.drafts)) return fail({ message: 'unsent-message-drafts.json has no drafts list.' });
  const people = withRows(sources.trainees).map(({ r }) => ({ id: r.trainee_id, name: r.display_name }));
  const problems = [];
  for (const d of drafts.drafts) {
    const id = d?.draft_id ?? null;
    const sid = d?.session_id || null;
    const texts = draftTexts(d);
    for (const t of texts) {
      if (LINK_OR_EMAIL_RE.test(t)) {
        problems.push({ draft_id: id, session_id: sid, issue: 'contact_or_link', expected: 'no links, emails or phone numbers', found: 'link or email', message: `Draft ${id} contains a link or an email address.` });
      }
      for (const m of t.matchAll(PHONE_RUN_RE)) {
        if (m[0].replace(/\D/g, '').length >= 9) {
          problems.push({ draft_id: id, session_id: sid, issue: 'contact_or_phone', expected: 'no phone numbers', found: 'phone number', message: `Draft ${id} contains a phone number.` });
          break;
        }
      }
    }
    if (d?.to_role !== 'learner') continue; // a mentor draft lists its own learners by design
    const own = people.find((p) => p.id === d.to_id);
    const ownWords = own ? [wholeWord(own.id, 'giu'), wholeWord(own.name, 'giu')] : [];
    for (const t of texts) {
      let rest = t;
      for (const re of ownWords) rest = rest.replace(re, ' ');
      const other = people.find((p) => p.id !== d.to_id
        && (wholeWord(p.id, 'iu').test(rest) || wholeWord(p.name, 'iu').test(rest)));
      if (other) {
        problems.push({ draft_id: id, session_id: sid, issue: 'other_learner_named', expected: 'only the learner\'s own name', found: other.id, message: `Draft ${id} names another learner (${other.id}).` });
      }
    }
  }
  if (problems.length === 0) {
    return pass({ expected: drafts.drafts.length, observed: drafts.drafts.length, evidence: [], message: `All ${drafts.drafts.length} drafts are free of other learners' names and of contact details.` });
  }
  const first = problems[0];
  return fail({
    expected: drafts.drafts.length,
    observed: drafts.drafts.length - problems.length,
    evidence: [],
    detail: { problems },
    message: `${first.message}${problems.length > 1 ? ` ${problems.length - 1} more privacy problem(s) in the drafts.` : ''}`,
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

// ---- output files: calendar, spreadsheet, Monday brief (C15-C17) ----

/** Unfold RFC 5545 continuation lines (CRLF + one space or tab). */
function unfoldIcs(text) {
  const out = [];
  for (const raw of text.split('\r\n')) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length) out[out.length - 1] += raw.slice(1);
    else out.push(raw);
  }
  return out;
}

/** Each VEVENT as { PROPNAME: [{ value, params }] }. */
function parseIcsEvents(lines) {
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [name, ...params] = line.slice(0, colon).split(';');
    (cur[name.toUpperCase()] ??= []).push({ value: line.slice(colon + 1), params });
  }
  return events;
}

const uidOf = (e) => e.UID?.[0]?.value ?? '';

function checkCalendar(store, ref, schedule, names) {
  if (schedule.problem) throw new Error(schedule.problem);
  const text = openText(store, ref);
  const problems = [];
  if (/(^|[^\r])\n/.test(text)) problems.push('a line ends with LF only, not CRLF');
  const banned = /ATTENDEE|ORGANIZER|mailto:/i.exec(text);
  if (banned) problems.push(`the file contains ${banned[0]}, which must not appear`);

  const events = parseIcsEvents(unfoldIcs(text));
  const booked = schedule.rows.filter(({ r }) => r.status === 'BOOKED');
  for (const { r } of booked) {
    const uid = `${r.session_id}@tace.local`;
    const hits = events.filter((e) => uidOf(e) === uid);
    if (hits.length !== 1) {
      problems.push(`${r.session_id} has ${hits.length} events in the calendar, expected 1`);
      continue;
    }
    const e = hits[0];
    const wantStart = `${r.date.replace(/-/g, '')}T${r.start.replace(':', '')}00`;
    const dt = e.DTSTART?.[0];
    if (!dt || dt.value !== wantStart || !dt.params.includes('TZID=Africa/Johannesburg')) {
      problems.push(`${r.session_id} starts at ${dt ? dt.value : 'nothing'}, expected ${wantStart} in Africa/Johannesburg`);
    }
    const mentor = names.get(r.mentor_id) ?? '';
    const desc = e.DESCRIPTION?.[0]?.value ?? '';
    if (!mentor || !desc.includes(`with ${mentor}`)) {
      problems.push(`${r.session_id} does not name mentor ${mentor || r.mentor_id}`);
    }
  }
  const bookedUids = new Set(booked.map(({ r }) => `${r.session_id}@tace.local`));
  const extra = events.filter((e) => !bookedUids.has(uidOf(e)));
  if (extra.length) problems.push(`${extra.length} event(s) do not match any booked session`);

  const evidence = booked.map(({ row }) => ({ sourceId: NAMES.schedule, row }));
  const expected = booked.length;
  const observed = events.length;
  if (problems.length === 0) {
    return pass({ expected, observed, evidence, message: `${expected} booked sessions and ${observed} events match one to one.` });
  }
  return fail({
    expected, observed, evidence, detail: { problems },
    message: `${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}.`,
  });
}

/** Re-open the spreadsheet with exceljs (a parser). Reads the Schedule sheet as displayed text. */
async function readXlsxSchedule(store, ref) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(store.readBuffer(ref)); // digest re-checked first
  const ws = wb.getWorksheet('Schedule');
  if (!ws) throw new Error('the spreadsheet has no Schedule sheet');
  const header = [];
  for (let c = 1; c <= 9; c += 1) header.push(String(ws.getRow(1).getCell(c).text ?? '').trim());
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cell = (c) => String(row.getCell(c).text ?? '');
    rows.push({ row: n, session: cell(1), learner: cell(2), mentor: cell(4), day: cell(5), start: cell(7), status: cell(9) });
  });
  return { header, rows };
}

function checkXlsx(xl, schedule, names, sources) {
  if (schedule.problem) throw new Error(schedule.problem);
  const trainees = requireSource(sources.trainees, 'trainees');
  const learners = new Map(withRows(trainees).map((t) => [t.r.trainee_id, t.r.display_name]));
  const want = ['Session', 'Learner', 'Skill', 'Mentor', 'Day', 'Date', 'Start', 'End', 'Status'];
  const problems = [];
  if (xl.header.join('|') !== want.join('|')) problems.push(`the header row is ${xl.header.join(', ')}`);

  const expRows = schedule.rows.map(({ r, row }) => ({
    row,
    session: r.session_id,
    learner: learners.get(r.trainee_id) ?? '',
    mentor: r.mentor_id ? names.get(r.mentor_id) ?? '' : '',
    day: r.day,
    start: r.start,
    status: r.status,
  }));
  if (xl.rows.length !== expRows.length) {
    problems.push(`the Schedule sheet has ${xl.rows.length} rows but the schedule file has ${expRows.length}`);
  }
  const fields = ['session', 'learner', 'mentor', 'day', 'start', 'status'];
  for (let i = 0; i < Math.min(xl.rows.length, expRows.length); i += 1) {
    const got = xl.rows[i];
    const exp = expRows[i];
    const diff = fields.find((f) => got[f] !== exp[f]);
    if (diff) {
      problems.push(`row ${i + 1} ${diff} is "${got[diff]}" but the schedule says "${exp[diff]}"`);
      break;
    }
  }

  const evidence = expRows.map((e) => ({ sourceId: NAMES.schedule, row: e.row }));
  const expected = expRows.length;
  const observed = xl.rows.length;
  if (problems.length === 0) {
    return pass({ expected, observed, evidence, message: `All ${expected} schedule rows in the spreadsheet match the schedule file.` });
  }
  return fail({ expected, observed, evidence, detail: { problems }, message: `${problems[0]}.` });
}

/** Reads the three figure lines from the brief and recounts them from the latest files. */
function checkBrief(store, ref, model, schedule, draftsJson) {
  if (schedule.problem) throw new Error(schedule.problem);
  const text = openText(store, ref);
  const read = (label) => {
    const m = new RegExp(`^${label}: (\\d+)$`, 'm').exec(text);
    return m ? Number(m[1]) : null;
  };
  const stated = { atRisk: read('At-risk learners'), booked: read('Booked sessions'), unsent: read('Unsent drafts') };
  const recomputed = {
    atRisk: model.atRiskIds.length,
    booked: schedule.rows.filter(({ r }) => r.status === 'BOOKED').length,
    unsent: (Array.isArray(draftsJson.drafts) ? draftsJson.drafts : []).filter((d) => d.status === 'UNSENT').length,
  };
  const labels = { atRisk: 'At-risk learners', booked: 'Booked sessions', unsent: 'Unsent drafts' };
  const mismatches = Object.keys(recomputed)
    .filter((k) => stated[k] !== recomputed[k])
    .map((k) => ({ field: labels[k], expected: recomputed[k], observed: stated[k] }));
  const expected = Object.keys(recomputed).map((k) => `${labels[k]} ${recomputed[k]}`).join('; ');
  if (mismatches.length === 0) {
    return pass({ expected, observed: expected, message: `The brief states ${expected}, matching the files.` });
  }
  const first = mismatches[0];
  return fail({
    expected, observed: Object.keys(stated).map((k) => `${labels[k]} ${stated[k] ?? 'missing'}`).join('; '),
    detail: { mismatches },
    message: `The brief says ${first.field} ${first.observed ?? 'missing'} but the files give ${first.expected}.`,
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
    attempt(checks, 'C11_drafts_match_schedule', draftsRef, KIND.MESSAGE_DRAFTS, () => checkDraftsMatchSchedule(store, draftsRef, schRef, sources));
    attempt(checks, 'C14_drafts_text_matches', draftsRef, KIND.MESSAGE_DRAFTS, () => checkDraftsText(store, draftsRef, schRef, names));
  }

  // ---- personal support (C18, C19). Emitted only when the optional live files were admitted. ----
  if (sources.help_requests) {
    if (draftsRef) {
      attempt(checks, 'C18_requests_answered', draftsRef, KIND.MESSAGE_DRAFTS, () => checkRequestsAnswered(store, draftsRef, sources));
    } else {
      emit(checks, 'C18_requests_answered', { name: NAMES.drafts, version: 0 }, KIND.MESSAGE_DRAFTS,
        fail({ expected: withRows(sources.help_requests).length, observed: 0, message: 'No message drafts exist, so no help request was answered.' }));
    }
  }
  if (draftsRef && (sources.help_requests || sources.learner_prefs || sources.memory)) {
    attempt(checks, 'C19_privacy_in_drafts', draftsRef, KIND.MESSAGE_DRAFTS, () => checkPrivacy(store, draftsRef, sources));
  }

  // ---- output files (C15-C17). Each is skipped when its file is absent. ----
  const icsRef = store.latestByName(NAMES.calendar);
  if (icsRef) {
    attempt(checks, 'C15_calendar_matches_schedule', icsRef, 'calendar_ics', () => {
      if (!schRef) throw new Error('no mentor schedule exists to compare the calendar with');
      return checkCalendar(store, icsRef, scheduleRows(store, schRef), names);
    });
  }

  const xlsxRef = store.latestByName(NAMES.xlsx);
  if (xlsxRef) {
    // exceljs reads the workbook asynchronously; the result (or its error) is then checked synchronously.
    let opened;
    try {
      opened = { data: await readXlsxSchedule(store, xlsxRef) };
    } catch (err) {
      opened = { error: err.message };
    }
    attempt(checks, 'C16_xlsx_matches_schedule', xlsxRef, 'schedule_xlsx', () => {
      if (opened.error) throw new Error(opened.error);
      if (!schRef) throw new Error('no mentor schedule exists to compare the spreadsheet with');
      return checkXlsx(opened.data, scheduleRows(store, schRef), names, sources);
    });
  }

  const briefRef = store.latestByName(NAMES.brief);
  if (briefRef) {
    attempt(checks, 'C17_brief_numbers_match', briefRef, 'monday_brief', () => {
      requireModel(model, problem);
      if (!schRef) throw new Error('no mentor schedule exists to recount bookings from');
      if (!draftsRef) throw new Error('no message drafts exist to recount unsent drafts from');
      return checkBrief(store, briefRef, model, scheduleRows(store, schRef), parseJsonArtifact(store, draftsRef));
    });
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
