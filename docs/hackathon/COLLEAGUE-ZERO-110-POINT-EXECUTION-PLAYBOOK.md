# T.A.C.E — Colleague Zero 110/110 execution playbook

**Date:** Friday, 13 November 2026  
**Status:** WINNING DEMO TARGET / NOT CURRENTLY PROVEN  
**Source:** User-provided *Colleague Zero: Marking Criteria*, seven scored criteria totaling 110; *Colleague Zero: The Autonomous Agent Hackathon* and *What's needed* supplied by the user.  
**Live submission:** Friday midnight Loom progress report; Saturday 14 Nov repository/README due 11:00 SAST; Saturday 12:00 in-person demonstration at Rosebank. Check official organizer announcements for any updates.

## Essential decision

**STOP making the 15 G02 subsections a prerequisite for the 24-hour hackathon.** Keep the general T.A.C.E architecture and approvals, but build a narrow, genuine, tested **Autonomous Education Recovery Colleague** vertical slice now. Do not confuse 241 + 48 green structural tests with an autonomous application that finishes a goal, self-corrects and creates real files.

### Single killer user outcome

"Using these synthetic assessment results for 36 adult trainees, identify learning gaps, create evidence-linked interventions, build a conflict-free support schedule for 3 fictional mentors, and deliver a performance report plus draft messages—**do not send any communications**."

**Inputs:** synthetic assessment.csv, trainee/mentor schedule.csv, skills/assessment rubric, optional educator preferences (English/isiZulu draft wording if reviewed), intentional inconsistent source row and a mentor availability change. No real student or medical information. All outputs should be written to artifacts/ with versioned run IDs, then reopened and independently verified.

**Outputs:** gap-analysis.csv, performance-summary.md or .html, improvement-plan.md/.json, mentor-schedule.csv and unsent-message-drafts.md; evidence/receipt JSON for each; provenance to source rows, acceptance checks, reviewer flags, repair details and re-check outcomes. Report how many synthetic trainees were analysed, what fraction lacked a source/answer, and which interventions were justified by evidence; never fabricate unsupported impact metrics.

## Judge-visible runtime architecture

```text
Natural-language goal → G02.01 deterministic intake → G02.02 typed contract proposal
    ↓
Adaptive minimal clarification only when required; no needless 3-question wizard for clear goal
    ↓
Planner (dynamic task graph; actual branches vary with goal and inputs)
    ↓
Data/Evidence Analyst → Intervention & Schedule Producer → Artifact/Comms Producer
    ↓                        ↓                           ↓
    └─────────── Independent Evidence/Quality Reviewer ←─────┘
                       ↓ if a real check fails
                  Targeted Repair Worker
                       ↓
                Re-run independent checks
                       ↓
          Persist + reopen artifacts, provenance and receipts
                       ↓
               User-visible finished mission (no sends)
```

**Role separation:** Planner owns plan/next action; Evidence Analyst reads/aggregates source and flags missing data; Intervention/Schedule Worker constructs interventions and checks capacity; Artifact/Comms Worker writes actual reports/drafts; Independent Reviewer uses deterministic recomputations and source citations; Repair Worker acts only on failed checks then re-runs the reviewer. This may be 5–6 logical roles, but complexity-aware selection should avoid spinning up agents unnecessarily. If only one LLM instance is available, sequential specialist runs with distinct tools/inputs/outputs are acceptable *as an implementation*, but they must have genuine handoffs, not a static cosmetic roster.

### Highest-value live self-correction sequence

1. Produce an **actual intermediate wrong artifact** under controlled fault injection: e.g., mentor A accidentally booked twice for an overlapping time slot, or gap analysis includes an incorrect derived score.
2. Independent Reviewer detects the real conflict/mismatch using a separately computed rule, source values and acceptance criterion. Emit `VERIFICATION_FAILED` with specific row IDs, expected vs actual and a source trace.
3. Planner selects a repair task with bounded retries. Appropriate repair worker changes only the affected schedule or analysis and issues a new version.
4. Reviewer **reopens/recomputes** the changed artifact; emit `VERIFICATION_PASSED` with before/after values, receipt and reviewer ID. Keep the initial failing artifact visible for judge inspection; do not fake a success flag.
5. Demonstrate resilience against a second independent error (missing source, stale schedule, invalid grade or model unavailable). The correct behavior may be to halt/ask, not always self-heal.
6. Let a judge change a constraint such as "mentor B is unavailable after 14:00"; show an actual replanning branch, not a rehearsed fixed script.

**Do not** present a manually pre-edited success or an `if (demoMode) { showErrorThenGreen(); }` simulation as genuine self-correction.

