# T.A.C.E: idea analysis against the Colleague Zero rubric, plus the 12:30 pitch

**Date:** Friday 13 November 2026, written ~10:50 SAST
**Inputs:** *Colleague Zero: Marking Criteria* (7 criteria, 110 points), *Agenda · Colleague Zero* (Day 1), this repo at `main` 16a08a1 and draft branch `review/g02-03-agui-next-20261112`.
**Status:** Analysis and recommendation. Scores below are my judgement of what a judge would award, not judge scores.

---

## 1. What the build is today (honest snapshot)

| Layer | What exists | Runs? |
|---|---|---|
| Problem and architecture | 40+ docs: charter, G01 problem statement (ADR-0003), threat model, 48 edge cases, gate registry, 110-point playbook | Docs only |
| G01 goal boundary | `tools/gate01/goal-boundary.mjs`, 16 tests | Yes, deterministic |
| G02.01 intake / G02.02 goal proposal / G02.03 prompt assembly | `tools/gate02/*`, 241 tests on the review branch | Yes, deterministic contracts |
| AG-UI adapter + 3-question wizard | `tools/integrations/agui/*`, 48 tests, static HTML demo | Yes, but preview only |
| Planner, specialist agents, reviewer, repair loop, file outputs | Not built | **No** |

**The rubric scores what is shown live.** The rubric itself says: *"Judge what was demonstrated live, not what was promised."* Today the repo has good design and good input checks, but no agent that plans, acts, checks and repairs. So almost all of the 110 points depend on what gets built between now and Saturday 11:00 (the repo deadline).

---

## 2. Scorecard: where we stand and what full marks needs

| # | Criterion | Max | If demoed today | What full marks needs | Biggest gap | Fix (priority order) |
|---|---|---:|---:|---|---|---|
| 1 | Reasoning and planning | 15 | 0–3 | Planner writes its own steps from a goal, adapts to the input, and the plan or log is visible | No planner. The wizard asks questions; it doesn't plan | LLM planner outputs a typed task graph (JSON) → show it as a graph. Run **two different goals** to show two different graphs |
| 2 | Self-correction | **20** | 0–4 | *"Judges can see the flag, the fix and the re-check"*, with real errors caught live | Nothing to correct yet | Reviewer **recomputes** results with code (not "LLM, are you sure?"). Red flag → repair agent → re-check goes green. Keep the failed version on screen |
| 3 | Execution and reliability | 15 | 0–3 | Runs end to end live, delivers usable files, handles odd input | No outputs | Write real files (`gap-analysis.csv`, `mentor-schedule.csv`, `support-plan.md`, `message-drafts.md`), reopen them on stage. Bad CSV row → safe halt, not a crash |
| 4 | Multi-agent collaboration | 15 | 0–3 | Several distinct roles, clear hand-offs, each adds value | No agents | 5 roles: Planner, Evidence Analyst, Scheduler, Writer, Independent Reviewer (+ Repair). Show "who did what" on each file |
| 5 | EdTech impact | 15 | 7–9 | Meaningful problem, **clear user**, *"could realistically be piloted"* | Problem is too broad (4 strands) and the stats are about school teachers while the demo is a bootcamp | Narrow to the bootcamp coordinator (section 3). Use matching evidence. Name the pilot: one Melsoft cohort, synthetic data first |
| 6 | Presentation and Q&A | **20** | — | Polished, confident live demo; explains decisions; answers "how do agents decide / disagree / detect errors" | Not rehearsed; the story is "an engine for any goal", which is hard to follow | One story: goal → plan → act → **fail → fix → re-check** → deliver → judge changes a constraint. Prepare the Q&A answers in section 6 |
| 7 | Professionalism | 10 | — | Energy, respect, clear ownership | On-time Loom tonight, named owners | Submit Loom before midnight; README fresh-clone tested before 11:00 Saturday |

**Read the weights.** Self-correction (20) and Presentation (20) are the two biggest criteria, and the guidelines say *"Self-correction is the defining feature of Colleague Zero."* Every build hour should go into making the fail → fix → re-check moment real and easy to see.

