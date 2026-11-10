# G01 boundary admission test evidence — 2026-11-10

**Scope:** Isolated local JavaScript contract-spike test only. **Result:** 16 passing, 0 failing; duration ~118 ms. **Environment:** Node.js v22.16.0; no backend, cloud, provider, OAuth or real tenant credentials.

**Command:** `node --test goal-boundary.test.mjs` in the local test directory containing the same authored modules later placed in `tools/gate01`.

**Covered assertions:**
1. Simple goal with no file admitted for draft planning.
2. Empty goal awaits input.
3. Client-supplied tenant/approval rejected.
4. Missing server-attested identity rejected.
5. Missing connector blocked.
6. Registered mock connector admitted.
7. Unknown output format blocked.
8. Recognized but unregistered video generator blocked.
9. External email send routed to approval state.
10. Shared grade update routed to approval.
11. Destructive effect disallowed in demo.
12. Upload without prior server-side checks blocked.
13. Attested upload admitted.
14. Negative budget rejected.
15. Unknown effect class rejected.
16. Excess source declarations rejected.

**Interpretation:** A passing *local unit test* validates these explicit contract branches only. It **does not** prove cryptographically verified identity, child-data privacy compliance, cross-tenant access isolation, actual file safety, agentic correctness, secure email/calendar behavior, or successful deployment. Those are outstanding integration/security gates.

**Follow-up:** Confirm the exact committed files against CI workflow run; build server identity middleware, authorized app connections and approval fingerprint verification before making real side effects.

References:
- [Boundary code](../../tools/gate01/goal-boundary.mjs)
- [Tests](../../tools/gate01/goal-boundary.test.mjs)
- [Security threat model](../gates/GATE-01-SECURITY-THREAT-MODEL.md)


## Verified GitHub Actions regression

Two GitHub Actions runs on 10 November 2026 **completed successfully** for the isolated `tools/gate01/goal-boundary.test.mjs` test job:

- [Run 42839741035](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42839741035), head `4a8e3db1828c6cd16b1a0427c25aab68629db70c`.
- [Run 42839749139](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42839749139), head `6dfcdd7ca2dfdb9cf59208fd682bc0dd87a14b3d`.

The workflow conclusion is **success**, independently reported by GitHub, not just a local test claim. It still proves only these 16 contract branches, not production authentication, POPIA compliance or a working agent execution chain.
