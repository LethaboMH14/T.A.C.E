# Wave 1 review — engine core (2026-11-13)

**Reviewer:** independent code-review agent (Sonnet, read-only). Saved by the lead, because the reviewer role has no write access.
**Verdict:** no P0. Two P1s, both fixed the same day.
**Tests at review time:** `tests/unit` 59 pass / 0 fail; `tools/**` 277 pass / 0 fail. Windows path-traversal probes (drive-relative, UNC, backslash `..`) all stayed inside the base or threw `PATH_ESCAPE`.

| Sev | Finding | Status |
|---|---|---|
| P1 | `latestByKind` returns the last-written file of a kind, so `.md` beat `.json` and the hand-off named the wrong file and digest | **Fixed:** `engine/run.mjs` `primaryOf()` picks the data file (.json > .csv > .md) |
| P1 | No `.gitattributes` while `core.autocrlf=true`: a Windows clone turns fixtures into CRLF and changes the digests | **Fixed:** `.gitattributes` with `* text=auto eol=lf` |
| P2 | `TASK_COMPLETED` lacked the artifact list promised in contracts | **Fixed:** `engine/graph.mjs` adds `artifacts: [name@vN]` |
| P2 | A retry after a worker wrote a file and then threw leaves an orphan version without an `ARTIFACT_WRITTEN` event | Open (workers are deterministic; documented limit) |
| P2 | Ledger swallows subscriber errors; a subscriber that appends during dispatch reorders what others see | Open (only one subscriber per run) |
| P2 | Formula-guard apostrophe is not stripped on parse; `NaN` is written as text | Open (no such cells in the fixtures) |
| P2 | `write` does not validate `kind`; `inputs[].version` is a string for sources but typed as a number | Open (typing note) |
| P2 | `runGraph({only})` treats out-of-scope tasks as completed even if they failed earlier; the planner never falls back to a second producer | Open (re-runs only start after a completed first pass) |
| P3 | Lenient CSV quirks, `maxAttempts: NaN`, scenarios file written even when invalid, shallow freeze of JSON sources | Open |

Weak tests named by the reviewer: graph event order is tested without jitter; no test for `READBACK_MISMATCH` or a shared-kind `latestByKind`.
