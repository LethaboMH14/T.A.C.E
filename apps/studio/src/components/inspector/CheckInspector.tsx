import type { Mission } from '@/state';
import { EvidenceXRay } from '../EvidenceXRay';

/** A check from the latest ledger result. Same content as the Evidence X-Ray, opened from the inspector. */
export function CheckInspector({ mission, id }: { mission: Mission; id: string }) {
  const check = mission.checks[id];
  if (!check) {
    return <p className="m-0 text-[13.5px] text-ink-3">No CHECK_RESULT for {id} in this run yet.</p>;
  }
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[12.5px] text-ink-3">
        {check.artifact} · round {check.round} · {check.status}
      </p>
      <EvidenceXRay check={check} sources={mission.sources} />
    </div>
  );
}
