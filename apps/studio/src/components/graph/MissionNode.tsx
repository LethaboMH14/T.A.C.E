import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Check, X } from 'lucide-react';
import type { NodeState, Tone } from '@/state';
import { iconFor } from './roles';

export interface MissionNodeData extends Record<string, unknown> {
  role: string;
  sub: string;
  state: NodeState;
  badge?: { text: string; tone: Tone };
}

export type MissionFlowNode = Node<MissionNodeData, 'mission'>;

const handleStyle = { opacity: 0, pointerEvents: 'none' as const, width: 6, height: 6 };

function Ring({ state }: { state: NodeState }) {
  const spin = state === 'running' || state === 'repairing';
  let mark = null;
  if (state === 'done') mark = <Check aria-hidden strokeWidth={2.6} />;
  if (state === 'failed' || state === 'blocked') mark = <X aria-hidden strokeWidth={2.6} />;
  return (
    <span className="tace-ring" data-spin={spin ? 'true' : undefined} aria-hidden>
      {mark}
    </span>
  );
}

function MissionNodeImpl({ data }: NodeProps<MissionFlowNode>) {
  const Icon = iconFor(data.role);
  return (
    <div className="tace-node" data-state={data.state} aria-label={`${data.role}: ${data.sub}, ${data.state}`}>
      <Handle id="in" type="target" position={Position.Left} style={{ ...handleStyle, top: '50%' }} isConnectable={false} />
      <Handle id="out" type="source" position={Position.Right} style={{ ...handleStyle, top: '50%' }} isConnectable={false} />
      <Handle id="loopOut" type="source" position={Position.Bottom} style={{ ...handleStyle, left: '50%' }} isConnectable={false} />
      <Handle id="loopIn" type="target" position={Position.Top} style={{ ...handleStyle, left: '50%' }} isConnectable={false} />
      <span className="tace-glyph">
        <Icon aria-hidden strokeWidth={1.7} />
      </span>
      <span className="tace-t">
        <span className="tace-role">{data.role}</span>
        <span className="tace-sub">{data.sub}</span>
      </span>
      <Ring state={data.state} />
      {data.badge ? <span className={`tace-badge ${data.badge.tone}`}>{data.badge.text}</span> : null}
    </div>
  );
}

export const MissionNode = memo(MissionNodeImpl);
MissionNode.displayName = 'MissionNode';
