// T.A.C.E education domain — Writer worker (deterministic code, no model).
// Owns two tasks:
//   performance_summary -> performance-summary.json + .md   (kind performance_summary)
//   draft_messages      -> unsent-message-drafts.json + .md (kind message_drafts)
// Nothing here sends anything. Every draft is written with status UNSENT.
// No timestamps inside artifact content.

import { parseCsv } from '../../engine/csv.mjs';
import { DRAFT_STATUS, RULES_VERSION, REQUEST_QUOTE_MAX, FORMATS, DEFAULT_FORMAT, DEFAULT_LANGUAGE } from './rules.mjs';

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
const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

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

/** Learner-typed or model-written text: collapse whitespace. The reviewer repeats this rule for quotes. */
export const normaliseText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** The quote a draft may show: at most REQUEST_QUOTE_MAX characters of the (normalised) request text. */
export const quoteOf = (text) => normaliseText(text).slice(0, REQUEST_QUOTE_MAX);

const URL_OR_EMAIL_RE = /https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RUN_RE = /\+?\d[\d\s().-]{6,}\d/g;
/** True when text carries a link, an email address or a phone number (9 or more digits). */
export function hasContact(text) {
  const t = String(text ?? '');
  if (URL_OR_EMAIL_RE.test(t)) return true;
  for (const m of t.matchAll(PHONE_RUN_RE)) {
    if (m[0].replace(/\D/g, '').length >= 9) return true;
  }
  return false;
}

const numText = (n) => String(Number(n));
const pushTo = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

/**
 * Support facts for every learner, built from the admitted sources (not from gaps.json).
 * Optional live files (help_requests, learner_prefs, memory) are read only when admitted.
 */
export function learnerFacts(ctx) {
  const src = ctx.sources;
  const skills = new Map(src.skills.rows.map((r) => [r.skill_id, { name: r.name, threshold: Number(r.threshold) }]));

  const scoreOf = new Map();
  for (const a of src.assessments.rows) {
    const raw = String(a.score ?? '').trim();
    if (raw === '') continue; // a missing score is not a gap and not zero
    const n = Number(raw);
    if (!Number.isFinite(n)) throw fail('BAD_SCORE', `assessments ${a.trainee_id}/${a.skill_id}: score is not a number`);
    scoreOf.set(`${a.trainee_id}|${a.skill_id}`, n);
  }
  const gapsBy = new Map();
  for (const [key, score] of [...scoreOf].sort((x, y) => byText(x[0], y[0]))) {
    const [tid, sid] = key.split('|');
    const sk = skills.get(sid);
    if (!sk || score >= sk.threshold) continue;
    pushTo(gapsBy, tid, { skill_id: sid, name: sk.name, score, threshold: sk.threshold, shortfall: sk.threshold - score });
  }

  const requestsBy = new Map();
  if (src.help_requests) {
    for (const r of src.help_requests.rows) {
      const sid = String(r.skill_id ?? '').trim();
      pushTo(requestsBy, r.trainee_id, { request_id: r.request_id, skill_id: skills.has(sid) ? sid : null, text: normaliseText(r.text) });
    }
    for (const list of requestsBy.values()) list.sort((a, b) => byText(a.request_id, b.request_id));
  }

  const prefsBy = new Map();
  if (src.learner_prefs) {
    for (const r of src.learner_prefs.rows) {
      const format = String(r.format ?? '').trim();
      const language = String(r.language ?? '').trim();
      prefsBy.set(r.trainee_id, {
        format: FORMATS.includes(format) ? format : DEFAULT_FORMAT,
        language: LANGUAGE_RE.test(language) ? language : DEFAULT_LANGUAGE,
      });
    }
  }

  const memoryBy = new Map();
  if (src.memory) {
    for (const r of src.memory.rows) {
      pushTo(memoryBy, r.trainee_id, { fact: normaliseText(r.fact), source_run: String(r.source_run ?? ''), at: String(r.at ?? '') });
    }
    for (const list of memoryBy.values()) list.sort((a, b) => byText(a.at, b.at) || byText(a.fact, b.fact));
  }

  return { skills, scoreOf, gapsBy, requestsBy, prefsBy, memoryBy };
}

/** One learner's support: gaps, requests, the focus skill, the skills they may be told about, prefs, memory. */
export function supportOf(facts, traineeId) {
  const requests = facts.requestsBy.get(traineeId) ?? [];
  const gaps = facts.gapsBy.get(traineeId) ?? [];
  const reqSkillId = requests.find((r) => r.skill_id)?.skill_id ?? null;
  // focus = weakest gap (largest shortfall, tie -> lowest skill_id); no gap -> the requested skill
  const weakest = gaps.reduce((best, g) => (best === null || g.shortfall > best.shortfall ? g : best), null);
  const focusId = weakest ? weakest.skill_id : reqSkillId;
  const skillIds = [...new Set([...gaps.map((g) => g.skill_id), ...(reqSkillId ? [reqSkillId] : [])])].sort(byText);
  return {
    gaps,
    requests,
    focusId,
    focusName: focusId ? facts.skills.get(focusId).name : null,
    skillIds,
    skillNames: skillIds.map((id) => facts.skills.get(id).name),
    prefs: facts.prefsBy.get(traineeId) ?? { format: DEFAULT_FORMAT, language: DEFAULT_LANGUAGE },
    memory: facts.memoryBy.get(traineeId) ?? [],
  };
}

