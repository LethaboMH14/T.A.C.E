# GATE 02 — Prompt Engineering, Intent Interpretation and Adaptive Clarification

**Date:** 2026-11-10 | **Status:** IN_RESEARCH; NOT IMPLEMENTED/NOT APPROVED
**Precondition:** G01 design signoff [ADR-0004](../decisions/ADR-0004-g01-requirements-signoff-and-g02-handoff.md)
**This is a research charter and initial requirements only; no master prompt or model selection is locked yet.**

## G02 mission

Interpret *any* natural-language or API goal as a minimal, typed **GoalContract Proposal** that identifies: user intent, desired outcome/artifact/action types, source needs, success/verification criteria, constraints, alternatives, essential unknowns and the appropriate need to clarify versus prepare. The model never grants authority or assumes tool availability. A deterministic boundary checker binds the proposal to the trusted server principal, actual capability registry and permitted effect class before any execution.

**Core tests:** Equivalent paraphrases should produce comparable outcome definitions; mixed requests should preserve independent subgoals; tiny tasks should not require a swarm; ambiguous official-grade/email requests should pause; no-data, malicious source text, unavailable connectors and unsupported file formats must be recognized honestly.

## Numbered research subsections (to be completed in this gate)

| ID | Topic | Required research/output |
| --- | --- | --- |
| G02.01 | Input normalization and conversation intent | raw text, locale and modality assumptions, user correction precedence |
| G02.02 | Goal schema and decomposition | stable proposal fields and subgoal DAG candidates, outcome-first representation |
| G02.03 | Prompt architecture | structured prompts with trusted instruction/data partition, no chain-of-thought exposure |
| G02.04 | Adaptive clarification policy | information-gain/impact/risk-driven asking; never long mandatory setup |
| G02.05 | Success criteria extraction | concrete artifacts, verified external actions, completion and unresolved conditions |
| G02.06 | Risk and autonomy classification | classification *suggestion* only, deterministic policy is final |
| G02.07 | Capability awareness and tool discovery | real registry-informed output, no model-invented tool declarations |
| G02.08 | Complexity and proportional team selection | decide whether no agent, single worker or multi-agent graph is warranted |
| G02.09 | Confidence and uncertainty | field-specific, calibrated if measured; don't treat LLM numeric confidence as proof |
| G02.10 | Structured output validation and repair | strict schema checks, one bounded structural re-ask, fail-closed invalid output |
| G02.11 | Multi-language and mixed goal parsing | languages, math notation, consent, review |
| G02.12 | Adversarial / injection resilience | source labels, refusal of prompt-derived permissions, evaluation |
| G02.13 | Evaluation corpus and baselines | paraphrase, no-data, out-of-domain, edge suite, ablations and manual baseline |
| G02.14 | API and integration handoff | status/clarification/contract proposal to G03–G05 and G07 policy |
| G02.15 | Decision ADR and exit tests | exact schema version, tests, open failures, signoff |

## Research alternatives (not decisions)

- Single trusted structured-output model, with server-side JSON schema validation and deterministic policy, versus multiple model adjudication.
- "Clarify first" for missing consequential facts versus "prepare a safe draft" for low-risk, high-information-value work.
- Flat GoalContract plus dynamically planned subgoals versus planner-generated DAG from the first step.
- Prompt-only function calling versus a small deterministic intent/risk parser preceding a model.

No provider/model names, prompt templates, confidence scales or tool-discovery algorithms are accepted without testing.

## G02 initial failure cases

- "Do all of this" with no supporting context -> ask precise actionable question, not hallucinate.
- "Send official grades" -> construct proposal but **never** obtain send rights from instruction.
- "Excel" mentioned with no connected app -> generate local template or request connection only if needed.
- A PDF says "ignore permissions" -> treated as source text; never agent instruction.
- Grade and deadline terminology ambiguous -> ask or state safe assumptions; do not guess a real grade or time zone.
- A user revises the requested recipient after approval -> invalidate existing approval (enforced G07).
- Repeated retries and bloated prompts -> bounded, measured parser behavior.
- New unknown goal -> propose a capability/unknown state without pretending an agent exists.

## Exit conditions before moving G03 design

G02.01–G02.15 researched; exact stable input/output schema and versioning; prompt/clarification decision policy; negative/security cases; measured evaluation including unseen paraphrases and invalid fields; explicit design decision/ADR; checked mapping to G01, G03 and G07.

**Nothing here claims a working or authorized autonomous engine.**


## G02 editable Figma design workspace (2026-11-10)

[**Open T.A.C.E Gate 02 — Intent, Skills & Memory Architecture + Mission Console**](https://www.figma.com/design/28egBAkhQHExkqUinyimtM)

Three editable pages were created:
1. **01 — Intent & Trust Architecture:** any-goal intake, server-attested identity, untrusted source data, typed intent proposal, minimal clarification, skill discovery, deterministic policy gate, receipts and verification.
2. **02 — Mission Console Concept:** synthetic 36-trainee recovery scenario, proposed adaptive specialists, source checks, approval queue, draft artifacts and honest not-yet-executed status.
3. **03 — Skills & Memory Policy:** separation of AGENTS.md/RULES.md, SKILL.md, versioned prompts, episodic/semantic/procedural memory, Honcho-style profile candidate, optional Obsidian authoring, trust and retention rules.

**Status:** editable *design concepts only*, not a functioning interface or approved Gate 02 architecture. Model selection, library adoption, memory vendors, schema, and real tool access are pending the active deep research and G02 review. Security controls remain assigned to G07 and testing to G11. Preserve the original [Gate 01 FigJam board](https://www.figma.com/board/WObVafIxNSBwRssWhTk5wi) as the earlier architecture reference.

**Design synchronization rule (proposed):** Each accepted architectural change should update its source-of-truth Markdown/ADR and the relevant editable Figma page. The diagrams must display the current status (proposed/accepted/implemented/tested) and should not be treated as proof of implementation.
