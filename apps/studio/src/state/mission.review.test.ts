// Review fixes for the workspace: execute/deliver stage colours, repair node settling, RUN_FINISHED per status.
import { describe, expect, it } from 'vitest';
import { initialMission, reduce, type LedgerEvent, type Mission } from './mission';

let seq = 0;
const ev = (type: string, data: any = {}, taskId: string | null = null, role: string | null = null): LedgerEvent => ({
  seq: ++seq,
  runId: 'r',
  ts: new Date(Date.UTC(2026, 10, 13, 12, 0, seq)).toISOString(),
  type,
  taskId,
  role,
  data,
});
const fold = (m: Mission, events: LedgerEvent[]) => events.reduce(reduce, m);

const tasks = [
  { id: 't1', capabilityId: 'c1', role: 'Analyst', label: 'gaps', dependsOn: [], consumes: [], produces: [] },
  { id: 't2', capabilityId: 'c2', role: 'Scheduler', label: 'schedule', dependsOn: ['t1'], consumes: [], produces: [] },
];

function started(): Mission {
  seq = 0;
  return fold(initialMission('r'), [
    ev('RUN_STARTED', { title: 'T', goalText: 'g', agents: { mode: 'code', note: 'x' } }),
    ev('PLAN_CREATED', { tasks, unsupported: [] }),
  ]);
}

describe('execute stage', () => {
  it('is green only when every task is done', () => {
    const m = fold(started(), [ev('TASK_COMPLETED', { summary: {} }, 't1', 'Analyst'), ev('TASK_COMPLETED', { summary: {} }, 't2', 'Scheduler')]);
    expect(m.stage.execute).toBe('done');
  });

  it('is bad when a task failed, even if others completed', () => {
    const m = fold(started(), [ev('TASK_FAILED', { message: 'boom' }, 't1', 'Analyst'), ev('TASK_COMPLETED', { summary: {} }, 't2', 'Scheduler')]);
    expect(m.stage.execute).toBe('bad');
  });

  it('is bad when a task was skipped, and stays bad at review start', () => {
    const m = fold(started(), [
      ev('TASK_COMPLETED', { summary: {} }, 't1', 'Analyst'),
      ev('TASK_SKIPPED', {}, 't2', 'Scheduler'),
      ev('REVIEW_STARTED', { round: 1 }),
    ]);
    expect(m.stage.execute).toBe('bad');
  });
});

describe('repair node', () => {
  it('does not spin: the next review round settles it', () => {
    const m = fold(started(), [
      ev('REVIEW_STARTED', { round: 1 }),
      ev('VERIFICATION_FAILED', { round: 1, failed: ['C1'], messages: ['overlap'] }),
      ev('REPAIR_SCHEDULED', { round: 1, strategy: 'reschedule_affected_sessions' }),
    ]);
    expect(m.node.repair.state).toBe('repairing');
    const next = fold(m, [ev('REVIEW_STARTED', { round: 2 })]);
    expect(next.node.repair.state).toBe('done');
  });

  it('settles when the run finishes without a later review', () => {
    const m = fold(started(), [
      ev('REPAIR_SCHEDULED', { round: 1, strategy: 'rerun_producer' }),
      ev('RUN_FINISHED', { status: 'PARTIAL', checksPassed: 1, checksTotal: 2, repairs: 1 }),
    ]);
    expect(m.node.repair.state).toBe('done');
  });
});

describe('deliver stage', () => {
  it('is green only on VERIFIED', () => {
    const m = fold(started(), [ev('RUN_FINISHED', { status: 'VERIFIED', checksPassed: 2, checksTotal: 2, repairs: 0 })]);
    expect(m.stage.deliver).toBe('done');
    expect(m.node.deliver.state).toBe('done');
  });

  it('shows PARTIAL as bad, not green', () => {
    const m = fold(started(), [ev('RUN_FINISHED', { status: 'PARTIAL', checksPassed: 1, checksTotal: 2, repairs: 0 })]);
    expect(m.stage.deliver).toBe('bad');
    expect(m.node.deliver.state).toBe('failed');
  });

  it('shows BLOCKED as bad and marks the blocked node', () => {
    const m = fold(started(), [ev('RUN_FINISHED', { status: 'BLOCKED', checksPassed: 0, checksTotal: 0, repairs: 0, reason: 'missing input' })]);
    expect(m.stage.deliver).toBe('bad');
    expect(m.node.blocked.state).toBe('blocked');
  });
});