/** The focus skill and the learner's own skill names (used by the model writer's step check). */
export function focusOf(facts, traineeId) {
  const s = supportOf(facts, traineeId);
  return { focusId: s.focusId, focusName: s.focusName, ownSkillNames: s.skillNames };
}

/**
 * Code-built personal fields for one learner draft.
 * session: { mentor, day_label, start, end } or null (requested, no booked session).
 * texts (optional, model writer only): { example, quiz, ifThen } replace the code step bodies.
 * Typed steps: worked_example, retrieval_quiz (both on the focus skill), if_then_plan.
 */
export function personalFields({ traineeId, name, facts, session, texts = null }) {
  const s = supportOf(facts, traineeId);
  const focusName = s.focusName;
  const situation = s.requests.length
    ? `I get stuck on '${quoteOf(s.requests[0].text).slice(0, 80)}'`
    : focusName ? `I fall behind on ${focusName}` : 'I get stuck on one part of the course';
  const when = session ? `${session.day_label} at ${session.start}` : 'a 30-minute study slot this week';
  const ifThen = `If ${situation}, then I will work through the worked example and the three questions at ${when}.`;

  const steps = s.focusId
    ? [
      { type: 'worked_example', skill_id: s.focusId, title: `Worked example: ${focusName}`,
        body: texts?.example ?? `Step by step: write down what the ${focusName} question asks, pick the one rule that fits, apply it, then check the answer against that rule.` },
      { type: 'retrieval_quiz', skill_id: s.focusId, title: `Three quick questions on ${focusName}`,
        body: texts?.quiz ?? `1. From memory, state the main rule for ${focusName}.\n2. Apply it to one new example.\n3. Name the mistake you are most likely to make.` },
      { type: 'if_then_plan', text: texts?.ifThen ?? ifThen },
    ]
    : [
      { type: 'worked_example', skill_id: null, title: 'Worked example: one question at a time',
        body: texts?.example ?? 'Write your question as one sentence, answer it with one small example, then check the answer.' },
      { type: 'retrieval_quiz', skill_id: null, title: 'Three quick questions',
        body: texts?.quiz ?? '1. Restate your question in your own words.\n2. Give one example that fits.\n3. Say what is still unclear.' },
      { type: 'if_then_plan', text: texts?.ifThen ?? ifThen },
    ];

  const payloadSkills = s.skillIds.map((id) => ({
    id,
    name: facts.skills.get(id).name,
    score: facts.scoreOf.get(`${traineeId}|${id}`) ?? null,
    threshold: facts.skills.get(id).threshold,
  }));
  const machine = s.prefs.language !== DEFAULT_LANGUAGE;
  const payload = {
    skills: payloadSkills,
    steps,
    session: session ? { mentor: session.mentor, day_label: session.day_label, start: session.start, end: session.end } : null,
    machine_translated: machine,
    memory: s.memory,
  };
  if (machine) payload.reviewer_note = 'needs a fluent reviewer';

  const why = [
    ...s.gaps.map((g) => `Your ${g.name} score is ${numText(g.score)}; the pass mark is ${numText(g.threshold)}.`),
    ...s.requests.map((r) => `You asked: '${quoteOf(r.text)}'.`),
  ].join(' ');

  return {
    format: s.prefs.format,
    language: s.prefs.language,
    why,
    what_to_work_on: s.skillNames,
    steps,
    payload,
    nudge_sms: `Hi ${name}, your support plan is in your T.A.C.E portal inbox.`,
    nudge_email: `Hi ${name}, your support plan is in your T.A.C.E portal inbox.`,
  };
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
    );
    if (d.format !== undefined) lines.push(`- Format: ${d.format} · language: ${d.language}${d.payload?.machine_translated ? ' (machine translated, needs a fluent reviewer)' : ''}`);
    if (d.why) lines.push(`- Why: ${d.why}`);
    if (Array.isArray(d.steps) && d.steps.length) {
      lines.push('- Steps:');
      for (const st of d.steps) lines.push(`  - ${st.type}: ${st.title ?? st.text}`);
    }
    lines.push('', d.body, '');
  }
  return lines.join('\n');
}

/**
 * Task draft_messages. Reads the LATEST mentor_schedule through the store.
 * One learner draft per BOOKED session (session order), then one session-less draft for each learner
 * who asked for help but has no booked session, then one mentor draft per mentor with sessions.
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
  const facts = learnerFacts(ctx);

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
      ...personalFields({
        traineeId: r.trainee_id,
        name: learner,
        facts,
        session: { mentor, day_label: label, start: r.start, end: r.end },
      }),
    });
  }

  // learners who asked for help but have no booked session: a draft with no session fields
  const bookedTrainees = new Set(booked.map((r) => r.trainee_id));
  const requesters = [...facts.requestsBy.keys()].filter((t) => !bookedTrainees.has(t)).sort(byText);
  for (const tid of requesters) {
    const learner = name(traineeName, tid, 'trainee');
    drafts.push({
      draft_id: nextId(),
      to_role: 'learner',
      to_id: tid,
      session_id: '',
      subject: 'Your support plan',
      body: `Hi ${learner}, thank you for asking for help. A mentor time is not booked yet. Your support plan is in your T.A.C.E portal inbox.`,
      day: '',
      date: '',
      start: '',
      mentor_id: '',
      status: DRAFT_STATUS,
      ...personalFields({ traineeId: tid, name: learner, facts, session: null }),
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
      requestDrafts: requesters.length,
    },
  };
}