**Stop building:** more G02 gates, more contract tests, AG-UI conformance. They are good engineering but score close to zero on this rubric. Keep them for Q&A ("our intake is validated by 289 tests") and move on.

---

## 3. Is the problem statement sound? Yes, but it's too wide. Here's a sharper one.

### What's wrong with the approved statement (ADR-0003)

1. **No single user.** "Educators and training providers" covers everyone. The rubric asks for *"a clear user."*
2. **Four problems at once** (workload, learning gaps, language, fragmentation). Judges remember one.
3. **Evidence and demo don't match.** TALIS (lower-secondary teachers) and TIMSS (Grade 9 maths) are school stats. The playbook demo is 36 adult trainees and 3 mentors at a bootcamp. A sharp judge will notice.
4. **No moment of pain.** It's abstract ("turning evidence into useful action"). There's no scene the judge can picture.
5. **No cost of doing nothing.** It doesn't say what is lost when it goes wrong.

ADR-0003 says changes need *"an explicit dated amendment"*. If you adopt the version below, record it as ADR-0008 (I have not done that).

### Proposed problem statement (bootcamp coordinator, lead user)

> **One-liner:** Bootcamp coordinators find out a learner is in trouble when the learner has already gone quiet.
>
> **Formal:** In a 24-week tech bootcamp, one coordinator and a few mentors support dozens of learners. The warning signs show up early: a late first login, failed first assignments, missed sessions. But they are scattered across the LMS, mark sheets and mentor calendars. Turning them into a support plan, a mentor slot and a message to the learner takes hours every week, so it happens late or not at all. Learners who could have finished drop out, in a country where 3.7 million young people are not in work, education or training and tech roles go unfilled.
>
> **20-second version:** Every Monday a coordinator opens three spreadsheets and a calendar to work out who's falling behind, who should help them and when. By the time it's done, the learner has missed another week. The data was there. The time to act on it wasn't.

### Evidence that matches this user

