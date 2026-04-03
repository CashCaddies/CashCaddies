/** Sum golfer fantasy points across a roster (client-side fallback when lineups.total_score not loaded). */
export function lineupTotalScore(players: Array<{ fantasy_points?: number }>): number {
  const raw = players.reduce((sum, p) => sum + Number(p.fantasy_points ?? 0), 0);
  return Math.round(raw * 10) / 10;
}

/** DFS golf fantasy — per-golfer round aggregate (CashCaddies rules). */
export const POINTS_BIRDIE = 3;
export const POINTS_PAR = 0.5;
export const POINTS_BOGEY = -1;
export const POINTS_DOUBLE_BOGEY = -3;
export const POINTS_EAGLE = 8;
export const POINTS_ALBATROSS = 13;

/** Full stat line → fantasy points (matches `golfer_scores.total_score` in the database). */
export function fantasyPointsFromDfsCounts(row: {
  birdies: number;
  pars: number;
  bogeys: number;
  double_bogeys: number;
  eagles: number;
  albatrosses: number;
}): number {
  const b = Number(row.birdies) || 0;
  const p = Number(row.pars) || 0;
  const bg = Number(row.bogeys) || 0;
  const db = Number(row.double_bogeys) || 0;
  const e = Number(row.eagles) || 0;
  const a = Number(row.albatrosses) || 0;
  const raw =
    POINTS_BIRDIE * b +
    POINTS_PAR * p +
    POINTS_BOGEY * bg +
    POINTS_DOUBLE_BOGEY * db +
    POINTS_EAGLE * e +
    POINTS_ALBATROSS * a;
  return Math.round(raw * 100) / 100;
}

/**
 * Legacy admin form: birdies / pars / bogeys only (double bogey, eagle, albatross default 0).
 * Uses current DFS points for bogey (-1).
 */
export function fantasyPointsFromCounts(birdies: number, pars: number, bogeys: number): number {
  return fantasyPointsFromDfsCounts({
    birdies,
    pars,
    bogeys,
    double_bogeys: 0,
    eagles: 0,
    albatrosses: 0,
  });
}
