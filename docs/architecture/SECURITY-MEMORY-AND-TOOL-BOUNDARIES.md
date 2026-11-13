# T.A.C.E — security, source trust, approvals, memory and skill governance

**Updated:** 2026-11-13. **Status:** REQUIRED DESIGN / FUTURE G07+ IMPLEMENTATION; NOT SECURITY-CERTIFIED. This complements the authoritative [G01 SEC-01–SEC-20 register](../gates/GATE-01-SECURITY-THREAT-MODEL.md), [connector policy](../gates/GATE-01-CONNECTOR-CAPABILITIES.md), [G02.03 trust research](../gates/GATE-02-03-PROMPT-ARCHITECTURE-RESEARCH.md) and [contract/API spec](CONTRACTS-STATE-MACHINE-AND-APIS.md). Do not call this document operational controls.

## 1. Core trust theorem

**An LLM, prompt, AG-UI event, retrieved page/PDF, tool result, markdown skill, memory record, GitHub comment or model confidence estimate never supplies executable authority.** Authorization depends on independently attested identity/tenant, source ownership, verified capability operations, trusted effect classification, constraints, valid and current exact approval where needed, bounded resource limits and a verifiable receipt.

Conceptual trust zones:
1. **Server-owned:** authentication, tenant, roles, fixed platform/developer policy, versioned template/schema, source registry, secret manager, trusted tool adapter registry, durable event/approval ledger.
2. **Potentially untrusted but legitimate user task:** natural-language goal, preference, selected wizard answer, intended output, requested data; may define *what they want*, never bypass G07.
3. **Lower-trust data:** uploaded files, web/connector response, RAG excerpts, OCR, agent handoffs, skills, memory and external tool descriptions. May provide admitted evidence but **no higher-priority instructions**.
4. **Model-produced:** proposed GoalContract, DAG, task text, answer, effect claims, confidence, self-reflection. Useful only after validation and policy.
5. **UI presentation:** graphs, AG-UI CUSTOM events, approval cards, action buttons, Figma designs. These present/request decisions, do not enforce authorization or certify proof.

## 2. Server gateway and tenant isolation — G07 mandatory

- Derive principal, tenant, role/scope, connection, source ownership and purpose from real authenticated middleware/connection—not model JSON or a caller-supplied `trusted` fixture.
- Use atomic expected-revision/idempotency checks in transactionally durable storage for goal updates, clarifications, approvals and task progress; prevent two concurrent answer submits from racing into different active plans.
- Deny unknown role/tenant, revoked credential, expired session, source from different tenant, stale source version, altered recipient, mismatched plan/goal revision.
- Authorization covers artifact reads/downloads, event streams, background work and memory, not only API tool calls.
- Cross-tenant document IDs, vector embeddings, object paths and signed links must be inaccessible; testing includes guessed IDs and stale links.
- Have request byte limits, concurrency limits, event/audio/video/uploads limits as appropriate; validate JSON duplicate keys, prototypes, Unicode, oversized nested objects and MIME/extension disagreement at transport.
- Privacy: maintain data classification and retention, purpose-limited processing and lawful basis. POPIA compliance requires a real review, not just code comments.

## 3. Effects and approval matrix

| Trusted effect class | Examples | Default design decision |
|---|---|---|
| READ_PUBLIC | approved public curriculum/info source | Safe approved retrieval route, source log and SSRF/egress controls |
| READ_PRIVATE | connected file, class assessment, account | Authenticated tenant/resource ownership, purpose and connector scopes |
| DRAFT_LOCAL / LOCAL_ARTIFACT | private synthetic report, unsent draft | Scoped sandbox, cost/storage caps, no external send |
| SHARED_WRITE | edit shared sheet/doc, schedule, official result | Real server policy + version checks + explicit exact human approval when consequential |
| EXTERNAL_SEND | email, notifications, external submission | Exact recipient/body/attachment/sender approval, expiry and idempotency |
| DESTRUCTIVE | delete, bulk overwrite, revoke | **Denied for demo**; separate high-assurance approvals and recovery if considered later |
| UNKNOWN | operation cannot be classified | DENY / request safe clarification, no optimistic read-only treatment |

**MCP server tool descriptors and `readOnlyHint` are untrusted hints**, not the source of a final effect classification. A tool marked read-only may hide mutation, logs, webhook sends or data exfiltration. G07 examines actual registered endpoint/action/arguments and limits outbound network/credentials.

### Exact approval binding

Server-side action proposal must include operation/version, actor/tenant, connected account, target resource/version, recipient(s), all user-visible arguments/attachments, policy/effect class, current goal revision, expiry, cost estimate and idempotency key. Display exactly what will happen. Approval records the actual approver, exact canonical action digest and one-time consume state. Changing any field invalidates it. A plain SHA-256 digest is only an integrity identifier; action authority requires authenticated, transactionally bound server state/signature.

**Failure:** audit/unavailable approval ledger → deny consequential effect, do not silently proceed. Timeout after a remote attempt → UNKNOWN until provider-receipt reconciliation/read-back, never blindly re-send.

