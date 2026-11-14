# LMS learner portal: load and persistence test

Status: **FAIL at 100 and 150 users** on profile creation and on the p95 latency budget. Persistence, the claim race, id distinctness and the demo reset all pass at every size tested.

## When and where

- Final runs: 2026-11-13, 23:10:48 to 23:11:07 SAST (times from the run JSON, see the tables).
- Machine: one Windows 11 laptop, one client IP, Node v24.18.0, `tools/lms/load.mjs` at the repo commit recorded in each run JSON (`meta.repoCommit`).
- Backend: Supabase free tier, project in eu-west-2, reached from South Africa.

## What was measured

- Each virtual user (VU) runs: `lms_create_profile`, `lms_me`, `lms_quiz('S1')`, `lms_submit_quiz` (answer index 0 for every question), `lms_submit_mark('S2')`, `lms_request_help('S3')`, `lms_set_prefs('visual','zu')`, `lms_inbox`, then discards the token, `lms_login` again with the same id and PIN, and `lms_me`. Persistence is checked against the values written.
- All VUs start together with `Promise.all`. The claim race (10 parallel `lms_login` on `L-05` with 10 different PINs) runs in the same wave.
- Latency is client-side wall time per RPC call, from `performance.now()` around `fetch`, including JSON parsing. Percentiles use nearest rank on the sorted array of all calls in the load phase.
- Errors are recorded as observed (HTTP status and backend message). Nothing is retried. No HTTP 429 or 5xx was seen in any run (checked across all six JSON files).
- The run ends with `lms_admin_reset` in a `finally` block, then `lms_list_profiles` verifies 36 learners, 3 mentors and 0 claimed.

## Pass criteria (declared before the first run)

- Functional: every VU's flow and persistence checks pass, the claim race has exactly 1 success and 9 losses with the message `That profile is taken or the PIN is wrong`, created profile ids are distinct, reset succeeds and the verification is 36 / 3 / 0.
- Latency: p95 over all load-phase calls at or below **1000 ms**. This budget is a chosen figure for a phone on a classroom network, not a measured requirement.

## Results

Each block below is the script's own report, rendered from the saved JSON of that run.

## Load test: 50 users, seed 20261113, 2026-11-13 23:10:48 SAST
plan hash 2c2d1269c8a1d9a7 · load wall 4515.373 ms · total wall 7864.321 ms

### Table 1: load phase (all users and claim race, concurrent)
| RPC | count | ok | errors | p50 ms | p95 ms | p99 ms | max ms | calls/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lms_create_profile | 50 | 50 | 0 | 1343.7 | 1985.5 | 1992.9 | 1992.9 | 11.1 |
| lms_login (persistence) | 50 | 50 | 0 | 285.4 | 398.5 | 440.8 | 440.8 | 11.1 |
| lms_login (claim race) | 11 | 2 | 9 | 1969.5 | 1979.6 | 1979.6 | 1979.6 | 2.4 |
| lms_me | 100 | 100 | 0 | 275.8 | 368.5 | 620.3 | 645.9 | 22.1 |
| lms_quiz | 50 | 50 | 0 | 257.5 | 424.7 | 426.5 | 426.5 | 11.1 |
| lms_submit_quiz | 50 | 50 | 0 | 262.6 | 397.6 | 404.5 | 404.5 | 11.1 |
| lms_submit_mark | 50 | 50 | 0 | 240.3 | 324.1 | 397.6 | 397.6 | 11.1 |
| lms_request_help | 50 | 50 | 0 | 251 | 375.1 | 381.8 | 381.8 | 11.1 |
| lms_set_prefs | 50 | 50 | 0 | 275.9 | 339.5 | 380.4 | 380.4 | 11.1 |
| lms_inbox | 50 | 50 | 0 | 259.3 | 328.9 | 368.4 | 368.4 | 11.1 |
| ALL | 511 | 502 | 9 | 272.3 | 1703.7 | 1979.6 | 1992.9 | 113.2 |

