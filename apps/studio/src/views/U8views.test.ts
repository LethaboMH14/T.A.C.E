import { describe, expect, it } from 'vitest';
import { initialMission, reduce, type LedgerEvent, type Mission } from '@/state';
import { plainReason, ModelMeter } from '@/components/ModelMeter';
import { buildAgents } from './AgentsView';
import { applyFilter, checkHistory } from './EvidenceView';
import { buildDiff, defaultPair, type Version } from './FilesView';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const T0 = Date.parse('2026-11-13T16:00:00.000Z');
let seq = 0;
const ev = (sec: number, type: string, role: string | null, taskId: string | null, data: any = {}): LedgerEvent => ({
  seq: ++seq, runId: 'run-x', ts: new Date(T0 + sec * 1000).toISOString(), type, role, taskId, data,
});

function fold(list: LedgerEvent[]): Mission {
  return list.reduce(reduce, initialMission('run-x'));
}

const check = (id: string, status: string, title = id, artifact = 'f.csv@v1') => ({ id, title, artifact, kind: 'k', status, expected: 1, observed: status === 'PASS' ? 1 : 0, evidence: [], message: 'm' });

const list: LedgerEvent[] = [
  ev(0, 'RUN_STARTED', null, null, { agents: { mode: 'model', provider: 'meta', model: 'muse-spark-1.3' } }),
  ev(1, 'AGENT_JOINED', 'Goal Reader', null, { agent: 'Scheduler', capabilityId: 'mentor_schedule', reason: 'r', by: 'planner' }),
  ev(2, 'MODEL_CALL', 'Goal Reader', null, { agent: 'Goal Reader', provider: 'meta', model: 'muse-spark-1.3', ok: true, ms: 1000, usage: { prompt: 1000000, completion: 0, total: 1000000 } }),
  ev(3, 'MODEL_CALL', 'Supervisor', null, { agent: 'Supervisor', provider: 'groq', model: 'g', ok: true, ms: 10, usage: { prompt: 5, completion: 5, total: 10 } }),
  ev(4, 'TASK_STARTED', 'Scheduler', 'mentor_schedule'),
  ev(5, 'ARTIFACT_WRITTEN', 'Scheduler', 'mentor_schedule', { name: 'mentor-schedule.csv', version: 1, file: 'artifacts/mentor-schedule.v1.csv', digest: 'aa', bytes: 3, mime: 'text/csv', producer: 'mentor_schedule' }),
  ev(6, 'TASK_COMPLETED', 'Scheduler', 'mentor_schedule', { summary: {} }),
  ev(7, 'REVIEW_STARTED', 'Reviewer', 'review', { round: 1 }),
  ev(8, 'CHECK_RESULT', 'Reviewer', 'review', check('C04', 'FAIL', 'No double booking')),
  ev(9, 'CHECK_RESULT', 'Reviewer', 'review', check('C01', 'PASS', 'Gaps')),
  ev(10, 'VERIFICATION_FAILED', 'Reviewer', 'review', { round: 1, failed: ['C04'], messages: ['x'] }),
  ev(11, 'REVIEW_STARTED', 'Reviewer', 'review', { round: 2 }),
  ev(12, 'CHECK_RESULT', 'Reviewer', 'review', check('C04', 'PASS', 'No double booking')),
  ev(13, 'CHECK_RESULT', 'Reviewer', 'review', check('C01', 'PASS', 'Gaps')),
  ev(14, 'VERIFICATION_PASSED', 'Reviewer', 'review', { round: 2, passed: 2, total: 2 }),
];

