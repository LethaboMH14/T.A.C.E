# G01.23 — Impact, measurement and outstanding validation

**Date:** 2026-11-10 | **Design state:** SPECIFIED FOR G01 | **Empirical state:** NOT TESTED
**Approved problem:** [ADR-0003](../decisions/ADR-0003-education-problem-statement-approval.md).
**Program:** universal T.A.C.E engine; EdTech is the judged demonstration. No KAIRO dependency.

## 1. Evidenced need versus proposed benefits

**Evidence-backed need:** In OECD TALIS 2024, 72% of surveyed South African lower-secondary teachers reported excessive marking as a significant source of stress, 66% administration; full-time respondents reported 7.1 hours/week marking and 4.9 hours/week administration. The OECD review of TIMSS 2023 documents that 55% of assessed Grade 9 learners did not attain the lowest international Mathematics benchmark. The DBE's mother-tongue bilingual education rollout identifies language access as a policy priority. OECD's Digital Education Outlook 2023 documents fragmentation/interoperability as an operational problem. These are context, not outcomes attributed to T.A.C.E.

**Proposed but NOT demonstrated:** saved teacher time, fewer mistakes, faster intervention, more accessible resources, reduced duplication, better learner understanding, improved completion, cost savings, increased trust.

## 2. First four user-level impact hypotheses

| ID | Hypothesis | Baseline | Measurement | No-go / falsification |
| --- | --- | --- | --- | --- |
| IMP-01 | Educator reaches an independently verified output faster | Same synthetic task completed manually using ordinary office tools; alternate single-model assistant | Task elapsed time, **separately** human active minutes and compute delay, all correction time | Equivalent baseline is faster or T.A.C.E has an invalid output |
| IMP-02 | Assessment-to-support gap shortens without inventing ability labels | Teacher manually maps 36 synthetic results to learning goals | Correct skill attribution, target support coverage, time from input to reviewed plan, false recommendation count | Any unsourced learner claim accepted as fact |
| IMP-03 | Accessible teaching draft preparation is more efficient without sacrificing correctness | Teacher manually assembles bilingual material with trusted educational references | Source-concept preservation; reviewer acceptance; keyboard/low-data checks; editing time | Incorrect translated formula or unchecked text represented as verified |
| IMP-04 | Cross-app task closure is more dependable | Copy data between spreadsheet, doc, email draft and calendar manually | Real local file existence/open test, formula reconciliation, exact connector receipt and read-back, duplicate side-effect rate | Incomplete or duplicated writes reported as complete |

These are hypotheses only. Do not report percentages as saved or achieved until both test data and method are recorded.

## 3. Separate evidence layers

- **E0 = problem evidence:** primary OECD/DBE/UNESCO research (already collected).
- **E1 = contract evidence:** schema, edge-case fixtures and validators for the proposed goal boundary (can be tested offline without any model).
- **E2 = synthetic end-to-end:** seeded learner-free/invented cohort, source files, actual service/tool calls and saved/reopened outputs.
- **E3 = production-like integration:** authenticated sandbox app connections, revocation, retry/idempotency and exact approvals.
- **E4 = human research:** 3–5 consenting adult teacher/mentor/coordinator usability sessions, ideally a subject expert and fluent language reviewer; record recruitment and tasks.
- **E5 = real-world impact:** lawful, permissioned pilot with enough subjects/time to support causal claims. **No real learner records in the hackathon demo.**

Only E0 currently exists. Written contracts do not constitute E1 test execution or E2–E5 evidence.

## 4. Experimental protocol

