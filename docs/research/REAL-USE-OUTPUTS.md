# What a coordinator, a learner and a mentor would use every week

Date: 2026-11-14. Research only, no code changed. Repo facts come from `domains/education/ARTIFACTS.md` (called ARTIFACTS below) and `apps/lms/LMS-SPEC.md` (called LMS-SPEC).

## 1. Sources (each fetched; one quoted span under 15 words)

| # | URL | Quote | What it implies for us |
|---|---|---|---|
| 1 | https://nacada.ksu.edu/Resources/Academic-Advising-Today/View-Articles/Maximizing-the-Use-of-an-Early-Alert-System-through-Advisor-Outreach.aspx | "a short, informal message expresses concern and availability to the advisee." | Outreach drafts must be short and warm. The same page reports advisors followed up by email 96%, 88% and 85% of the time (2011, 2012, 2013) and recommends a stronger approach after "three or more" notifications. We have no notification count yet. |
| 2 | same page | "Messages should encourage a response from the student." | End every learner message with one easy reply (a button in the portal), not a lecture. |
| 3 | https://www.stellic.com/resources/what-is-an-early-alert-system | "every flag gets an owner, an action, and an outcome that's recorded" | The coordinator list needs owner, action and outcome per flagged learner. We produce flags but record no outcome. |
| 4 | https://pure.uj.ac.za/en/publications/exploring-factors-influencing-dropout-among-tvet-college-students/ | "student self-motivation and missing classes, peer relationships, college support, and programme satisfaction." | South African TVET study (169 engineering students, four Gauteng colleges). Help-request categories motivation, time and access matter as much as scores, so show the category, not only the skill gap. |
| 5 | https://www.learningscientists.org/blog/2016/6/23-1 | "Retrieval practice involves recreating something you've learned in the past from your memory" | The quiz step in a plan should be recall, not rereading. The page also says to retrieve again "a bit later on". A second recall prompt a few days later is worth building. |
| 6 | https://en.wikipedia.org/wiki/Worked-example_effect | "when they receive worked examples at the beginning of cognitive skill acquisition." | Secondary source (Wikipedia). Use worked examples for weak skills, then fade steps. Examples can stop helping as skill grows, so a learner above threshold should not get one. |
| 7 | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.565202/full | "an if–then plan that specifies when, where, and how" | The if-then step needs a real time. The same paper reports g = 0.336 (95% CI 0.229 to 0.443; 24 studies, N = 15,907) for mental contrasting with implementation intentions. That is a small-to-medium effect, so do not oversell it. |
| 8 | https://www.togetherplatform.com/blog/mentor-meeting-agendas-for-productive-sessions-template | "Assign clear action or follow-up tasks to every topic for accountability and momentum." | Vendor blog, weak authority. A mentor brief ends with one action for the learner and one for the mentor, and the next session starts from last time's action. |

Also seen in search results but not opened or quoted, so not relied on: EAB Navigate "Alerts and Cases" PDF (qc.cuny.edu), BYU early alert page (daily risk status), University of Michigan Student Explorer (page returned HTTP 403).

Not verified (stated before anyone asks): nothing was found or fetched for Harambee, CodeSpace, Canvas/Moodle analytics or learnership practice. WeThinkCode material was found only in marketing pages and a case-study PDF the fetch tool could not read. No South African early-alert or weekly check-in practice is evidenced here. Sources 1 to 3 are US higher education, not bootcamps. Sources 5 to 8 are general learning science, with no adult-bootcamp trial. A 60% TVET first-year dropout figure in one search summary was not checked at its source, so it is not used. Treat everything below as design hypotheses to test with real coordinators.

## 2. Outputs per person

Legend: HAVE = produced today (artifact cited). MISSING = not produced.

### Coordinator (weekly, Monday; laptop Studio)
| Output | When | Screen | Exact fields | Status |
|---|---|---|---|---|
| Monday brief | Mon | Studio, printable | at-risk count, booked count, unsent drafts count, per learner: top gap, session day and time | HAVE `monday-brief.md` (ARTIFACTS section 8). Limit: a requested skill that is not a gap fails the brief (ARTIFACTS known limits). |
| Skill health table | Mon | Studio | per skill: mean, below threshold, missing | HAVE `performance-summary.json/.md` (section 2) |
| Approve-and-send list | Mon | Studio | draft, to, session, UNSENT banner, approve | HAVE `unsent-message-drafts` (section 5) |
| Calendar and spreadsheet | Mon | Outlook/Excel | session, learner, mentor, day, time, status | HAVE `.ics` and `.xlsx` (sections 6, 7) |
| Flag follow-up list (owner, action, outcome) | Mon, Fri | Studio | learner, why flagged, request category, owner, next action, due, outcome | MISSING. The brief lists people but records no outcome (source 3). |
| Quiet learners and week-on-week change | Mon | Studio | no attempts this week, minutes, score change vs last attempt | MISSING |

### Learner (daily glance, weekly plan; portal on phone)
| Output | When | Screen | Exact fields | Status |
|---|---|---|---|---|
| Support plan in inbox | after approval | portal Inbox | why (score vs pass mark, own quoted request), what to work on, worked example, recall questions, if-then plan, session day/time/mentor, language, format | HAVE draft payload and steps (ARTIFACTS section 5 and personal support); delivered by `lms_admin_deliver` (LMS-SPEC). |
| Read aloud and voice help | any | portal | Listen button, Speak button | HAVE (LMS-SPEC) |
| Skills with latest score and pass mark | daily | portal Home | score, threshold, minutes, source label | HAVE (`lms_me`) |
| "This week" card: one next step | Mon | portal Home | next step, when, minutes done vs planned, change since last attempt | MISSING (steps exist only inside the long message) |
| Spaced re-check | 2 to 3 days after session | portal Home | 3 recall questions on the same skill | MISSING |

