import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { ReactFlow, useReactFlow, useStore, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph/graph.css';
import type { Mission } from '@/state';
import { computeLayout, layoutInputFrom } from './graph/layout';
import { MissionNode, type MissionFlowNode } from './graph/MissionNode';
import { Roster } from './graph/Roster';

// Live view: nodes are fixed, the canvas fits the plan, the page keeps its own scroll.
const nodeTypes = { mission: MissionNode };
const proOptions = { hideAttribution: false };
const fitViewOptions = { padding: 0.16 };
const PULSE_MS = 1400;

/** Re-fits the whole plan whenever the canvas changes size (inspector opened, side panel collapsed, window resized). */
function FitOnResize() {
  const { fitView } = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  useEffect(() => {
    if (!width || !height) return;
    const id = window.requestAnimationFrame(() => fitView({ ...fitViewOptions, duration: 0 }));
    return () => window.cancelAnimationFrame(id);
  }, [width, height, fitView]);
  return null;
}

/**
 * onSelectNode(id) fires on click, and on Enter or Space while a node has keyboard focus.
 * selectedId draws the selection ring on that node. The graph never decides selection itself.
 */
export function MissionGraph({
  mission,
  onSelectNode,
  selectedId = null,
}: {
  mission: Mission;
  onSelectNode?: (id: string) => void;
  selectedId?: string | null;
}) {
  const input = useMemo(
    () => layoutInputFrom(mission),
    // Only the slices the layout reads; node states are applied below without relayout.
    [mission.tasks, mission.deliverables.length, mission.sources.length, mission.blockedSources.length, mission.node.blocked?.state, mission.node.goal?.state],
  );
  const hasPlan = input.tasks.length > 0 || input.stopped;
  const layout = useMemo(() => computeLayout(input), [input]);
  const planKey = useMemo(() => layout.nodes.map((n) => n.id).join('|'), [layout]);

  // The latest HANDOFF pulses its edge for PULSE_MS. Keyed on the event seq, so replays do not re-trigger.
  const latest = mission.handoffs[mission.handoffs.length - 1];
  const [pulse, setPulse] = useState<string | null>(null);
  useEffect(() => {
    if (!latest) return;
    const id = `${latest.from}--${latest.to}`;
    setPulse(id);
    const t = window.setTimeout(() => setPulse((p) => (p === id ? null : p)), PULSE_MS);
    return () => window.clearTimeout(t);
  }, [latest?.seq]);

  const nodes = useMemo<MissionFlowNode[]>(
    () =>
      layout.nodes.map((n) => {
        const info = mission.node[n.id];
        const fallback = n.id === 'blocked' ? 'blocked' : 'pending';
        const selected = n.id === selectedId;
        return {
          id: n.id,
          type: 'mission',
          position: { x: n.x, y: n.y },
          width: n.w,
          height: n.h,
          draggable: false,
          selectable: true,
          selected,
          connectable: false,
          style: selected ? { borderRadius: 14, boxShadow: '0 0 0 3px var(--accent-weak), 0 0 0 5px var(--accent)' } : undefined,
          data: { role: n.role, sub: n.sub, state: info?.state ?? fallback, badge: info?.badge },
        };
      }),
    [layout, mission.node, selectedId],
  );

  // Keyboard: nodes are focusable (xyflow tabIndex). Enter or Space on a focused node selects it.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = (e.target as HTMLElement).closest<HTMLElement>('.react-flow__node')?.dataset.id;
    if (!id) return;
    e.preventDefault();
    onSelectNode?.(id);
  };

  const liveLoop = mission.node.repair?.state === 'repairing';
  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => {
        const loop = e.kind === 'loop';
        let className = '';
        if (loop) className = liveLoop ? 'tace-edge-loop tace-edge-loop-live' : 'tace-edge-loop';
        else if (e.kind === 'stop') className = 'tace-edge-stop';
        else if (pulse === e.id) className = 'tace-edge-flow';
        else if (mission.node[e.target]?.state === 'done') className = 'tace-edge-done';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: loop ? 'loopOut' : 'out',
          targetHandle: loop ? 'loopIn' : 'in',
          type: 'smoothstep',
          pathOptions: { borderRadius: 12 },
          className,
          selectable: false,
          focusable: false,
        };
      }),
    [layout, mission.node, pulse, liveLoop],
  );

  return (
    <section className="min-h-[200px] shrink-0 rounded-card border border-line bg-surface p-4 shadow" aria-labelledby="h-graph">
      <h2 id="h-graph" className="mb-3 text-[15px] font-semibold text-ink">
        Execution graph
      </h2>

      {hasPlan ? (
        <div className="tace-graph w-full" style={{ height: layout.height + 32 }} onKeyDown={onKeyDown}>
          <ReactFlow
            key={planKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => onSelectNode?.(node.id)}
            fitView
            fitViewOptions={fitViewOptions}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            minZoom={0.2}
            maxZoom={1.25}
            proOptions={proOptions}
          >
            <FitOnResize />
          </ReactFlow>
        </div>
      ) : (
        <div className="tace-empty">
          <p>Steps appear here once the plan is made.</p>
        </div>
      )}

      <Roster joined={mission.joined} tasks={mission.tasks} node={mission.node} agentsMode={mission.agents?.mode} />
    </section>
  );
}
