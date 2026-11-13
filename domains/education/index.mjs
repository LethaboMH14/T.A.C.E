// The education domain pack, as the generic runner sees it.
import { fileURLToPath } from 'node:url';
import { EDU_CAPABILITIES, EDU_CATALOG } from './capabilities.mjs';
import { EDU_SOURCE_SPECS, EDU_OPTIONAL_SOURCE_SPECS } from './sources.mjs';
import { review } from './reviewer.mjs';
import { planRepairs, applyRepair } from './repair.mjs';
import { RULES_VERSION } from './rules.mjs';
import { SCENARIOS } from '../../fixtures/education-recovery/scenarios.mjs';

export const EDU_DOMAIN = Object.freeze({
  id: 'education-recovery',
  rulesVersion: RULES_VERSION,
  capabilities: EDU_CAPABILITIES,
  catalog: EDU_CATALOG,
  // A known-valid proposal (the report-only fixture) shown to the Goal Reader as a SHAPE example.
  goalExample: SCENARIOS.find((s) => s.id === 'report_only').proposal,
  goalContext: [
    'trainees.csv lists each learner (id, display name, first login day, sessions attended).',
    'assessments.csv has one score per learner per skill; an empty cell is a missing score.',
    'skills.csv gives each skill its pass threshold. A gap = a present score below that threshold.',
    'At risk = 2 or more gaps, or a late first login (day 4 or later) with at least 1 gap.',
    'mentors.csv names the 3 mentors, the skills each can teach and their weekly session capacity.',
    'availability.csv gives each mentor’s time windows for the week of 16 Nov 2026; sessions are 60 minutes.',
    'interventions.json lists the support activities available per skill.',
    'Messages are drafts for a person to approve; nothing is ever sent.',
  ].join(' '),
  // Optional live files load only when a scenario lists them in intakeSources (run.mjs filters by intake).
  sourceSpecs: [...EDU_SOURCE_SPECS, ...EDU_OPTIONAL_SOURCE_SPECS],
  review,
  planRepairs,
  applyRepair,
  sourcesDir: fileURLToPath(new URL('../../fixtures/education-recovery/v1/', import.meta.url)),
  scenariosDir: fileURLToPath(new URL('../../fixtures/education-recovery/v1/scenarios/', import.meta.url)),
});
