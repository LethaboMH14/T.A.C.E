// Unit tests for the output workers (calendar, spreadsheet, Monday brief) and the artifact store
// extensions (.ics, .xlsx, readBuffer). Real files in temp folders; node built-ins plus exceljs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createArtifactStore } from '../../engine/artifacts.mjs';
import { KIND } from '../../engine/contracts.mjs';
import {
  foldIcsLine, escapeIcsText, buildIcs, icsLocal, fixZipTimes, renderBriefMd,
  exportCalendar, exportScheduleXlsx, DTSTAMP,
} from '../../domains/education/outputs.mjs';
import ExcelJS from 'exceljs';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function withDirAsync(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-out-'));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function withDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tace-out-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SCHEDULE_CSV = [
  'session_id,trainee_id,skill_id,mentor_id,day,date,start,end,intervention_id,status',
  'S-01,L-01,S1,M-A,Mon,2026-11-16,09:00,10:00,I-S1-M,BOOKED',
  'S-02,L-02,S2,M-B,Tue,2026-11-17,10:00,11:00,I-S2-M,BOOKED',
  'S-03,L-03,S3,,,,,,I-S3-M,UNSCHEDULED',
  '',
].join('\n');

const SOURCES = {
  trainees: { rows: [
    { trainee_id: 'L-01', display_name: 'Learner 01' },
    { trainee_id: 'L-02', display_name: 'Learner 02' },
    { trainee_id: 'L-03', display_name: 'Learner 03' },
  ] },
  mentors: { rows: [
    { mentor_id: 'M-A', display_name: 'Mentor A', capacity: '6' },
    { mentor_id: 'M-B', display_name: 'Mentor B', capacity: '6' },
  ] },
  skills: { rows: [
    { skill_id: 'S1', name: 'Variables and types' },
    { skill_id: 'S2', name: 'Control flow' },
    { skill_id: 'S3', name: 'Functions' },
  ] },
};

function ctxFor(dir) {
  const store = createArtifactStore(dir);
  store.write({ kind: KIND.MENTOR_SCHEDULE, name: 'mentor-schedule.csv', content: SCHEDULE_CSV, producer: 'mentor_schedule' });
  return { taskId: 'export_test', sources: SOURCES, store, scenario: {}, phase: 'initial', inputRefs: [] };
}

// ---- iCalendar helpers ----

test('foldIcsLine: every physical line is at most 75 octets and unfolds to the original', () => {
  const long = `SUMMARY:${'a'.repeat(200)}`;
  const folded = foldIcsLine(long);
  const lines = folded.split('\r\n');
  assert.ok(lines.length > 1, 'a 200-character line must fold');
  for (const l of lines) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `too long: ${l.length}`);
  for (const l of lines.slice(1)) assert.ok(l.startsWith(' '), 'continuation lines start with a space');
  const unfolded = lines.map((l, i) => (i === 0 ? l : l.slice(1))).join('');
  assert.equal(unfolded, long);
});

test('foldIcsLine: never splits a multi-byte UTF-8 character', () => {
  const line = `DESCRIPTION:${'é'.repeat(60)}😀${'😀'.repeat(20)}`;
  const folded = foldIcsLine(line);
  for (const l of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75);
    assert.ok(!l.includes('�'));
  }
  const unfolded = folded.split('\r\n').map((l, i) => (i === 0 ? l : l.slice(1))).join('');
  assert.equal(unfolded, line);
});

test('escapeIcsText escapes backslash, semicolon, comma and newline', () => {
  assert.equal(escapeIcsText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
});

test('icsLocal builds floating local time and rejects bad input', () => {
  assert.equal(icsLocal('2026-11-17', '09:30'), '20261117T093000');
  assert.throws(() => icsLocal('17/11/2026', '09:30'), { code: 'BAD_DATE' });
  assert.throws(() => icsLocal('2026-11-17', '9am'), { code: 'BAD_TIME' });
});

const EVENTS = [
  { uid: 'S-01@tace.local', date: '2026-11-16', start: '09:00', end: '10:00', summary: 'Mentor session: Variables, types; more', description: 'Learner 01 with Mentor A. Proposal only — not sent.' },
  { uid: 'S-02@tace.local', date: '2026-11-17', start: '10:00', end: '11:00', summary: 'Mentor session: Control flow', description: 'x'.repeat(150) },
];

test('buildIcs: fixed structure, CRLF only, no attendee or organizer fields', () => {
  const ics = buildIcs(EVENTS);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/(^|[^\r])\n/.test(ics), 'every line break must be CRLF');
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
  assert.ok(ics.includes(`DTSTAMP:${DTSTAMP}`));
  assert.ok(ics.includes('PRODID:-//T.A.C.E//EN'));
  assert.ok(ics.includes('METHOD:PUBLISH'));
  assert.ok(ics.includes('STATUS:TENTATIVE'));
  assert.ok(ics.includes('TZID:Africa/Johannesburg'));
  assert.ok(ics.includes('TZOFFSETFROM:+0200'));
  assert.ok(ics.includes('DTSTART;TZID=Africa/Johannesburg:20261116T090000'));
  assert.ok(!/ATTENDEE|ORGANIZER|mailto:/i.test(ics));
  assert.ok(ics.includes('SUMMARY:Mentor session: Variables\\, types\\; more'));
});

test('buildIcs is deterministic: same events, same bytes', () => {
  assert.equal(buildIcs(EVENTS), buildIcs(EVENTS.map((e) => ({ ...e }))));
});

