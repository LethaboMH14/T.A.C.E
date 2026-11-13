// Builds the six scenario files and proves each goal proposal passes the accepted G02 validators.
// Run: node fixtures/education-recovery/scenarios.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeGoalTurn } from '../../tools/gate02/normalize-turn.mjs';
import { validateGoalProposal } from '../../tools/gate02/goal-proposal.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'v1', 'scenarios');
const ALL = ['trainees', 'assessments', 'skills', 'mentors', 'availability', 'interventions'];

export const TRUSTED_FIXTURE_CONTEXT = Object.freeze({
  actor: { subject: 'coordinator-demo', tenant: 'synthetic-bootcamp' },
  goalId: 'goal-edu-1', turnId: 't1', revision: 1,
  defaultLocale: 'en-ZA', timeZone: 'Africa/Johannesburg',
});

const full = () => ({
  schemaVersion: 'g02-goal-proposal-v0.2',
  intent: { summary: 'Find learners who are slipping, plan support, book mentors and draft messages without sending them', modes: ['ANALYZE', 'CREATE', 'COORDINATE'] },
  relationToPrior: 'NEW_GOAL',
  deliverables: [
    { id: 'gap_analysis', description: 'Per-learner skill gaps with source rows', formatHint: 'csv' },
    { id: 'performance_summary', description: 'Cohort performance summary', formatHint: 'md' },
    { id: 'improvement_plan', description: 'Support plan linked to verified gaps', formatHint: 'json' },
    { id: 'mentor_schedule', description: 'Clash-free mentor sessions', formatHint: 'csv' },
    { id: 'message_drafts', description: 'Unsent message drafts for review', formatHint: 'md' },
  ],
  subgoals: [
    { id: 'analyse', outcome: 'Find skill gaps and at-risk learners', dependsOn: [], deliverableIds: ['gap_analysis', 'performance_summary'], sourceSlots: [0, 1, 2], capabilityKinds: ['READ_SOURCE', 'WRITE_ARTIFACT'], effectKinds: ['READ_ONLY', 'LOCAL_ARTIFACT'] },
    { id: 'plan', outcome: 'Match each verified gap to a support activity', dependsOn: ['analyse'], deliverableIds: ['improvement_plan'], sourceSlots: [5], capabilityKinds: ['READ_SOURCE', 'WRITE_ARTIFACT'], effectKinds: ['READ_ONLY', 'LOCAL_ARTIFACT'] },
    { id: 'schedule', outcome: 'Book mentor sessions without clashes', dependsOn: ['plan'], deliverableIds: ['mentor_schedule'], sourceSlots: [3, 4], capabilityKinds: ['READ_SOURCE', 'SCHEDULING', 'WRITE_ARTIFACT'], effectKinds: ['READ_ONLY', 'LOCAL_ARTIFACT'] },
    { id: 'drafts', outcome: 'Draft messages to learners and mentors, do not send', dependsOn: ['schedule'], deliverableIds: ['message_drafts'], sourceSlots: [], capabilityKinds: ['MESSAGE_DRAFT', 'WRITE_ARTIFACT'], effectKinds: ['LOCAL_ARTIFACT'] },
  ],
  sourceSlots: [0, 1, 2, 3, 4, 5],
  capabilityNeeds: [
    { kind: 'READ_SOURCE', reason: 'Read the synthetic cohort files' },
    { kind: 'WRITE_ARTIFACT', reason: 'Write local result files' },
    { kind: 'SCHEDULING', reason: 'Place mentor sessions in availability windows' },
    { kind: 'MESSAGE_DRAFT', reason: 'Write drafts for a person to review' },
  ],
  effectClaims: [
    { kind: 'READ_ONLY', description: 'Read synthetic inputs without changing them' },
    { kind: 'LOCAL_ARTIFACT', description: 'Write local files only; nothing is sent' },
  ],
  acceptanceCriteria: [
    { id: 'gaps_match', deliverableId: 'gap_analysis', check: 'Every gap matches a source row below threshold', method: 'SOURCE_CROSSCHECK', evidenceExpectation: 'Recomputed gaps equal reported gaps' },
    { id: 'totals_match', deliverableId: 'performance_summary', check: 'Cohort numbers match the raw scores', method: 'SOURCE_CROSSCHECK', evidenceExpectation: 'Recomputed means and counts equal reported ones' },
    { id: 'plan_refs', deliverableId: 'improvement_plan', check: 'Every support item points to a verified gap and a known activity', method: 'SOURCE_CROSSCHECK', evidenceExpectation: 'All plan items reference existing gaps and intervention ids' },
    { id: 'no_clash', deliverableId: 'mentor_schedule', check: 'No mentor is double-booked and capacity holds', method: 'SCHEDULE_CONFLICT_CHECK', evidenceExpectation: 'Zero overlaps, all sessions inside availability' },
    { id: 'unsent', deliverableId: 'message_drafts', check: 'Every draft is unsent and matches a booked session', method: 'HUMAN_REVIEW', evidenceExpectation: 'All drafts marked UNSENT' },
  ],
  uncertainties: [],
});

