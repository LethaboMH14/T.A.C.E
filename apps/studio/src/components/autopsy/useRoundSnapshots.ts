import { useMemo } from 'react';
import type { Check, Mission } from '@/state';

export type StoredCheck = Check & { round: number; seq: number };

/**
 * The failing checks of each review round, exactly as the ledger had them when that round
 * failed. The reducer snapshots them on VERIFICATION_FAILED (CHECK_RESULT events always come
 * first), so this does not depend on React render timing, even on a fast replay.
 */
export function useRoundSnapshots(mission: Mission): Map<number, StoredCheck[]> {
  return useMemo(() => {
    const byRound = new Map<number, StoredCheck[]>();
    for (const r of mission.rounds) if (r.checks?.length) byRound.set(r.round, r.checks as StoredCheck[]);
    return byRound;
  }, [mission.rounds]);
}