test('exportCalendar: one VEVENT per BOOKED row, the UNSCHEDULED row is left out', async () => {
  await withDirAsync(async (dir) => {
    const result = await exportCalendar(ctxFor(dir));
    const ics = fs.readFileSync(path.join(dir, result.artifacts[0].file), 'utf8');
    assert.equal(result.summary.events, 2);
    assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
    assert.ok(ics.includes('UID:S-01@tace.local'));
    assert.ok(!ics.includes('S-03'));
    assert.ok(ics.includes('Learner 02 with Mentor B. Proposal only'));
  });
});

// ---- artifact store extensions ----

test('store: .ics writes as text/calendar and reads back', () => {
  withDir((dir) => {
    const store = createArtifactStore(dir);
    const ref = store.write({ kind: KIND_TEST, name: 'x.ics', content: 'BEGIN:VCALENDAR\r\n', producer: 't' });
    assert.equal(ref.mime, 'text/calendar');
    assert.equal(store.read(ref), 'BEGIN:VCALENDAR\r\n');
  });
});

const KIND_TEST = 'test_kind';

test('store: .xlsx needs a Buffer, readBuffer returns the same bytes, tampering is refused', () => {
  withDir((dir) => {
    const store = createArtifactStore(dir);
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x7f]);
    assert.throws(() => store.write({ kind: KIND_TEST, name: 'x.xlsx', content: 'text', producer: 't' }), { code: 'BAD_CONTENT' });
    const ref = store.write({ kind: KIND_TEST, name: 'x.xlsx', content: bytes, producer: 't' });
    assert.equal(ref.mime, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.ok(store.readBuffer(ref).equals(bytes));
    fs.writeFileSync(path.join(dir, ref.file), Buffer.from([1, 2, 3]));
    assert.throws(() => store.readBuffer(ref), { code: 'DIGEST_MISMATCH' });
  });
});

test('store: a Buffer is refused for .csv, and unknown extensions are still refused', () => {
  withDir((dir) => {
    const store = createArtifactStore(dir);
    assert.throws(() => store.write({ kind: KIND_TEST, name: 'x.csv', content: Buffer.from('a'), producer: 't' }), { code: 'BAD_CONTENT' });
    assert.throws(() => store.write({ kind: KIND_TEST, name: 'x.pdf', content: 'a', producer: 't' }), { code: 'BAD_NAME' });
  });
});

// ---- xlsx ----

test('fixZipTimes: two exceljs writes of the same workbook give identical bytes after the fix', async () => {
  const make = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'T.A.C.E';
    wb.created = new Date(Date.UTC(2026, 10, 13));
    wb.modified = new Date(Date.UTC(2026, 10, 13));
    const ws = wb.addWorksheet('Schedule');
    ws.addRow(['Session', 'Learner']);
    ws.addRow(['S-01', 'Learner 01']);
    return fixZipTimes(Buffer.from(await wb.xlsx.writeBuffer()));
  };
  const a = await make();
  await new Promise((r) => setTimeout(r, 2100)); // zip times have 2-second resolution
  const b = await make();
  assert.equal(sha(a), sha(b));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(a);
  assert.equal(wb.getWorksheet('Schedule').getRow(2).getCell(1).text, 'S-01');
});

test('exportScheduleXlsx: two runs in separate folders give the same digest and the right sheets', async () => {
  const digests = [];
  for (let i = 0; i < 2; i += 1) {
    await withDirAsync(async (dir) => {
      const result = await exportScheduleXlsx(ctxFor(dir));
      const ref = result.artifacts[0];
      digests.push(ref.digest);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(fs.readFileSync(path.join(dir, ref.file)));
      assert.deepEqual(wb.worksheets.map((w) => w.name), ['Schedule', 'By mentor']);
      const ws = wb.getWorksheet('Schedule');
      assert.equal(ws.getRow(1).getCell(1).text, 'Session');
      assert.ok(ws.getRow(1).font.bold, 'header row is bold');
      assert.equal(ws.views[0].state, 'frozen');
      assert.equal(ws.rowCount, 4, 'header + 3 schedule rows');
      assert.equal(ws.getRow(2).getCell(2).text, 'Learner 01');
      assert.equal(ws.getRow(2).getCell(4).text, 'Mentor A');
      const byMentor = wb.getWorksheet('By mentor');
      assert.deepEqual(byMentor.getRow(2).values.slice(1), ['Mentor A', 1, 6, 'yes']);
      assert.deepEqual(byMentor.getRow(3).values.slice(1), ['Mentor B', 1, 6, 'yes']);
      assert.equal(wb.creator, 'T.A.C.E');
    });
  }
  assert.equal(digests[0], digests[1]);
});

// ---- Monday brief ----

test('renderBriefMd: fixed figure lines and no timestamps', () => {
  const md = renderBriefMd({
    atRisk: [{ trainee_id: 'L-01', display_name: 'Learner 01', topGap: { skill_id: 'S1', skillName: 'Variables and types', score: 40, threshold: 60 }, session: 'Mon 16 Nov 09:00–10:00 with Mentor A' }],
    atRiskCount: 1, bookedCount: 1, mentors: [{ display_name: 'Mentor A', capacity: 6, booked: 1 }],
    unsentCount: 2, learnerDrafts: 1, mentorDrafts: 1, unbookedAtRisk: [], unscheduled: 0, missingCells: 0,
  });
  assert.ok(md.includes('At-risk learners: 1'));
  assert.ok(md.includes('Booked sessions: 1'));
  assert.ok(md.includes('Unsent drafts: 2'));
  assert.ok(md.includes('- Nothing outstanding.'));
  assert.ok(!/\d{4}-\d{2}-\d{2}T|\b\d{2}:\d{2}:\d{2}\b/.test(md), 'no timestamps');
});
