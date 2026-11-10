# Gate 01 — KAIRO as T.A.C.E's education demonstration

**Date:** 2026-11-10  
**State:** RESEARCH PROPOSAL — not approved for implementation or hackathon submission  
**Source:** Private [KAIRO](https://github.com/LethaboMH14/KAIRO) at main `93a741339b1116992fa63823d570aa5b2f7dace7` (2026-10-30).  
**Comparison:** [T.A.C.E ADR-0002](../decisions/ADR-0002-universal-engine-education-demo.md) and [G01](GATE-01-EDUCATION-GOAL.md).

## Assessment

KAIRO is a much stronger *existing educational experience* than a new unimplemented demo: reviewed educational sources, source-anchored lessons, an interactive Three.js motor and pump, prepared CS exercises, teacher/avatar interface, learner practice, saved work, Firebase/Firestore account scoping, provider-consented AI gateway, bounded source retrieval, budgets and real regression tests.

**Do not confuse KAIRO's learning/lesson gateway with T.A.C.E's dynamic multi-agent execution graph.** KAIRO currently has no demonstrated end-to-end, learner-facing dynamic roster/typed agent handoffs/independent repair graph for arbitrary goals. Coordination workers on GitHub are development workers, not product agents.

### Source evidence

- [Product brief](https://github.com/LethaboMH14/KAIRO/blob/main/docs/KAIRO-PRODUCT-BRIEF.md): six-studio ambition and source→lesson→simulation→practice loop.
- [README](https://github.com/LethaboMH14/KAIRO/blob/main/README.md): app routes and boundaries.
- [AI architecture](https://github.com/LethaboMH14/KAIRO/blob/main/docs/ai-integration-20261025/ARCHITECTURE.md): bounded reviewed-source retrieval, provider consent, revision checks.
- [Model gateway code](https://github.com/LethaboMH14/KAIRO/blob/main/studio/server/ai-runtime/gateway.mjs): owner-scoped reservations, consent and idempotent request checks.
- [Pump simulation](https://github.com/LethaboMH14/KAIRO/blob/main/studio/src/pump-lab/physics.ts): deterministic **illustrative**, not industry-validated physics model.
- [Motor calculations](https://github.com/LethaboMH14/KAIRO/blob/main/studio/src/engineering/fieldMath.ts): deterministic synchronous-field-speed calculations.
- [Latest inspected main CI](https://github.com/LethaboMH14/KAIRO/actions/runs/41110121910): successful run Oct 30 2026; not an independent full hosted journey.
- [October 28 UX audit](https://github.com/LethaboMH14/KAIRO/blob/main/docs/improve-loop-20261028/AUDIT.md): observed local journey and defects; audit branch differs from today's main.
- [October 28 PR triage](https://github.com/LethaboMH14/KAIRO/blob/main/docs/improve-loop-20261028/PR-TRIAGE.md): many independent PRs, warnings about red exact-head CI and unverified UI.
- As of this review, GitHub search returns 63 open PRs and 30 open issues. The README references `docs/submission-release-20261026/CURRENT-RELEASE.json` but that path was not found on main.

## Scores — analyst estimates, NOT competition results

| Dimension | Score | Reason |
| --- | ---: | --- |
| Education product concept | 9.2/10 | Tangible source-to-interactive-learning problem and visual impact |
| Working implementation readiness | 7.5/10 | Extensive code/CI and real workflows, but remaining UX, production and evidence gaps |
| Colleague Zero *as is* | 5.8/10 | Education and tools strong; genuine dynamic multi-agent delegation, review/correction, adaptive graph absent from verified evidence |
| KAIRO + tested T.A.C.E graph potential | 9+/10 | **Conditional**, contingent on building and demonstrating real delegation, correction, outputs and compliance |

Official Colleague Zero criteria: **reasons, self-corrects, executes, collaborates, serves education**. Source: https://hackathon-26.melsoft.org/

## Recommended G01 direction (not yet locked)

**Product boundary:** T.A.C.E = domain-neutral goal interpreter, dynamic workflow/agent graph, policy, verification, tools and event stream. KAIRO = optional education domain pack consisting of its existing reviewed source workflows, studio simulators, learner experience and artifact record adapters. Maintain distinct repos and ownership; expose approved tool/API boundaries rather than copying the whole 2,789-file application into T.A.C.E.

**Flagship goal:** An adult engineering/TVET learner uploads a source and asks: *“I still don't understand how changes to motor frequency, pole count and pump restrictions affect operation. Turn my approved material into a cited, interactive lesson, test misconceptions, give me practical activities, correct unsupported explanations and save a study plan.”*

**Illustrative workflow:** interpret goal → verified extraction/source review → parallel source auditor and mathematical/physics validator → instructional designer → registered KAIRO motor/pump activity → independent reviewer → bounded correction loop → save lesson, practice, intervention and evidence → reopen and verify. Actual learner decisions may trigger a *new* targeted subgoal or human approval. Do not claim arbitrary 3D content generation; use registered prepared scenes and an honest fallback.

**Contrasting small goal:** Convert a reviewed syllabus to a table or CSV without spawning a pointless swarm. Same core, different topology.

**Visually:** left panel real agent statuses and evidence-backed handoffs, center movable **validated** task graph, right KAIRO 3D live studio and real output/approval drawer. Model hidden reasoning is not exposed; typed decision/event summaries are.

## Needed engineering to reach a strong competition result

| Priority | Change | Verification |
| --- | --- | --- |
| P0 | Confirm organizer's rules on pre-existing KAIRO code, previously submitted work and disclosures | Written organizer response; do not presume reuse allowed |
| P0 | Pick one adult-user education task, one input fixture, bounded scene, exact artifact set | Approved G01 acceptance tests |
| P0 | Add dynamic goal-driven LangGraph.js (or a minimal typed state machine) to a new T.A.C.E control service | 2 distinct goals yield 2 meaningfully different graphs |
| P0 | Tool adapters for KAIRO reviewed source, simulation/readings, lesson draft, persistence and artifact download | Real source-scoped tool acknowledgments and read-back checks |
| P0 | Multi-agent roles with independent responsibilities, structured handoffs, supervisor/reviewer and max 2 repair attempts | Real parallelism, stored messages and tested failure correction |
| P0 | Real correction case: confuse synchronous field speed with real shaft speed; validator rejects wrong educational claim and repair updates the saved lesson | Before/after artifact and exact formula/source check |
| P1 | Clean first-run UX; collapse excessive navigation, duplicate creation CTAs, raw hashes, mis-scoped sample copy and false connectivity warnings | Fresh adult-user mobile/desktop walkthrough; avoid assuming Oct 28 issues still reproduce |
| P1 | Add mission canvas, trace, provenance links, approvals, output previews without fabricated events | UI rehydrates from authoritative backend run |
| P1 | Self-evaluation and practical improvement: real held-out tasks, correctness, provenance and time to deliver | measured repetitions with both failures and passes |
| Later | Conditional scene composition, multimodal narration, multilingual review, deeper memory | separate tests and honest unsupported states |

### Hackathon integrity concern

The **public Colleague Zero overview does not explicitly authorize reuse of old project code**. Other hackathons' rules do not determine this contest's rules. Get clarification *before* relying on KAIRO as substantial pre-existing submitted work; document old vs newly implemented features honestly. KAIRO is a **private** repo with MIT root license and separate third-party notices; verify team contributions, redistribution rights, assets and hosting access before public demos.

**No code merged, KAIRO not changed, no agents launched. Gate 01 remains IN_RESEARCH.**
