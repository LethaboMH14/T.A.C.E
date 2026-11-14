// End-to-end tests for the output files (calendar, spreadsheet, Monday brief).
// Each test runs the real engine into a temp folder and re-opens the files from disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { EVENT, RUN_STATUS, CHECK_STATUS } from '../../engine/contracts.mjs';
import {
  loadScenario, sha256, withTempDir, runScenario, readEvents, readIndex, latestRef,
} from './helpers.mjs';

const OUTPUT_CHECKS = ['C15_calendar_matches_schedule', 'C16_xlsx_matches_schedule', 'C17_brief_numbers_match'];

function checkResults(runDir) {
  return readEvents(runDir).filter((e) => e.type === EVENT.CHECK_RESULT).map((e) => e.data);
}

test('E2E-OUT-01 weekly_checkin: verified, the three output files exist, C15-C17 pass', async () => {
  await withTempDir(async (tmp) => {
    const runDir = path.join(tmp, 'run');
    const result = await runScenario({ scenario: loadScenario('weekly_checkin'), runDir, runId: 'weekly-1' });
    assert.equal(result.status, RUN_STATUS.VERIFIED);

    const index = readIndex(runDir);
    for (const name of ['mentor-sessions.ics', 'mentor-schedule.xlsx', 'monday-brief.md']) {
      const ref = latestRef(index, name);
      assert.ok(ref, `missing ${name}`);
      assert.equal(sha256(fs.readFileSync(path.join(runDir, ref.file))), ref.digest, `digest mismatch ${name}`);
    }

    const checks = checkResults(runDir);
    for (const id of OUTPUT_CHECKS) {
      const c = checks.find((x) => x.id === id);
      assert.ok(c, `${id} missing from the review`);
      assert.equal(c.status, CHECK_STATUS.PASS, `${id}: ${c.message}`);
    }
  });
});

test('E2E-OUT-02 weekly_checkin: calendar has 14 VEVENTs and no attendees', async () => {
  await withTempDir(async (tmp) => {
    const runDir = path.join(tmp, 'run');
    await runScenario({ scenario: loadScenario('weekly_checkin'), runDir, runId: 'weekly-2' });
    const ics = fs.readFileSync(path.join(runDir, latestRef(readIndex(runDir), 'mentor-sessions.ics').file), 'utf8');
    assert.equal(ics.split('BEGIN:VEVENT').length - 1, 14);
    assert.ok(!/ATTENDEE|ORGANIZER|mailto:/i.test(ics));
    assert.ok(!/(^|[^\r])\n/.test(ics), 'CRLF line endings');
  });
});

test('E2E-OUT-03 weekly_checkin: the spreadsheet re-opens with 14 schedule rows and 3 mentor rows', async () => {
  await withTempDir(async (tmp) => {
    const runDir = path.join(tmp, 'run');
    await runScenario({ scenario: loadScenario('weekly_checkin'), runDir, runId: 'weekly-3' });
    const ref = latestRef(readIndex(runDir), 'mentor-schedule.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fs.readFileSync(path.join(runDir, ref.file)));
    assert.equal(wb.getWorksheet('Schedule').rowCount - 1, 14);
    assert.equal(wb.getWorksheet('By mentor').rowCount - 1, 3);
  });
});

test('E2E-OUT-04 weekly_checkin: two runs give byte-identical calendar and spreadsheet', async () => {
  const digests = [];
  for (const id of ['det-a', 'det-b']) {
    await withTempDir(async (tmp) => {
      const runDir = path.join(tmp, 'run');
      await runScenario({ scenario: loadScenario('weekly_checkin'), runDir, runId: id });
      const index = readIndex(runDir);
      digests.push([latestRef(index, 'mentor-sessions.ics').digest, latestRef(index, 'mentor-schedule.xlsx').digest]);
    });
  }
  assert.deepEqual(digests[0], digests[1]);
});

test('E2E-OUT-05 inject_overlap still verifies and repairs with the output files present in the plan', async () => {
  await withTempDir(async (tmp) => {
    const runDir = path.join(tmp, 'run');
    const result = await runScenario({ scenario: loadScenario('inject_overlap'), runDir, runId: 'overlap-out' });
    assert.equal(result.status, RUN_STATUS.VERIFIED);
    const events = readEvents(runDir);
    assert.ok(events.some((e) => e.type === EVENT.VERIFICATION_FAILED && e.data.failed.includes('C04_schedule_no_overlap')));
    assert.ok(events.some((e) => e.type === EVENT.VERIFICATION_PASSED));
  });
});