### Table 2: admin (once, before reset), reset and verification
| RPC | count | ok | errors | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lms_list_profiles | 1 | 1 | 0 | 206 | 206 | 206 | 206 |
| lms_admin_export | 1 | 1 | 0 | 225.2 | 225.2 | 225.2 | 225.2 |
| lms_admin_feed | 1 | 1 | 0 | 230.8 | 230.8 | 230.8 | 230.8 |
| lms_admin_reset | 1 | 1 | 0 | 219.4 | 219.4 | 219.4 | 219.4 |

admin export: {"bytes":64117,"profiles":89,"skills":6,"latest":310,"minutesKeys":86,"help":50,"availability":7,"memory":0}
admin feed: {"attempts":100,"help":50,"claimed":51}

### Errors grouped by message (load phase)
| RPC | HTTP | code | message | count |
| --- | --- | --- | --- | --- |
| lms_login (claim race) | 400 | LMS_HTTP | lms_login: HTTP 400: That profile is taken or the PIN is wrong | 9 |

### Checks
- persistence and profile flow: 50 of 50 users pass
- claim race (L-05, 10 parallel logins): 1 success, 9 fail, 9 with the expected message, winner re-login true -> PASS
- profile creates succeeded: 50 of 50
- unique profile ids: 50 distinct of 50 created -> PASS
- lms_admin_reset: ok
- after reset: 36 learners, 3 mentors, 0 claimed, 0 load-created profiles still listed -> PASS

VERDICT: FAIL · functional PASS · p95 1703.7 ms vs budget 1000 ms FAIL · user-flow error calls 0
  - p95 1703.7 ms over the 1000 ms budget (all load-phase calls)

---

## Load test: 100 users, seed 20261113, 2026-11-13 23:10:59 SAST
plan hash c0331b4e3ba34bcb · load wall 4395.499 ms · total wall 6031.074 ms

### Table 1: load phase (all users and claim race, concurrent)
| RPC | count | ok | errors | p50 ms | p95 ms | p99 ms | max ms | calls/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lms_create_profile | 100 | 63 | 37 | 1450.7 | 1774.7 | 1918.4 | 1927.2 | 22.8 |
| lms_login (persistence) | 63 | 63 | 0 | 304.8 | 397.9 | 404.2 | 404.2 | 14.3 |
| lms_login (claim race) | 11 | 2 | 9 | 1488.4 | 1606.3 | 1606.3 | 1606.3 | 2.5 |
| lms_me | 126 | 126 | 0 | 387.8 | 577.5 | 632.7 | 637.1 | 28.7 |
| lms_quiz | 63 | 63 | 0 | 397.7 | 530.5 | 583.6 | 583.6 | 14.3 |
| lms_submit_quiz | 63 | 63 | 0 | 301.1 | 414 | 454.1 | 454.1 | 14.3 |
| lms_submit_mark | 63 | 63 | 0 | 266.1 | 295.3 | 362.7 | 362.7 | 14.3 |
| lms_request_help | 63 | 63 | 0 | 266.1 | 305.2 | 326.8 | 326.8 | 14.3 |
| lms_set_prefs | 63 | 63 | 0 | 267.9 | 299.2 | 322.3 | 322.3 | 14.3 |
| lms_inbox | 63 | 63 | 0 | 272.7 | 305 | 322.6 | 322.6 | 14.3 |
| ALL | 678 | 632 | 46 | 291.1 | 1559.7 | 1772.9 | 1927.2 | 154.2 |

### Table 2: admin (once, before reset), reset and verification
| RPC | count | ok | errors | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lms_list_profiles | 1 | 1 | 0 | 361.7 | 361.7 | 361.7 | 361.7 |
| lms_admin_export | 1 | 1 | 0 | 233.6 | 233.6 | 233.6 | 233.6 |
| lms_admin_feed | 1 | 1 | 0 | 229.8 | 229.8 | 229.8 | 229.8 |
| lms_admin_reset | 1 | 1 | 0 | 217 | 217 | 217 | 217 |