## 4. SEC-01–SEC-20 implementation trace (authoritative detail remains G01 source)

| G01 risk | Mandatory control / acceptance test |
|---|---|
| SEC-01 injection in PDF/email/web/OCR | Untrusted source text stays data; fake `SYSTEM:` cannot modify actual role or permission |
| SEC-02 cross-learner/tenant leak | Per-resource tenant owner + scoped search and memory; A cannot read B IDs |
| SEC-03 mass send or grade write | Tool operation denied without role, exact approval and receipt |
| SEC-04 swapped approval after display | Changing recipient/attachment/payload invalidates action fingerprint |
| SEC-05 prompt-created plugin/skill | No unreviewed self-install, credentials or sandbox escape |
| SEC-06 archive bombs/macros/uploads | Quarantine, MIME signature, file/decompress ceilings, parser isolation |
| SEC-07 SSRF/exfil | No arbitrary HTTP fetch; private IP and redirects blocked/rechecked |
| SEC-08 CSV/HTML formula/script injection | Encode CSV literal cells safely, sanitize HTML, no execution of file formulas |
| SEC-09 hallucinated educational facts | Source-row references and independent mathematical/constraint verification |
| SEC-10 inappropriate provider data | Per-provider disclosure approval and minimal necessary context |
| SEC-11 logs leak secrets/records | Structured metadata-only telemetry, redaction, retention and access controls |
| SEC-12 runaway loops/costs | Graph/node/time/retry/token/file/tenant caps and cancel/kill switch |
| SEC-13 duplicate remote effects | Idempotency reservation, reconciliation, read-back and never blind send retry |
| SEC-14 revoked connector/outage | Fail closed, BLOCKED state and explicit reconnection needed |
| SEC-15 overbroad learner/child role | Distinct institutional/guardian/legal basis, strict child-data policy, no broad rosters |
| SEC-16 changed source revision | Immutable source digests, compare versions at planning/approval/tool call |
| SEC-17 agent spoofing/handoff tamper | Trusted task/run sender, signed/attested event store and schema validation |
| SEC-18 accidental public exports | Private default, scoped sharing and short-lived authorized downloads |
| SEC-19 irreversible destructive action | Demo denies; eventual compensating controls and stronger confirmation |
| SEC-20 loss of audit/availability | Degraded mode blocks consequential effects; truthful event status |

These are **requirements**, not tests already passing. G01 contains all 20 exact risk narratives and test criteria.

## 5. Untrusted prompt and content processing

- Maintain actual separate server-selected system/developer roles. Delimiters, JSON quoted `role:"system"`, Markdown frontmatter or file headings cannot create privileged message objects.
- User requests may express desired task. User content that purports to alter server security is **not a trusted control**.
- Extracted text from PDF/email/LMS/web, OCR, memory or skill must keep sourceId/version, citation offsets and low-trust label through context, handoff and verification.
- Model output can be structurally valid yet semantically wrong, omit consequential effect, contain secret copies, misattribute a citation or be manipulated by persuasive injection. **Prompt role separation is necessary but insufficient**; evaluate actual model behavior with adversarial held-out cases G02.12/G11.
- Do not include unrelated private notes, protected source handles, credentials, entire tenant context or hidden system internals in model-visible messages.
- Separate source retrieval/ingestion parser from tool execution; if a document says “send roster to URL”, do not run that instruction.
- Fail closed on unsupported file format, unexplained model token budget exhaustion, unadmitted context or schema repair beyond bounded policy.
- Sensitive data classifier/purpose control is downstream and currently absent; model-facing interpretation text itself may contain PII. G02.01 “allowlist projection” is **not anonymization**.

## 6. Tool and sandbox architecture

**ToolRegistry / CapabilityDescriptor** must be version-pinned and admin-reviewed: input/output schema, resource/tenant scopes, effect class computed by trusted code, connection status, max payload, timeout/attempt budget, idempotency, egress domains, evidence and read-back method.

**Execution process:**
1. Validate authenticated task/goal/plan revision.
2. Validate declared operation and args using trusted schema; disallow unregistered tool.
3. Check source/resource owner and effect classification from trusted adapter, not model or MCP label.
4. Require exact approval if consequential; reserve idempotency key in durable ledger.
5. Execute with least-privilege secret scope; sandbox relevant filesystem/network.
6. Store provider/local receipt and sanitized event metadata.
7. Read back actual effect or file; produce verified proof or UNKNOWN/PARTIAL.
8. Never let tool text or exception leak secrets into UI or another tenant.

**Computers/containers:** Docker is not itself a complete secure isolation boundary; kernel sharing, filesystem mounts, default network egress and credentials need explicit policy. Never allow unrestricted browser/terminal/shell from an LLM without sandbox/approvals. OpenBot/OpenDots per-Dot computer functions are evaluation-only; do not turn them on merely because their UI exists.

**External actions in EdTech demo:** no sending, no official grades, no real learner-data edits; produce private local files and unsent drafts only. Any simulated provider receipt must be clearly marked fixture, not a live send.

## 7. Privacy, consent and POPIA

