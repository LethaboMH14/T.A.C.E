// T.A.C.E education domain — LLM Message Writer (AGENTS-SPEC §4).
// Same output files and format as writer.draftMessages (ARTIFACTS.md §5), but each LEARNER draft's
// subject and body are written by the model from structured facts. Everything else is copied by
// code from the latest mentor schedule: draft order, day, date, start, mentor_id, session_id,
// to_id and status. Mentor drafts use deterministic wording written here.
// Nothing here sends anything. Every draft is written with status UNSENT.

import { parseCsv } from '../../engine/csv.mjs';
import { DRAFT_STATUS } from './rules.mjs';
import { renderDraftsMd } from './writer.mjs';

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-17" -> { day: "Tue", label: "Tue 17 Nov" }. UTC, no local time zone. */
function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw fail('BAD_DATE', `not an ISO date: ${JSON.stringify(iso)}`);
  const month = Number(m[2]);
  const dayNum = Number(m[3]);
  const dt = new Date(Date.UTC(Number(m[1]), month - 1, dayNum));
  const day = DAY_NAMES[dt.getUTCDay()];
  return { day, label: `${day} ${dayNum} ${MONTHS[month - 1]}` };
}

export const DRAFTS_SCHEMA = {
  type: 'object',
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['session_id', 'subject', 'body'],
      },
    },
  },
  required: ['drafts'],
};

const SYSTEM_PROMPT = [
  'You write short messages to adult learners about a 1:1 mentor session on a skills-recovery programme.',
  'For every session in the facts, write one draft: a subject and a body addressed to the learner.',
  'Style: warm, plain English for an adult learner, at most 60 words per body.',
  'Each body MUST state the exact day_label, the exact start–end time (start, then end) and the mentor_name, spelled exactly as given in the facts.',
  'Do not write any email address, phone number, web link or URL.',
  'Never promise anything that is not in the facts (no guaranteed results, no extra sessions, no rooms, no follow-up dates).',
  'Use each session_id exactly as given. Return JSON only, matching the requested schema.',
].join('\n');

function mentorDraftBody(mentor, items, n) {
  return `Hi ${mentor}, you have ${n} mentor session${n === 1 ? '' : 's'} booked:\n${items.join('\n')}\nReply if any of these times do not work.`;
}

function describeProblem(p) {
  const parts = [];
  if (p.issue) parts.push(p.issue);
  if (p.expected !== undefined && p.expected !== null) parts.push(`expected ${p.expected}`);
  if (p.found !== undefined && p.found !== null) parts.push(`found ${p.found}`);
  return parts.join(', ') || 'the draft was not acceptable';
}

function feedbackMessage(feedback, previousBySession) {
  const lines = feedback.map((f) => {
    const id = f.draft_id ? ` (${f.draft_id})` : '';
    return `- session ${f.session_id ?? 'unknown'}${id}: ${f.message ?? describeProblem(f)}`;
  });
  const flagged = [...new Set(feedback.map((f) => f.session_id).filter(Boolean))].sort(byText);
  const previous = flagged
    .filter((sid) => previousBySession.has(sid))
    .map((sid) => ({ session_id: sid, ...previousBySession.get(sid) }));
  return [
    'The previous drafts had these problems. Fix ONLY the drafts for the sessions listed below.',
    'Return ALL drafts (one for every session_id in the facts); keep the others as they were.',
    ...lines,
    previous.length ? `Previous text for the flagged sessions: ${JSON.stringify(previous, null, 2)}` : '',
  ].filter(Boolean).join('\n');
}

function previousDraftsBySession(store) {
  const ref = store.latestByName('unsent-message-drafts.json');
  const out = new Map();
  if (!ref) return out;
  try {
    const json = JSON.parse(store.read(ref));
    for (const d of json.drafts ?? []) {
      if (d?.to_role === 'learner' && d.session_id) out.set(d.session_id, { subject: d.subject, body: d.body });
    }
  } catch {
    // an unreadable previous version only removes the hint; the facts still drive the new drafts
  }
  return out;
}

/**
 * Task draft_messages with the model writing learner text.
 * @param {{taskId, sources, store, scenario, phase, inputRefs, model, feedback?}} ctx
 */
