import { describe, expect, it } from 'vitest';
import { aggregateModelCalls } from './ModelMeter';

const call = (agent: string, ok: boolean, ms: number, total: number) => ({ agent, ok, ms, total, error: ok ? null : 'x' });

describe('aggregateModelCalls', () => {
  it('returns no rows for no calls', () => {
    expect(aggregateModelCalls([])).toEqual([]);
  });

  it('sums calls, failures, ms and tokens per agent in first-appearance order', () => {
    const rows = aggregateModelCalls([
      call('Goal Reader', true, 16189, 4042),
      call('Supervisor', true, 5401, 1041),
      call('Goal Reader', false, 900, 0),
      call('Goal Reader', true, 100, 250),
    ]);
    expect(rows).toEqual([
      { agent: 'Goal Reader', calls: 3, failures: 1, ms: 17189, tokens: 4292 },
      { agent: 'Supervisor', calls: 1, failures: 0, ms: 5401, tokens: 1041 },
    ]);
  });
});