### Mentor (before and after each session; portal phone, or laptop)
| Output | When | Screen | Exact fields | Status |
|---|---|---|---|---|
| Session list | Mon | portal Home, `.ics` | learner, skill, day, time | PARTLY HAVE: mentor draft lists sessions (section 5), `.ics` (section 6). |
| Availability and capacity | weekly | portal Availability | windows, capacity | HAVE (`lms_set_availability`) |
| Session brief per learner | 1 hour before | portal Inbox | skill, score vs pass mark, learner's own words (quoted), last 2 attempts with minutes, preferred format and language, memory facts, last action, one suggested first question | MISSING |
| After-session note | after session | portal | what happened, learner action, mentor action, next session needed yes/no | MISSING (no table for it) |

## 3. Five additions, ranked (about 3 hours each)

Rank is by value per hour and by whether the data already exists.

1. **Mentor session brief** (one per BOOKED session; mentor inbox).
   - User sees: half a screen: skill, score vs pass mark, the learner's request quoted, last two attempts with minutes, format and language, up to three memory facts, then "Open with: ..." and "Agree one action".
   - Data: `gaps.json`, `help_requests.csv` (text, category), attempts with minutes (`lms_admin_export` latest and minutes), `learner_prefs.csv`, `memory.csv` (today only passed in `payload.memory`, never worded), schedule row.
   - Reviewer check C20_brief_matches_data: recompute score, threshold, minutes and session time from sources; the quoted request must be an exact substring of the source text (cut to 140 characters); no other learner named (reuse C19); no link, email or phone.

2. **Coordinator follow-up list with owner, action, outcome.**
   - User sees: a table per flagged learner (at risk, requested, or quiet) with reason, request category, owner (coordinator or a mentor), proposed next action and an empty outcome column to fill after the week.
   - Data: gaps, `at_risk`, request categories (concept, assignment, time, motivation, access, other), schedule status (BOOKED or UNSCHEDULED), attempts per learner.
   - Reviewer check C21_followups_cover_flags: every recomputed at-risk or requested learner has exactly one row; category equals the source category; UNSCHEDULED learners appear with a non-mentor action (the code never invents a mentor).

3. **Learner "This week" card.**
   - User sees: one sentence ("Do the 3 recall questions on Variables and types on Tue 17 Nov at 09:00, before your session"), minutes done, score change since last attempt.
   - Data: priority skill, if-then step, session time, attempts with minutes and timestamps, language and format prefs.
   - Reviewer check C22_card_matches_plan: skill equals priority skill; time equals the booked session or a default 30-minute slot; minutes and score change recomputed from attempts; card text names no skill the learner does not own.

4. **Quiet learners and week-on-week change** (coordinator).
   - User sees: two short lists, "No activity this week" and "Moved up or down", each with numbers.
   - Data: attempts with timestamps and minutes (`lms_admin_feed`, `latest`).
   - Reviewer check C23_activity_recomputed: counts and score deltas recomputed from the raw attempt rows. Self-reported marks stay labelled as such, as the portal does.

5. **Spaced re-check nudge** (learner, 2 to 3 days after the session).
   - User sees: a portal card with 3 recall questions on the skill from the session, then the score.
   - Data: booked session, the existing quiz questions (18 across S1 to S6), `lms_submit_quiz`.
   - Reviewer check C24_recheck_timing: nudge date is after the session and within the same week; skill equals the session skill; questions exist in the quiz bank for that skill. Nudge text stays an unsent draft (SMS or email), as now.

Not recommended now: anything that ranks learners by a new risk score. We have no calibrated model, and doctrine 7 forbids uncalibrated claims.

## 4. Plain-language copy

Use: "Your plan", "This week", "Next step", "Practice questions", "Worked example" (learners know it from school), "Your mentor", "Pass mark", "Needs a person" (coordinator), "Waiting for your OK", "Booked", "Not booked yet", "Ask for help".

Avoid on learner screens: artifact, digest, ledger, payload, intervention, at-risk, gap, shortfall, threshold, priority skill, UNSENT, reviewer, run, source. Say "your score is 48, the pass mark is 60" (the existing `why` line already does this). Never label a learner "at risk" on any learner or mentor screen.

Coordinator screens may say "at risk" and "flag", but pair each with the reason and the owner. Replace "digest" with "Monday summary", "ledger" with "what was checked", "UNSENT" with "Not sent yet, needs your OK", "intervention" with "support".

Tone: short, informal, concern plus availability, and one easy reply (sources 1 and 2). Translated messages keep the existing note "needs a fluent reviewer", shown as "A person who speaks this language should check this".

## 5. Limitations
- Few primary sources; most are US campus or general learning-science pages. No South African coordinator was interviewed. A 30-minute talk with one real coordinator and one mentor should come before the build.
- The effect size quoted (g = 0.336) applies to a different intervention (mental contrasting plus if-then), not to our nudges.
- The ranking is my judgement from the data we have, not a measured result.
