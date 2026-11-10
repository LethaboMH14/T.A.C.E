# G01.24 — Security, privacy, identity and agent authority architecture

**Date:** 2026-11-10. **Design:** required / scope-defined. **Implementation:** NOT VERIFIED as present in the T.A.C.E runtime.  
**Primary sources:** OWASP Top 10 for LLM Applications 2025, OWASP AI Agent Security Cheat Sheet, South Africa POPIA Act 4 of 2013, NIST AI RMF GenAI Profile. Treat this as engineering guidance and get qualified privacy/security review before handling real learners' data.

## 1. Security first principle

**No permission comes from a prompt, model output, retrieved document, agent message or diagram edit.** All execution rights are independently enforced using authenticated user identity, tenant/role policy, tool capabilities, source/resource scopes and, for consequential effects, a fresh human approval bound to the exact action. Any missing element fails closed.

Security boundaries occur **before ingestion**, **between source and agent reasoning**, **between agents**, **before tool execution**, **at approval**, **before sending/storing data**, and **before declaring completion**.

## 2. Trust boundary diagram

~~~mermaid
flowchart TD
    U["User / API / upload: potentially untrusted"] --> A["Gateway: authentication, rate, size, MIME, tenant, session"]
    A --> Q["Quarantine and safe parser / extraction"]
    X["Untrusted emails / web / LMS / app responses"] --> C["Data-only context compiler; source labels and owner scope"]
    Q --> C
    C --> M["Model planner proposes a plan (NO authority)"]
    M --> V["Deterministic policy check: schema, capability, tenant, budgets, allowed side effects"]
    V --> R{"Permitted without human approval?"}
    R -->|"Read / local draft"| T["Least-privileged tool adapter"]
    R -->|"External send, grade or shared update"| H["Exact action proposal; authorized human approval"]
    H --> S["Immutable action fingerprint / expiry and reauthorization"]
    S --> T
    T --> E["Append-only effect receipt + read-back / reconciler"]
    E --> J["Independent output verifier and safe deliverable"]
    M --> L["Agent handoff ledger: scoped, typed, signed or authenticated"]
    L --> V
~~~

This is a **required architecture**, not an assertion that OAuth, isolation, sandboxing, policy engine or append-only audit already runs in T.A.C.E.

## 3. Threat register: risk -> design rule -> verification test

| ID | Threat / failure | Mandatory architecture control | Negative test to pass before production |
| --- | --- | --- | --- |
| SEC-01 | Direct/indirect prompt injection in PDF, email, website or OCR | External content is **data**, never instructions/authority; source labels; no tool policy from RAG | PDF text that asks to send roster outside system is ignored for tool decisions |
| SEC-02 | Cross-learner or cross-institution data leak | Server-derived tenant/owner, scoped retrieval + memory, strict resource filters, no user-selected tenant override | Owner A cannot query a B document via ID or embedding |
| SEC-03 | Agent can send mass mail or change grades | Deny by default; exact per-operation allowlist, no wildcard tool capability; real approver | Send/grade attempt without approval gets denied and no write receipt |
| SEC-04 | Approval swapped after human sees it (TOCTOU) | Canonical action payload, hash, recipient/resource/version, purpose, expiry, approver identity bound to execution | Change recipient or attachment after approval -> old approval invalid |
| SEC-05 | New plugin expands privileges or executes untrusted code | Registry, verified publisher, pinned version, sandbox, signed package/provenance, human install | Prompt-created skill cannot self-install or mint credentials |
| SEC-06 | Malicious or oversized upload, archive bombs, macros, embedded scripts | File-signature sniff, extension+MIME comparison, file/decompressed limits, quarantine, parser isolation, no macros, malware scanning where available | Nested/compressed malicious sample rejected or safely bounded |
| SEC-07 | External URLs cause SSRF or data exfiltration | Default no arbitrary fetch/egress, domain allowlist, DNS/IP resolution checks, prohibit internal/metadata addresses, redirects rechecked | Embedded internal-network URL not fetched |
| SEC-08 | Spreadsheet formula injection, document HTML/script injection | Generate safe CSV cell serialization, escape leading spreadsheet formulas from untrusted data; sanitize HTML; validate output | Input starting with formula symbols treated as literal content |
| SEC-09 | AI output hallucination treated as verified education fact | Source-grounded claims, deterministic math/constraint checks, independent review and unresolved status | Wrong worksheet answer rejected; citation mismatch flagged |
| SEC-10 | Model/connector gets inappropriate data | Data-classification rules, minimum necessary context, provider and region disclosure, secrets redacted | Private learner identifiers never go to unapproved model |
| SEC-11 | Hidden logs leak documents or API keys | Structured metadata-only audit, encrypt protected storage, redact tokens, minimize retention, access controls | No raw secret/learner content in traced events |
| SEC-12 | Unbounded agent loop, costs, file growth or API quota | Per-goal budgets, node/action/retry/timeout caps, per-tenant rate limit, circuit breaker and kill switch | Cyclic graph or infinite retry rejected deterministically |
| SEC-13 | Duplicate writes on retry or network uncertainty | Idempotency keys, reconciliation/read-back after ambiguous timeout, compensating actions where possible | Same logical message or event written at most once |
| SEC-14 | Tool/adaptor outage or revoked OAuth during work | Fail closed, isolate affected nodes, request reconnection; no hallucinated success | Revoked token leaves unperformed action pending |
| SEC-15 | Overbroad role/content access by a child learner | Distinct role-to-capability matrix; parental/school-lawful-basis policy for child personal data, institutional authorization | Learner role cannot read class roster, grade all peers or approve mail |
| SEC-16 | Revision changes after evidence review | Immutable source digest, version fencing at read, approve and write | Stale source revision causes pause/recheck |
| SEC-17 | Agent-to-agent spoofing or unauthorized handoff | Authenticated sender, typed task IDs, role/capability policy and event chain, replay detection | Forged worker result cannot confer authority |
| SEC-18 | Unsafe file sharing and accidental PII publication | Private-by-default files, explicit sharing targets, short-lived signed links if used, download authorization | Exports cannot become public by default |
| SEC-19 | Destructive action with no rollback | Safe preview/dry-run, scoped approval, compensating steps; irreversible effects require especially strong confirmation | Bulk-delete/grade-upload refused without explicit policy and exact confirmation |
| SEC-20 | Availability, reliability and audit failures | Separate trust policy and telemetry availability; if critical audit service fails, consequential effects are blocked | Audit unavailable prevents a grade/share/send and records degraded run |