### Unique differentiators that are achievable

- **Mission Evidence X-Ray:** each recommendation links to admitted source rows; reviewers and judges can inspect "why this trainee/cohort intervention?"
- **Autonomous Failure Autopsy:** the same UI shows red failed check, precise root cause, repair diff and green independent re-check; real event trace and versioned files.
- **Goal-to-Graph with Dynamic Staffing:** simple artifact goal uses 1–2 roles, multi-part recovery goal engages multiple; demonstrate a small changed goal, not only a fixed education pipeline.
- **Risk-aware clarification:** ask only for genuinely blocking source/recipient/time details. A quick-start vs guided preference is a UX feature, not permission to send.
- **POPIA-aware synthetic pilot:** no real learner records, no actual emails/grades/financial movements; all communications are drafts, evidence stays in scoped storage and outputs are explicit.
- **Resilience/what-if:** reviewer catches mentor schedule collision when availability changes; replan without losing evidence of the original error.

Avoid adding 3D VR, unnecessary agent swarms, universal tool marketplaces or cloud infrastructure simply because they look impressive. They compete with the judged end-to-end self-correction path.

## Rubric-specific full-point contracts

| Criterion | Max | Exact excellent judge proof |
|---|---:|---|
| Reasoning and planning | **15** | Given one goal, model/planner emits a real DAG with dependencies and chooses next actions. Vary dataset/mentor constraint and show a genuinely changed next step/plan. Log decisions and task states, not hidden chain-of-thought. |
| Self-correction | **20** | Independent reviewer detects a genuine injected intermediate defect during live run, files a precise flag, assigns targeted repair, and automatically **re-checks** success without person manually fixing it. Show two faults, including one safe-to-halt case. |
| Execution and reliability | **15** | From goal to persisted **finished, usable** report and conflict-free schedule; reopen, spot-check rows, verify references and receipts; timeout/retry; no fabricated tool actions. |
| Multi-agent collaboration | **15** | 4–5 distinct roles with typed handoffs, a visible ownership graph, independent reviewing, and only necessary specialists activated. Show what each role added to a final file or correction. |
| EdTech impact | **15** | Clear buyer: adult education coordinator/facilitator. Problem: assessment insights, tailored support and mentor scheduling consume time and leave learners unsupported. Show 36-trainee/3-mentor synthetic scenario, practical workflows and a credible pilot path. **Only quote time/quality gains if measured.** |
| Presentation and Q&A | **20** | Judge-visible 4–6-minute goal→plan→act→fail→fix→verify→deliver narrative; polished but honest UI; answer model selection, tools, autonomy, reviewer independence, failure modes and real-learner privacy. |
| Professionalism and attitude | **10** | Reliable on-time submissions, respectful peer/judge interactions, named task ownership, clear documentation, transparent known limitations and responsive Q&A. Teamwork is observed, not established by GitHub files alone. |

## Short presentation storyboard (adjust to organizer's actual time allocation)

**0:00–0:25 — Stakes:** "Educators have data, but turning it into timely support plans and a feasible mentor schedule is manual. T.A.C.E is an autonomous colleague that owns the outcome rather than just answering questions."

**0:25–0:55 — Goal:** paste the single education recovery mission; show exactly which source files are permitted and the outcome criteria.

**0:55–1:30 — Visible reasoning:** dynamic planner DAG, role assignments, source references, risk constraints and why each step is needed.

**1:30–2:30 — Agents execute:** real dataset ingested, counts cross-checked, interventions composed, mentor schedule and drafts written.

**2:30–3:35 — Winning moment:** reviewer identifies a real schedule collision or score mismatch; red event, specific failing evidence; repair agent changes file; reviewer independently recomputes and passes. Let judges inspect both versions.

**3:35–4:20 — Deliver:** open actual generated report and schedule; show traceable recommendations and unsent message drafts; show exact acceptance/receipt entries.

**4:20–4:50 — Adapt:** judge changes one constraint; show graph replan and re-verified output.

**4:50–5:15 — Impact & limitations:** practical education coordinator pilot; explain synthetic data and external-send approval boundary. Do not claim measured impact without benchmark.

## Critical acceptance tests before presentation

