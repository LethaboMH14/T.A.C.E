// Education domain pack: the capabilities the generic planner can choose from.
// The planner picks only what the goal's deliverables need (report-only goal -> 2 tasks).
// Every worker is deterministic code (not a language model) and is labelled that way in the UI.
import { KIND } from '../../engine/contracts.mjs';
import { computeGaps } from './analyst.mjs';
import { recommendInterventions } from './interventions.mjs';
import { scheduleMentors } from './scheduler.mjs';
import { writePerformanceSummary, draftMessages } from './writer.mjs';
import { exportCalendar, exportScheduleXlsx, writeMondayBrief, KIND_CALENDAR, KIND_SCHEDULE_XLSX, KIND_MONDAY_BRIEF } from './outputs.mjs';

export const EDU_CAPABILITIES = Object.freeze([
  {
    id: 'compute_gaps', role: 'Analyst', label: 'Find skill gaps and learners at risk',
    consumes: [KIND.SRC_TRAINEES, KIND.SRC_ASSESSMENTS, KIND.SRC_SKILLS],
    produces: [KIND.GAPS, KIND.GAP_ANALYSIS], run: computeGaps,
  },
  {
    id: 'performance_summary', role: 'Report Writer', label: 'Summarise cohort performance',
    consumes: [KIND.GAPS, KIND.SRC_SKILLS, KIND.SRC_ASSESSMENTS],
    produces: [KIND.PERFORMANCE_SUMMARY], run: writePerformanceSummary,
  },
  {
    id: 'recommend_interventions', role: 'Support Planner', label: 'Match each gap to a support activity',
    consumes: [KIND.GAPS, KIND.SRC_INTERVENTIONS],
    produces: [KIND.IMPROVEMENT_PLAN], run: recommendInterventions,
  },
  {
    id: 'mentor_schedule', role: 'Scheduler', label: 'Book mentor sessions without clashes',
    consumes: [KIND.IMPROVEMENT_PLAN, KIND.SRC_MENTORS, KIND.SRC_AVAILABILITY],
    produces: [KIND.MENTOR_SCHEDULE], run: scheduleMentors,
  },
  {
    id: 'draft_messages', role: 'Message Writer', label: 'Draft messages for a person to approve',
    consumes: [KIND.MENTOR_SCHEDULE, KIND.SRC_MENTORS, KIND.SRC_TRAINEES],
    produces: [KIND.MESSAGE_DRAFTS], run: writeDrafts,
  },
  {
    id: 'export_calendar', role: 'Calendar Writer', label: 'Write booked mentor sessions as a calendar file',
    consumes: [KIND.MENTOR_SCHEDULE, KIND.SRC_MENTORS, KIND.SRC_TRAINEES, KIND.SRC_SKILLS],
    produces: [KIND_CALENDAR], run: exportCalendar,
  },
  {
    id: 'export_schedule_xlsx', role: 'Spreadsheet Writer', label: 'Write the mentor schedule as a spreadsheet',
    consumes: [KIND.MENTOR_SCHEDULE, KIND.SRC_MENTORS, KIND.SRC_TRAINEES, KIND.SRC_SKILLS],
    produces: [KIND_SCHEDULE_XLSX], run: exportScheduleXlsx,
  },
  {
    id: 'monday_brief', role: 'Brief Writer', label: 'Write the one-page Monday brief for the coordinator',
    consumes: [KIND.GAPS, KIND.PERFORMANCE_SUMMARY, KIND.MENTOR_SCHEDULE, KIND.MESSAGE_DRAFTS, KIND.SRC_MENTORS, KIND.SRC_TRAINEES],
    produces: [KIND_MONDAY_BRIEF], run: writeMondayBrief,
  },
]);

// With a model configured, the wording is written by the model (facts are still copied by code
// and checked by C11/C14). Without one, the deterministic writer is used and labelled as code.
async function writeDrafts(ctx) {
  if (ctx.model?.available) {
    const { draftMessagesWithModel } = await import('./message-writer.mjs');
    return draftMessagesWithModel(ctx);
  }
  return draftMessages(ctx);
}

/** Deliverable ids this pack can produce (shown to the Goal Reader model). */
export const EDU_CATALOG = Object.freeze([
  { id: 'gap_analysis', description: 'Per-learner skill gaps with source rows (csv)' },
  { id: 'performance_summary', description: 'Cohort performance summary (md + json)' },
  { id: 'improvement_plan', description: 'Support plan linked to verified gaps (json + md)' },
  { id: 'mentor_schedule', description: 'Clash-free mentor sessions (csv)' },
  { id: 'message_drafts', description: 'Unsent message drafts for a person to approve (json + md)' },
  { id: 'calendar_ics', description: 'Booked mentor sessions as a calendar file (ics), proposal only' },
  { id: 'schedule_xlsx', description: 'Mentor schedule as a spreadsheet (xlsx) with counts per mentor' },
  { id: 'monday_brief', description: 'One-page Monday brief: who needs help, what is booked, what needs approval (md)' },
]);
