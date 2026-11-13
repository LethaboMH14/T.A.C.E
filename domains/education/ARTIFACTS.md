# Education domain — artifact formats (the contract between workers and the reviewer)

Workers WRITE these formats; the reviewer READS them back from disk and recomputes from the raw
sources with its own code. Rules are in `rules.mjs`. All lists are sorted as stated. No timestamps
inside any artifact. Source row numbers are the physical CSV line (header = line 1).

## Shared worker interface

```js
// every worker:  export async function <name>(ctx) -> { artifacts: ArtifactRef[], summary: object }
ctx = {
  taskId,                 // e.g. 'compute_gaps'
  sources,                // { trainees, assessments, skills, mentors, availability, interventions } AdmittedSource
  store,                  // engine/artifacts.mjs store: write({kind,name,content,producer,inputs}), read(ref), latestByKind(kind)
  scenario,               // scenario JSON (inject, unavailable, ...)
  phase,                  // 'initial' | 'rerun'   -> fault injection ONLY when phase === 'initial'
  inputRefs,              // [{name, version, digest}] of the sources/artifacts this task consumed; pass as `inputs` on write
}
// read a previous worker's JSON output (a real file hand-off):
const ref = ctx.store.latestByKind('gaps'); const gaps = JSON.parse(ctx.store.read(ref));
```
`producer` on every write = `ctx.taskId`. `summary` is small plain JSON for the live activity feed
(e.g. `{ atRisk: 12, gaps: 41 }`). Use `toCsv` from `engine/csv.mjs` for every CSV.

## 1. `gaps.json` (kind `gaps`) and `gap-analysis.csv` (kind `gap_analysis`) — task `compute_gaps`, role Analyst
```json
{ "rulesVersion": "edu-rules-v1",
  "trainees": [ { "trainee_id": "L-01", "display_name": "Learner 01", "first_login_day": 2,
      "gaps":    [ { "skill_id": "S3", "score": 48, "threshold": 60, "shortfall": 12, "row": 16 } ],
      "missing": [ { "skill_id": "S5", "row": 18 } ],
      "at_risk": false, "priority_skill": null } ] }
```
All 36 trainees, sorted by `trainee_id`; `gaps`/`missing` sorted by `skill_id`. `priority_skill` only when `at_risk`.
CSV columns: `trainee_id,display_name,skill_id,score,threshold,shortfall,at_risk,source_file,source_row`
— one row per gap, sorted by trainee_id then skill_id; `at_risk` is `yes`/`no`; `source_file` = `assessments.csv`.

## 2. `performance-summary.json` + `performance-summary.md` (kind `performance_summary`) — task `performance_summary`, role Writer
```json
{ "rulesVersion": "edu-rules-v1", "trainees": 36, "assessed_cells": 210, "missing_cells": 6,
  "at_risk_count": 12, "at_risk_ids": ["L-03", "..."],
  "skills": [ { "skill_id": "S1", "name": "Variables and types", "threshold": 60,
                "mean": 67.4, "present": 35, "missing": 1, "below_threshold": 7 } ] }
```
Built from `gaps.json` + the skills and assessments sources. `mean` = present scores only, 1 decimal.
The `.md` is rendered from the JSON by `renderSummaryMd(json)` (export it): title, one-line method
("Means use present scores only. Missing scores are flagged, not counted as zero."), a table
`| Skill | Mean | Below threshold | Missing |` with one row per skill using the exact JSON numbers,
and the at-risk list. Write the JSON first, then the MD; both carry the same version number.
**Fault `inject.kind === 'wrong_aggregate'` (phase initial only):** for `inject.skill_id`, compute the mean
treating missing as 0 over all 36 trainees (a realistic bug). Everything else stays correct.

