// Education domain RULES — constants and plain-word definitions only, NO LOGIC.
// The workers (analyst, scheduler, writer) and the independent reviewer each implement
// these rules in their OWN code. Sharing the numbers is fine; sharing the code is not,
// because then the reviewer would just repeat the worker's bug.

export const RULES_VERSION = 'edu-rules-v1';

/** A gap = a score that is present and strictly below the skill's threshold (skills.csv "threshold"). */
/** A missing score (empty cell) is NOT a gap and is NOT zero. It is flagged as MISSING. */

/** At risk = (number of gaps >= AT_RISK_MIN_GAPS) OR (first_login_day >= LATE_LOGIN_DAY AND gaps >= 1). */
export const AT_RISK_MIN_GAPS = 2;
export const LATE_LOGIN_DAY = 4;

/** Priority skill for an at-risk trainee = the gap with the largest (threshold - score); tie -> lowest skill_id. */

/** Each at-risk trainee gets ONE mentor session of SESSION_MINUTES with a mentor whose skills include the priority skill. */
export const SESSION_MINUTES = 60;

/** Sessions are placed on whole-hour starts inside availability windows (availability.csv), week starting WEEK_OF. */
export const WEEK_OF = '2026-11-16';
export const DAYS = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

/** Mentor capacity = mentors.csv "capacity" = max sessions per week. */

/** Cohort means: average of PRESENT scores only, rounded to 1 decimal (Math.round(x*10)/10). */
export const MEAN_DECIMALS = 1;
/** Tolerance the reviewer uses when comparing reported numbers to recomputed ones. */
export const NUMBER_TOLERANCE = 0.05;

/** Drafts are never sent. Every draft carries status exactly "UNSENT". */
export const DRAFT_STATUS = 'UNSENT';
