# Education recovery fixture, v1

All data in this folder is fictional and synthetic. Learners are "Learner 01" to "Learner 36", mentors are "Mentor A" to "Mentor C", and no real person, school or result is represented.

Seed: **20261115**. The generator starts at 20261113 and uses the first seed whose baseline meets every constraint (seeds 20261113 and 20261114 failed). Regenerate with `node fixtures/education-recovery/generate.mjs`; the same seed gives byte-identical files. Check the files with `node fixtures/education-recovery/validate.mjs`.

**skills.csv** lists six skills (S1 Variables and types to S6 Git and version control), each with a pass threshold of 60.

**trainees.csv** lists 36 learners with their first login day (1 to 7, mostly 1 or 2), sessions attended out of 12, and the sessions total of 12.

**assessments.csv** holds 216 rows, one per learner and skill, ordered by learner then skill. A score is an integer from 20 to 100, or empty when missing. There are exactly 6 missing cells, two or more of them in S3.

**mentors.csv** lists three mentors, each with the skills they can teach and a capacity of 6 sessions a week.

**availability.csv** lists six weekly windows across the three mentors, on Monday to Friday.

**interventions.json** lists 12 support activities, two per skill: a one-to-one mentor session (60 minutes) and a guided practice set (45 minutes).

## Rules

- A gap is a present score below the skill threshold. A missing score is not a gap and is not zero.
- A learner is at risk when they have 2 or more gaps, or when their first login day is 4 or later and they have at least 1 gap.
- The baseline at-risk count must fall between 10 and 14 inclusive.
- The S3 mean with missing scores counted as zero must differ from the S3 mean of present scores by at least 1.0. Means are rounded to 1 decimal.

The thresholds and the at-risk constants come from `domains/education/rules.mjs`.
