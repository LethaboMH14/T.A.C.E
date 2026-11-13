// Targeted repair for the education domain.
// Repair changes ONLY what a failed check points at, writes a NEW artifact version (v1 is kept),
// and reports exactly what changed. It never marks anything as passed: the independent reviewer
// re-opens the new files and decides. Deterministic code, not a language model.
import { parseCsv, toCsv } from '../../engine/csv.mjs';
import { DAYS, WEEK_OF, SESSION_MINUTES } from './rules.mjs';
import { renderSummaryMd } from './writer.mjs';

const SCHEDULE_CHECKS = new Set(['C04_schedule_no_overlap', 'C05_schedule_in_availability', 'C06_schedule_capacity', 'C07_schedule_skill_match', 'C08_schedule_covers_at_risk']);
const SUMMARY_CHECKS = new Set(['C02_summary_numbers', 'C03_summary_text_matches']);
const DRAFT_CHECKS = new Set(['C10_drafts_unsent', 'C11_drafts_match_schedule', 'C14_drafts_text_matches', 'C18_requests_answered', 'C19_privacy_in_drafts']);

/**
 * Group failed checks into repair jobs.
 * @param {import('../../engine/contracts.mjs').Check[]} failed
 * @returns {{kind:string, strategy:string, checkIds:string[], fixable:boolean, rerun:string[], reason?:string}[]}
 */
export function planRepairs(failed) {
  const jobs = new Map();
  const add = (key, job, id) => {
    if (!jobs.has(key)) jobs.set(key, { ...job, checkIds: [] });
    jobs.get(key).checkIds.push(id);
  };
  for (const c of [...failed].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    // UNKNOWN means the reviewer could not read or trust a file. Repair must not guess around that.
    if (c.status !== 'FAIL') add('unknown:' + c.id, { kind: c.kind, strategy: 'none', fixable: false, rerun: [], reason: `${c.id} could not be checked (${c.message}). A person must look at it.` }, c.id);
    else if (SCHEDULE_CHECKS.has(c.id)) add('schedule', { kind: 'mentor_schedule', strategy: 'reschedule_affected_sessions', fixable: true, rerun: ['mentor_schedule'] }, c.id);
    else if (SUMMARY_CHECKS.has(c.id)) add('summary', { kind: 'performance_summary', strategy: 'recompute_affected_numbers', fixable: true, rerun: ['performance_summary'] }, c.id);
    else if (DRAFT_CHECKS.has(c.id)) add('drafts', { kind: 'message_drafts', strategy: 'regenerate_from_latest_schedule', fixable: true, rerun: [] , rerunSelf: 'draft_messages' }, c.id);
    else if (c.id === 'C01_gaps_match') add('gaps', { kind: 'gap_analysis', strategy: 'rerun_producer', fixable: true, rerun: [], rerunSelf: 'compute_gaps' }, c.id);
    else if (c.id === 'C15_calendar_matches_schedule') add('ics', { kind: 'calendar_ics', strategy: 'rerun_producer', fixable: true, rerun: [], rerunSelf: 'export_calendar' }, c.id);
    else if (c.id === 'C16_xlsx_matches_schedule') add('xlsx', { kind: 'schedule_xlsx', strategy: 'rerun_producer', fixable: true, rerun: [], rerunSelf: 'export_schedule_xlsx' }, c.id);
    else if (c.id === 'C17_brief_numbers_match') add('brief', { kind: 'monday_brief', strategy: 'rerun_producer', fixable: true, rerun: [], rerunSelf: 'monday_brief' }, c.id);
    else if (c.id === 'C09_plan_refs') add('plan', { kind: 'improvement_plan', strategy: 'rerun_producer', fixable: true, rerun: [], rerunSelf: 'recommend_interventions' }, c.id);
    else add('integrity:' + c.id, { kind: c.kind, strategy: 'none', fixable: false, rerun: [], reason: 'Integrity problem (a file or source changed outside the run). A person must look at it.' }, c.id);
  }
  return [...jobs.values()];
}

// ---------------------------------------------------------------- schedule

function dateFor(day) {
  const i = DAYS.indexOf(day);
  const d = new Date(WEEK_OF + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
}
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

function mentorSlots(mentorId, sources, scenario) {
  const off = new Set((scenario.unavailable || []).filter(u => u.mentor_id === mentorId).map(u => u.day));
  const slots = [];
  for (const w of sources.availability.rows) {
    if (w.mentor_id !== mentorId || off.has(w.day)) continue;
    // whole-hour starts only, same rule as the scheduler (rules.mjs)
    for (let s = Math.ceil(toMin(w.start) / 60) * 60; s + SESSION_MINUTES <= toMin(w.end); s += 60) {
      slots.push({ day: w.day, date: dateFor(w.day), start: toHhmm(s), end: toHhmm(s + SESSION_MINUTES) });
    }
  }
  return slots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.start) - toMin(b.start));
}

