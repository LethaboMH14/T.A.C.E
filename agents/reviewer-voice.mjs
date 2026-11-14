// Reviewer voice: the model explains failed checks in plain words and proposes a route.
// The route itself comes from code (planRepairs). A mismatch keeps the code route.
const VERDICT_SCHEMA = Object.freeze({
  name: 'review_verdicts',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['verdicts'],
    properties: {
      verdicts: {
        type: 'array',
        maxItems: 32,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['checkId', 'verdict', 'proposedRoute'],
          properties: {
            checkId: { type: 'string' },
            verdict: { type: 'string', minLength: 1, maxLength: 400 },
            proposedRoute: { type: 'string', enum: ['repair', 'person'] },
          },
        },
      },
    },
  },
});

function coded(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const cut = (s, n = 500) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * @param {{model, checks:object[], route:object[], messenger}} args
 *   route = planRepairs(failed) output: jobs {kind, fixable, checkIds, ...}
 * @returns {Promise<{verdicts:{checkId, verdict, route, proposedRoute, agreed}[], routeAgreed:boolean, unexplained:string[]}>}
 */
export async function explainReview({ model, checks, route, messenger }) {
  if (!model || model.available !== true) {
    throw coded('MODEL_UNAVAILABLE', 'No model configured. Review verdicts were not written.');
  }

  const failed = checks
    .filter((c) => c.status !== 'PASS')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (failed.length === 0) return { verdicts: [], routeAgreed: true, unexplained: [] };

  const repairIds = new Set(
    route.filter((j) => j.fixable === true).flatMap((j) => j.checkIds),
  );
  const codeRouteOf = (checkId) => (repairIds.has(checkId) ? 'repair' : 'person');

  const out = await model.chat({
    agent: 'Reviewer voice',
    messages: [
      {
        role: 'system',
        content:
          'You explain failed review checks to a coordinator in plain words. For each check write a verdict ' +
          'of at most two sentences, and propose a route: "repair" if the engine can re-run the step that made ' +
          'the artifact, or "person" if a human must look. Return JSON {"verdicts":[{"checkId","verdict","proposedRoute"}]}.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          checks: failed.map((c) => ({
            checkId: c.id, title: c.title, kind: c.kind, status: c.status,
            expected: c.expected, observed: c.observed, message: c.message,
          })),
        }),
      },
    ],
    jsonSchema: VERDICT_SCHEMA,
  });

  const proposed = new Map();
  for (const v of (out.json && Array.isArray(out.json.verdicts) ? out.json.verdicts : [])) {
    if (v && typeof v.checkId === 'string' && !proposed.has(v.checkId)) proposed.set(v.checkId, v);
  }

  const verdicts = [];
  const unexplained = [];
  for (const check of failed) {
    const v = proposed.get(check.id);
    if (!v) {
      unexplained.push(check.id);
      continue;
    }
    const codeRoute = codeRouteOf(check.id);
    const agreed = v.proposedRoute === codeRoute;
    if (!agreed) {
      messenger.send({
        type: 'DECISION', from: 'Engine', to: 'Reviewer voice',
        about: { checkId: check.id },
        reason: cut(`Kept the ${codeRoute} route for ${check.id}: the repair plan says ${codeRoute}, ` +
          `the reviewer proposed ${v.proposedRoute}.`),
        body: { checkId: check.id, codeRoute, proposedRoute: v.proposedRoute },
      });
    }
    const verdictText = String(v.verdict ?? '').trim() || 'No verdict text returned.';
    messenger.send({
      type: 'RESULT', from: 'Reviewer voice',
      to: codeRoute === 'repair' ? 'Repair' : 'Coordinator',
      about: { checkId: check.id },
      reason: cut(verdictText),
      body: { checkId: check.id, route: codeRoute, proposedRoute: v.proposedRoute },
    });
    verdicts.push({
      checkId: check.id, verdict: verdictText, route: codeRoute,
      proposedRoute: v.proposedRoute, agreed,
    });
  }

  const routeAgreed = unexplained.length === 0 && verdicts.every((v) => v.agreed);
  return { verdicts, routeAgreed, unexplained };
}
