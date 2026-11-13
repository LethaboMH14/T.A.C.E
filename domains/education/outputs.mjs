// T.A.C.E education domain — output workers (deterministic code, no model).
// Three tasks, each writes a real file and returns its ArtifactRef:
//   export_calendar       -> mentor-sessions.ics        (kind calendar_ics)      role Calendar Writer
//   export_schedule_xlsx  -> mentor-schedule.xlsx       (kind schedule_xlsx)     role Spreadsheet Writer
//   monday_brief          -> monday-brief.md            (kind monday_brief)      role Brief Writer
// Nothing here sends anything. No wall-clock time inside any file (determinism).
// Reviewer checks C15-C17 re-read these files independently; this file does not import the reviewer.

import ExcelJS from 'exceljs';
import { parseCsv } from '../../engine/csv.mjs';
import { KIND } from '../../engine/contracts.mjs';
import { RULES_VERSION } from './rules.mjs';

export const KIND_CALENDAR = 'calendar_ics';
export const KIND_SCHEDULE_XLSX = 'schedule_xlsx';
export const KIND_MONDAY_BRIEF = 'monday_brief';

export const CALENDAR_NAME = 'mentor-sessions.ics';
export const SCHEDULE_XLSX_NAME = 'mentor-schedule.xlsx';
export const BRIEF_NAME = 'monday-brief.md';

/** Fixed timestamps: nothing in these files depends on the clock. */
export const DTSTAMP = '20261113T000000Z';
const FIXED_DATE = new Date(Date.UTC(2026, 10, 13));
const TZID = 'Africa/Johannesburg';

const SCHEDULE_COLUMNS = ['session_id', 'trainee_id', 'skill_id', 'mentor_id', 'day', 'date', 'start', 'end', 'status'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// ---------- shared reads (latest files through the store, sha256 re-checked by store.read) ----------

function latestSchedule(ctx) {
  const ref = ctx.store.latestByKind(KIND.MENTOR_SCHEDULE);
  if (!ref) throw fail('NO_SCHEDULE', 'no mentor_schedule artifact exists to export');
  const csv = parseCsv(ctx.store.read(ref));
  for (const col of SCHEDULE_COLUMNS) {
    if (!csv.header.includes(col)) throw fail('SCHEMA', `mentor_schedule is missing column ${col}`);
  }
  const rows = csv.rows.slice().sort((a, b) => byText(a.session_id, b.session_id));
  return { ref, rows };
}

function nameMap(src, idCol, nameCol, what) {
  if (!src || !Array.isArray(src.rows)) throw fail('NO_SOURCE', `source ${what} was not admitted`);
  return new Map(src.rows.map((r) => [r[idCol], r[nameCol]]));
}

function lookup(map, id, what) {
  if (!map.has(id)) throw fail('UNKNOWN_ID', `${what} ${id} is not in the sources`);
  return map.get(id);
}

/** "2026-11-17" -> "Tue 17 Nov". UTC arithmetic only, no local time zone. */
export function dayLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw fail('BAD_DATE', `not an ISO date: ${JSON.stringify(iso)}`);
  const dayNum = Number(m[3]);
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, dayNum));
  return `${DAY_NAMES[dt.getUTCDay()]} ${dayNum} ${MONTHS[Number(m[2]) - 1]}`;
}

// ---------- iCalendar (RFC 5545) helpers ----------

/** TEXT value escaping: backslash, semicolon, comma, newline. */
export function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold one content line to 75 octets per physical line. Continuation lines start with one space
 * (so they carry 74 content octets). Never splits a UTF-8 character. Input has no CRLF.
 */
export function foldIcsLine(line) {
  const pieces = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (curBytes + b > limit) {
      pieces.push(cur);
      cur = ch;
      curBytes = b;
      limit = 74;
    } else {
      cur += ch;
      curBytes += b;
    }
  }
  pieces.push(cur);
  return pieces.join('\r\n ');
}