## 3. `improvement-plan.json` + `.md` (kind `improvement_plan`) — task `recommend_interventions`, role Intervention Specialist
```json
{ "rulesVersion": "edu-rules-v1",
  "items": [ { "trainee_id": "L-03", "skill_id": "S4", "intervention_id": "I-S4-M", "kind": "mentor_session",
               "title": "1:1 mentor session: data structures", "reason": "Score 41 is below 60 (assessments.csv line 22)",
               "source_row": 22 } ] }
```
Rule: every gap gets the `practice` intervention for its skill; every at-risk trainee ALSO gets the
`mentor_session` intervention for their `priority_skill`. Only verified gaps (from `gaps.json`). Sorted by
trainee_id, then skill_id, then kind. If no intervention exists for a skill, list it under `"unresolved"`
(array of `{trainee_id, skill_id, reason}`) — never invent one. `.md` renders the items per learner.

## 4. `mentor-schedule.csv` (kind `mentor_schedule`) — task `mentor_schedule`, role Scheduler
Columns: `session_id,trainee_id,skill_id,mentor_id,day,date,start,end,intervention_id,status`
- One row per at-risk trainee (from the plan's `mentor_session` items). `status` = `BOOKED` or `UNSCHEDULED`
  (UNSCHEDULED rows have empty mentor/day/date/start/end).
- Greedy, deterministic: order learners by number of gaps desc, then trainee_id. For each, try mentors
  sorted by mentor_id whose `skills` include the skill and who have capacity left; take the earliest free
  whole-hour slot (Mon→Fri, then time) inside that mentor's availability windows, minus any
  `scenario.unavailable` windows. No mentor may have two sessions starting at the same time.
- `date` from `WEEK_OF` (Mon = 2026-11-16 … Fri = 2026-11-20). `session_id` = `S-01`, `S-02`… in booking order.
- Rows sorted by session_id.
**Fault `inject.kind === 'overlap'` (phase initial only):** when `inject.mentor_id` receives their SECOND
booking, give it the same slot as their FIRST booking (forgot to mark the slot used). Exactly one overlap.

## 5. `unsent-message-drafts.json` + `.md` (kind `message_drafts`) — task `draft_messages`, role Writer
```json
{ "status_all": "UNSENT",
  "drafts": [ { "draft_id": "D-01", "to_role": "learner", "to_id": "L-03", "session_id": "S-01",
                "subject": "Your mentor session on Tue 17 Nov", "body": "...Tue 17 Nov at 09:00 with Mentor B...",
                "day": "Tue", "date": "2026-11-17", "start": "09:00", "mentor_id": "M-B", "status": "UNSENT" } ] }
```
One learner draft per BOOKED session (in session order), then one mentor draft per mentor with ≥1
session (to_role `mentor`, session_id `""`, listing their sessions). Plain, kind wording. No email
addresses. Always read the LATEST schedule version. `.md` renders every draft with a clear "UNSENT —
needs a person's approval" banner.

## 6. Reviewer checks (written by the runner to `evidence-checks.json`)
| id | kind checked | passes when |
|---|---|---|
| C01_gaps_match | gap_analysis | recomputed gaps (trainee, skill, score, row) equal the CSV rows |
| C02_summary_numbers | performance_summary | recomputed means/counts/at-risk equal JSON within 0.05 |
| C03_summary_text_matches | performance_summary | each skill row in the .md shows the JSON mean |
| C04_schedule_no_overlap | mentor_schedule | no mentor has two BOOKED sessions that overlap |
| C05_schedule_in_availability | mentor_schedule | every BOOKED session lies inside an availability window (and not in an unavailable one) |
| C06_schedule_capacity | mentor_schedule | sessions per mentor ≤ capacity |
| C07_schedule_skill_match | mentor_schedule | mentor's skills include the session skill |
| C08_schedule_covers_at_risk | mentor_schedule | every recomputed at-risk learner has a BOOKED session |
| C09_plan_refs | improvement_plan | every item is a real gap and a known intervention for that skill |
| C10_drafts_unsent | message_drafts | every draft status is exactly UNSENT |
| C11_drafts_match_schedule | message_drafts | every learner draft matches a BOOKED session (mentor, day, start) in the latest schedule |
| C12_artifacts_intact | (all) | every latest artifact re-reads with its recorded sha256 |
| C13_source_digests | (all) | every source input recorded on an artifact matches the admitted digest |

## 6. `mentor-sessions.ics` (kind `calendar_ics`) — task `export_calendar`, role Calendar Writer
RFC 5545 VCALENDAR, CRLF line endings, lines folded at 75 octets (continuation lines start with one space).
Header: `PRODID:-//T.A.C.E//EN`, `VERSION:2.0`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, then a VTIMEZONE for
`Africa/Johannesburg` (SAST, +0200, no DST). One VEVENT per BOOKED row of the latest `mentor-schedule.csv`:
`UID:<session_id>@tace.local`, `DTSTAMP:20261113T000000Z` (fixed), `DTSTART;TZID=Africa/Johannesburg:<date>T<start>00`,
the matching DTEND, `SUMMARY:Mentor session: <skill name>`, `DESCRIPTION:<learner> with <mentor>. Proposal only — not sent.`,
`STATUS:TENTATIVE`. No ATTENDEE, ORGANIZER or mailto: anywhere. UNSCHEDULED rows produce no event.

## 7. `mentor-schedule.xlsx` (kind `schedule_xlsx`) — task `export_schedule_xlsx`, role Spreadsheet Writer
Built with exceljs (MIT). Sheet `Schedule`: bold frozen header `Session, Learner, Skill, Mentor, Day, Date, Start, End,
Status`, one row per schedule row in CSV order (learner and mentor shown by display name). Sheet `By mentor`:
`Mentor, Booked sessions, Capacity, Within capacity`. Workbook creator `T.A.C.E`, created and modified 2026-11-13.
Zip entry timestamps are rewritten to a fixed date (`fixZipTimes`) so two runs give identical bytes.
Written as a Buffer; the store checks the digest on read (`readBuffer`).

## 8. `monday-brief.md` (kind `monday_brief`) — task `monday_brief`, role Brief Writer
One page, no timestamps. Sections: `## Who needs help this week` (at-risk learners with top gap and booked session),
`## What is booked` (per mentor), `## What needs your approval`, `## What we could not do`. The figures are on fixed lines
the reviewer reads back:
- `At-risk learners: N`
- `Booked sessions: N`
- `Unsent drafts: N`

## Reviewer checks C15-C17 (added for the output files)
- **C15_calendar_matches_schedule** (artifact `mentor-sessions.ics`): every BOOKED row has exactly one VEVENT with the
  matching UID, DTSTART date and time in Africa/Johannesburg, and the mentor name in DESCRIPTION; no extra events;
  CRLF only; no ATTENDEE, ORGANIZER or mailto:.
- **C16_xlsx_matches_schedule** (artifact `mentor-schedule.xlsx`): re-opened through `readBuffer` (digest re-checked) and
  parsed with exceljs. The Schedule sheet header and every row (session, learner, mentor, day, start, status) equal the
  latest `mentor-schedule.csv`.
- **C17_brief_numbers_match** (artifact `monday-brief.md`): the three stated figures equal the recomputed values: at-risk
  learners from the reviewer's own recomputation, BOOKED rows from the schedule, UNSENT drafts from the drafts JSON.
Each check is skipped when its file is absent. Routing to repair is the lead's decision (see the report).

## Store extensions (engine/artifacts.mjs)
`.ics` is written as a string (`text/calendar`). `.xlsx` must be written as a Buffer (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
`readBuffer(ref)` returns the bytes after the sha256 check. `read(ref)` is unchanged for every existing extension.

## Scenario `weekly_checkin`
The baseline proposal plus the three output deliverables, and a subgoal `outputs` (depends on `schedule` and `drafts`)
with one ARTIFACT_REOPEN acceptance criterion per deliverable.
