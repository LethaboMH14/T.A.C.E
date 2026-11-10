# Gate 01 — App and Tool Connector Policy (v0.1)

**Status:** PROPOSED design only, not an operational T.A.C.E integration. **Date:** 2026-11-10. **KAIRO excluded.**

## Principle

A user's prompt may ask T.A.C.E to work with Excel, Word, email, Google apps, an academy learning management system or a generic API. A service named in a prompt is NOT automatically connected. The tool registry must report actual operations, identity, authenticated permission, costs, constraints and proofs.

## Capability contract

Every adapter must declare:
- stable tool ID/version and operation schemas;
- effect class: READ, DRAFT, LOCAL_WRITE, REMOTE_WRITE, EXTERNAL_SEND;
- OAuth/service identity, tenant, per-operation scopes and permission gates;
- allowed file/resource kinds, data classification and retention;
- timeout, quota, cost, retries, idempotency and abort behavior;
- status: CONNECTED, AVAILABLE_NOT_CONNECTED, SIMULATED_FIXTURE, UNSUPPORTED;
- verification: saved resource ID, read-back, checksums, or exact provider receipt;
- negative tests for revoked authorization, stale source and duplicate writes.

A proposed new skill may be written and tested in a sandbox, but it must not install arbitrary untrusted code, grant itself rights or acquire credentials silently. Treat retrieved text as untrusted data, never as the authority to expand tool privileges.

## Candidate connectors — NOT claims about Melsoft Academy's stack

| Target | What could be done if configured | Important boundary | Vendor evidence |
| --- | --- | --- | --- |
| Microsoft Excel / OneDrive / SharePoint | read and write approved workbooks, tables and ranges | permissions, resource version and read-back required | https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0 |
| Microsoft Word / OneDrive | create and store real DOCX files; read allowed documents | never overwrite shared documents without approval | Microsoft Graph Drive/Files auth to be verified |
| Microsoft Outlook | read approved mailbox metadata and prepare or send mail | draft != send; review exact addressee/content | Microsoft Graph permissions to be verified |
| Gmail | create draft and send explicitly approved messages | send is separate, higher-impact operation | https://developers.google.com/workspace/gmail/api/guides/sending |
| Google Docs, Sheets, Drive | author, update, store and inspect data and documents | least-privilege OAuth and write receipts | Google Workspace APIs |
| Google Classroom | read courses/coursework, create materials when authorized | changes to learner coursework/grades require teacher-controlled gate | https://developers.google.com/workspace/classroom/reference/rest |
| Moodle (or another configured LMS) | read permitted course content and execute enabled web-service functions | admin must enable and permit exact functions | https://docs.moodle.org/dev/Web_services |
| Calendar and scheduling | discover authorized availability and prepare or create sessions | no invited attendees until approved | provider-specific API scopes |
| Institutional/custom API | provide capability via typed OpenAPI/MCP-style adapter | no assumed connectivity or secrets | site-specific contract required |
| Local file tools | parse and generate CSV, XLSX, DOCX, PDF, PPTX and diagram source where supported | formats must open and pass validation | implementation to build |

**Melsoft Academy software:** no verified public inventory establishes which particular email suite, LMS, CRM or scheduling tools Melsoft Academy currently uses. This roadmap does not attribute any of these products to them. Use synthetic sandbox connectors or explicitly authorized integrations for the hackathon.

## Human and privacy boundaries

- Personal learner data, school records, formal grades, real parent/learner communications, admissions decisions and potentially consequential actions require access restrictions and appropriate human oversight.
- Sending mail, altering shared schedules, writing grades, publishing lessons and modifying external records are distinct permission scopes from analysis or drafting.
- Use fictitious cohorts and records for public demo; any reported productivity and accuracy gains must come from actual measurements.
- Fail closed on revoked permissions, stale source versions, absent connectors and unverified write results. Never invent tool receipts or recipients.

## When a prompt arrives with NO data

Public sources may support a general task, with assumptions visible. Private student-specific conclusions are prohibited without authorized evidence. If a missing detail is critical to the requested outcome, ask one targeted question or produce a labelled partial draft. Never infer an app connection from the user's wording.

## Separation of gates

G01 establishes the required connector *capability and risk contract*. G02 handles natural-language goal understanding. G04 chooses feasible tools and skills; G07 implements secure adapters and side effects; G10 renders the connection and approval interfaces.

**Approval:** NOT APPROVED. No connector installed by this document.
