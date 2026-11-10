# Gate 01 executable boundary spike

**Status:** Limited tested proof-of-contract; **NOT** production authentication, permission middleware, secure parsing or a working multi-agent executor.

Run from repository root:

```bash
node --test tools/gate01/goal-boundary.test.mjs
```

The module `assessGoalBoundary(request, trusted)` accepts a **server-attested trusted context** (which this spike does **not** authenticate or create). It checks request shape, missing goal, forged top-level actor/approval fields, connector and output registry membership, demo-disabled destructive effects, and whether remote sends or shared writes need human approval. No file bytes are processed; `uploadsVerified` is an externally attested boolean, not a scanner. No API calls, OAuth tokens, messages, grade writes or remote effects occur.

**Security limits:**
- This is not a replacement for server-side authentication, cryptographic approval, tenant isolation, sandboxed file parsing, malicious-document inspection, signed source provenance, replay prevention, real write/read-back verification, or POPIA review.
- It does not prove source contents are free from prompt injection or that incoming connector data belongs to the actor. It only verifies registrations provided by the trusted server parameter.
- It does not perform natural-language intent parsing or validate output correctness; those need G02/G09.
- An approved email or grade change is **never** executed by this tool.

**Tests:** 16 deterministic checks passed in a local Node 22.16.0 run on 2026-11-10. See [test receipt](../../docs/checks/G01-BOUNDARY-TEST-20261110.md). GitHub Actions has now reported a **successful** run; [CI run 42839749139](https://github.com/LethaboMH14/T.A.C.E/actions/runs/42839749139). This verifies the isolated unit suite, not actual identity/OAuth/permissions.

Read [G01 final requirements](../../docs/gates/GATE-01-FINAL-SPECIFICATION.md), [G01 threat model](../../docs/gates/GATE-01-SECURITY-THREAT-MODEL.md), [G02 research charter](../../docs/gates/GATE-02-INTENT-AND-CLARIFICATION-RESEARCH.md).