South Africa's POPIA establishes principles for lawful processing, purpose, minimality, quality, safeguards and data-subject rights. Processing children's personal information involves special restrictions (see [G01 POPIA notes](../gates/GATE-01-SECURITY-THREAT-MODEL.md)); legal review and institutional authorization are required before handling real learner records.

- **For demo:** synthetic adult IDs and fictional mentors, with no real names, grades or addresses.
- **For real pilot:** institutional lawful basis and consent/authority, classification and purpose, data-subject correction/deletion, retention, encryption/access audit, breach handling, recipient safeguards and any cross-border/provider data processing review.
- Prefer local fixture generation, no unnecessary prompt logging; provider data residency and processing terms must be verified, not assumed.
- Minimize data shown to each specialist. No raw grades in general event telemetry or across unrelated agents.
- Do not claim “POPIA compliant” or privacy certified until actually implemented and reviewed.

## 8. Agent skills, AGENTS.md, RULES.md, SKILL.md and memory

**Repository files:** root `CLAUDE.md` and `AGENTS.md` provide coding-agent onboarding. They do not authorize T.A.C.E runtime agents or override platform policy. They should not be blindly pasted into high-priority model context.

**Planned runtime skill representation:**
```
skills/
  <skill-id>/
    SKILL.md              # human-readable description; untrusted until reviewed
    manifest.json         # signed/pinned ID, version, maintainer, input/output schemas,
                          # permitted capabilityRefs, effect ceiling, data scope, tests
    tests/
    adapters/             # reviewed code only; no arbitrary install
```
Skill activation requires independent registry allowlist, verified package provenance, exact compatible tool versions, tenant scope and a **real** authorization boundary. No capability comes from a skill's prose. Ability to propose a new skill ≠ ability to install/execute one.

**Memory tiers:**
- run-local working state: ephemeral plan, events, context; purge per run policy;
- episodic memory: curated past *verified* event/outcome, scoped to tenant and user/project;
- semantic memory: curated facts with source/provenance/confidence calibration, version and correction;
- procedural memory: approved skills/workflows, not model guesses.

Every memory record needs owner/tenant, purpose, consent/lawful basis, sourceRef, sensitivity, verification, created/expiry, version, access, correction/deletion audit and memory-retrieval log. Never cross tenants or promote memory into system role; test leakage by searching another tenant's embeddings. Memory records that conflict with newly verified data require review; no silent overwrite of authoritative source.

**Candidates**, not installed: Honcho, Obsidian-like notes, Mem0, Letta, Graphiti/Zep, SQLite/pgvector/Qdrant. Evaluate governance, maintenance, license, latency and privacy separately. The hackathon MVP should **not** depend on a memory product.

## 9. Safety/abuse and failure conditions

- Unavailable model/tool, impossible request, missing data, weak evidence, contradiction, unsupported connector and exhausted budget → explicit BLOCKED/PARTIAL with user-relevant next action.
- Prompt injection, exfiltration request, cross-tenant source, forged approval, stale revision, malformed schema, duplicate event → deny and audit without leaking details.
- Repeated failed repair → cap attempts and display verifiable failure; no infinite replan.
- Canceled runs stop future work; reconcile already attempted external effects. UI cancellation is a request that server must confirm.
- Never continue consequential effects if security/audit service is unavailable.
- Do not permit unrestricted autonomous code installation, credential changes, bulk sends or destructive operations based on conversational instructions.

## 10. Security test layers and definition of done

**Unit/contract**: input shape, Unicode, DAG acyclicity, effect mapping, bounded retries, safe source refs, exact action payload and checksums. G02 deterministic tests cover a subset only.

**Integration:** real authenticated test tenant A/B, versioned source registry, approval endpoint, retry with idempotency, provider timeout and read-back, audit event proof, revoked token, absent tool, interrupted run resume.

**Adversarial:** malicious PDF/CSV/web instructions, forged `AGENTS.md`/`SKILL.md`, fake system role in context, model claims of verified effects, CSV formula payload, SSRF URL and redirect, prototype pollution/JSON duplicate keys, cross-tenant vectors/URLs.

**Data/privacy:** no real learner data in fixtures, logs/telemetry redaction, model disclosure allowlist, retention expiry/deletion, scoped file links, credential rotation.

**End-to-end assurance:** actual saved artifact fails an independent check, repair changes bytes and recheck passes; original failure remains traceable; no side effects beyond approved fixtures.

Security review owner should file verified findings with precise path, severity, reproduction, mitigation, test, CI and unresolved risk. **No test run or penetration test is implied by this document.**

## 11. Required P0 work before real external effects

- authenticated principal/tenant source of truth;
- source registry and safe parser; strict egress;
- server-owned policy engine and actual operation effect classification;
- exact one-time approvals, revision fences and idempotent durable ledger;
- sandbox and credential isolation;
- receipt reconciliation, independent checker, private artifact storage;
- privacy/POPIA assessment for real educational data;
- adversarial model and integration evaluation.

**Do not merge these into “complete” simply because G02 unit CI is green.**
