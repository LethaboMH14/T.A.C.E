// Analyst worker — deterministic code, NOT a language model. Implements domains/education/rules.mjs.
// Reads admitted sources (strings), writes gaps.json (kind 'gaps') and gap-analysis.csv (kind 'gap_analysis').
// No timestamps in content. Sorted everywhere. A missing score is never a gap and never zero.

import { RULES_VERSION, AT_RISK_MIN_GAPS, LATE_LOGIN_DAY } from './rules.mjs';
import { toCsv } from '../../engine/csv.mjs';

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Ascending plain string comparison (no locale). */
function byString(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Empty or whitespace-only cell -> null (MISSING). Anything else must be a number. */
function parseScore(raw, where) {
  const s = String(raw ?? '').trim();
  if (s === '') return null;
  if (!NUMBER_RE.test(s)) throw fail('BAD_SCORE', `${where}: score "${s}" is not a number`);
  return Number(s);
}

function parseNumber(raw, where) {
  const s = String(raw ?? '').trim();
  if (!NUMBER_RE.test(s)) throw fail('BAD_NUMBER', `${where}: "${s}" is not a number`);
  return Number(s);
}

/**
 * @param {object} ctx  shared worker context (see domains/education/ARTIFACTS.md)
 * @returns {Promise<{artifacts: object[], summary: {trainees:number, gaps:number, missing:number, atRisk:number}}>}
 */
export async function computeGaps(ctx) {
  const { trainees, assessments, skills } = ctx.sources;

  // threshold per skill, from skills.csv
  const thresholds = new Map();
  for (const s of skills.rows) {
    const id = s.skill_id;
    if (thresholds.has(id)) throw fail('DUPLICATE_SKILL', `skill ${id} appears twice`);
    thresholds.set(id, parseNumber(s.threshold, `skills.csv ${id} threshold`));
  }
  const skillIds = [...thresholds.keys()].sort(byString);

  // trainees, sorted by trainee_id
  const traineeRows = trainees.rows.slice().sort((a, b) => byString(a.trainee_id, b.trainee_id));
  const traineeIds = new Set(traineeRows.map((t) => t.trainee_id));

  // assessment cells keyed by trainee|skill, with the physical line number
  const cells = new Map();
  assessments.rows.forEach((r, i) => {
    const row = assessments.rowNumbers[i];
    if (!traineeIds.has(r.trainee_id)) {
      throw fail('UNKNOWN_TRAINEE', `assessments.csv line ${row}: trainee ${r.trainee_id} is not in trainees.csv`);
    }
    if (!thresholds.has(r.skill_id)) {
      throw fail('UNKNOWN_SKILL', `assessments.csv line ${row}: skill ${r.skill_id} is not in skills.csv`);
    }
    const key = `${r.trainee_id}|${r.skill_id}`;
    if (cells.has(key)) throw fail('DUPLICATE_CELL', `assessments.csv line ${row}: duplicate ${key}`);
    cells.set(key, {
      score: parseScore(r.score, `assessments.csv line ${row}`),
      row,
    });
  });

  const out = [];
  const csvRows = [];
  let totalGaps = 0;
  let totalMissing = 0;
  let atRiskCount = 0;

  for (const t of traineeRows) {
    const firstLoginDay = parseNumber(t.first_login_day, `trainees.csv ${t.trainee_id} first_login_day`);
    const gaps = [];
    const missing = [];

    for (const skillId of skillIds) {
      const cell = cells.get(`${t.trainee_id}|${skillId}`);
      if (!cell) {
        // No assessment row at all for this learner and skill: flagged as missing, row unknown.
        missing.push({ skill_id: skillId, row: null });
        continue;
      }
      if (cell.score === null) {
        missing.push({ skill_id: skillId, row: cell.row });
        continue;
      }
      const threshold = thresholds.get(skillId);
      if (cell.score < threshold) {
        gaps.push({
          skill_id: skillId,
          score: cell.score,
          threshold,
          shortfall: threshold - cell.score,
          row: cell.row,
        });
      }
    }

    const lateLogin = firstLoginDay >= LATE_LOGIN_DAY;
    const atRisk = gaps.length >= AT_RISK_MIN_GAPS || (lateLogin && gaps.length >= 1);

    // priority skill: largest shortfall, tie -> lowest skill_id (gaps are already in skill_id order,
    // so a strictly-greater comparison keeps the lowest id on ties)
    let priority = null;
    if (atRisk) {
      for (const g of gaps) {
        if (priority === null || g.shortfall > priority.shortfall) priority = g;
      }
    }

    out.push({
      trainee_id: t.trainee_id,
      display_name: t.display_name,
      first_login_day: firstLoginDay,
      gaps,
      missing,
      at_risk: atRisk,
      priority_skill: atRisk ? priority.skill_id : null,
    });

    totalGaps += gaps.length;
    totalMissing += missing.length;
    if (atRisk) atRiskCount += 1;

    for (const g of gaps) {
      csvRows.push({
        trainee_id: t.trainee_id,
        display_name: t.display_name,
        skill_id: g.skill_id,
        score: g.score,
        threshold: g.threshold,
        shortfall: g.shortfall,
        at_risk: atRisk ? 'yes' : 'no',
        source_file: 'assessments.csv',
        source_row: g.row,
      });
    }
  }

  const gapsJson = { rulesVersion: RULES_VERSION, trainees: out };
  const gapsRef = ctx.store.write({
    kind: 'gaps',
    name: 'gaps.json',
    content: JSON.stringify(gapsJson, null, 2) + '\n',
    producer: ctx.taskId,
    inputs: ctx.inputRefs,
  });

  const csvHeader = [
    'trainee_id', 'display_name', 'skill_id', 'score', 'threshold',
    'shortfall', 'at_risk', 'source_file', 'source_row',
  ];
  const gapCsvRef = ctx.store.write({
    kind: 'gap_analysis',
    name: 'gap-analysis.csv',
    content: toCsv(csvHeader, csvRows),
    producer: ctx.taskId,
    inputs: ctx.inputRefs,
  });

  return {
    artifacts: [gapsRef, gapCsvRef],
    summary: {
      trainees: out.length,
      gaps: totalGaps,
      missing: totalMissing,
      atRisk: atRiskCount,
    },
  };
}