const describe = (r) => (r.status === 'BOOKED' ? `${r.mentor_id} ${r.day} ${r.start}` : 'unscheduled');

/**
 * Re-place only the sessions that break a rule; every valid session keeps its exact slot.
 *
 * Propose-and-verify ladder (per session, using the run's repair history):
 *   level 0  smallest change first: same mentor, same day, one hour later (if that slot is in
 *            the mentor's window). Repair does NOT pre-check clashes here; the independent
 *            Reviewer judges the result. If it clashes, the Reviewer rejects it and the next
 *            round escalates.
 *   level 1+ full re-placement: first free valid slot (same mentor first, then another mentor
 *            with the skill), fully checked against everything kept.
 * Whether level 0 is rejected depends only on the real schedule; nothing is scripted.
 */
export function repairSchedule(rows, sources, scenario, history = []) {
  const mentors = new Map(sources.mentors.rows.map(m => [m.mentor_id, { skills: new Set(m.skills.split(';')), capacity: Number(m.capacity) }]));
  const mentorIds = [...mentors.keys()].sort();
  const slotsOf = new Map(mentorIds.map(id => [id, mentorSlots(id, sources, scenario)]));
  const kept = [];
  const used = (id) => kept.filter(k => k.status === 'BOOKED' && k.mentor_id === id);
  const valid = (r) => {
    const m = mentors.get(r.mentor_id);
    if (!m || !m.skills.has(r.skill_id)) return false;
    if (!slotsOf.get(r.mentor_id).some(s => s.day === r.day && s.start === r.start)) return false;
    if (used(r.mentor_id).length >= m.capacity) return false;
    return !used(r.mentor_id).some(k => k.day === r.day && k.start === r.start);
  };
  const changes = [];
  const movedBefore = new Map();
  for (const h of history) for (const c of h.changes || []) if (c.session_id) movedBefore.set(c.session_id, (movedBefore.get(c.session_id) || 0) + 1);
  // Pass 1: keep every session that already obeys the rules. Sessions Repair never touched win a
  // contested slot, so a session Repair moved earlier yields instead of bumping an innocent one.
  const bySession = (a, b) => (a.session_id < b.session_id ? -1 : 1);
  const ordered = [...rows].sort((a, b) => (movedBefore.has(a.session_id) - movedBefore.has(b.session_id)) || bySession(a, b));
  const broken = [];
  for (const r of ordered) {
    if (r.status === 'BOOKED' && valid(r)) kept.push({ ...r });
    else broken.push(r);
  }
  // Pass 2: move only the broken ones.
  for (const r of broken) {
    const level = movedBefore.get(r.session_id) || 0;
    let next = null;
    let strategy = 'first_free_valid_slot';
    if (level === 0 && r.status === 'BOOKED') {
      const target = toHhmm(toMin(r.start) + SESSION_MINUTES);
      const s = (slotsOf.get(r.mentor_id) || []).find(x => x.day === r.day && x.start === target);
      if (s && used(r.mentor_id).length < mentors.get(r.mentor_id).capacity) {
        next = { ...r, ...s, status: 'BOOKED' };
        strategy = 'shift_one_hour';
      }
    }
    if (!next) {
      const candidates = [r.mentor_id, ...mentorIds.filter(id => id !== r.mentor_id)].filter(id => mentors.get(id)?.skills.has(r.skill_id));
      for (const id of candidates) {
        if (used(id).length >= mentors.get(id).capacity) continue;
        const slot = slotsOf.get(id).find(s => !used(id).some(k => k.day === s.day && k.start === s.start));
        if (slot) { next = { ...r, mentor_id: id, ...slot, status: 'BOOKED' }; break; }
      }
    }
    next = next || { ...r, mentor_id: '', day: '', date: '', start: '', end: '', status: 'UNSCHEDULED' };
    kept.push(next);
    if (describe(next) !== describe(r)) {
      changes.push({ session_id: r.session_id, trainee_id: r.trainee_id, from: describe(r), to: describe(next), strategy, attempt: level + 1,
        reason: strategy === 'shift_one_hour'
          ? 'Smallest change first: same mentor, one hour later. The independent Reviewer decides whether it holds.'
          : r.status === 'BOOKED' ? 'Escalated: moved to the first free slot that passes every schedule rule' : 'Was unscheduled; a free valid slot exists' });
    }
  }
  kept.sort((a, b) => (a.session_id < b.session_id ? -1 : 1));
  return { rows: kept, changes };
}

