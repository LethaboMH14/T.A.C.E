# Wave 2 review + red team — workers, reviewer, repair, run loop (2026-11-13)

**Reviewer:** independent code-review agent (Sonnet, read-only). Saved by the lead, because the reviewer role cannot write files.
**Verdict:** the demo is real. Nothing is hardcoded green. No P0.

**Red-team evidence (reviewer's own harness):**
- An injected analyst bug (thresholds +5) made the Reviewer fail C01/C02/C09; repair ran rounds 1–2; the run ended PARTIAL.
- A throwing scheduler gave PARTIAL, not VERIFIED.
- The Reviewer imports only contracts, csv, rules and node built-ins, and re-opens every file through `store.read`, which re-hashes it.
- Faults fire only via the scenario `inject` flag in phase `initial`. Repair writes v2 with its own code; it does not just switch the flag off.
- Repaired summary v2 digest = baseline v1 digest. v1 files are kept. Drafts re-run from schedule v2.
- Determinism: two runs each of four scenarios gave identical manifest artifact digests.
- An independent recompute of at-risk / priority / boundary / missing scores matches for all 36 learners.

| Sev | Finding | Status |
|---|---|---|
| P1 | Re-using a `--run-id` appends to the old run (mixed events, v3→v4) | **Fixed:** `runMission` refuses a non-empty run folder (`RUN_EXISTS`, CLI exit 4) |
| P1 | PARTIAL runs carried no reason; 0/0 checks reported as passed | **Fixed:** reasons from failed steps, unfixable repairs, budget exhaustion and unsupported deliverables; 0 checks → PARTIAL with reason |
| P2 | `applyRepair` uncaught: a file tampered mid-run crashed the run without a manifest | **Fixed:** try/catch → recorded as not possible; UNKNOWN checks are never routed to repair |
| P2 | Repair `skillStats` did not trim, unlike the other modules | **Fixed** |
| P2 | Repair slots were not aligned to whole hours | **Fixed:** `Math.ceil(start/60)*60`, same as the scheduler |
| P2 | Summary-repair `.md` v2 had no `ARTIFACT_WRITTEN` event | **Fixed:** `alsoWritten` emitted |
| P2 | Ledger and manifest did not record the planted fault | **Fixed:** `RUN_STARTED.plantedFault` and `manifest.plantedFault`; Mission Studio shows it under the title |
| P2 | Repair re-rendered markdown claiming "verified JSON" when nothing had changed | **Fixed:** returns not-possible unless only the text check failed |
| P2 | Scalar summary mismatches (e.g. `at_risk_count`) are never repaired | Open; ends PARTIAL honestly |
| P3 | Faults on a target with nothing to break pass silently; C11 ignores mentor drafts; C08 does not check priority skill; reviewer at-risk logic is close to the analyst's (independent code, shared spec); no unit tests for repair/run (covered by E2E); score range not validated | Open |
