/**
 * PGA-style cut after round 2: top 65 and ties continue; others miss the cut (MC).
 */

export const PGA_CUT_COUNT = 65;

export type PlayerStrokeRow = {
  golferId: string;
  /** Lower is better (total strokes through end of R2). */
  strokesThruR2: number;
};

export type CutResultRow = {
  golferId: string;
  /** 1-based position when sorted by strokes (best = 1). Ties share the same stroke total but get sequential cut_position for display. */
  cutPosition: number;
  madeCut: boolean;
};

/**
 * Sort by strokes ascending (best first). Everyone tied with or better than the 65th score makes the cut.
 */
export function computePgaCutResults(players: PlayerStrokeRow[]): CutResultRow[] {
  if (players.length === 0) {
    return [];
  }

  const sorted = [...players].sort((a, b) => {
    if (a.strokesThruR2 !== b.strokesThruR2) {
      return a.strokesThruR2 - b.strokesThruR2;
    }
    return a.golferId.localeCompare(b.golferId);
  });

  const cutoffIndex = Math.min(PGA_CUT_COUNT - 1, sorted.length - 1);
  const cutoffStrokes = sorted[cutoffIndex].strokesThruR2;

  return sorted.map((p, index) => ({
    golferId: p.golferId,
    cutPosition: index + 1,
    madeCut: p.strokesThruR2 <= cutoffStrokes,
  }));
}

/** Effective missed-cut penalty from contest settings (0 = disabled). */
export function missedCutPenaltyFromContest(penalty: number | null | undefined): number {
  if (penalty == null || !Number.isFinite(penalty)) {
    return 0;
  }
  return penalty;
}
