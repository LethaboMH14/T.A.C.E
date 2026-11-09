# 04 — Technology candidates and evaluation

**Status:** Candidate inventory; not final dependency approvals. **Date:** 2026-11-10.

Choose a small, coherent build stack. Free **source code** does not guarantee free inference, compute, hosting, provider quota or storage.

| Function | MVP candidate | Alternative | Decision / caveat |
| --- | --- | --- | --- |
| UI | React + TypeScript + Vite | Next.js | PROPOSED: BobSwarm used React/Vite; reuse design concepts, not unlicensed code |
| Backend/API | FastAPI (Python) | Node/TypeScript | PROPOSED: Python aligns with Python LangGraph, parsing and education data tooling |
| Stateful graph | LangGraph (Python) | purpose-built state machine | PROPOSED: checkpointing, explicit edges, human interrupt; inspect current API |
| Schema validation | Pydantic | Zod | PROPOSED: validate model outputs and external inputs deterministically |
| Local run state | SQLite / supported checkpointer | PostgreSQL | PROPOSED: prefer simplest persisted demo before infrastructure scaling |
| Long-term/vector | SQLite lexical retrieval initially | PostgreSQL + pgvector; Qdrant | PROPOSED: source count and accuracy determine whether vector search is necessary |
| Document parsing | Docling for hard PDF/Office inputs | simple Python parsers for fixture CSV/MD | PROPOSED: start with synthetic structured dataset; avoid expensive parsing during demo |
| Tool protocol | Python function tools then official MCP SDK where needed | BobSwarm Node MCP patterns | PROPOSED: use MCP for interoperable tools; avoid a large tool registry |
| Model runtime | OpenAI-compatible provider adapter | Ollama/local inference | OPEN: benchmark actual free quotas, reliability and latency; no assumed unlimited free API |
| Trace/observability | structured JSON event log | Arize Phoenix; Langfuse | PROPOSED: install extra service only if it materially helps a verifiable demo |
| Chat surface | purpose-built Mission Console | LibreChat; Jan | PROPOSED: generic chat interfaces do not show graph state and artifacts as well |
| Workflow visualisation | React Flow / custom SVG | static DAG UI | PROPOSED: simple live diagram with real state only |
| Agent framework comparisons | thin scoped agents on LangGraph | AutoGen; CrewAI; smolagents | OPEN: test whether added abstraction provides demonstrable value |

## Findings from preliminary external research

- **LangGraph:** durable execution/checkpointing, graph control, subgraphs and interrupt patterns are relevant. Official: https://docs.langchain.com/oss/python/langgraph/overview
- **MCP:** standard tool/resources/prompts interface, useful for bounded action adapters. Official: https://modelcontextprotocol.io/
- **Docling:** structured document ingestion, tables and PDF support. Official: https://docling-project.github.io/docling/
- **pgvector:** embeddings and approximate/exact vector retrieval in PostgreSQL. Source: https://github.com/pgvector/pgvector
- **Qdrant:** hybrid retrieval capabilities; higher operational overhead than a tiny demo may need. Docs: https://qdrant.tech/documentation/
- **Arize Phoenix:** self-hostable observability/evaluation. Docs: https://arize.com/docs/phoenix/
- **Langfuse:** traces/prompt/evaluation tooling. Docs: https://langfuse.com/docs
- **Jan:** open desktop local-AI UI/server; not a replacement for custom graph/mission UI. Docs: https://docs.jan.ai/
- **LibreChat:** open-source multi-provider chat interface; optional alternative, not core. Docs: https://www.librechat.ai/
- **Letta:** persistent memory approach worth studying, but too much extra platform complexity for the first prototype. Docs: https://docs.letta.com/

**Dependency due diligence before selecting:** confirm exact current license, maintenance status, version/compatibility, transitive dependencies, infrastructure cost, network availability, vulnerability posture and data-handling policy. Do not label all products in this list "free and unrestricted" or assume licenses are interchangeable.

## Concrete first implementation candidate

FastAPI + LangGraph + Pydantic + SQLite + typed Python tools + React/Vite UI + synthetic CSV/Markdown inputs + event stream.

Only add Docling, pgvector, multi-tenant memory or external MCP services once a concrete benchmark or user requirement justifies them.

## Research-driven optimizations

- State-first design rather than a long orchestration prompt.
- Rerun only failed/dependent nodes, never regenerate the entire report by default.
- Retrieval anchored to source ID/version and immutable excerpt locator.
- Deterministic validation for rules and schema; LLM for interpretation/design.
- Small role-specific tool manifests, not all tools exposed to every agent.
- Independent reviewer with explicit failure codes and bounded retries.
- Model routing by complexity/latency/cost; report actual consumed calls.
- Opt-in memory promotion only after a completed, verified outcome.

## To test during module review

1. Time a complete single-agent baseline and a parallel-swarmed run on identical fixture.
2. Compare output correctness/coverage with and without retrieval.
3. Check input parsing on CSV + Markdown before enabling complex PDFs.
4. Verify checkpoints survive an interrupted request and safe retry does not duplicate records.
5. Measure whether a local model is actually able to produce valid schemas on the available hardware.
6. Confirm the UI renders only real backend events, not a canned progress sequence.