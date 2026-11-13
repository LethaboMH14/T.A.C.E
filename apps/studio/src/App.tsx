import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { MissionHeader } from '@/components/MissionHeader';
import { GoalPanel } from '@/components/GoalPanel';
import { SourcesPanel } from '@/components/SourcesPanel';
import { ActivityFeed } from '@/components/ActivityFeed';
import { MissionGraph } from '@/components/MissionGraph';
import { ReviewPanel } from '@/components/ReviewPanel';
import { QuestionCard } from '@/components/QuestionCard';
import { AgentRoom } from '@/components/AgentRoom';
import { ModelMeter } from '@/components/ModelMeter';
import { FilesPanel } from '@/components/FilesPanel';
import { useMission } from '@/state';

export default function App() {
  const [runId, setRunId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('run'));
  const mission = useMission(runId);

  useEffect(() => {
    const url = runId ? `?run=${encodeURIComponent(runId)}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [runId]);

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <TopBar runId={runId} onRunChange={setRunId} />
      <MissionHeader mission={mission} />

      <main className="mx-auto grid max-w-[1600px] grid-cols-[300px_minmax(0,1fr)_400px] items-start gap-4 px-6 pt-4 max-[1280px]:grid-cols-[280px_minmax(0,1fr)] max-[860px]:grid-cols-[minmax(0,1fr)] max-[860px]:gap-3 max-[860px]:px-4 max-[860px]:pt-3">
        <aside className="flex min-w-0 flex-col gap-4 max-[860px]:order-2">
          <GoalPanel mission={mission} />
          <SourcesPanel mission={mission} />
          <ActivityFeed mission={mission} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4 max-[860px]:order-1">
          <QuestionCard mission={mission} />
          <MissionGraph mission={mission} />
          <AgentRoom mission={mission} />
          <ModelMeter mission={mission} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 max-[1280px]:col-span-full max-[860px]:order-3">
          <ReviewPanel mission={mission} />
        </aside>
      </main>

      <section className="mx-auto mt-4 max-w-[1552px] max-[860px]:mx-4 max-[860px]:mt-3" aria-label="Files">
        <FilesPanel mission={mission} />
      </section>

      <footer className="mx-auto flex items-center justify-center gap-2 px-6 pb-7 pt-[22px] text-center text-[13px] text-ink-3">
        <Lock className="h-[15px] w-[15px] shrink-0" aria-hidden />
        <span>
          Synthetic data only. Workers are deterministic code. Nothing is sent: messages stay as drafts until a person approves them.
        </span>
      </footer>
    </div>
  );
}
