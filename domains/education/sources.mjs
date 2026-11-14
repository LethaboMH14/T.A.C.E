// Source specs for the education domain pack (consumed by engine/sources.mjs admitSources).
import { KIND } from '../../engine/contracts.mjs';

export const EDU_SOURCE_SPECS = Object.freeze([
  { sourceId: 'trainees', kind: KIND.SRC_TRAINEES, file: 'trainees.csv', version: 'v1', format: 'csv',
    requiredColumns: ['trainee_id', 'display_name', 'first_login_day', 'sessions_attended', 'sessions_total'], keyColumns: ['trainee_id'] },
  { sourceId: 'assessments', kind: KIND.SRC_ASSESSMENTS, file: 'assessments.csv', version: 'v1', format: 'csv',
    requiredColumns: ['trainee_id', 'skill_id', 'score'], keyColumns: ['trainee_id', 'skill_id'] },
  { sourceId: 'skills', kind: KIND.SRC_SKILLS, file: 'skills.csv', version: 'v1', format: 'csv',
    requiredColumns: ['skill_id', 'name', 'threshold'], keyColumns: ['skill_id'] },
  { sourceId: 'mentors', kind: KIND.SRC_MENTORS, file: 'mentors.csv', version: 'v1', format: 'csv',
    requiredColumns: ['mentor_id', 'display_name', 'skills', 'capacity'], keyColumns: ['mentor_id'] },
  { sourceId: 'availability', kind: KIND.SRC_AVAILABILITY, file: 'availability.csv', version: 'v1', format: 'csv',
    requiredColumns: ['mentor_id', 'day', 'start', 'end'], keyColumns: ['mentor_id', 'day', 'start'] },
  { sourceId: 'interventions', kind: KIND.SRC_INTERVENTIONS, file: 'interventions.json', version: 'v1', format: 'json' },
]);

// Optional live snapshot files (written by the LMS snapshot into the run's sourcesDir). They are NOT in
// EDU_SOURCE_SPECS: engine admitSources reports a missing file as MISSING_SOURCE and does not skip optional
// specs, so the required list stays exact for every fixture run. A live run passes
// [...EDU_SOURCE_SPECS, ...EDU_OPTIONAL_SOURCE_SPECS] as its domain sourceSpecs; sourcesNode then loads a
// file only when the scenario lists it in intakeSources.
export const EDU_OPTIONAL_SOURCE_SPECS = Object.freeze([
  { optional: true, sourceId: 'help_requests', kind: 'source:help_requests', file: 'help_requests.csv', version: 'v1', format: 'csv',
    requiredColumns: ['request_id', 'trainee_id', 'skill_id', 'category', 'text', 'at'], keyColumns: ['request_id'] },
  { optional: true, sourceId: 'learner_prefs', kind: 'source:learner_prefs', file: 'learner_prefs.csv', version: 'v1', format: 'csv',
    requiredColumns: ['trainee_id', 'format', 'language'], keyColumns: ['trainee_id'] },
  { optional: true, sourceId: 'memory', kind: 'source:memory', file: 'memory.csv', version: 'v1', format: 'csv',
    requiredColumns: ['trainee_id', 'fact', 'source_run', 'at'] },
]);
