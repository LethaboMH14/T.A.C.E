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

/** Support: a learner is SUPPORTED when at risk OR requested. A requested learner has >= 1 row in help_requests.csv. */
/** Support reason: 'at_risk' | 'requested' | 'both' | null (not supported). At-risk itself is unchanged by requests. */
/** Requested priority skill = the skill named in the learner's first request (by request_id) that names a known skill. */
/** A help-request text is quoted in a draft at most REQUEST_QUOTE_MAX characters (whitespace collapsed first). */
export const REQUEST_QUOTE_MAX = 140;
/** Learner preferences (learner_prefs.csv). Unknown or missing values fall back to these defaults. */
export const FORMATS = Object.freeze(['text', 'visual', 'audio']);
export const DEFAULT_FORMAT = 'text';
export const DEFAULT_LANGUAGE = 'en';
