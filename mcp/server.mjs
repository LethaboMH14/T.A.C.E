// T.A.C.E MCP server (stdio). Five tools over the real mission engine.
//   node mcp/server.mjs            -> serves over stdio (stdout is the protocol; logs go to stderr)
// Writes only under runs/ (run_mission creates a run folder there). Every other tool is read-only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runMission } from '../engine/run.mjs';
import { createArtifactStore, safeJoin } from '../engine/artifacts.mjs';
import { admitSources } from '../engine/sources.mjs';
import { EDU_DOMAIN } from '../domains/education/index.mjs';
import { EDU_SOURCE_SPECS } from '../domains/education/sources.mjs';
import { TRUSTED_FIXTURE_CONTEXT } from '../fixtures/education-recovery/scenarios.mjs';
import { loadScenario, stampRunId } from '../cli/tace.mjs';

const SCENARIO_RE = /^[a-z_]+$/;
const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const READ_CAP_BYTES = 200 * 1024;
const repoRunsDir = fileURLToPath(new URL('../runs', import.meta.url));

class ToolError extends Error {}

const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const errorResult = (message) => ({ content: [{ type: 'text', text: message }], isError: true });

function checkRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) throw new ToolError('runId must be 1-80 letters, digits, "_" or "-"');
}

function runFolder(runsDir, runId) {
  checkRunId(runId);
  const dir = safeJoin(runsDir, runId);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new ToolError(`no run folder for runId ${runId}`);
  return dir;
}

function readIndex(runDir) {
  const indexPath = path.join(runDir, 'artifacts', 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

/** Create a MCP server bound to one runs folder. Tests pass a temp folder. */
export function createTaceMcpServer({ runsDir = repoRunsDir } = {}) {
  const root = path.resolve(runsDir);
  const server = new McpServer({ name: 'tace', version: '0.1.0' });

  const handle = (fn) => async (args) => {
    try {
      return text(await fn(args));
    } catch (err) {
      return errorResult(err instanceof ToolError ? err.message : `Error: ${err.message || String(err)}`);
    }
  };

  server.registerTool('list_scenarios', {
    description: 'List the built-in education recovery scenarios (id and title).',
    inputSchema: {},
  }, handle(() => {
    const dir = EDU_DOMAIN.scenariosDir;
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { id: s.id, title: s.title };
    });
  }));

  server.registerTool('run_mission', {
    description: 'Run a real mission for a scenario. Writes a new run folder under runs/ and returns its outcome.',
    inputSchema: { scenario: z.string().describe('Scenario id, lowercase letters and underscores (see list_scenarios)') },
  }, handle(async ({ scenario }) => {
    if (typeof scenario !== 'string' || !SCENARIO_RE.test(scenario)) throw new ToolError('scenario must match /^[a-z_]+$/');
    let spec;
    try {
      spec = loadScenario(scenario);
    } catch (err) {
      throw new ToolError(err.message);
    }
    fs.mkdirSync(root, { recursive: true });
    let runId = stampRunId(spec.id);
    while (fs.existsSync(path.join(root, runId))) runId = `${stampRunId(spec.id)}-${crypto.randomBytes(3).toString('hex')}`;
    const runDir = safeJoin(root, runId);
    const result = await runMission({
      scenario: spec, domain: EDU_DOMAIN, sourcesDir: EDU_DOMAIN.sourcesDir, runDir, runId,
      trustedContext: TRUSTED_FIXTURE_CONTEXT, paceMs: 0,
    });
    return {
      runId: result.runId,
      status: result.status,
      checksPassed: result.checksPassed,
      checksTotal: result.checksTotal,
      repairs: result.repairs.filter((r) => r.to || r.rerun).length,
      reason: result.manifest.reason ?? null,
    };
  }));

  server.registerTool('list_files', {
    description: "List the artifact files of one run (from that run's artifacts/index.json).",
    inputSchema: { runId: z.string().describe('Run id, e.g. inject_overlap-20261113-151313') },
  }, handle(({ runId }) => {
    const runDir = runFolder(root, runId);
    return readIndex(runDir).map((r) => ({ name: r.name, version: r.version, digest: r.digest, bytes: r.bytes, producer: r.producer }));
  }));

  server.registerTool('read_file', {
    description: 'Read one artifact version of a run as text (latest if version is omitted). Capped at 200 KB; the digest is re-checked on read.',
    inputSchema: {
      runId: z.string(),
      name: z.string().describe('File name, e.g. mentor-schedule.csv'),
      version: z.number().int().positive().optional(),
    },
  }, handle(({ runId, name, version }) => {
    const runDir = runFolder(root, runId);
    const refs = readIndex(runDir).filter((r) => r.name === name);
    if (!refs.length) throw new ToolError(`no artifact named ${name} in run ${runId}`);
    const ref = version === undefined
      ? refs.reduce((best, r) => (r.version > best.version ? r : best))
      : refs.find((r) => r.version === version);
    if (!ref) throw new ToolError(`${name} has no version ${version} in run ${runId}`);
    const store = createArtifactStore(runDir);
    const full = store.read(ref);
    const bytes = Buffer.from(full, 'utf8');
    const truncated = bytes.length > READ_CAP_BYTES;
    return {
      name: ref.name,
      version: ref.version,
      digest: ref.digest,
      bytes: bytes.length,
      truncated,
      text: truncated ? bytes.subarray(0, READ_CAP_BYTES).toString('utf8') : full,
    };
  }));

  server.registerTool('review_run', {
    description: 'Re-run the independent reviewer on one run: re-admit the six fixture sources and recompute every check from the run files.',
    inputSchema: { runId: z.string() },
  }, handle(async ({ runId }) => {
    const runDir = runFolder(root, runId);
    const store = createArtifactStore(runDir);
    const manifestRef = store.latestByName('final-manifest.json');
    if (!manifestRef) throw new ToolError(`run ${runId} has no final manifest (it did not finish)`);
    const manifest = JSON.parse(store.read(manifestRef));
    const scenario = loadScenario(manifest.scenarioId);
    const adm = admitSources(EDU_DOMAIN.sourcesDir, EDU_SOURCE_SPECS);
    if (adm.problems.length) throw new ToolError(`fixture sources do not admit: ${adm.problems.map((p) => p.message).join('; ')}`);
    const { checks } = await EDU_DOMAIN.review({ sources: adm.sources, store, scenario });
    return checks.map((c) => ({ id: c.id, status: c.status, message: c.message }));
  }));

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const server = createTaceMcpServer({ runsDir: repoRunsDir });
  await server.connect(new StdioServerTransport());
  process.stderr.write('tace mcp: serving 5 tools on stdio\n');
}
