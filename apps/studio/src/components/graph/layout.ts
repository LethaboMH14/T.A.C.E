// Pure layout for the mission graph. No React, no DOM: it turns the plan shape into
// logical coordinates. Rows are top to bottom: goal, sources, tasks by depth, review+repair
// side by side, then deliver. The numbers mirror buildGraph/layoutGraph in web/app.js.
// Type-only import: nothing here is decided by the UI, every input is a ledger-derived field.

import type { Mission, Task } from '@/state';

export const NODE_W = 216;
export const NODE_H = 58;
export const ROW = 84;
export const HG = 20;
export const TOP = 18;

export type EdgeKind = 'flow' | 'sink' | 'loop' | 'stop';

export interface LayoutNode {
  id: string;            // mission.node key: goal, sources, task id, review, repair, deliver, blocked
  role: string;          // display role; also the icon key (see roles.ts)
  sub: string;           // sub-label
  row: number;
  x: number;             // top-left, logical px
  y: number;
  w: number;
  h: number;
}

export interface LayoutEdge {
  id: string;            // `${source}--${target}`
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  rows: number;          // number of distinct rows used
}

export interface LayoutInput {
  tasks: Pick<Task, 'id' | 'role' | 'label' | 'dependsOn'>[];
  deliverableCount: number;
  sourceCount: number;
  blockedCount: number;
  stopped: boolean;      // no tasks and the run is blocked: draw a Stopped node
}

/** Adapter from the Mission shape to layout input. Only the slices the layout reads. */
export function layoutInputFrom(
  m: Pick<Mission, 'tasks' | 'deliverables' | 'sources' | 'blockedSources' | 'node'>,
): LayoutInput {
  const stopped =
    m.tasks.length === 0 &&
    (m.blockedSources.length > 0 || m.node.blocked?.state === 'blocked' || m.node.goal?.state === 'blocked');
  return {
    tasks: m.tasks,
    deliverableCount: m.deliverables.length,
    sourceCount: m.sources.length,
    blockedCount: m.blockedSources.length,
    stopped,
  };
}

/** Longest dependsOn chain per task. Unknown dependencies are ignored, cycles are cut at 0. */
export function taskDepths(tasks: LayoutInput['tasks']): Map<string, number> {
  const byId = new Map<string, LayoutInput['tasks'][number]>();
  for (const t of tasks) if (!byId.has(t.id)) byId.set(t.id, t);
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const deps = byId.get(id)!.dependsOn.filter((d) => byId.has(d) && d !== id);
    const v = deps.length ? 1 + Math.max(...deps.map(depth)) : 0;
    visiting.delete(id);
    memo.set(id, v);
    return v;
  };
  for (const id of [...byId.keys()].sort()) depth(id);
  return memo;
}

export function computeLayout(input: LayoutInput): GraphLayout {
  const byId = new Map<string, LayoutInput['tasks'][number]>();
  for (const t of input.tasks) if (!byId.has(t.id)) byId.set(t.id, t);
  const tasks = [...byId.values()];
  const depth = taskDepths(tasks);

  type Draft = Omit<LayoutNode, 'x' | 'y' | 'w' | 'h'>;
  const drafts: Draft[] = [
    { id: 'goal', role: 'Goal', sub: `${input.deliverableCount} deliverables`, row: 0 },
    {
      id: 'sources',
      role: 'Sources',
      sub: input.blockedCount ? `${input.blockedCount} missing` : `${input.sourceCount} files admitted`,
      row: 1,
    },
  ];
  for (const t of tasks) drafts.push({ id: t.id, role: t.role, sub: t.label, row: 2 + (depth.get(t.id) ?? 0) });

  const edges: LayoutEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (source: string, target: string, kind: EdgeKind) => {
    const id = `${source}--${target}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, source, target, kind });
  };

  addEdge('goal', 'sources', 'flow');

  if (tasks.length) {
    const lastTaskRow = Math.max(1, ...drafts.map((d) => d.row));
    drafts.push(
      { id: 'review', role: 'Reviewer', sub: 'Recomputes from the raw files', row: lastTaskRow + 1 },
      { id: 'repair', role: 'Repair', sub: 'Fixes only what failed', row: lastTaskRow + 1 },
      { id: 'deliver', role: 'Deliver', sub: 'Verified files + manifest', row: lastTaskRow + 2 },
    );
    const hasChild = new Set<string>();
    for (const t of tasks) {
      const deps = t.dependsOn.filter((d) => byId.has(d) && d !== t.id);
      if (deps.length === 0) addEdge('sources', t.id, 'flow');
      for (const d of deps) {
        addEdge(d, t.id, 'flow');
        hasChild.add(d);
      }
    }
    for (const t of tasks) if (!hasChild.has(t.id)) addEdge(t.id, 'review', 'sink');
    addEdge('review', 'repair', 'loop');
    addEdge('review', 'deliver', 'flow');
  } else if (input.stopped) {
    drafts.push({ id: 'blocked', role: 'Stopped', sub: 'Needs the missing input', row: 2 });
    addEdge('sources', 'blocked', 'stop');
  }

  // Position: centred rows of fixed-width nodes, canvas as wide as the widest row.
  const byRow = new Map<number, Draft[]>();
  for (const d of drafts) {
    const list = byRow.get(d.row) ?? [];
    list.push(d);
    byRow.set(d.row, list);
  }
  const rowKeys = [...byRow.keys()].sort((a, b) => a - b);
  const rowWidth = (n: number) => n * NODE_W + (n - 1) * HG;
  const canvasW = Math.max(NODE_W, ...rowKeys.map((r) => rowWidth(byRow.get(r)!.length)));
  const nodes: LayoutNode[] = [];
  for (const r of rowKeys) {
    const list = byRow.get(r)!;
    let x = (canvasW - rowWidth(list.length)) / 2;
    for (const d of list) {
      nodes.push({ ...d, x, y: TOP + r * ROW, w: NODE_W, h: NODE_H });
      x += NODE_W + HG;
    }
  }
  const maxRow = rowKeys.length ? rowKeys[rowKeys.length - 1] : 0;
  return {
    nodes,
    edges,
    width: canvasW,
    height: TOP + maxRow * ROW + NODE_H + 22,
    rows: rowKeys.length,
  };
}
