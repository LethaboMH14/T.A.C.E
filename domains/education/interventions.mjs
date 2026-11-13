// Intervention Specialist worker — deterministic code, NOT a language model.
// Reads the latest 'gaps' artifact through the store (a real file hand-off) and the admitted
// interventions catalogue. Writes improvement-plan.json then improvement-plan.md (kind 'improvement_plan').
// Never invents an intervention: a missing one is listed under "unresolved".

import { RULES_VERSION } from './rules.mjs';

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function byString(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareItems(a, b) {
  return byString(a.trainee_id, b.trainee_id)
    || byString(a.skill_id, b.skill_id)
    || byString(a.kind, b.kind);
}

/** The one catalogue entry for (skill, kind). Zero matches -> null. Two or more -> hard error. */
function findIntervention(catalogue, skillId, kind) {
  const hits = catalogue.filter((i) => i.skill_id === skillId && i.kind === kind);
  if (hits.length > 1) {
    throw fail('AMBIGUOUS_INTERVENTION', `${hits.length} interventions match ${skillId}/${kind}`);
  }
  return hits.length === 1 ? hits[0] : null;
}

function reasonFor(gap) {
  return `Score ${gap.score} is below ${gap.threshold} (assessments.csv line ${gap.row})`;
}

function renderPlanMd(plan, gapsByTrainee) {
  const lines = [];
  lines.push('# Improvement plan');
  lines.push('');
  lines.push(`Rules version: ${plan.rulesVersion}. Every item comes from a verified gap in gaps.json.`);
  lines.push('Items are suggestions for a person to confirm. Nothing here has been sent or booked.');
  lines.push('');

  const traineeIds = [...new Set(plan.items.map((i) => i.trainee_id))].sort(byString);
  for (const id of traineeIds) {
    const g = gapsByTrainee.get(id);
    const label = g ? `${id} (${g.display_name})` : id;
    const flag = g && g.at_risk ? ' - at risk' : '';
    lines.push(`## ${label}${flag}`);
    lines.push('');
    for (const item of plan.items.filter((i) => i.trainee_id === id)) {
      const what = item.kind === 'mentor_session' ? 'Mentor session' : 'Practice';
      lines.push(`- ${what} for ${item.skill_id}: ${item.title}`);
      lines.push(`  - Why: ${item.reason}`);
    }
    lines.push('');
  }

  lines.push('## Unresolved');
  lines.push('');
  if (plan.unresolved.length === 0) {
    lines.push('None. Every gap and at-risk mentor need has a catalogue intervention.');
  } else {
    for (const u of plan.unresolved) {
      lines.push(`- ${u.trainee_id}, ${u.skill_id}: ${u.reason}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {object} ctx  shared worker context (see domains/education/ARTIFACTS.md)
 */
export async function recommendInterventions(ctx) {
  const gapsRef = ctx.store.latestByKind('gaps');
  if (!gapsRef) throw fail('NO_GAPS', 'no gaps artifact in the store; run compute_gaps first');
  const gaps = JSON.parse(ctx.store.read(gapsRef));
  if (gaps.rulesVersion !== RULES_VERSION) {
    throw fail('RULES_MISMATCH', `gaps.json is ${gaps.rulesVersion}, expected ${RULES_VERSION}`);
  }

  const catalogue = ctx.sources.interventions.json;
  if (!Array.isArray(catalogue)) throw fail('BAD_CATALOGUE', 'interventions.json must be an array');

  const items = [];
  const unresolved = [];
  const trainees = gaps.trainees.slice().sort((a, b) => byString(a.trainee_id, b.trainee_id));

  for (const t of trainees) {
    const gapList = t.gaps.slice().sort((a, b) => byString(a.skill_id, b.skill_id));

    // every verified gap -> the practice intervention for its skill
    for (const gap of gapList) {
      const practice = findIntervention(catalogue, gap.skill_id, 'practice');
      if (practice) {
        items.push({
          trainee_id: t.trainee_id,
          skill_id: gap.skill_id,
          intervention_id: practice.intervention_id,
          kind: 'practice',
          title: practice.title,
          reason: reasonFor(gap),
          source_row: gap.row,
        });
      } else {
        unresolved.push({
          trainee_id: t.trainee_id,
          skill_id: gap.skill_id,
          reason: `no practice intervention exists for ${gap.skill_id}`,
        });
      }
    }

    // at-risk -> ALSO a mentor session for the priority skill
    if (t.at_risk) {
      const priority = gapList.find((g) => g.skill_id === t.priority_skill);
      if (!priority) {
        unresolved.push({
          trainee_id: t.trainee_id,
          skill_id: String(t.priority_skill),
          reason: 'priority skill has no matching gap in gaps.json',
        });
        continue;
      }
      const mentor = findIntervention(catalogue, priority.skill_id, 'mentor_session');
      if (mentor) {
        items.push({
          trainee_id: t.trainee_id,
          skill_id: priority.skill_id,
          intervention_id: mentor.intervention_id,
          kind: 'mentor_session',
          title: mentor.title,
          reason: reasonFor(priority),
          source_row: priority.row,
        });
      } else {
        unresolved.push({
          trainee_id: t.trainee_id,
          skill_id: priority.skill_id,
          reason: `no mentor_session intervention exists for ${priority.skill_id}`,
        });
      }
    }
  }

  items.sort(compareItems);
  unresolved.sort((a, b) => byString(a.trainee_id, b.trainee_id) || byString(a.skill_id, b.skill_id));

  const plan = { rulesVersion: RULES_VERSION, items, unresolved };
  const inputs = [...ctx.inputRefs, { name: gapsRef.name, version: gapsRef.version, digest: gapsRef.digest }];

  const planJsonRef = ctx.store.write({
    kind: 'improvement_plan',
    name: 'improvement-plan.json',
    content: JSON.stringify(plan, null, 2) + '\n',
    producer: ctx.taskId,
    inputs,
  });

  const gapsByTrainee = new Map(gaps.trainees.map((t) => [t.trainee_id, t]));
  const planMdRef = ctx.store.write({
    kind: 'improvement_plan',
    name: 'improvement-plan.md',
    content: renderPlanMd(plan, gapsByTrainee),
    producer: ctx.taskId,
    inputs,
  });

  return {
    artifacts: [planJsonRef, planMdRef],
    summary: {
      items: items.length,
      mentorSessions: items.filter((i) => i.kind === 'mentor_session').length,
      practice: items.filter((i) => i.kind === 'practice').length,
      unresolved: unresolved.length,
    },
  };
}