// ---------------------------------------------------------------- summary

function skillStats(skillId, sources) {
  const skill = sources.skills.rows.find(s => s.skill_id === skillId);
  const threshold = Number(skill.threshold);
  const cells = sources.assessments.rows.filter(a => a.skill_id === skillId);
  const present = cells.filter(a => String(a.score).trim() !== '').map(a => Number(String(a.score).trim()));
  const mean = present.length ? Math.round((present.reduce((x, y) => x + y, 0) / present.length) * 10) / 10 : null;
  return { mean, present: present.length, missing: cells.length - present.length, below_threshold: present.filter(s => s < threshold).length };
}

/** Recompute only the per-skill numbers that the reviewer flagged (or every skill if no detail was given). */
export function repairSummary(json, failedChecks, sources) {
  const flagged = new Set();
  for (const c of failedChecks) for (const m of c.detail?.mismatches || []) {
    const parts = String(m.field || '').split('.');
    if (parts[0] === 'skills' && parts[1]) flagged.add(parts[1]);
  }
  const targets = flagged.size ? [...flagged].sort() : json.skills.map(s => s.skill_id);
  const next = JSON.parse(JSON.stringify(json));
  const changes = [];
  for (const s of next.skills) {
    if (!targets.includes(s.skill_id)) continue;
    const fresh = skillStats(s.skill_id, sources);
    for (const k of ['mean', 'present', 'missing', 'below_threshold']) {
      if (s[k] !== fresh[k]) { changes.push({ field: `skills.${s.skill_id}.${k}`, from: s[k], to: fresh[k], reason: 'Recomputed from present scores only (missing is not zero)' }); s[k] = fresh[k]; }
    }
  }
  return { json: next, changes };
}

// ---------------------------------------------------------------- apply

/**
 * Apply one repair job. Returns {from, to, changes} or {unfixable, reason}.
 * Jobs with `rerunSelf` are handled by the runner (it re-runs that task); nothing is written here.
 */
export async function applyRepair(ctx, job, failedChecks) {
  const { store, sources, scenario } = ctx;
  if (job.kind === 'mentor_schedule') {
    const ref = store.latestByName('mentor-schedule.csv');
    const parsed = parseCsv(store.read(ref));
    const { rows, changes } = repairSchedule(parsed.rows, sources, scenario, ctx.history || []);
    if (!changes.length) return { unfixable: true, reason: 'No valid free slot exists for the affected sessions. A person must add mentor time or change capacity.' };
    const to = store.write({ kind: ref.kind, name: ref.name, content: toCsv(parsed.header, rows), producer: 'repair', inputs: ref.inputs });
    return { from: `${ref.name}@v${ref.version}`, to: `${to.name}@v${to.version}`, toRef: to, changes };
  }
  if (job.kind === 'performance_summary') {
    const ref = store.latestByName('performance-summary.json');
    const { json, changes } = repairSummary(JSON.parse(store.read(ref)), failedChecks, sources);
    const onlyText = failedChecks.every((c) => c.id === 'C03_summary_text_matches');
    if (!changes.length && !onlyText) {
      return { unfixable: true, reason: 'The flagged summary numbers already match a fresh recompute here, so repair cannot tell what is wrong. A person must look at it.' };
    }
    if (!changes.length) {
      // numbers already right: only the text drifted, so re-render the markdown from the JSON
      const mdRef = store.latestByName('performance-summary.md');
      const md = store.write({ kind: mdRef.kind, name: mdRef.name, content: renderSummaryMd(json), producer: 'repair', inputs: mdRef.inputs });
      return { from: `${mdRef.name}@v${mdRef.version}`, to: `${md.name}@v${md.version}`, toRef: md, changes: [{ field: 'markdown', from: 'out of date', to: 're-rendered from the JSON numbers' }] };
    }
    const to = store.write({ kind: ref.kind, name: ref.name, content: JSON.stringify(json, null, 2) + '\n', producer: 'repair', inputs: ref.inputs });
    const mdRef = store.latestByName('performance-summary.md');
    const md = store.write({ kind: mdRef.kind, name: mdRef.name, content: renderSummaryMd(json), producer: 'repair', inputs: mdRef.inputs });
    return { from: `${ref.name}@v${ref.version}`, to: `${to.name}@v${to.version}`, toRef: to, alsoWritten: [md], changes };
  }
  return { unfixable: true, reason: `No repair strategy for ${job.kind}` };
}