| Claim in the pitch | Evidence | Source | Limits (say these if asked) |
|---|---|---|---|
| Early signals predict dropout | Leaving early is best predicted by the delay before the first login on an assignment; leaving later by the number of errors in the first assignment | [Hawlitschek et al. 2020, *Drop-out in programming courses – prediction and prevention*](https://www.emeraldinsight.com/insight/content/doi/10.1108/JARHE-02-2019-0035/full/html) | University programming course, not a bootcamp |
| Abandonment is detectable in time to act | Coding learners who quit showed signs of difficulty and disengagement first; the authors argue for timely intervention | [Yan et al. 2017 (Univ. of Washington)](https://faculty.washington.edu/ajko/papers/Yan2017GidgetAbandonment.pdf) | Online coding tutorial |
| Mentoring helps people finish | Time constraints and course difficulty were the top barriers; mentorship increased course completion | [LaunchCode working paper, EdWorkingPapers ai25-1122](https://edworkingpapers.com/sites/default/files/ai25-1122.pdf) | US programme |
| Acting on alerts works | Georgia State's early-alert advising: graduation up 6 percentage points since 2013; graduates finished half a semester sooner. **Over 90% of the cost was advising staff, not software** | [NPR, 2016](https://www.npr.org/sections/ed/2016/10/30/499200614/how-one-university-used-big-data-to-boost-graduation-rates) | University's own figures; system built by EAB. **This is the strongest line in the pitch:** the alerts worked because people had time to act on them. T.A.C.E gives the coordinator that time |
| Stakes: youth | 35.7% of South Africans aged 15–24 are NEET, about 3.7 million (Q3 2026 QLFS, released 10 Nov 2026) | [EWN, 10 Nov 2026](https://www.ewn.co.za/2026/11/10/stats-sa-over-37-million-young-south-africans-remain-locked-out-of-jobs-education-and-training) | **Check against the Stats SA P0211 Q3 2026 release before quoting.** I only saw the news report |
| Stakes: jobs | ~118,000 unfilled ICT roles; 27.2% vacancy rate (2024); software developer is the top digital role | [Africa.com citing Collective X *Decoding ICT Demand*](https://africa.com/opinion/south-africa-has-118000-unfilled-tech-jobs-why-does-it-take-so-long-for-jobseekers-to-land-one) | Industry research, not Stats SA |
| AI can give time back | RCT, 259 teachers: ChatGPT + a guide cut lesson-prep time 31% (56 vs 81 min/week) with no drop in quality | [EEF / NFER Teacher Choices trial](https://educationendowmentfoundation.org.uk/news/teachers-using-chatgpt-alongside-a-guide-to-support-them-to-use-it-effectively-can-cut-lesson-planning-time-by-over-30-per-cent) | Lesson planning, not coordination. Proves the category, not our product |
| AI can give time back (2) | Teachers using AI weekly report saving 5.9 h/week | [Gallup–Walton 2025](https://www.waltonfamilyfoundation.org/the-ai-dividend-new-survey-shows-ai-is-helping-teachers-reclaim-valuable-time) | Self-reported, US |
| **Why self-correction must be real** | Only 37 of 75 AI-generated Grade 3–5 maths items had the correct answer key | [AIME-Con 2026 work-in-progress](https://aclanthology.org/2026.aimecon-wip.44.pdf) | Small models, small pilot |
| **Why the reviewer recomputes and doesn't just ask the model** | *"LLMs cannot spot math errors, even when allowed to peek into the solution"* | [EMNLP 2025](https://preview.aclanthology.org/dashboard/2025.emnlp-main.553.pdf) | Supports a code-based checker over model self-review |
| Judges' own context | Melsoft runs a 24-week, full-time Full Stack Software Engineering bootcamp | [Course Report](https://www.coursereport.com/courses/full-stack-software-engineering-bootcamp-melsoft-academy) | Directory listing, not Melsoft's own site |

**Keep the school evidence (TALIS 72% marking stress, TIMSS 55%)** for the second goal (section 4). It fits the teacher use case and shows the engine isn't only for bootcamps.

**What we can't claim:** time saved by T.A.C.E, completion improved, any real learner data. Say "synthetic cohort" every time. That honesty helps on Presentation and Professionalism.

---

## 4. The solution: clear, provable, not hard-coded

You asked for both users, led by the bootcamp coordinator, to show it *"can think, correct and make decisions depending on tasks and not just hardcoded."* That fits the rubric well. The way to prove it is **two goals, one engine, two different plans**:

| | Goal A: lead demo (bootcamp coordinator) | Goal B: contrast (school teacher, smaller) |
|---|---|---|
| Goal typed in | "Using week-6 results for my 36 learners and my 3 mentors' availability, find who's at risk, build support plans, book mentor sessions with no clashes and draft messages. Don't send anything." | "My Grade 9 class scored badly on algebra. Make a 10-question practice sheet on their 3 weakest topics, with an answer key." |
| Plan the planner should produce | 5 roles, parallel branches (analysis ∥ availability), then schedule → write → review | 2–3 roles: Analyst → Writer → Reviewer. No scheduler, no messages |
| Real error the reviewer catches | Mentor double-booked in an overlapping slot, or a learner's average computed wrong. The reviewer recomputes from the CSV, flags the row IDs, Scheduler repairs, reviewer re-checks → green | Wrong answer in the key. The reviewer solves each question with code (e.g. sympy), flags question 7, Writer fixes, re-check → green |
| Safe halt | Learner row with missing scores → marked "insufficient evidence", not guessed | Question it can't verify → marked "unverified", not shipped |
| Live adapt (judge's turn) | Judge says "Mentor B is off after 14:00" → planner re-plans, schedule changes, reviewer re-checks | — |

This answers the hardest Q&A question ("isn't this just a script?") without words. The judge sees a different graph for a different goal.

### Where the errors come from (be honest about this)

The guidelines ask teams to *"show an error being caught and fixed."* Two honest options:
1. **Natural errors.** LLMs do get arithmetic and scheduling wrong. Use them when they happen, but they won't happen on cue.
2. **Declared fault injection.** A visible "stress test" switch that corrupts one intermediate value *before* the reviewer sees it. Say so on stage: "I'm going to break it on purpose. Watch it catch it." That's honest and reliable. A hard-coded red-then-green animation is not, and the repo's own playbook already bans it.

Use 2 as the main moment and point to 1 when it happens.

---

## 5. The name

**The repo never says what T.A.C.E stands for** (README: *"expanded acronym and the public-facing product name are not yet approved"*). One small risk: *tace* is Latin and Italian for "be silent". That's unlikely to matter with these judges, but you should know.

### Option A: keep T.A.C.E and give it a meaning (recommended)

| Expansion | Why it works |
|---|---|
| **Track · Act · Check · Explain** ← pick | It's the agent loop itself. **Track** learner signals → **Act** (plan, schedule, draft) → **Check** (independent reviewer: the 20-point criterion is in the name) → **Explain** (every recommendation links back to its source rows). The judges hear the rubric in the name |
| Turn Assessments into Coordinated Execution | Accurate, but long and dry |
| Teaching Assistant Colleague Engine | Plain, but says nothing about self-correction |

### Option B: rename

| Name | Why | Risk |
|---|---|---|
| **Catch** | Two meanings: catches learners before they slip, and catches its own mistakes. "Catch — the colleague that catches what falls through." | Common word. No trademark check done |
| Safety Net | Instantly clear to non-technical judges | Generic. Says nothing about agents |
| Second Look | Self-review in the name | Sounds like a review tool only |
| Keeper | "Keeps learners in the programme" | Vague |

**Recommendation:** keep **T.A.C.E — Track, Act, Check, Explain** for this hackathon. The repo, CI, ADRs and Loom all already say T.A.C.E, and a rename costs time you don't have today. If you want a product name after the hackathon, *Catch* is the strongest candidate.

---

## 6. Q&A prep (the judges' listed questions first)

| Likely question | Answer |
|---|---|
| **How do the agents decide?** | The Planner reads the goal and the available files and writes a task graph: which roles are needed, what depends on what. Different goals give different graphs, and you just saw two. |
| **What happens when they disagree?** | Code wins over opinion. If the Writer says a learner averaged 62% and the Reviewer recomputes 48% from the CSV, the recomputed value stands and the Writer's output is sent back. If the evidence itself is missing, it stops and asks the person. It doesn't guess. |
| **How are errors detected?** | The Reviewer doesn't ask the model whether it's right. Research shows LLMs can't reliably spot their own maths errors. It recomputes: averages from source rows, clash checks on the schedule, solving each quiz answer with code. |
| Isn't this just a script? | Change the goal or a constraint and the plan changes. Mentor B unavailable → new schedule, re-checked. |
| Why several agents and not one? | Each role has different inputs, tools and a different definition of "done". And the checker must be independent of the writer, or it just agrees with itself. |
| Real learner data / POPIA? | Synthetic data only. Nothing is sent: messages are drafts that wait for the coordinator's approval. A pilot would start the same way on one cohort. |
| What would a pilot look like? | One Melsoft cohort, synthetic run first, then the coordinator uses it on a weekly review for a month. We'd measure hours spent per week and days from warning sign to first mentor session, against their current process. |
| Have you measured time saved? | No, and we won't claim it. The EEF trial found 31% time savings for AI-assisted planning. Measuring ours is the pilot's job. |

---

## 7. Idea pitch for 12:30 today: 90-second core + 30-second extension

**Shape:** story → evidence → technical. **Core:** 219 words, about 90 seconds at 150 words per minute. Only three numbers: **3.7 million**, **118,000**, **six points**. Rehearse it with a timer at least twice. If you finish under 80 seconds, you're rushing.

### Core script (90 s)

| Time | Slide | Say |
|---|---|---|
| 0:00–0:20 | 1 | **[Story]** Picture Monday morning for a bootcamp coordinator: 36 learners, 3 mentors. Open the mark sheet, the attendance log, three mentor calendars. Work out who's falling behind, who should help, and when. It eats the day. And by the time it's done, one learner has already stopped logging in. *(pause)* |
| 0:20–0:47 | 1 | **[Evidence]** The signs were there early. Research on programming courses shows a late first login and errors in the first assignment predict dropout. The data isn't missing; the time to act on it is. When Georgia State acted on early alerts, graduation rose six points. And here, every dropout matters: 3.7 million young South Africans are not in work, study or training, while 118,000 tech jobs sit empty. |
| 0:47–1:15 | 2 | **[Technical]** So we're building T.A.C.E: Track, Act, Check, Explain. The coordinator types one goal. A Planner agent breaks it into tasks. An Analyst finds who's at risk and why. A Scheduler books mentors. A Writer drafts plans and messages. Then an independent Reviewer recalculates everything from the source data, because AI can't reliably catch its own mistakes. Wrong average, double-booked mentor: it flags it, sends it back, and checks again. |
| 1:15–1:30 | 3 | **[Close]** Give it a different goal and it builds a different team, so it's planning, not following a script. Synthetic data, nothing sent without approval. Tomorrow you'll watch it catch and fix its own mistake, live. |

### Optional extension (+30 s, only if there's time)

> A teacher asking for a practice sheet on the class's weakest topics gets a smaller team, and the Reviewer solves every answer in the key with code before it ships. What's built today: the goal-intake layer, checked by 289 automated tests. What we build next: the agent loop and the Reviewer. The pilot is one cohort: a synthetic run first, then a month of weekly reviews, measuring coordinator hours and days from warning sign to first mentor session. We won't claim a saving until we've measured it.

### Delivery notes

- Pause after *"stopped logging in."* That pause is where the judges picture the problem.
- Slow down on the three numbers. Say "three point seven **million**", not "3.7M".
- On slide 2, point at the Reviewer box when you say *"recalculates"*. That's the 20-point criterion.
- Say "Track, Act, Check, Explain" slowly, once. It's the only time the name needs explaining.
- The story is an illustration, not a real coordinator. If asked, say so.

### Slide text (3 slides)

**Slide 1: The problem**
- Title: **Monday, 9:00.**
- Line: 36 learners · 3 mentors · 4 spreadsheets
- Big line: **The signs come early. The help comes late.**
- Two stats, large: **3.7 million** young South Africans not in work, education or training · **118,000** unfilled tech jobs
- Footer, small: Stats SA QLFS Q3 2026 (via EWN, 10 Nov 2026) · Collective X, *Decoding ICT Demand*

**Slide 2: How T.A.C.E works**
- Title: **T.A.C.E: Track · Act · Check · Explain**
- Diagram, left to right:
  `Goal → Planner → [Analyst ∥ Scheduler] → Writer → Reviewer → Delivered files`
  with a red loop arrow `Reviewer → Repair → Reviewer` labelled **flag → fix → re-check**
- Callout on the Reviewer box: **Recalculates from the source data. It never just asks the AI if it's right.**

**Slide 3: Tomorrow's live demo**
1. One goal, in plain language
2. Agents plan and act: you'll see the plan
3. We break it on purpose → it catches and fixes it
4. You change a constraint → it re-plans
5. We open the real files

- Footer: **Synthetic data · nothing sent without the coordinator's approval**

### Host questions: 15-second answers

| If the host asks | Say |
|---|---|
| What have you built so far? | "The goal-intake and validation layer, with 289 automated tests. Today we build the agent loop and the Reviewer. Tomorrow you see it run." |
| How is this different from ChatGPT? | "ChatGPT answers. T.A.C.E finishes the job: it plans, books the schedule, writes the files, then checks its own work and fixes what's wrong before handing it over." |
| Why several agents and not one? | "Each job has different inputs and a different test for 'done'. And the checker has to be independent of the writer, or it just agrees with itself." |
| How do you know it caught a real error? | "The Reviewer recalculates from the raw data with code. You'll see the wrong value, the right value and the fixed file side by side." |
| Who would use it, and how would you pilot it? | "A bootcamp coordinator, like at Melsoft. Pilot on one cohort: synthetic data first, then a month of weekly reviews, measuring hours and how fast learners get help." |
| What about learner privacy? | "Synthetic data only for the hackathon. Nothing is sent: messages are drafts until the coordinator approves." |
| What does T.A.C.E stand for? | "Track, Act, Check, Explain. That's the loop it runs." |

### Cue card (one card, in the speaker's hand)

```
1 MONDAY   36 learners, 3 mentors, 4 sheets → learner stopped logging in  (pause)
2 EVIDENCE signs early (late login, first-assignment errors) · Georgia State +6 pts
           3.7 MILLION not in work/study/training · 118,000 tech jobs empty
3 T.A.C.E  Track·Act·Check·Explain → Planner, Analyst, Scheduler, Writer
           REVIEWER recalculates → flag, fix, re-check   (point at slide)
4 CLOSE    different goal = different team · synthetic, no sends · "watch it fix itself, live"
```

---

## 7A. Pitch v2: aligned to the architecture handover (12:00)

**Source of truth:** `CLAUDE.md`, `docs/architecture/COMPLETE-SYSTEM-BLUEPRINT.md` (main, 13 Nov). The deck now has 8 slides. Every technical line below maps to a gate in the blueprint, and anything not built is said to be "building" or "evaluating".

| Slide | Gate(s) | Status said out loud |
|---|---|---|
| 1 Problem · 2 Why it happens | G01 problem (ADR-0003, narrowed to the coordinator) | Evidence-backed |
| 3 The loop | G05 graph, G06 agents, G09 review/repair | Building for tomorrow |
| 4 Four kinds of engineering | G02.03 prompt, G03 context, G04/G06 swarm, G05 graph | Prompt layer built + tested; rest designed |
| 5 Talk + stay honest | G06 typed hand-offs, event ledger, G07/G09 guards | Design; AG-UI adapter built |
| 6 Why this design | Research backing | Cited papers |
| 7 Stack + status | G02 code, PR #8, blueprint §8 | 289 tests; candidates labelled |
| 8 Tomorrow | G12 demo | Promise |

### Full script (~2:30)

1. **Problem (0:00–0:20).** Picture Monday morning for a bootcamp coordinator: 36 learners, 3 mentors. Open the mark sheet, the attendance log, three mentor calendars. Work out who's falling behind, who should help, and when. It eats the day. And by the time it's done, one learner has already stopped logging in. *(pause)* In a country where 3.7 million young people are out of work, education and training, and 118,000 tech jobs sit empty, every one of those learners matters.
2. **Why (0:20–0:42).** Three reasons it keeps happening. The data is scattered across four places. Acting early works: Georgia State acted on early alerts and graduation rose six points, and most of the cost was people's time. And you can't just throw a chatbot at it: in one study only 37 of 75 AI-made maths items had the right answer. So the problem isn't just speed. It's speed you can trust.
3. **The loop (0:42–1:00).** So we're building T.A.C.E: Track, Act, Check, Explain. The coordinator types one goal. A Planner breaks it into tasks. An Analyst finds who's at risk. A Scheduler books mentors. A Writer drafts the plans. Then an independent Reviewer recalculates everything from the source data. If something's wrong, it flags it, Repair fixes only that, and it checks again.
4. **Engine (1:00–1:25).** Under the hood, four kinds of engineering. Prompt: the server sets the roles and the model must answer in a strict schema, or it's rejected. Context: only admitted files get in, each with an ID and version, labelled as data so a file can never give orders. Swarm: one worker for a simple goal, a team when the work truly splits. Graph: a typed task graph with budgets and retries, and every run ends Verified, or honestly Partial or Blocked.
5. **Talk + honesty (1:25–1:45).** The agents don't chat freely. They pass typed hand-offs into one event ledger, and that ledger is what the screen streams. Our rule against made-up answers: the model proposes, code decides. No citation, no claim. Nothing is done without a real file and a read-back. Missing evidence means Partial, never a guess.
6. **Research (1:45–2:00).** This isn't a guess. Research at ICLR 2024 showed AI can't reliably fix its own reasoning without outside feedback, and a 2025 study of 1,642 multi-agent runs found they fail through weak verification and misaligned agents. That's why our checker is code, and our hand-offs are typed.
7. **Stack (2:00–2:15).** Built and tested today: intake, a strict plan validator, a server-owned prompt assembler and an AG-UI event adapter, 289 tests in CI. Building now: the ledger, the agents and the repair loop. Node and TypeScript, SQLite, and a provider-neutral model adapter.
8. **Close (2:15–2:30).** Give it a different goal and it builds a different team. Synthetic data, nothing sent without approval. Tomorrow you'll watch it catch and fix its own mistake, live.

**90-second cut:** say slides 1, 3, 5 and 8 in full; for slide 2 say only "the data is scattered and unchecked AI can't be trusted"; skip 4, 6 and 7 and keep them for Q&A.

### New Q&A answers

| Question | Answer |
|---|---|
| Where's the prompt engineering? | "The server builds the prompt, not the user's text. Roles are fixed, the output must match a strict schema, and anything malformed is rejected. That's built and tested (G02.03)." |
| How do agents communicate? | "Typed hand-offs: from, to, input file and version, output, evidence rows, status. All written to one append-only event ledger. The UI only displays that ledger, through AG-UI events." |
| How do you prevent hallucination? | "The model proposes, code decides. Strict schemas, admitted sources only, every claim cites a row, the Reviewer recalculates from raw files, done needs a read-back, missing evidence means Partial." |
| Where's the loop? | "Plan, run, review. A failed check creates a repair task for only that output, then the Reviewer re-checks. Repairs are capped, so it can't loop forever, and it reports Blocked if it can't fix it safely." |
| What happens when agents disagree? | "The disagreement becomes a check. Recomputed data beats a model's claim. If the data can't settle it, it asks the person." |
| Which model? | "A provider-neutral adapter, so we're not locked to one AI company. We pick based on measured schema accuracy and cost, not hype." |

**Not yet placed on slides:** "alisX". It isn't in the repo; confirm what it is before quoting it.

## 8. Build order for the rest of today (deadline: repo + README Saturday 11:00, demo 12:00)

1. **P0, by ~17:30:** synthetic data (36 learners, 3 mentors, week-6 results) + Planner → Analyst → Scheduler → Writer, writing real files.
2. **P0, by ~21:00:** Independent Reviewer with code checks (averages, schedule clashes) + Repair + re-check, visible in an event log. Declared fault-injection switch.
3. **20:30:** progress check-in survey. **Before 00:00:** Loom progress report.
4. **P1, tonight:** Goal B (quiz + sympy answer-key check). Live constraint change ("Mentor B off after 14:00").
5. **P1:** a simple mission view: task graph, event log with red/green checks, links to the output files. The existing wizard can be the front door.
6. **Saturday before 11:00:** fresh-clone README test, a recorded backup run *labelled as recorded*, rehearse twice.

## 9. Limits of this analysis

- The NEET figure comes from a news report of the Q3 2026 QLFS, not the Stats SA release itself. Check it before quoting.
- Dropout-signal and mentoring studies are from university courses, online tutorials and a US programme, not South African bootcamps. No rigorous South African bootcamp dropout rate was found.
- Georgia State figures are the university's own, reported by NPR in 2016.
- The "today" scores in section 2 are my judgement. The rubric is scored by Melsoft's judges on the live demo.
- No trademark search was done for any name in section 5.
- The pitch length for 12:30 wasn't stated; the script is ~2 minutes.
