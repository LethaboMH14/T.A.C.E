import { memo, useMemo } from 'react';
import type { Mission, NodeState } from '@/state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { kindLabel } from './roles';

type Joined = Mission['joined'][number];
type Tasks = Mission['tasks'];
type NodeMap = Mission['node'];

/** Which graph node an agent drives: by capability id, then by role name, then reviewer/repair. */
function nodeFor(j: Joined, tasks: Tasks): { id: string; role: string } {
  const byCap = tasks.find((t) => t.capabilityId === j.capabilityId);
  if (byCap) return { id: byCap.id, role: byCap.role };
  const byRole = tasks.find((t) => t.role === j.agent);
  if (byRole) return { id: byRole.id, role: byRole.role };
  if (/review/i.test(j.agent)) return { id: 'review', role: 'Reviewer' };
  if (/repair/i.test(j.agent)) return { id: 'repair', role: 'Repair' };
  return { id: '', role: j.agent };
}

export const Roster = memo(function Roster({
  joined,
  tasks,
  node,
  agentsMode,
}: {
  joined: Joined[];
  tasks: Tasks;
  node: NodeMap;
  agentsMode: 'model' | 'code' | undefined;
}) {
  // Derived rows only; the reason text stays the one from AGENT_JOINED.
  const rows = useMemo(
    () =>
      joined.map((j) => {
        const target = nodeFor(j, tasks);
        const state: NodeState | undefined = target.id ? node[target.id]?.state : undefined;
        return {
          key: `${j.capabilityId}-${j.agent}`,
          role: target.role,
          state: state ?? 'pending',
          kind: kindLabel(target.role, agentsMode),
          reason: j.reason,
          by: j.by,
        };
      }).concat(joined.length ? [
        // The checker and the fixer are always on the team, but they never "join" through the planner.
        { key: 'review', role: 'Reviewer', state: node.review?.state ?? 'pending', kind: kindLabel('Reviewer', agentsMode), reason: 'Independent: re-opens every file and recomputes from the raw sources', by: 'engine' },
        { key: 'repair', role: 'Repair', state: node.repair?.state ?? 'pending', kind: kindLabel('Repair', agentsMode), reason: 'Called only when a check fails; changes only what failed', by: 'engine' },
      ] : []),
    [joined, tasks, node, agentsMode],
  );

  if (rows.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <ul className="tace-roster" aria-label="Agents that joined this mission">
        {rows.map((r) => (
          <li key={r.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="tace-chip" tabIndex={0} data-state={r.state}>
                  <span className="tace-dot" aria-hidden />
                  {r.role} <span className="tace-kind">{r.kind}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {r.reason}
                {r.by ? <span className="block opacity-70">Joined by {r.by}</span> : null}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </TooltipProvider>
  );
});
