// The education domain pack, as the generic runner sees it.
import { fileURLToPath } from 'node:url';
import { EDU_CAPABILITIES } from './capabilities.mjs';
import { EDU_SOURCE_SPECS } from './sources.mjs';
import { review } from './reviewer.mjs';
import { planRepairs, applyRepair } from './repair.mjs';
import { RULES_VERSION } from './rules.mjs';

export const EDU_DOMAIN = Object.freeze({
  id: 'education-recovery',
  rulesVersion: RULES_VERSION,
  capabilities: EDU_CAPABILITIES,
  sourceSpecs: EDU_SOURCE_SPECS,
  review,
  planRepairs,
  applyRepair,
  sourcesDir: fileURLToPath(new URL('../../fixtures/education-recovery/v1/', import.meta.url)),
  scenariosDir: fileURLToPath(new URL('../../fixtures/education-recovery/v1/scenarios/', import.meta.url)),
});