export async function draftMessagesWithModel(ctx) {
  if (!ctx.model?.available) {
    throw fail('MODEL_UNAVAILABLE', 'no model is configured (MODEL_API_KEY is not set), so messages were not drafted');
  }

  const ref = ctx.store.latestByName('mentor-schedule.csv');
  if (!ref) throw fail('NO_SCHEDULE', 'no mentor-schedule.csv exists to draft from');
  const csv = parseCsv(ctx.store.read(ref));
  for (const col of ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'status']) {
    if (!csv.header.includes(col)) throw fail('SCHEMA', `mentor-schedule.csv is missing column ${col}`);
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

  const facts = booked.map((r) => {
    const { day, label } = dateParts(r.date);
    if (day !== r.day) {
      throw fail('DAY_MISMATCH', `${r.session_id}: schedule says ${r.day} but ${r.date} is a ${day}`);
    }
    return {
      session_id: r.session_id,
      learner_name: name(traineeName, r.trainee_id, 'trainee'),
      skill_name: name(skillName, r.skill_id, 'skill'),
      mentor_name: name(mentorName, r.mentor_id, 'mentor'),
      day_label: label,
      start: r.start,
      end: r.end,
    };
  });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Facts for ${facts.length} learner drafts:\n${JSON.stringify({ sessions: facts }, null, 2)}` },
  ];
  const feedback = Array.isArray(ctx.feedback) ? ctx.feedback : [];
  if (feedback.length) {
    messages.push({ role: 'user', content: feedbackMessage(feedback, previousDraftsBySession(ctx.store)) });
  }

  const reply = await ctx.model.chat({
    agent: 'Message Writer',
    messages,
    jsonSchema: { name: 'drafts', schema: DRAFTS_SCHEMA },
  });
  const json = reply.json;
  const writtenBy = `${reply.provider ?? ctx.model.provider}:${reply.model ?? ctx.model.model}`; // the provider that actually answered (router may fall back)

  const byId = new Map();
  for (const d of Array.isArray(json?.drafts) ? json.drafts : []) {
    if (d && typeof d.session_id === 'string' && !byId.has(d.session_id)) byId.set(d.session_id, d);
  }
  const incomplete = facts
    .filter((f) => {
      const d = byId.get(f.session_id);
      return !d || typeof d.subject !== 'string' || typeof d.body !== 'string' || !d.subject.trim() || !d.body.trim();
    })
    .map((f) => f.session_id);
  if (incomplete.length) {
    throw fail('MODEL_INCOMPLETE', `model returned no usable draft for: ${incomplete.join(', ')}`);
  }

  const drafts = [];
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `D-${String(counter).padStart(2, '0')}`;
  };

  for (const r of booked) {
    const m = byId.get(r.session_id);
    drafts.push({
      draft_id: nextId(),
      to_role: 'learner',
      to_id: r.trainee_id,
      session_id: r.session_id,
      subject: m.subject,
      body: m.body,
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
      return `- ${label} ${r.start}–${r.end}: ${name(traineeName, r.trainee_id, 'trainee')} on ${name(skillName, r.skill_id, 'skill')}`;
    });
    const n = mine.length;
    drafts.push({
      draft_id: nextId(),
      to_role: 'mentor',
      to_id: mid,
      session_id: '',
      subject: `Your booked mentor sessions (${n})`,
      body: mentorDraftBody(mentor, items, n),
      day: '',
      date: '',
      start: '',
      mentor_id: mid,
      status: DRAFT_STATUS,
    });
  }

  const out = { status_all: DRAFT_STATUS, drafts };
  const inputs = ctx.inputRefs ?? [];
  const jsonRef = ctx.store.write({
    kind: 'message_drafts',
    name: 'unsent-message-drafts.json',
    content: `${JSON.stringify(out, null, 2)}\n`,
    producer: ctx.taskId,
    inputs,
  });
  const mdRef = ctx.store.write({
    kind: 'message_drafts',
    name: 'unsent-message-drafts.md',
    content: renderDraftsMd(out),
    producer: ctx.taskId,
    inputs,
  });
  const learnerDrafts = drafts.filter((d) => d.to_role === 'learner').length;
  return {
    artifacts: [jsonRef, mdRef],
    summary: {
      drafts: drafts.length,
      learnerDrafts,
      mentorDrafts: drafts.length - learnerDrafts,
      writtenBy,
    },
  };
}
