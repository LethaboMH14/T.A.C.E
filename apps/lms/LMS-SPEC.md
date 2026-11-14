# T.A.C.E Learner Portal (live LMS) — build spec, 13 Nov 2026

## What it is
A mobile-first learner and mentor portal for the live demo. Anyone in the room scans a QR code, opens the portal on their phone, picks one of 36 learners or 3 mentors (or creates a learner), sets a PIN, and then acts: takes a quiz (marked by the database), submits a mark (self-reported, labelled), logs time, asks for help in their own words, and sets a preferred format and language. T.A.C.E (the laptop) snapshots this live data into its normal sources, runs the mission, and after the coordinator approves, **delivers each person's own plan into their portal inbox**. Nothing goes to email or SMS automatically; those are drafts a person sends ("check your portal inbox").

## Backend (live, verified with `node tools/lms/smoke.mjs`)
Supabase project `tace-lms` (eu-west-2). URL `https://biyneypnrnzhgyuibfwv.supabase.co`, publishable key `sb_publishable_7FY9SrZrkAPvNQjHGVgvlQ_O4jQSP_Y` (public by design; tables are deny-all, only the RPCs below are callable). Call: `POST {URL}/rest/v1/rpc/<fn>` with headers `apikey: <key>`, `content-type: application/json`, body = named args. Errors: non-2xx with `{message}` → show the message.

| RPC | Args | Returns |
|---|---|---|
| lms_list_profiles | – | [{id, kind:'learner'\|'mentor', display_name, claimed}] |
| lms_login | p_id, p_pin (4–8 digits) | session token (string). An unclaimed profile is claimed by this PIN. |
| lms_create_profile | p_name (1–40), p_pin | {id, token} |
| lms_me | p_token | {profile:{id,kind,display_name,prefs:{format,language},mentor_skills,capacity}, skills:[{id,name,threshold,latest:{score,minutes,source,at}\|null}], help:[…], availability:[{day,start,end}], unread} |
| lms_quiz | p_token, p_skill | [{id, prompt, options[]}] (no answer key) |
| lms_submit_quiz | p_token, p_skill, p_answers int[] (option index per question, in id order), p_minutes | {score, correct, total, review:[{id, your, right, explanation}]} |
| lms_submit_mark | p_token, p_skill, p_score 0–100, p_minutes | {ok} (stored as self_reported) |
| lms_request_help | p_token, p_skill ('' for none), p_category ∈ concept\|assignment\|time\|motivation\|access\|other, p_text 1–500 | {ok} |
| lms_set_prefs | p_token, p_format ∈ text\|visual\|audio, p_language ∈ en zu xh af st tn nso ts ve ss nr | {ok} |
| lms_set_contact | p_token, p_email (text or null), p_phone (text or null; 082 123 4567 or +27…), p_consent boolean | {ok, stored}. Save with p_consent true; Remove with p_consent false. Server error text is shown as-is. |
| lms_set_availability | p_token, p_windows [{day:'Mon'..'Fri', start:'HH:MM', end:'HH:MM'}] (mentors) | {ok} |
| lms_inbox | p_token | [{id, run_id, kind, subject, body, format, language, payload, at, read}] |
| lms_mark_read | p_token, p_id | {ok} |
| Admin (laptop server only, token in .env `LMS_ADMIN_TOKEN`) | | |
| lms_admin_export | p_admin | {at, skills, profiles, latest:[{profile_id, skill_id, score, minutes, source, at}], minutes:{id: total}, help:[…], availability:[…], memory:[…]} |
| lms_admin_feed | p_admin, p_after_attempt, p_after_help | {attempts:[…new], help:[…new], claimed} |
| lms_admin_deliver | p_admin, p_run, p_messages [{profile_id, kind, subject, body, format, language, payload}] | count |
| lms_admin_remember | p_admin, p_run, p_facts [{profile_id, fact}] | count |
| lms_admin_reset | p_admin | {ok} (clears audience activity and claims; keeps the seeded baseline) |

Seeded: skills S1–S6 (threshold 60), learners L-01..L-36 ("Learner 01"…) with the fixture baseline scores, mentors M-A/M-B/M-C with skills, capacity 6 and availability windows, 18 quiz questions.

## Rules (binding, owner 13 Nov)
- Nothing hardcoded or scripted: every number, name, status and message on screen comes from an RPC response. Empty and error states say what's missing.
- Privacy: ask for a nickname only; show "Don't use your real full name. Demo data only." No contact field is shown or stored unless the person opts in under "Get a notice when a new plan arrives" (Me for learners, Home for mentors): an email and/or a South African mobile, plus an unticked consent checkbox. Remove stores nothing. The Ask-for-help screen and Welcome show: "What you type here may be processed by an AI model to write your plan. Don't include personal details."
- Mobile first: 375px, thumb-reachable actions, large tap targets (≥44px), no horizontal scroll. Also fine on desktop.
- Visual world: the same as Mission Studio (light, Instrument Sans + Bricolage Grotesque for headings + JetBrains Mono for ids; deck gradient #7D9EFA → #DB61E6 → #8F66ED as accent only; green/amber/red statuses). It should feel like a real school portal, warm and calm, not a dev tool. No emoji icons (lucide-react).
- Accessibility: labels, focus states, reduced motion.

## Portal behaviour added 13 Nov (owner and lead)
- **Session.** The token is kept in localStorage per profile (tace.lms.session.<id>, current profile in tace.lms.current). On load with a token the app calls lms_me and resumes. A "Please log in again" answer clears the token and opens the profile picker with that profile preselected and highlighted; its PIN restores all earlier data, which is stored server-side. Sign out clears the token.
- **Layout.** Below 1024px: header and bottom tab bar (learner: Home, Help, Inbox, Me; mentor: Home, Availability, Inbox). From 1024px: left sidebar (learner: Home, Skills, Help, Inbox, Me; mentor: Home, Availability, Inbox), content in a centred column (max 1024px, 1152px from 1280px). Home is two columns on desktop: skills | right rail (Ask for help, latest message, preferences). The quiz is one centred card: keys 1 to 4 pick an option, Enter goes to the next question or submits after the last.
- **Voice help.** The Ask-for-help form has a Speak button (Web Speech API, SpeechRecognition or webkitSpeechRecognition). It is hidden where unsupported. Language comes from the learner's preference: en-ZA, zu-ZA, xh-ZA, af-ZA, st-ZA, tn-ZA, nso-ZA, ts-ZA, ve-ZA, ss-ZA, nr-ZA (en-ZA if unknown). Recognised text is added to the box; the person reviews and edits it before Send.
- **Read aloud.** Every inbox message has a Listen button (speechSynthesis). It uses a voice for the message language when the phone has one; otherwise an English voice with the note "Read in English voice"; if no voice at all, "No voice for <language> on this phone — showing text". Nothing plays automatically; the text is always shown.
- **Inbox steps.** payload.steps items carry a type (worked_example, parsons, retrieval_quiz, if_then_plan), shown with an icon and title, body preformatted. payload.reviewer_note is shown when present.
- **Sources.** A source value of seed is labelled baseline.