describe('AgentsView buildAgents', () => {
  const m = fold(list);
  const cards = buildAgents(m, list);
  const by = (n: string) => cards.find((c) => c.name === n)!;

  it('lists joined agents, model agents, Reviewer and Repair, with Reviewer and Repair last', () => {
    // Joined agents first (in join order), then the model agents, then Reviewer and Repair.
    expect(cards.map((c) => c.name)).toEqual(['Scheduler', 'Goal Reader', 'Supervisor', 'Reviewer', 'Repair']);
  });

  it('gives kind, steps, files, and cost from the ledger', () => {
    expect(by('Goal Reader')).toMatchObject({ kind: 'model', calls: 1, tokens: 1000000, usdText: '$1.25' });
    expect(by('Supervisor')).toMatchObject({ kind: 'model', usdText: 'tokens only' });
    expect(by('Scheduler')).toMatchObject({ kind: 'code', steps: 1, files: ['mentor-schedule.csv'] });
    expect(by('Reviewer')).toMatchObject({ kind: 'independent', steps: 2 });
  });

  it('is empty when no run is selected', () => {
    expect(buildAgents(initialMission(null), [])).toEqual([]);
  });
});

describe('EvidenceView checkHistory', () => {
  const m = fold(list);
  const h = checkHistory(m, list);

  it('keeps status per round from CHECK_RESULT events', () => {
    const c04 = h.find((c) => c.id === 'C04')!;
    expect(c04.rounds).toEqual([{ round: 1, status: 'FAIL' }, { round: 2, status: 'PASS' }]);
    expect(c04.latest).toBe('PASS');
  });

  it('filters by latest status', () => {
    expect(applyFilter(h, 'all')).toHaveLength(2);
    expect(applyFilter(h, 'failed')).toEqual([]);
    expect(applyFilter(h, 'passed').map((c) => c.id)).toEqual(['C01', 'C04']);
  });

  it('falls back to the latest result per check when no events are given', () => {
    const fb = checkHistory(m, []);
    expect(fb.every((c) => c.rounds.length === 1)).toBe(true);
  });
});

describe('FilesView diff', () => {
  it('marks removed and added lines and collapses long unchanged runs', () => {
    const a = ['h', '1', '2', '3', '4', '5', 'end'].join('\n') + '\n';
    const b = ['h', '1', '2', '3', '4', '5', 'END'].join('\n') + '\n';
    const items = buildDiff(a, b);
    expect(items.filter((i) => i.type === 'del')).toEqual([{ type: 'del', text: 'end' }]);
    expect(items.filter((i) => i.type === 'add')).toEqual([{ type: 'add', text: 'END' }]);
    const gap = items.find((i) => i.type === 'gap');
    expect(gap).toMatchObject({ type: 'gap', count: 6 });
  });

  it('defaults mentor-schedule.csv to v1 against the latest, others to the last two', () => {
    const v = (version: number): Version => ({ kind: 'k', name: 'f', version, file: `artifacts/f.v${version}`, digest: 'd', bytes: 1, mime: 'text/csv', producer: 'p', inputs: [], seq: version, by: 'p' });
    expect(defaultPair('mentor-schedule.csv', [v(1), v(2), v(3)])).toEqual([1, 3]);
    expect(defaultPair('gap-analysis.csv', [v(1), v(2), v(3)])).toEqual([2, 3]);
    expect(defaultPair('x.csv', [v(1)])).toBeNull();
  });
});

describe('ModelMeter fixes', () => {
  it('maps fallback codes to plain words', () => {
    expect(plainReason('MODEL_HTTP_429')).toBe('rate limit');
    expect(plainReason('MODEL_HTTP_503')).toBe('service error');
    expect(plainReason('MODEL_HTTP_402')).toBe('out of credit');
    expect(plainReason('MODEL_HTTP_404')).toBe('model retired');
    expect(plainReason('MODEL_HTTP_410')).toBe('model retired');
    expect(plainReason('auth')).toBe('key refused');
    expect(plainReason('MODEL_TIMEOUT')).toBe('timeout');
  });

  it('shows the run note in code mode instead of the no-key message', () => {
    const m = fold([ev(0, 'RUN_STARTED', null, null, { agents: { mode: 'code', note: 'Model turned off for this run' } })]);
    const html = renderToStaticMarkup(createElement(ModelMeter, { mission: m }));
    expect(html).toContain('Model turned off for this run');
    expect(html).not.toContain('No model key configured');
  });
});
