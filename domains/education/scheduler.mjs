// T.A.C.E education domain — mentor scheduler (task mentor_schedule, role Scheduler).
// Deterministic greedy booking (ADR-0008: no solver dependency). Zero dependencies.
// Rules come from ./rules.mjs; this file implements them on its own (no shared logic).

import { toCsv } from '../../engine/csv.mjs';
import { DAYS, WEEK_OF, SESSION_MINUTES } from './rules.mjs';

const HEADER = Object.freeze([
  'session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'intervention_id', 'status',
]);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toMinutes(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) throw fail('BAD_TIME', `bad time: ${JSON.stringify(hhmm)}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function toHHMM(minutes) {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

function dateFor(day) {
  const i = DAYS.indexOf(day);
  if (i < 0) throw fail('BAD_DAY', `bad day: ${day}`);
  const [y, mo, d] = WEEK_OF.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + i)).toISOString().slice(0, 10);
}

/**
 * Every whole-hour session start that fits inside one of the mentor's availability windows,
 * minus any scenario.unavailable day. Sorted Mon..Fri, then start time.
 * @returns {{day:string,date:string,start:string,end:string}[]}
 */
export function allSlots(mentorId, sources, scenario = {}) {
  const blockedDays = new Set(
    (scenario?.unavailable ?? []).filter((u) => u.mentor_id === mentorId).map((u) => u.day),
  );
  const found = new Map();
  for (const w of sources.availability.rows) {
    if (w.mentor_id !== mentorId || blockedDays.has(w.day) || !DAYS.includes(w.day)) continue;
    const winStart = toMinutes(w.start);
    const winEnd = toMinutes(w.end);
    const firstHour = Math.ceil(winStart / 60) * 60;
    for (let t = firstHour; t + SESSION_MINUTES <= winEnd; t += 60) {
      const start = toHHMM(t);
      const key = `${w.day}|${start}`;
      if (!found.has(key)) {
        found.set(key, { day: w.day, date: dateFor(w.day), start, end: toHHMM(t + SESSION_MINUTES) });
      }
    }
  }
  return [...found.values()].sort((a, b) => {
    const da = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (da !== 0) return da;
    return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  });
}

/**
 * Slots still free for one mentor, given the sessions already booked (rows with mentor_id and day/start).
 * Sessions for other mentors and UNSCHEDULED rows are ignored.
 * @returns {{day:string,date:string,start:string,end:string}[]}
 */
export function freeSlots(mentorId, sessions, sources, scenario = {}) {
  const taken = new Set(
    (sessions ?? [])
      .filter((s) => s.mentor_id === mentorId && s.status !== 'UNSCHEDULED')
      .map((s) => `${s.day}|${s.start}`),
  );
  return allSlots(mentorId, sources, scenario).filter((s) => !taken.has(`${s.day}|${s.start}`));
}

/**
 * Greedy, deterministic mentor booking.
 * Input: latest improvement plan (.json). Learners = its mentor_session items, ordered by gap count
 * (practice items per learner) descending, then trainee_id ascending.
 * For each learner, candidate mentors = skills include the session skill and capacity left, sorted by
 * mentor_id; the first candidate with a free slot takes its earliest free slot. Otherwise UNSCHEDULED.
 * Fault (phase initial only, scenario.inject overlap): when inject.mentor_id gets its SECOND booking,
 * it reuses the exact slot of its first booking and does not consume a new slot.
 */
export async function scheduleMentors(ctx) {
  const { sources, store, phase } = ctx;
  const scenario = ctx.scenario ?? {};

  let planRef = store.latestByKind('improvement_plan');
  if (!planRef || !planRef.name.endsWith('.json')) planRef = store.latestByName('improvement-plan.json');
  if (!planRef) throw fail('MISSING_PLAN', 'no improvement_plan artifact to schedule from');
  const plan = JSON.parse(store.read(planRef));
  const items = Array.isArray(plan.items) ? plan.items : [];

  const gapCount = new Map();
  for (const it of items) {
    if (it.kind === 'practice') gapCount.set(it.trainee_id, (gapCount.get(it.trainee_id) ?? 0) + 1);
  }
  const learners = items
    .filter((it) => it.kind === 'mentor_session')
    .map((it) => ({
      trainee_id: it.trainee_id,
      skill_id: it.skill_id,
      intervention_id: it.intervention_id,
      gaps: gapCount.get(it.trainee_id) ?? 0,
    }))
    .sort((a, b) => (b.gaps - a.gaps) || (a.trainee_id < b.trainee_id ? -1 : a.trainee_id > b.trainee_id ? 1 : 0));

  const mentors = sources.mentors.rows
    .map((r) => ({
      id: r.mentor_id,
      skills: new Set(String(r.skills).split(';').map((s) => s.trim()).filter(Boolean)),
      capacity: Number(r.capacity),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const remaining = new Map(mentors.map((m) => [m.id, m.capacity]));
  const bookedBy = new Map(mentors.map((m) => [m.id, []]));

  const faultMentor = phase === 'initial' && scenario.inject?.kind === 'overlap' ? scenario.inject.mentor_id : null;
  let faultApplied = false;

  const rows = [];
  learners.forEach((l, idx) => {
    const sessionId = `S-${pad2(idx + 1)}`;
    const base = {
      session_id: sessionId,
      trainee_id: l.trainee_id,
      skill_id: l.skill_id,
      intervention_id: l.intervention_id,
    };
    const candidates = mentors.filter((m) => m.skills.has(l.skill_id) && remaining.get(m.id) > 0);
    let placed = null;
    for (const m of candidates) {
      const mine = bookedBy.get(m.id);
      let slot;
      if (faultMentor === m.id && !faultApplied && mine.length === 1) {
        const first = mine[0];
        slot = { day: first.day, date: first.date, start: first.start, end: first.end };
        faultApplied = true;
      } else {
        slot = freeSlots(m.id, mine, sources, scenario)[0] ?? null;
      }
      if (slot) {
        placed = { mentorId: m.id, slot };
        break;
      }
    }
    if (placed) {
      const row = {
        ...base,
        mentor_id: placed.mentorId,
        day: placed.slot.day,
        date: placed.slot.date,
        start: placed.slot.start,
        end: placed.slot.end,
        status: 'BOOKED',
      };
      bookedBy.get(placed.mentorId).push(row);
      remaining.set(placed.mentorId, remaining.get(placed.mentorId) - 1);
      rows.push(row);
    } else {
      rows.push({
        ...base, mentor_id: '', day: '', date: '', start: '', end: '', status: 'UNSCHEDULED',
      });
    }
  });

  rows.sort((a, b) => (a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : 0));

  const content = toCsv(HEADER, rows);
  const ref = store.write({
    kind: 'mentor_schedule',
    name: 'mentor-schedule.csv',
    content,
    producer: ctx.taskId,
    inputs: ctx.inputRefs ?? [],
  });

  const byMentor = {};
  for (const m of mentors) byMentor[m.id] = bookedBy.get(m.id).length;
  const booked = rows.filter((r) => r.status === 'BOOKED').length;
  const unscheduled = rows.length - booked;

  return { artifacts: [ref], summary: { booked, unscheduled, byMentor } };
}