admin export: {"bytes":71854,"profiles":102,"skills":6,"latest":336,"minutesKeys":99,"help":63,"availability":7,"memory":0}
admin feed: {"attempts":126,"help":63,"claimed":64}

### Errors grouped by message (load phase)
| RPC | HTTP | code | message | count |
| --- | --- | --- | --- | --- |
| lms_create_profile | 409 | LMS_HTTP | lms_create_profile: HTTP 409: duplicate key value violates unique constraint "profiles_pkey" | 37 |
| lms_login (claim race) | 400 | LMS_HTTP | lms_login: HTTP 400: That profile is taken or the PIN is wrong | 9 |

### Checks
- persistence and profile flow: 63 of 100 users pass
- claim race (L-05, 10 parallel logins): 1 success, 9 fail, 9 with the expected message, winner re-login true -> PASS
- profile creates succeeded: 63 of 100
- unique profile ids: 63 distinct of 63 created -> PASS
- lms_admin_reset: ok
- after reset: 36 learners, 3 mentors, 0 claimed, 0 load-created profiles still listed -> PASS

VERDICT: FAIL · functional FAIL · p95 1559.7 ms vs budget 1000 ms FAIL · user-flow error calls 37
  - 37 of 100 users failed a step or a persistence check
  - p95 1559.7 ms over the 1000 ms budget (all load-phase calls)

---

## Load test: 150 users, seed 20261113, 2026-11-13 23:11:07 SAST
plan hash 0cc4e8da90027eac · load wall 7074.059 ms · total wall 8482.996 ms

### Table 1: load phase (all users and claim race, concurrent)
| RPC | count | ok | errors | p50 ms | p95 ms | p99 ms | max ms | calls/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lms_create_profile | 150 | 63 | 87 | 3080.1 | 4099.6 | 4275.1 | 4279 | 21.2 |
| lms_login (persistence) | 63 | 63 | 0 | 295.6 | 578.1 | 630.1 | 630.1 | 8.9 |
| lms_login (claim race) | 11 | 2 | 9 | 4097 | 4362.2 | 4362.2 | 4362.2 | 1.6 |
| lms_me | 126 | 126 | 0 | 537.8 | 1824.8 | 1906.8 | 1909.7 | 17.8 |
| lms_quiz | 63 | 63 | 0 | 395.5 | 564.3 | 1482.1 | 1482.1 | 8.9 |
| lms_submit_quiz | 63 | 63 | 0 | 326 | 391.2 | 417.4 | 417.4 | 8.9 |
| lms_submit_mark | 63 | 63 | 0 | 261.9 | 331.4 | 340.1 | 340.1 | 8.9 |
| lms_request_help | 63 | 63 | 0 | 265.3 | 302.2 | 329.1 | 329.1 | 8.9 |
| lms_set_prefs | 63 | 63 | 0 | 274.5 | 376.8 | 391.4 | 391.4 | 8.9 |
| lms_inbox | 63 | 63 | 0 | 279.6 | 372.2 | 383 | 383 | 8.9 |
| ALL | 728 | 632 | 96 | 333.9 | 4059.8 | 4103.5 | 4362.2 | 102.9 |

### Table 2: admin (once, before reset), reset and verification
| RPC | count | ok | errors | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lms_list_profiles | 1 | 1 | 0 | 213.1 | 213.1 | 213.1 | 213.1 |
| lms_admin_export | 1 | 1 | 0 | 227.7 | 227.7 | 227.7 | 227.7 |
| lms_admin_feed | 1 | 1 | 0 | 224.6 | 224.6 | 224.6 | 224.6 |
| lms_admin_reset | 1 | 1 | 0 | 226.1 | 226.1 | 226.1 | 226.1 |

