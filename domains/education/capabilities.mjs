// Education domain pack: the capabilities the generic planner can choose from.
// The planner picks only what the goal's deliverables need (report-only goal -> 2 tasks).
// Every worker is deterministic code (not a language model) and is labelled that way in the UI.
import { KIND } from '../../engine/contracts.mjs';
import { computeGaps } from './analyst.mjs';
import { recommendInterventions } from './interventions.mjs';
import { scheduleMentors } from './scheduler.mjs';
import { writePerformanceSummary, draftMessages } from './writer.mjs';

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
    produces: [KIND.MESSAGE_DRAFTS], run: draftMessages,
  },
]);
