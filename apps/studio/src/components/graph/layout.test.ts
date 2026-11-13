import { describe, expect, it } from 'vitest';
import { computeLayout, type LayoutInput } from './layout';

const base = { deliverableCount: 2, sourceCount: 3, blockedCount: 0, stopped: false };

const reportOnly: LayoutInput = {
  ...base,
  tasks: [
    { id: 'gaps', role: 'Analyst', label: 'Compute gaps', dependsOn: [] },
    { id: 'report', role: 'Report Writer', label: 'Summarise skills', dependsOn: ['gaps'] },
  ],
};

const fullPlan: LayoutInput = {
  ...base,
  tasks: [
    { id: 'gaps', role: 'Analyst', label: 'Compute gaps', dependsOn: [] },
    { id: 'report', role: 'Report Writer', label: 'Summarise skills', dependsOn: ['gaps'] },
    { id: 'support', role: 'Support Planner', label: 'Match items', dependsOn: ['gaps'] },
    { id: 'schedule', role: 'Scheduler', label: 'Book sessions', dependsOn: ['support'] },
    { id: 'draft', role: 'Message Writer', label: 'Draft messages', dependsOn: ['schedule', 'report'] },
  ],
};

const blocked: LayoutInput = { ...base, sourceCount: 0, blockedCount: 1, stopped: true, tasks: [] };

const rowCount = (l: ReturnType<typeof computeLayout>) => new Set(l.nodes.map((n) => n.row)).size;

describe('computeLayout', () => {
  it('report-only plan (2 tasks) uses fewer rows than the full plan', () => {
    const small = computeLayout(reportOnly);
    const big = computeLayout(fullPlan);
    expect(rowCount(small)).toBeLessThan(rowCount(big));
    expect(small.height).toBeLessThan(big.height);
  });

  it('review and repair share a row, with review on the left', () => {
    const l = computeLayout(fullPlan);
    const review = l.nodes.find((n) => n.id === 'review')!;
    const repair = l.nodes.find((n) => n.id === 'repair')!;
    expect(review.row).toBe(repair.row);
    expect(review.x).toBeLessThan(repair.x);
    const deliver = l.nodes.find((n) => n.id === 'deliver')!;
    expect(deliver.row).toBeGreaterThan(review.row);
  });

  it('tasks sit at depth = longest dependsOn chain', () => {
    const l = computeLayout(fullPlan);
    const row = (id: string) => l.nodes.find((n) => n.id === id)!.row;
    expect(row('gaps')).toBe(2);
    expect(row('report')).toBe(3);
    expect(row('support')).toBe(3);
    expect(row('schedule')).toBe(4);
    expect(row('draft')).toBe(5);
  });

  it('a blocked plan with no tasks yields a Stopped node fed from sources', () => {
    const l = computeLayout(blocked);
    const stop = l.nodes.find((n) => n.id === 'blocked');
    expect(stop?.role).toBe('Stopped');
    expect(l.nodes.some((n) => n.id === 'review')).toBe(false);
    expect(l.edges).toContainEqual({ id: 'sources--blocked', source: 'sources', target: 'blocked', kind: 'stop' });
  });

  it('is deterministic and centres each row on the canvas', () => {
    const a = computeLayout(fullPlan);
    const b = computeLayout(fullPlan);
    expect(a).toEqual(b);
    for (const r of new Set(a.nodes.map((n) => n.row))) {
      const row = a.nodes.filter((n) => n.row === r);
      const left = row[0].x;
      const right = row[row.length - 1].x + row[row.length - 1].w;
      expect(Math.abs(left - (a.width - right))).toBeLessThan(1e-9);
    }
  });

  it('ignores unknown dependencies and survives a cycle', () => {
    const l = computeLayout({
      ...base,
      tasks: [
        { id: 'a', role: 'Analyst', label: 'A', dependsOn: ['b', 'ghost'] },
        { id: 'b', role: 'Report Writer', label: 'B', dependsOn: ['a'] },
      ],
    });
    expect(l.nodes.find((n) => n.id === 'a')).toBeDefined();
    expect(l.edges.some((e) => e.source === 'ghost')).toBe(false);
  });
});