admin export: {"bytes":71857,"profiles":102,"skills":6,"latest":336,"minutesKeys":99,"help":63,"availability":7,"memory":0}
admin feed: {"attempts":126,"help":63,"claimed":64}

### Errors grouped by message (load phase)
| RPC | HTTP | code | message | count |
| --- | --- | --- | --- | --- |
| lms_create_profile | 409 | LMS_HTTP | lms_create_profile: HTTP 409: duplicate key value violates unique constraint "profiles_pkey" | 87 |
| lms_login (claim race) | 400 | LMS_HTTP | lms_login: HTTP 400: That profile is taken or the PIN is wrong | 9 |

### Checks
- persistence and profile flow: 63 of 150 users pass
- claim race (L-05, 10 parallel logins): 1 success, 9 fail, 9 with the expected message, winner re-login true -> PASS
- profile creates succeeded: 63 of 150
- unique profile ids: 63 distinct of 63 created -> PASS
- lms_admin_reset: ok
- after reset: 36 learners, 3 mentors, 0 claimed, 0 load-created profiles still listed -> PASS

VERDICT: FAIL · functional FAIL · p95 4059.8 ms vs budget 1000 ms FAIL · user-flow error calls 87
  - 87 of 150 users failed a step or a persistence check
  - p95 4059.8 ms over the 1000 ms budget (all load-phase calls)

## Summary by size

| Users | Creates ok | Persistence pass | Race | Unique ids | Reset + verify | p95 all calls (ms) | Functional | Latency | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 50 | 50 / 50 | 50 / 50 | PASS | PASS | PASS | 1703.7 | PASS | FAIL | FAIL (latency) |
| 100 | 63 / 100 | 63 / 63 | PASS | PASS | PASS | 1559.7 | FAIL | FAIL | FAIL |
| 150 | 63 / 150 | 63 / 63 | PASS | PASS | PASS | 4059.8 | FAIL | FAIL | FAIL |

## Findings

1. **Profile creation fails at 100 and 150 concurrent users, and not at 50.** The 50-user run had 50 of 50 creates succeed. At 100 and 150 users, 37 and 87 creates returned HTTP 409 `duplicate key value violates unique constraint "profiles_pkey"`. Exactly 63 creates succeeded in each of those runs, and all 63 new ids are in the range `L-37` to `L-99` (63 values). The SQL behind `lms_create_profile` is not in this repo, so the cause is not confirmed. The observed pattern is consistent with id allocation that collides under concurrent inserts and a two-digit id space. Both need checking in the database function before any claim about capacity.
2. **Latency is the other failure.** p95 across all load-phase calls was 1703.7 ms at 50 users, 1559.7 ms at 100 and 4059.8 ms at 150. At 150 users the `lms_create_profile` p95 was 4099.6 ms and the race logins' p95 was 4362.2 ms. The post-login calls were slower than at 50 users: `lms_me` p95 was 1824.8 ms at 150 users (p99 1906.8 ms), and the other post-login calls (persistence login, quiz, marks, help, prefs, inbox) had p95 between 302.2 and 578.1 ms.
3. **Persistence holds for every VU that got through.** 50 / 50, 63 / 63 and 63 / 63 users read back the same profile id, the S1 and S2 scores, one help request and prefs `{visual, zu}`.
4. **The claim race holds.** In every final run, exactly one of the 10 parallel logins won, the other 9 got the expected message, and a re-login with the winning PIN succeeded.
5. **Reset works.** Load-created profiles were removed; the verification found 36 learners, 3 mentors and 0 claimed after every run.

## Limitations