- Fresh run with 36 synthetic trainees produces all defined deliverables and real filesystem artifacts.
- Independent data auditor recomputes every relevant aggregate from input; any mismatch fails.
- At least one injected grade/report inconsistency is caught, repaired and rechecked without manual correction.
- At least one overlapping mentor booking is caught; replanning produces a conflict-free schedule; re-check passes.
- Missing/invalid source and ambiguous recipient lead to safe clarification/halt rather than hallucinated completion.
- New availability/capacity constraints change planning or schedule output meaningfully; ensure no fixed fake run.
- Simulated provider failure produces an explicit failure or clearly labelled fallback, with bounded retry and no duplicate effects.
- Reviewer logs are independent from writer logs; all "VERIFIED" outcomes include evidence/receipt references and can be rechecked.
- Total times, output counts, source citations and "number of issues fixed" in demo are computed, not scripted constants.
- A second clean environment follows README from a new clone; verify every command and sample dataset.
- Backup demo is labelled as a **recorded run**, not deceptively presented as live execution.
- GitHub and README submitted by Sat 14 Nov 11:00; Loom progress report by Fri midnight; verify locally displayed schedule with organizers.

## Work order, in strict priority

**P0-A:** ship one goal-to-durable-files run; no UI polish can compensate for missing end-to-end execution.  
**P0-B:** independent fail→repair→recheck on real intermediate data; 20-point criterion and clearest standout.  
**P0-C:** dynamic plan and real distinct agent handoffs; 15+15 points.  
**P0-D:** second-input/error resilience tests, exact receipts, source citations and fresh-clone README.  
**P1:** mission console presenting plan, live evidence events, repair diff, artifacts and adaptive clarification. Can reuse existing T.A.C.E UI/AG-UI research, but avoid blocking core engine on CopilotKit/OpenDots licensing.  
**P1:** at least one credible educator/facilitator feedback pass or a transparent synthetic-user study; quantify benchmark only if actually run.  
**P2:** broader universal capability discovery, skills/memory, multi-provider fallback, heavy Figma, advanced agents. Valuable later, not needed to win the short competition.

## Honest status as of 2026-11-13 check

- [T.A.C.E main](https://github.com/LethaboMH14/T.A.C.E) is still at `369a174f48b90ede6aa53ea1734ed9139bb8d3a2`.
- [Draft PR #8](https://github.com/LethaboMH14/T.A.C.E/pull/8) remains **open, draft, unmerged** (latest inspected head `da96575896d1683d53f855ae1fcaf3afe46bdea7`).
- Latest draft PR head shows passing GitHub Actions workflows for G02.01/G02.02/G02.03 and isolated AG-UI clarification adapter/UI tests. These are **contract and prototype tests**, not verified autonomous end-to-end education deliverables or real self-correction.
- User-provided Bandicam recording samples show Colleague Zero Day 1 livestream and judges/hosts, not a demonstrated T.A.C.E mission run. Therefore no live-rubric points can be treated as earned based on those frames.
- **Architecture/idea assessment:** 9/10 idea, 8.5/10 technical plan. **Verified live-demo readiness:** ~3/10; these are qualitative model assessments, not judge scores. Exact marks would require an actual finished live demo and evaluation.
- **110/110 is a target, not a claim.** The crucial blocker is demonstrated autonomous execution and independent correction.

## Judge Q&A answers to prepare

**Why multi-agent rather than one model?** Because the Planner, data worker, schedule producer and independent verifier need different tools, evidence scopes, handoffs and success conditions; the verifier must independently recompute outputs rather than rubber-stamp the writer. The system should use fewer agents for simple tasks.

**What makes it autonomous?** It selects a goal-specific plan, runs bounded tasks, uses real tools to persist files, inspects those files against acceptance criteria, chooses a targeted repair and re-verifies. No hidden human correction during the observed loop.

**How do you know it is right?** It doesn't trust confidence alone; deterministic recomputation and evidence-backed acceptance tests validate each artifact. When evidence is missing, it reports unresolved.

**What if agents disagree?** The discrepancy becomes a validation event. Deterministic source/rule checks win over unsupported model assertions; if still uncertain, request human clarification rather than silently pick a winner.

**What prevents unsafe actions?** Identity and tenant binding, least-privilege connectors, independent effect classification, exact approval for consequential actions, and verified receipts. State clearly which are implemented versus designed. During hackathon all emails are drafts and data is synthetic.

**Why would an educator adopt it?** It reduces disconnected manual movement between assessment analysis, individualized support, mentor scheduling and communications; trial on synthetic data first, then a small permissioned pilot. Never claim specific savings without comparing baseline times.

**How is this different from a scripted automation?** Run another task and change a constraint. A real planner must alter subgoals and specialist selection, not merely switch fixed UI colors or narrate hardcoded steps.

**What is next beyond the hackathon?** Approved G02.03 design; G02.04 adaptive clarification; scoped connectors and independent security; impact/accuracy evaluation; AG-UI UI interoperability; open-source OpenDots/OpenBot evaluation separately. None is necessary as a prerequisite to one honest working MVP.