const reportOnly = () => ({
  schemaVersion: 'g02-goal-proposal-v0.2',
  intent: { summary: 'Give a performance report on the cohort with the skill gaps', modes: ['ANALYZE', 'CREATE'] },
  relationToPrior: 'NEW_GOAL',
  deliverables: [
    { id: 'gap_analysis', description: 'Per-learner skill gaps with source rows', formatHint: 'csv' },
    { id: 'performance_summary', description: 'Cohort performance summary', formatHint: 'md' },
  ],
  subgoals: [
    { id: 'analyse', outcome: 'Find skill gaps and summarise the cohort', dependsOn: [], deliverableIds: ['gap_analysis', 'performance_summary'], sourceSlots: [0, 1, 2], capabilityKinds: ['READ_SOURCE', 'WRITE_ARTIFACT'], effectKinds: ['READ_ONLY', 'LOCAL_ARTIFACT'] },
  ],
  sourceSlots: [0, 1, 2],
  capabilityNeeds: [
    { kind: 'READ_SOURCE', reason: 'Read the synthetic cohort files' },
    { kind: 'WRITE_ARTIFACT', reason: 'Write local result files' },
  ],
  effectClaims: [
    { kind: 'READ_ONLY', description: 'Read synthetic inputs without changing them' },
    { kind: 'LOCAL_ARTIFACT', description: 'Write local files only' },
  ],
  acceptanceCriteria: [
    { id: 'gaps_match', deliverableId: 'gap_analysis', check: 'Every gap matches a source row below threshold', method: 'SOURCE_CROSSCHECK', evidenceExpectation: 'Recomputed gaps equal reported gaps' },
    { id: 'totals_match', deliverableId: 'performance_summary', check: 'Cohort numbers match the raw scores', method: 'SOURCE_CROSSCHECK', evidenceExpectation: 'Recomputed means and counts equal reported ones' },
  ],
  uncertainties: [],
});

const GOAL = 'Using the results for our 36 bootcamp learners, find who is falling behind and why, plan support for each gap, book our 3 mentors without clashes, and draft messages to learners and mentors. Do not send anything.';

export const SCENARIOS = [
  { id: 'baseline', title: 'Full mission, no faults', goalText: GOAL, intakeSources: ALL, proposal: full(), inject: null },
  { id: 'report_only', title: 'Smaller goal: report only', goalText: 'Give me a performance report on the cohort with each learner’s skill gaps.', intakeSources: ['trainees', 'assessments', 'skills'], proposal: reportOnly(), inject: null },
  { id: 'inject_overlap', title: 'Self-correction: the scheduler double-books a mentor', goalText: GOAL, intakeSources: ALL, proposal: full(), inject: { kind: 'overlap', mentor_id: 'M-B' } },
  { id: 'inject_wrong_aggregate', title: 'Self-correction: the report counts missing scores as zero', goalText: GOAL, intakeSources: ALL, proposal: full(), inject: { kind: 'wrong_aggregate', skill_id: 'S3' } },
  { id: 'mentor_unavailable', title: 'Changed constraint: Mentor B is away on Thursday', goalText: GOAL, intakeSources: ALL, proposal: full(), inject: null, unavailable: [{ mentor_id: 'M-B', day: 'Thu' }] },
  { id: 'missing_source', title: 'Missing input: no assessment file', goalText: GOAL, intakeSources: ALL, proposal: full(), inject: null, excludeSources: ['assessments'] },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(dir, { recursive: true });
  let bad = 0;
  for (const s of SCENARIOS) {
    const n = normalizeGoalTurn({ goal: s.goalText, sources: s.intakeSources.map(r => ({ kind: 'upload', ref: r })) }, TRUSTED_FIXTURE_CONTEXT);
    if (n.status !== 'NORMALIZED') { console.log(s.id, 'INTAKE', n.status, n.code); bad++; continue; }
    const v = validateGoalProposal(s.proposal, n.record);
    console.log(s.id.padEnd(24), v.status, v.code, (v.candidateOrder || []).join(' > '));
    if (v.status !== 'PROPOSAL_VALID') bad++;
    writeFileSync(join(dir, s.id + '.json'), JSON.stringify(s, null, 2) + '\n');
  }
  process.exit(bad ? 1 : 0);
}
