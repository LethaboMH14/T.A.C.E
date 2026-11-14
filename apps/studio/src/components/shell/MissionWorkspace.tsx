import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ListTree, Radio, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MissionHeader } from '@/components/MissionHeader';
import { QuestionCard } from '@/components/QuestionCard';
import { MissionGraph } from '@/components/MissionGraph';
import { GoalPanel } from '@/components/GoalPanel';
import { SourcesPanel } from '@/components/SourcesPanel';
import { ActivityFeed } from '@/components/ActivityFeed';
import { AgentRoom } from '@/components/AgentRoom';
import { ModelMeter } from '@/components/ModelMeter';
import { ReviewPanel } from '@/components/ReviewPanel';
import { Timeline } from '@/components/Timeline';
import { SourceIntake } from '@/components/live/SourceIntake';
import { DeliverBar } from '@/components/deliver/DeliverBar';
import { onFocusRequest, takeFocus } from '@/state/notifications';
import { cn } from '@/lib/utils';
import { Inspector, type InspectorSelection } from '@/components/inspector/Inspector';
import type { Mission } from '@/state';

/**
 * The mission view: header, question, execution graph in the centre; bottom tab strip; Inspector on the right
 * when something is selected. Only the centre column and tab panels scroll. The page itself does not.
 * Parent passes key={runId} so a new run starts with no selection.
 */
export function MissionWorkspace({ mission, runId }: { mission: Mission; runId: string | null }) {
  const [selection, setSelection] = useState<InspectorSelection>(null);
  const [tab, setTab] = useState('activity');
  const [panelOpen, setPanelOpen] = useState(true);

  // A notice asked for a node of this run: open it in the inspector.
  useEffect(() => {
    const apply = () => {
      const r = takeFocus(runId);
      if (r?.nodeId) setSelection({ type: 'node', id: r.nodeId });
    };
    apply();
    return onFocusRequest(apply);
  }, [runId]);

  if (!runId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-[26px] font-bold tracking-[-0.01em] text-ink">No mission open</h1>
        <p className="m-0 max-w-[58ch] text-[15px] text-ink-2">
          Describe a goal above, or press ⌘K to pick a scenario.
        </p>
      </div>
    );
  }

  const selectedNode = selection?.type === 'node' ? selection.id : null;

  return (
    <div className="flex min-h-0 flex-1 max-[719px]:flex-col">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col max-[719px]:flex-none">
        <MissionHeader mission={mission} />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 max-[719px]:overflow-visible">
          <QuestionCard mission={mission} />
          <SourceIntake mission={mission} />
          <DeliverBar mission={mission} />
          <MissionGraph mission={mission} onSelectNode={(id: string) => setSelection({ type: 'node', id })} selectedId={selectedNode} />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setPanelOpen(true);
          }}
          className={cn('flex shrink-0 flex-col border-t border-line bg-bg max-[719px]:h-auto max-[719px]:min-h-0', panelOpen ? 'h-[36%] min-h-[240px]' : 'h-auto')}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2 max-[719px]:overflow-x-auto">
            <TabsList aria-label="Mission detail">
              <TabsTrigger value="activity"><Activity className="h-4 w-4" aria-hidden />Activity</TabsTrigger>
              <TabsTrigger value="agents"><Radio className="h-4 w-4" aria-hidden />Agent room</TabsTrigger>
              <TabsTrigger value="timeline"><ListTree className="h-4 w-4" aria-hidden />Timeline</TabsTrigger>
              <TabsTrigger value="review"><ShieldCheck className="h-4 w-4" aria-hidden />Review</TabsTrigger>
            </TabsList>
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              aria-expanded={panelOpen}
              aria-label={panelOpen ? 'Collapse details' : 'Expand details'}
              title={panelOpen ? 'Collapse details' : 'Expand details'}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-field text-ink-2 hover:bg-sunken"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-150 ease-out motion-reduce:transition-none', !panelOpen && 'rotate-180')} aria-hidden />
            </button>
          </div>
          <TabsContent value="activity" className={cn('min-h-0 flex-1 overflow-auto p-4 outline-none max-[719px]:overflow-visible', !panelOpen && 'hidden')}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[1000px]:grid-cols-1">
              <div className="flex min-w-0 flex-col gap-4">
                <GoalPanel mission={mission} />
                <SourcesPanel mission={mission} />
              </div>
              <ActivityFeed mission={mission} />
            </div>
          </TabsContent>
          <TabsContent value="agents" className={cn('min-h-0 flex-1 overflow-auto p-4 outline-none max-[719px]:overflow-visible', !panelOpen && 'hidden')}>
            <div className="flex flex-col gap-4">
              <AgentRoom mission={mission} />
              <ModelMeter mission={mission} />
            </div>
          </TabsContent>
          <TabsContent value="timeline" className={cn('min-h-0 flex-1 overflow-auto p-4 outline-none max-[719px]:overflow-visible', !panelOpen && 'hidden')}>
            <Timeline mission={mission} />
          </TabsContent>
          <TabsContent value="review" className={cn('min-h-0 flex-1 overflow-auto p-4 outline-none max-[719px]:overflow-visible', !panelOpen && 'hidden')}>
            <ReviewPanel mission={mission} />
          </TabsContent>
        </Tabs>
      </section>

      {selection ? (
        <aside
          aria-label="Inspector"
          className="flex min-h-0 w-[380px] shrink-0 flex-col overflow-auto border-l border-line bg-surface max-[1180px]:w-[320px] max-[719px]:w-full max-[719px]:border-l-0 max-[719px]:border-t"
        >
          <Inspector mission={mission} selection={selection} onClose={() => setSelection(null)} />
        </aside>
      ) : null}
    </div>
  );
}
