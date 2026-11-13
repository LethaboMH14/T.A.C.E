// T.A.C.E education domain — Writer worker (deterministic code, no model).
// Owns two tasks:
//   performance_summary -> performance-summary.json + .md   (kind performance_summary)
//   draft_messages      -> unsent-message-drafts.json + .md (kind message_drafts)
// Nothing here sends anything. Every draft is written with status UNSENT.
// No timestamps inside artifact content.

import { parseCsv } from '../../engine/csv.mjs';
import { DRAFT_STATUS, RULES_VERSION } from './rules.mjs';

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const round1 = (x) => Math.round(x * 10) / 10;
const inputsOf = (ctx) => ctx.inputRefs ?? [];

/** A score cell is missing when it is empty (or only spaces). Missing is NOT zero. */
function parseScore(raw, where) {
  const s = String(raw ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw fail('BAD_SCORE', `${where}: score is not a number: ${JSON.stringify(raw)}`);
  return n;
}

function latestGaps(ctx) {
  const ref = ctx.store.latestByKind('gaps');
  if (!ref) throw fail('NO_GAPS', 'no gaps artifact exists to summarise');
  const gaps = JSON.parse(ctx.store.read(ref));
  if (gaps.rulesVersion !== RULES_VERSION) {
    throw fail('RULES_MISMATCH', `gaps.json is ${gaps.rulesVersion}, writer expects ${RULES_VERSION}`);
  }
  return gaps;
}

/**
 * Render performance-summary.md from performance-summary.json. Pure: same JSON, same text.
 * @param {object} json
 * @returns {string}
 */
export function renderSummaryMd(json) {
  const fmt = (m) => (m === null || m === undefined ? 'n/a' : Number(m).toFixed(1));
  const atRisk = json.at_risk_ids.length
    ? json.at_risk_ids.map((id) => `- ${id}`)
    : ['- None'];
  const lines = [
    '# Cohort performance summary',
    '',
    'Means use present scores only. Missing scores are flagged, not counted as zero.',
    '',
    `Rules ${json.rulesVersion} · ${json.trainees} learners · ${json.assessed_cells} scores present · ` +
      `${json.missing_cells} missing · ${json.at_risk_count} at risk`,
    '',
    '| Skill | Mean | Below threshold | Missing |',
    '| --- | --- | --- | --- |',
    ...json.skills.map((s) => `| ${s.skill_id} ${s.name} | ${fmt(s.mean)} | ${s.below_threshold} | ${s.missing} |`),
    '',
    `## Learners at risk (${json.at_risk_count})`,
    '',
    ...atRisk,
    '',
  ];
  return lines.join('\n');
}

/**
 * Task performance_summary.
 * @param {object} ctx  worker context (see ARTIFACTS.md "Shared worker interface")
 */
export async function writePerformanceSummary(ctx) {
  const gaps = latestGaps(ctx);
  const trainees = gaps.trainees.slice().sort((a, b) => byText(a.trainee_id, b.trainee_id));
  const skillRows = ctx.sources.skills.rows.slice().sort((a, b) => byText(a.skill_id, b.skill_id));
  const assessRows = ctx.sources.assessments.rows;

  // Injected fault: only in the first (initial) version, only for the chosen skill.
  const injectSkill = ctx.phase === 'initial' && ctx.scenario?.inject?.kind === 'wrong_aggregate'
    ? ctx.scenario.inject.skill_id
    : null;

  let assessedCells = 0;
  let missingCells = 0;
  const skills = skillRows.map((s) => {
    let sum = 0;
    let present = 0;
    let missing = 0;
    for (const r of assessRows) {
      if (r.skill_id !== s.skill_id) continue;
      const score = parseScore(r.score, `assessments ${r.trainee_id}/${r.skill_id}`);
      if (score === null) {
        missing += 1;
      } else {
        sum += score;
        present += 1;
      }
    }
    assessedCells += present;
    missingCells += missing;

    const correct = present > 0 ? round1(sum / present) : null;
    // Realistic bug (injected): missing cells counted as zero, divided by all learners.
    const mean = s.skill_id === injectSkill ? round1(sum / trainees.length) : correct;
    const below = trainees.reduce(
      (n, t) => n + t.gaps.filter((g) => g.skill_id === s.skill_id).length,
      0,
    );
    return {
      skill_id: s.skill_id,
      name: s.name,
      threshold: Number(s.threshold),
      mean,
      present,
      missing,
      below_threshold: below,
    };
  });

  const atRiskIds = trainees.filter((t) => t.at_risk).map((t) => t.trainee_id);
  const json = {
    rulesVersion: RULES_VERSION,
    trainees: trainees.length,
    assessed_cells: assessedCells,
    missing_cells: missingCells,
    at_risk_count: atRiskIds.length,
    at_risk_ids: atRiskIds,
    skills,
  };

  const inputs = inputsOf(ctx);
  const jsonRef = ctx.store.write({
    kind: 'performance_summary',
    name: 'performance-summary.json',
    content: `${JSON.stringify(json, null, 2)}\n`,
    producer: ctx.taskId,
    inputs,
  });
  const mdRef = ctx.store.write({
    kind: 'performance_summary',
    name: 'performance-summary.md',
    content: renderSummaryMd(json),
    producer: ctx.taskId,
    inputs,
  });
  return {
    artifacts: [jsonRef, mdRef],
    summary: { atRisk: atRiskIds.length, missing: missingCells, skills: skills.length },
  };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-17" -> { day: "Tue", label: "Tue 17 Nov" }. Computed in UTC, no local time zone. */
function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw fail('BAD_DATE', `not an ISO date: ${JSON.stringify(iso)}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const dayNum = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, dayNum));
  const day = DAY_NAMES[dt.getUTCDay()];
  return { day, label: `${day} ${dayNum} ${MONTHS[month - 1]}` };
}

/** Renders unsent-message-drafts.md from the JSON. Pure. */
export function renderDraftsMd(json) {
  const learners = json.drafts.filter((d) => d.to_role === 'learner').length;
  const mentors = json.drafts.filter((d) => d.to_role === 'mentor').length;
  const lines = [
    `**UNSENT — needs a person's approval before anything is sent.**`,
    '',
    '# Unsent message drafts',
    '',
    `Every draft status: ${json.status_all}. Learner drafts: ${learners}. Mentor drafts: ${mentors}.`,
    '',
  ];
  for (const d of json.drafts) {
    lines.push(
      `## ${d.draft_id} · to ${d.to_role} ${d.to_id}`,
      '',
      `- Status: ${d.status}`,
      `- Session: ${d.session_id || 'none (mentor summary)'}`,
      `- Subject: ${d.subject}`,
      '',
      d.body,
      '',
    );
  }
  return lines.join('\n');
}

/**
 * Task draft_messages. Reads the LATEST mentor_schedule through the store.
 * @param {object} ctx
 */
export async function draftMessages(ctx) {
  const ref = ctx.store.latestByKind('mentor_schedule');
  if (!ref) throw fail('NO_SCHEDULE', 'no mentor_schedule artifact exists to draft from');
  const csv = parseCsv(ctx.store.read(ref));
  for (const col of ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'status']) {
    if (!csv.header.includes(col)) throw fail('SCHEMA', `mentor_schedule is missing column ${col}`);
  }

  const traineeName = new Map(ctx.sources.trainees.rows.map((r) => [r.trainee_id, r.display_name]));
  const mentorName = new Map(ctx.sources.mentors.rows.map((r) => [r.mentor_id, r.display_name]));
  const skillName = new Map(ctx.sources.skills.rows.map((r) => [r.skill_id, r.name]));
  const name = (map, id, what) => {
    if (!map.has(id)) throw fail('UNKNOWN_ID', `${what} ${id} is not in the sources`);
    return map.get(id);
  };

  const booked = csv.rows
    .filter((r) => r.status === 'BOOKED')
    .sort((a, b) => byText(a.session_id, b.session_id));

  const drafts = [];
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `D-${String(counter).padStart(2, '0')}`;
  };

  for (const r of booked) {
    const { day, label } = dateParts(r.date);
    if (day !== r.day) {
      throw fail('DAY_MISMATCH', `${r.session_id}: schedule says ${r.day} but ${r.date} is a ${day}`);
    }
    const learner = name(traineeName, r.trainee_id, 'trainee');
    const mentor = name(mentorName, r.mentor_id, 'mentor');
    const skill = name(skillName, r.skill_id, 'skill');
    drafts.push({
      draft_id: nextId(),
      to_role: 'learner',
      to_id: r.trainee_id,
      session_id: r.session_id,
      subject: `Your mentor session on ${label}`,
      body: `Hi ${learner}, you have a 1:1 mentor session on ${skill} with ${mentor} on ${label} at ${r.start}–${r.end}. Reply if this time does not work.`,
      day: r.day,
      date: r.date,
      start: r.start,
      mentor_id: r.mentor_id,
      status: DRAFT_STATUS,
    });
  }

  const mentorIds = [...new Set(booked.map((r) => r.mentor_id))].sort(byText);
  for (const mid of mentorIds) {
    const mine = booked.filter((r) => r.mentor_id === mid);
    const mentor = name(mentorName, mid, 'mentor');
    const items = mine.map((r) => {
      const { label } = dateParts(r.date);
      const learner = name(traineeName, r.trainee_id, 'trainee');
      const skill = name(skillName, r.skill_id, 'skill');
      return `- ${label} ${r.start}–${r.end}: ${learner} on ${skill}`;
    });
    const n = mine.length;
    drafts.push({
      draft_id: nextId(),
      to_role: 'mentor',
      to_id: mid,
      session_id: '',
      subject: `Your booked mentor sessions (${n})`,
      body: `Hi ${mentor}, you have ${n} mentor session${n === 1 ? '' : 's'} booked:\n${items.join('\n')}\nReply if any of these times do not work.`,
      day: '',
      date: '',
      start: '',
      mentor_id: mid,
      status: DRAFT_STATUS,
    });
  }

  const json = { status_all: DRAFT_STATUS, drafts };
  const inputs = inputsOf(ctx);
  const jsonRef = ctx.store.write({
    kind: 'message_drafts',
    name: 'unsent-message-drafts.json',
    content: `${JSON.stringify(json, null, 2)}\n`,
    producer: ctx.taskId,
    inputs,
  });
  const mdRef = ctx.store.write({
    kind: 'message_drafts',
    name: 'unsent-message-drafts.md',
    content: renderDraftsMd(json),
    producer: ctx.taskId,
    inputs,
  });
  return {
    artifacts: [jsonRef, mdRef],
    summary: {
      drafts: drafts.length,
      learnerDrafts: drafts.filter((d) => d.to_role === 'learner').length,
      mentorDrafts: drafts.filter((d) => d.to_role === 'mentor').length,
    },
  };
}
