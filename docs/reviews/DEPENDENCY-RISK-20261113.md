# Dependency advisories — accepted for the 14 Nov demo (reviewed 13 Nov 2026)

`npm audit --omit=dev`: 3 findings (2 moderate, 1 high).

| Package | Advisory | Why accepted now | Revisit |
|---|---|---|---|
| zod < 4.6.6 (top level 3.25.76, also used by LangGraph JS and the MCP SDK) | GHSA-mrhx-c7xc-m3w5: memory exhaustion when validating oversized constrained collections | We only validate local, size-capped input: studio POST bodies ≤ 4 KB, agent message reasons ≤ 500 chars, model replies already parsed by the adapter. LangGraph 1.7.4 and MCP SDK 1.32.2 resolve zod 3; forcing v4 risks breaking both the night before the demo. `@langchain/core` already brings zod 4.6.7 for itself. | Upgrade to zod ≥ 4.6.6 once LangGraph and MCP SDK are confirmed compatible; then run the full suite |
| uuid < 11.1.1 (via exceljs 4.4.0) | GHSA-w5hq-g745-h8pq: missing buffer bounds check in v3/v5/v6 when `buf` is passed | We never call uuid; exceljs uses it internally without a caller-supplied buffer | Track exceljs releases |