- One client IP. Every request came from one laptop. Rate limits or per-IP throttling at a classroom with many phones behind one Wi-Fi NAT would look different, and so would a room of phones on mobile data.
- Real phones add network latency. The laptop's own round trip was not measured separately, so these latencies are not an estimate of phone latency.
- The Vercel static host is not tested. Only the Supabase RPC layer was exercised, directly, without the web app.
- Supabase free tier limits (connection pool, compute and request quotas) apply and were not measured separately. The 63-create ceiling may be a plan limit, a database-function bug, or both; the data here cannot separate them.
- One run per size for the final set. Repeat runs with the same seed differed: 50 users gave p95 1249.3 ms in the earlier run and 1703.7 ms in the final run; 150 users gave 1713.1 ms and 4059.8 ms. The latency figures carry at least that spread.
- Scores and PINs come from a seeded generator (seed 20261113). Concurrent scheduling is not seeded, so request interleaving differs between runs.
- All accounts are synthetic (`Load NNN`). The test used the demo reset, which clears every claim in the live database. It refuses to start only if `L-05` is already claimed.

## Superseded runs (kept in runs/, git-ignored)

- `runs/_load/2026-11-13T21-03-49-032Z-u050.json`: preflight found 2 claims left from earlier activity; the reset cleared them. Same script logic otherwise.
- `runs/_load/2026-11-13T21-04-33-421Z-u100.json` and `...-04-42-098Z-u150.json`: produced before the uniqueness check was corrected. Their "unique ids" line reads FAIL only because it also required all creates to succeed; distinctness was 63 of 63 in both.

## Reproduce

    node tools/lms/load.mjs --users 50  --seed 20261113
    node tools/lms/load.mjs --users 100 --seed 20261113
    node tools/lms/load.mjs --users 150 --seed 20261113

Each run ends with a reset. Do not run during a live class. Known-answer checks of the harness (fake backend: correct, broken prefs, double claim, reset keeps profiles) are in the session scratchpad, not in the repo.

## Re-runs on 14 Nov 2026, 02:00–02:25 SAST (after two fixes)

Fixes applied to the live database before these runs:
1. **Profile IDs past 99 collided.** `lpad(n, 2)` truncates `100` to `10`, so profile 100 tried to reuse `L-10`. This explains the "exactly 63 creates succeed" result above. IDs now pad to a minimum width only.
2. **Profile creation no longer waits on a lock.** IDs come from a sequence (`lms.learner_seq`, reset to 36 by `lms_admin_reset`). Measured inside the database: one create takes 37 ms, of which bcrypt is 11 ms.

| Run (150 users) | Creates ok | Full flow + persistence ok | Claim race | p50 all calls | p95 all calls | Calls/s |
|---|---|---|---|---|---|---|
| Burst, no cap, 8 s client timeout | 0 / 150 | 0 / 150 | 1 win, 9 refused | 8007 ms | 8026 ms | 10 |
| Arrivals over 30 s, no cap | 114 / 150 | 92 / 150 | PASS | 396 ms | 8001 ms | 29.1 |
| Burst, 30 s client timeout | 48 / 150 | 47 / 150 | PASS | 2125 ms | 10558 ms | 15.7 |
| Burst, at most 24 requests in flight (`LOAD_MAX_INFLIGHT=24`) | 146 / 150 | 144 / 150 | PASS | 3799 ms* | 12628 ms* | 22.3 |

\* With the cap, the timings include time spent queued on this laptop, so they overstate server latency.

**Where the failures come from.** Supabase edge logs for the window 00:10Z onward show **156 `lms_create_profile` requests, all HTTP 200**. The harness sent about 450 across those runs. The rest never reached Supabase: one Windows laptop cannot open 150 TLS connections at the same instant. The errors are `network error` or `timed out` on the client, with no 429 and no 5xx.

**What this means for the room.** Each phone holds its own connection, so the realistic test is the capped one: 146 of 150 accounts were created, and 144 of 150 completed the whole flow, including signing out, signing back in and seeing the same data. The project sustained about 22 calls per second from one laptop in South Africa to eu-west-2. Persistence, unique IDs, the claim race and the clean reset passed in every run.

**Not measured:** 150 real phones on venue Wi-Fi; Vercel static hosting; performance after the free-tier project has been idle and paused.

**Remaining risk:** a 4–6 digit PIN has no lockout. That is acceptable with synthetic data only.
