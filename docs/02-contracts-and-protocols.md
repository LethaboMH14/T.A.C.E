# 02 — Typed contracts and communication protocol

**Status:** Draft schemas / interface commitments pending review. **Version:** 0.1.

The state store, not conversational text, is the authoritative source of run facts.

## GoalContract

~~~yaml
contract_version: "0.1"
goal_id: "goal_demo_001"
actor:
  role: teacher
  tenant_id: "demo_school"
objective: "Prepare evidence-backed learner catch-up interventions"
inputs:
  - source_id: "demo_assessments_v1"
  - source_id: "demo_attendance_v1"
  - source_id: "demo_curriculum_v1"
constraints:
  data_scope: "synthetic-only"
  maximum_repair_rounds: 2
  default_communication_state: "draft"
assumptions:
  - text: "Plans will be reviewed by the teacher before learner contact"
    accepted_by_user: true
acceptance_criteria:
  - id: "A1"
    test: "each proposed intervention links to learner evidence"
  - id: "A2"
    test: "each curriculum recommendation links to valid topic evidence"
  - id: "A3"
    test: "files and follow-up records persisted and readable"
required_artifacts:
  - "intervention_plans.json"
  - "teacher_summary.md"
  - "draft_messages.json"
permissions:
  read_demo_data: true
  write_demo_artifacts: true
  send_external_message: "approval_required"
  change_learner_grade: false
status: "awaiting_user_approval"
~~~

In real code, define and validate with a runtime schema library (Pydantic or Zod). No string-generated YAML alone should be trusted as a valid contract.

## TaskNode / DAG entry

~~~json
{
  "task_id": "T03",
  "capability": "intervention_design",
  "depends_on": ["T01", "T02"],
  "inputs": ["artifact:T01.analysis", "artifact:T02.curriculum"],
  "output_schema": "InterventionPlanV1",
  "tool_allowlist": ["search_curriculum", "create_draft_plan"],
  "risk": "review_required",
  "retry_budget": 2,
  "status": "blocked_on_dependencies"
}
~~~

**Invariants:** every task has a unique ID; all dependencies refer to existing tasks; the DAG is acyclic; every task has a machine-checkable completion test; parallel tasks never compete to mutate the same artifact unless explicitly serialized.

## AgentMessage / handoff

~~~json
{
  "message_version": "1",
  "run_id": "run_demo_001",
  "from_task": "T01",
  "to_task": "T03",
  "message_type": "evidence_result",
  "artifact_refs": ["artifact:assessment_findings_v1"],
  "evidence_refs": ["source:demo_assessments_v1#row-4"],
  "uncertainties": ["Attendance data cannot establish the cause of low scores"],
  "status": "complete",
  "created_at": "server-assigned"
}
~~~

Messages contain references and bounded summaries, not unbounded raw chat transcripts. The receiving node may ask the Context Compiler to resolve a referenced source.

## RunState

~~~yaml
run_id: "run_demo_001"
goal_contract_ref: "goal_demo_001@0.1"
phase: "RUNNING"
graph_version: "tace-graph-v0.1"
task_status: {}
evidence_refs: []
context_refs_by_task: {}
tool_receipts: []
artifact_refs: []
approval_requests: []
review_results: []
repair_count_by_task: {}
runtime_budget:
  max_model_calls: 30
  max_elapsed_seconds: 600
  max_tool_calls: 50
event_seq: 0
final_outcome: null
~~~

Budgets above are illustrative proposed defaults, not measured requirements; review them against actual model and tool performance.

## Evidence / review record

~~~json
{
  "evidence_id": "E001",
  "source_id": "demo_curriculum_v1",
  "source_version": "sha256-or-version",
  "locator": "section:fractions",
  "claim_id": "C023",
  "quote_or_structured_value": "A short bounded verbatim excerpt",
  "retrieved_at": "server-timestamp",
  "trust_class": "user_supplied_reference",
  "review": {
    "reviewer_role": "quality_reviewer",
    "verdict": "fail",
    "failure_codes": ["UNSUPPORTED_CURRICULUM_MAPPING"],
    "repair_instructions": "Re-retrieve section reference and replace unsupported activity"
  }
}
~~~

A citation is **not automatically proof**. Deterministic schema/scope/source checks and human review for consequential decisions remain necessary.

## ToolCall / receipt

~~~json
{
  "tool_call_id": "call_007",
  "run_id": "run_demo_001",
  "task_id": "T05",
  "tool": "write_demo_followup",
  "arguments_hash": "sha256",
  "idempotency_key": "run_demo_001:T05:followup:v1",
  "authorization": "permitted_demo_write",
  "status": "acknowledged",
  "side_effect": true,
  "resource_ref": "followup:0007",
  "verification_status": "read_back_passed"
}
~~~

Tool states: PROPOSED → AUTHORIZED → EXECUTED → ACKNOWLEDGED → VERIFIED / FAILED. A model statement such as "I sent it" cannot bypass these statuses.

## Runtime event envelope

~~~json
{
  "event_version": "1",
  "run_id": "run_demo_001",
  "sequence": 14,
  "event_type": "task.review_failed",
  "task_id": "T03",
  "timestamp": "server-timestamp",
  "public_summary": "Reviewer found a curriculum mismatch",
  "payload_ref": "review:R009"
}
~~~

Events are append-only with server-assigned monotonically increasing sequence numbers per run. UI reconnects by sequence and rebuilds from the authoritative snapshot.

## MemoryRecord

~~~json
{
  "memory_id": "mem_001",
  "category": "procedural",
  "text": "Validated way to cross-check curriculum source anchors",
  "owner_scope": "demo_school",
  "provenance_refs": ["run_demo_001", "review:R009"],
  "approved": false,
  "sensitivity": "nonpersonal",
  "created_at": "server-timestamp",
  "expires_at": null,
  "version": 1
}
~~~

Do not persist direct student identifiers or unverified conclusions by default. Memory retrieval is tenant- and task-scoped, with corrections and expiry supported.