const HHMM_RE = /^(\d{2}):(\d{2})$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-17" + "09:00" -> "20261117T090000" (floating local time, paired with TZID). */
export function icsLocal(date, hhmm) {
  if (!ISO_RE.test(date)) throw fail('BAD_DATE', `not an ISO date: ${JSON.stringify(date)}`);
  if (!HHMM_RE.test(hhmm)) throw fail('BAD_TIME', `not a time: ${JSON.stringify(hhmm)}`);
  return `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}

/**
 * Build the whole VCALENDAR text. events: [{uid, start, end, date, summary, description}]
 * Pure: same events, same bytes. No ATTENDEE, ORGANIZER or email addresses are ever written.
 */
export function buildIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//T.A.C.E//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0200',
    'TZNAME:SAST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${DTSTAMP}`,
      `DTSTART;TZID=${TZID}:${icsLocal(e.date, e.start)}`,
      `DTEND;TZID=${TZID}:${icsLocal(e.date, e.end)}`,
      `SUMMARY:${escapeIcsText(e.summary)}`,
      `DESCRIPTION:${escapeIcsText(e.description)}`,
      'STATUS:TENTATIVE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Task export_calendar. One VEVENT per BOOKED session. */
export async function exportCalendar(ctx) {
  const { rows } = latestSchedule(ctx);
  const learners = nameMap(ctx.sources.trainees, 'trainee_id', 'display_name', 'trainees');
  const mentors = nameMap(ctx.sources.mentors, 'mentor_id', 'display_name', 'mentors');
  const skills = nameMap(ctx.sources.skills, 'skill_id', 'name', 'skills');

  const booked = rows.filter((r) => r.status === 'BOOKED');
  const events = booked.map((r) => {
    const learner = lookup(learners, r.trainee_id, 'trainee');
    const mentor = lookup(mentors, r.mentor_id, 'mentor');
    const skill = lookup(skills, r.skill_id, 'skill');
    return {
      uid: `${r.session_id}@tace.local`,
      date: r.date,
      start: r.start,
      end: r.end,
      summary: `Mentor session: ${skill}`,
      description: `${learner} with ${mentor}. Proposal only — not sent.`,
    };
  });

  const ref = ctx.store.write({
    kind: KIND_CALENDAR,
    name: CALENDAR_NAME,
    content: buildIcs(events),
    producer: ctx.taskId,
    inputs: ctx.inputRefs ?? [],
  });
  return { artifacts: [ref], summary: { events: events.length } };
}

// ---------- XLSX helpers ----------

/**
 * exceljs writes zip entries stamped with the current time, so two runs differ byte-for-byte.
 * This rewrites the DOS date/time of every entry (central directory and local header) to the
 * fixed FIXED_DATE. Walks the zip structure (no signature scanning). Content is unchanged.
 */
export function fixZipTimes(zip) {
  const buf = Buffer.from(zip);
  const dosDate = ((FIXED_DATE.getUTCFullYear() - 1980) << 9) | ((FIXED_DATE.getUTCMonth() + 1) << 5) | FIXED_DATE.getUTCDate();
  const dosTime = 0;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw fail('ZIP_EOCD', 'xlsx has no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw fail('ZIP_CENTRAL', 'bad central directory entry');
    buf.writeUInt16LE(dosTime, p + 12);
    buf.writeUInt16LE(dosDate, p + 14);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw fail('ZIP_LOCAL', 'bad local file header');
    buf.writeUInt16LE(dosTime, local + 10);
    buf.writeUInt16LE(dosDate, local + 12);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return buf;
}

/** Task export_schedule_xlsx. Sheets: "Schedule" (frozen bold header) and "By mentor". */
export async function exportScheduleXlsx(ctx) {
  const { rows } = latestSchedule(ctx);
  const learners = nameMap(ctx.sources.trainees, 'trainee_id', 'display_name', 'trainees');
  const mentorRows = (ctx.sources.mentors?.rows ?? []).slice().sort((a, b) => byText(a.mentor_id, b.mentor_id));
  const mentors = nameMap(ctx.sources.mentors, 'mentor_id', 'display_name', 'mentors');
  const skills = nameMap(ctx.sources.skills, 'skill_id', 'name', 'skills');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'T.A.C.E';
  wb.lastModifiedBy = 'T.A.C.E';
  wb.created = FIXED_DATE;
  wb.modified = FIXED_DATE;

  const sheet = wb.addWorksheet('Schedule');
  const header = sheet.addRow(['Session', 'Learner', 'Skill', 'Mentor', 'Day', 'Date', 'Start', 'End', 'Status']);
  header.font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns = [
    { width: 12 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 8 },
    { width: 12 }, { width: 8 }, { width: 8 }, { width: 14 },
  ];
  for (const r of rows) {
    sheet.addRow([
      r.session_id,
      lookup(learners, r.trainee_id, 'trainee'),
      lookup(skills, r.skill_id, 'skill'),
      r.mentor_id ? lookup(mentors, r.mentor_id, 'mentor') : '',
      r.day,
      r.date,
      r.start,
      r.end,
      r.status,
    ]);
  }

  const byMentor = wb.addWorksheet('By mentor');
  const mh = byMentor.addRow(['Mentor', 'Booked sessions', 'Capacity', 'Within capacity']);
  mh.font = { bold: true };
  byMentor.views = [{ state: 'frozen', ySplit: 1 }];
  byMentor.columns = [{ width: 18 }, { width: 16 }, { width: 12 }, { width: 16 }];
  for (const m of mentorRows) {
    const booked = rows.filter((r) => r.status === 'BOOKED' && r.mentor_id === m.mentor_id).length;
    const capacity = Number(m.capacity);
    byMentor.addRow([m.display_name, booked, capacity, booked <= capacity ? 'yes' : 'no']);
  }

  const buf = fixZipTimes(Buffer.from(await wb.xlsx.writeBuffer()));
  const ref = ctx.store.write({
    kind: KIND_SCHEDULE_XLSX,
    name: SCHEDULE_XLSX_NAME,
    content: buf,
    producer: ctx.taskId,
    inputs: ctx.inputRefs ?? [],
  });
  return { artifacts: [ref], summary: { rows: rows.length, mentors: mentorRows.length } };
}

// ---------- Monday brief ----------

/**
 * Renders monday-brief.md. Pure. The three figure lines use fixed wording so the reviewer (C17)
 * can read them back: "At-risk learners: N", "Booked sessions: N", "Unsent drafts: N".
 */
export function renderBriefMd(f) {
  const lines = [
    '# Monday brief for the coordinator',
    '',
    `Rules ${RULES_VERSION}. Every number below is read from the files in this run. Nothing has been sent.`,
    '',
    '## Who needs help this week',
    '',
    `At-risk learners: ${f.atRiskCount}`,
    '',
  ];
  if (f.atRisk.length === 0) lines.push('- None.');
  for (const l of f.atRisk) {
    const gap = `${l.topGap.skill_id} ${l.topGap.skillName} (score ${l.topGap.score}, threshold ${l.topGap.threshold})`;
    const booked = l.session ? `booked ${l.session}` : 'not booked yet';
    lines.push(`- ${l.trainee_id} ${l.display_name}: top gap ${gap}; ${booked}.`);
  }
  lines.push(
    '',
    '## What is booked',
    '',
    `Booked sessions: ${f.bookedCount}`,
    '',
    ...f.mentors.map((m) => `- ${m.display_name}: ${m.booked} of ${m.capacity} capacity`),
    '',
    '## What needs your approval',
    '',
    `Unsent drafts: ${f.unsentCount}`,
    '',
    `- Learner drafts: ${f.learnerDrafts}. Mentor drafts: ${f.mentorDrafts}. Every draft is UNSENT.`,
    '',
    '## What we could not do',
    '',
  );
  const could = [];
  if (f.unbookedAtRisk.length) could.push(`- At-risk learners without a booked session: ${f.unbookedAtRisk.join(', ')}.`);
  if (f.unscheduled) could.push(`- Sessions with no mentor slot (UNSCHEDULED): ${f.unscheduled}.`);
  if (f.missingCells) could.push(`- Missing scores: ${f.missingCells} cells. They are flagged, not counted as zero.`);
  lines.push(...(could.length ? could : ['- Nothing outstanding.']), '');
  return lines.join('\n');
}

/** Task monday_brief. Reads the latest gaps, performance summary, schedule and drafts. */
export async function writeMondayBrief(ctx) {
  const gapsRef = ctx.store.latestByKind('gaps');
  if (!gapsRef) throw fail('NO_GAPS', 'no gaps artifact exists for the brief');
  const gaps = JSON.parse(ctx.store.read(gapsRef));
  if (gaps.rulesVersion !== RULES_VERSION) throw fail('RULES_MISMATCH', `gaps.json is ${gaps.rulesVersion}`);

  const perfRef = ctx.store.latestByName('performance-summary.json');
  if (!perfRef) throw fail('NO_SUMMARY', 'no performance summary exists for the brief');
  const perf = JSON.parse(ctx.store.read(perfRef));

  const draftsRef = ctx.store.latestByName('unsent-message-drafts.json');
  if (!draftsRef) throw fail('NO_DRAFTS', 'no message drafts exist for the brief');
  const drafts = JSON.parse(ctx.store.read(draftsRef));

  const { rows } = latestSchedule(ctx);
  const booked = rows.filter((r) => r.status === 'BOOKED');
  const mentorRows = (ctx.sources.mentors?.rows ?? []).slice().sort((a, b) => byText(a.mentor_id, b.mentor_id));
  const mentorName = nameMap(ctx.sources.mentors, 'mentor_id', 'display_name', 'mentors');
  const skillName = new Map(perf.skills.map((s) => [s.skill_id, s.name]));

  const atRiskTrainees = gaps.trainees.filter((t) => t.at_risk).sort((a, b) => byText(a.trainee_id, b.trainee_id));
  const atRisk = atRiskTrainees.map((t) => {
    // A requested priority skill may not be a gap; then the brief names the largest gap (tie -> lowest skill_id).
    const top = t.gaps.find((g) => g.skill_id === t.priority_skill)
      ?? t.gaps.slice().sort((a, b) => ((b.threshold - b.score) - (a.threshold - a.score)) || byText(a.skill_id, b.skill_id))[0];
    if (!top) throw fail('NO_PRIORITY', `${t.trainee_id} is at risk but has no priority gap`);
    const session = booked.find((r) => r.trainee_id === t.trainee_id);
    return {
      trainee_id: t.trainee_id,
      display_name: t.display_name,
      topGap: { skill_id: top.skill_id, skillName: skillName.get(top.skill_id) ?? top.skill_id, score: top.score, threshold: top.threshold },
      session: session ? `${dayLabel(session.date)} ${session.start}–${session.end} with ${mentorName.get(session.mentor_id) ?? session.mentor_id}` : null,
    };
  });

  const unsent = drafts.drafts.filter((d) => d.status === 'UNSENT');
  const brief = {
    atRisk,
    atRiskCount: atRisk.length,
    bookedCount: booked.length,
    mentors: mentorRows.map((m) => ({
      display_name: m.display_name,
      capacity: Number(m.capacity),
      booked: booked.filter((r) => r.mentor_id === m.mentor_id).length,
    })),
    unsentCount: unsent.length,
    learnerDrafts: unsent.filter((d) => d.to_role === 'learner').length,
    mentorDrafts: unsent.filter((d) => d.to_role === 'mentor').length,
    unbookedAtRisk: atRisk.filter((l) => !l.session).map((l) => l.trainee_id),
    unscheduled: rows.filter((r) => r.status === 'UNSCHEDULED').length,
    missingCells: perf.missing_cells,
  };

  const ref = ctx.store.write({
    kind: KIND_MONDAY_BRIEF,
    name: BRIEF_NAME,
    content: renderBriefMd(brief),
    producer: ctx.taskId,
    inputs: ctx.inputRefs ?? [],
  });
  return {
    artifacts: [ref],
    summary: { atRisk: brief.atRiskCount, booked: brief.bookedCount, unsent: brief.unsentCount },
  };
}
