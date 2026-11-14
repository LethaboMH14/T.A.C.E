import { useEffect, useState } from 'react';

/**
 * Phases of the repair moment: 0 clash shown, 1 the moved row is struck,
 * 2 the repaired row slides in, 3 the repair line and the re-check line may show.
 * With reduced motion the final phase is shown at once and nothing moves.
 */
export const FINAL_PHASE = 3;

export function useRepairPhase(active: boolean, reduce: boolean): number {
  const [phase, setPhase] = useState(reduce ? FINAL_PHASE : 0);

  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setPhase(FINAL_PHASE);
      return;
    }
    const timers = [
      setTimeout(() => setPhase(1), 350),
      setTimeout(() => setPhase(2), 1100),
      setTimeout(() => setPhase(FINAL_PHASE), 1700),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, reduce]);

  return phase;
}