1. Fix one synthetic evaluation dataset with 36 fictional trainees, 3 mentors, limited timeslots, 4 file/source types, 2 language preferences, source revision IDs and a realistic support deadline. No real identities, email recipients or private cloud data.
2. Predefine task goals *before* any model output. Use 7 educational task families plus unseen paraphrases, mixed goals, vague or attachment-free prompts and non-education general goals for capability admission.
3. Set **at least 30 total prompt variants** for boundary classification/equivalence, plus at least 15 negative/edge-case variants. Separate development and held-out sets; publish fixture seed, hash, intended result and reviewer notes.
4. Compare (a) office/manual baseline, (b) direct single-model baseline and (c) T.A.C.E with supported agents/tools. Baselines get the same accessible input and output criteria. Note differences in system capability honestly.
5. For each run store: task ID, source hashes, model/provider versions if present, prompts by version, tools actually invoked, duration, tokens/cost, planned and completed steps, approval requests, artifacts, verification evidence, error reason and reviewer decision. Do not log learner data or secrets.
6. Evaluate blinded outputs against deterministic validators plus teacher/subject expert rubrics. Don't use a model grading itself as the only correctness oracle.
7. Inject controlled interruptions: changed staff availability, tool timeout, missing file, conflicting source, false formula, revoked access and duplicate request ID. Label injections as experimental, not spontaneous agent discoveries.
8. Publish successes **and failures**, uncertainty, confidence intervals when meaningful, sample size, limitations, held-out prompt outcomes and a simple readable judge evidence dashboard.

## 5. Objective engineering targets (not results or outcome promises)

| ID | Metric | Proposed acceptance target for demo stage |
| --- | --- | --- |
| Q-01 | Unsupported inputs and permissions | **100% blocked or reported correctly** on the fixed negative-fixture suite |
| Q-02 | Unauthorized external effects | **0** sends, LMS writes or calendar changes without matching, current approval |
| Q-03 | Synthetic cross-owner access | **0** cross-owner reads in test suite |
| Q-04 | Output integrity | **100%** required artifacts exist, reopen and match expected schema/content checks |
| Q-05 | Scheduling consistency | **0** overlapping mentor/room assignments and no stale plan after seeded availability change |
| Q-06 | Repair evidence | At least one detected error: failing check -> bounded repair -> independent passing check, **or** explicit unresolved stop |
| Q-07 | Proportional workflow | At least 1 simple request without needless agent swarm; 1 complex request with actual specialist handoffs |
| Q-08 | Source accuracy | 0 unsupported source-as-fact claims in reviewed demonstration artifact; cite sampled supporting passages |
| Q-09 | Bilingual status | Clearly indicate **DRAFT—REQUIRES FLUENT REVIEW** until qualified review really occurs |
| Q-10 | Prompt robustness | Held-out rephrasings produce substantially equivalent *goal constraints* while permitting different valid plans; record disagreement |
| Q-11 | Cost/runaway | Deterministic max tools/nodes/retries/time/cost; stopped jobs cannot continue effects |
| Q-12 | Data integrity and approvals | Every external write has exact approved payload fingerprint, idempotency key and verifiable provider receipt |

These targets are **proposed release gates** for implementation G07/G09/G11/G12. Zero observed failures in a small suite cannot prove zero future failures.

## 6. Reporting template

Record: fixture ID; input/data/license; actor; baseline times; T.A.C.E time; task success; human effort; error count/severity; review decisions; tool and artifact receipts; cost; confidence/uncertainty; what failed; exact run/provenance URL; corrective issue. Report no savings when baseline not run. Never estimate generic "X hours saved per teacher" from TALIS without independent real-world measurement.

## 7. Pending work

- [x] Research problem sources and distinguish correlation/context from causal claims.
- [x] Specify hypotheses, metrics, controls, synthetic evaluation method and targets.
- [ ] Generate, hash and independently review realistic fixture pack.
- [ ] Execute any end-to-end T.A.C.E work.
- [ ] Compare against manual/standard-tools baselines.
- [ ] Run security, replay and integration tests.
- [ ] Observe real consenting adult educator testers and language reviewers.
- [ ] Publish measured outcomes, failure analysis and pilot decision.

**Gate distinction:** G01 can accept this *evaluation contract* and move to G02. Empirical evidence remains **PENDING IN G11/G12**; it is not fabricated or waived. The gate must not be represented as a validated product.

## Sources

- https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/south-africa_49ebbcf9-en.html
- https://www.oecd.org/en/publications/consolidating-the-general-education-certificate-in-south-africa_06154f19-en/full-report/component-3.html
- https://www.education.gov.za/Programmes/MTbBE.aspx
- https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/interoperability-unifying-and-maximising-data-reuse-within-digital-education-ecosystems_660f8da1.html
- https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