## 4. Effect-class / decision table

| Effect class | Examples | Default |
| --- | --- | --- |
| READ_PUBLIC | official curriculum, public programme page | Allow only through safe approved retrieval with source log and network policy |
| READ_PRIVATE | user file, connected sheet, learner record | Require authenticated owner/tenant, purpose and connector scopes |
| DRAFT_LOCAL | analysis and new local documents from already approved data | Allowed subject to content security and cost limits; no sending |
| WRITE_LOCAL | store new work in private user workspace | Scoped storage, idempotency, read-back |
| WRITE_SHARED | alter grade sheet, LMS content, shared docs or schedule | Fresh human approval of exact resource/version/payload |
| EXTERNAL_SEND | email, Teams message, invitation, submission | Fresh approval, exact recipient list and body/attachment fingerprint |
| DESTRUCTIVE | delete, revoke, bulk overwrite | Deny in demo; production requires a separately authorized high-assurance operation |

The model's declaration of "high confidence" has **no effect** on this permission classification.

## 5. POPIA and child personal data safeguards

South Africa's Protection of Personal Information Act 4 of 2013 covers lawful processing, processing limitation, purpose specification, information quality, openness, security safeguards and data-subject rights. **Sections 19–22** require appropriate safeguards and breach-handling obligations. **Sections 34–35** restrict processing personal information concerning children subject to specified authorizations or exceptions. A user instruction alone is **not** proof of the required lawful basis or competent person's consent.

For the competition **use fully synthetic records only**. A later pilot should document who is the responsible party and operator, lawful processing basis, notices and retention, age-related authorisations where applicable, security controls and contracts, data-subject access/deletion, retention and cross-border transfer assessments. No statement here claims compliance or that all learner data can be processed automatically.

Relevant primary law: https://www.justice.gov.za/legislation/acts/2013-004.pdf
Regulator guidance: https://inforegulator.org.za/guidance-notes/

## 6. Failure modes and safe output semantics

A run has explicit possible outcomes: COMPLETED_VERIFIED, COMPLETED_WITH_LIMITATIONS, AWAITING_INPUT, AWAITING_APPROVAL, BLOCKED_POLICY, BLOCKED_CAPABILITY, FAILED_VALIDATION, CANCELLED, and FAILED_RUNTIME. **COMPLETED_VERIFIED requires actual artifact/side-effect evidence**, not model-written claims.

Return exact verification evidence: file path/size/hash and read-back, tool name/version, result resource ID and timestamp, source locator/revision, deterministic checks, independent reviewer verdict, approval reference when relevant. All receipts should redact secrets and protect learner data.

## 7. Implementation assignment and critical path

**Immediately for G01:** lock this threat model, authority matrix, privacy boundary, negative test contracts and no-real-records demo policy.  
**G02/G03:** untrusted-instruction partitioning, explicit source/adversarial metadata, context trust labels; prompt engineering never authorizes actions.  
**G04/G06:** agent/capability registry and authenticated scoped agent handoffs.  
**G05:** finite graph, cancel/stop, budgets and version fencing.  
**G07 P0:** actual authorization middleware, OAuth scopes, signed/immutable approvals, file admission, safe adapters and idempotent writes.  
**G08:** tenant-scoped encrypted/expiring memory.  
**G09:** factual/formula and output checks; review provenance.  
**G10:** approval UX shows **real immutable actions**, not a natural-language paraphrase.  
**G11/G12:** automated attack suite, logging/privacy review, live sandbox verification, and deployment block when any P0 check fails.

**No claim that these controls are implemented by merely writing this document. Production/institutional integration blocked until corresponding tests pass.**

## Sources

- https://genai.owasp.org/llm-top-10/
- https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html
- https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- https://www.justice.gov.za/legislation/acts/2013-004.pdf
- https://inforegulator.org.za/guidance-notes/
