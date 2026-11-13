# T.A.C.E MCP server

A Model Context Protocol server (stdio) that exposes the T.A.C.E education recovery mission engine as five tools. It runs real missions, lists and reads the files they produced, and re-runs the independent reviewer on a finished run.

Source: `mcp/server.mjs`. Tests: `tests/unit/mcp.test.mjs` (`node --test tests/unit/mcp.test.mjs`).

## Tools

| Tool | Input | Result |
|---|---|---|
| `list_scenarios` | none | `[{id, title}]` |
| `run_mission` | `scenario` (`/^[a-z_]+$/`) | `{runId, status, checksPassed, checksTotal, repairs, reason}`. Runs the mission for real and writes a new folder under `runs/`. |
| `list_files` | `runId` | `[{name, version, digest, bytes, producer}]` from that run's `artifacts/index.json` |
| `read_file` | `runId`, `name`, `version?` | Text of one artifact version (latest if omitted). Digest is re-checked. Capped at 200 KB. |
| `review_run` | `runId` | `[{id, status, message}]`. Re-admits the six fixture sources and runs the independent reviewer on the run's files. |

Errors come back as tool results with `isError: true` and a plain message. Run ids must match `/^[A-Za-z0-9_-]{1,80}$/` and name an existing folder under `runs/`.

## What it writes

Only `run_mission` writes, and only a new folder under `runs/`. The other four tools read.

## Add it to a client

Use an absolute path to `mcp/server.mjs`. Node 22.13 or later is required (Node 24 is used in development).

Claude Code:

```sh
claude mcp add tace -- node C:/Users/USER/Desktop/T.A.C.E/repo/mcp/server.mjs
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tace": {
      "command": "node",
      "args": ["C:/Users/USER/Desktop/T.A.C.E/repo/mcp/server.mjs"]
    }
  }
}
```

Stdout carries the protocol. Logs go to stderr.
