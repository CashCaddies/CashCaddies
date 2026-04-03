/**
 * PGA-style DFS golf fantasy scoring (CashCaddies).
 * Aggregate stats should treat hole-in-one as distinct from eagle/birdie counts when possible to avoid double-counting.
 *
 * Missed-cut (MC) players: `golfer_scores.total_score` is frozen after the cut (R1–2 fantasy + optional contest penalty);
 * counters no longer drive the total (`scoring_locked`). See `lib/golf-cut.ts` and `run_pga_cut_calculation`.
 */

export type HoleResult =
  | "birdie"
  | "eagle"
  | "albatross"
  | "par"
  | "bogey"
  | "double_bogey"
  | "hole_in_one";

export type RoundStats = {
  /** In hole order; used for per-round streak bonuses. */
  holes: HoleResult[];
};

export type PlayerTournamentStats = {
  birdies: number;
  eagles: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  holeInOnes: number;
  /** Official finishing place (1 = winner). 0 or negative = no placement points. */
  finishingPosition: number;
  /** True if the player recorded at least one bogey-free regulation round in the event. */
  bogeyFreeRound: boolean;
  /** Count of rounds completed under 70 gross strokes (0–4). Bonus at 4. */
  under70Rounds: number;
  /** Number of separate “3+ birdies in a row” streaks (each awards +3). */
  birdieStreaks: number;
};

const HOLE_POINTS: Record<HoleResult, number> = {
  birdie: 3,
  eagle: 8,
  albatross: 13,
  par: 0.5,
  bogey: -0.5,
  double_bogey: -1,
  hole_in_one: 10,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Single-hole fantasy points. */
export function calculateHoleScore(holeResult: HoleResult): number {
  return HOLE_POINTS[holeResult];
}

/** Count how many times 3+ birdies occur consecutively (each block counts once for +3 bonus). */
export function countBirdieStreakBonuses(holes: HoleResult[]): number {
  let i = 0;
  let bonuses = 0;
  while (i < holes.length) {
    if (holes[i] === "birdie") {
      let len = 0;
      while (i < holes.length && holes[i] === "birdie") {
        len += 1;
        i += 1;
      }
      if (len >= 3) {
        bonuses += 1;
      }
    } else {
      i += 1;
    }
  }
  return bonuses;
}

/**
 * Fantasy points for one round from hole-by-hole results.
 * Includes streak bonus (3+ birdies in a row = +3 per streak) and bogey-free round (+3 if no bogey/double on card).
 */
export function calculateRoundScore(roundStats: RoundStats): number {
  const { holes } = roundStats;
  let sum = 0;
  for (const h of holes) {
    sum += calculateHoleScore(h);
  }
  sum += countBirdieStreakBonuses(holes) * 3;
  const hasBogeyOrWorse = holes.some((h) => h === "bogey" || h === "double_bogey");
  if (!hasBogeyOrWorse) {
    sum += 3;
  }
  return round2(sum);
}

/** Placement points from finishing position (PGA DFS table). */
export function placementPoints(finishingPosition: number): number {
  const p = Math.floor(finishingPosition);
  if (!Number.isFinite(p) || p < 1) {
    return 0;
  }
  if (p === 1) return 30;
  if (p === 2) return 20;
  if (p === 3) return 18;
  if (p === 4) return 16;
  if (p === 5) return 14;
  if (p >= 6 && p <= 10) return 12;
  if (p >= 11 && p <= 15) return 10;
  if (p >= 16 && p <= 20) return 8;
  if (p >= 21 && p <= 25) return 6;
  if (p >= 26 && p <= 30) return 5;
  if (p >= 31 && p <= 40) return 4;
  if (p >= 41 && p <= 50) return 3;
  return 0;
}

/** Full tournament fantasy total from aggregate counters + bonuses + placement. */
export function calculateTournamentScore(stats: PlayerTournamentStats): number {
  const {
    birdies,
    eagles,
    pars,
    bogeys,
    doubleBogeys,
    holeInOnes,
    finishingPosition,
    bogeyFreeRound,
    under70Rounds,
    birdieStreaks,
  } = stats;

  let total = 0;
  total += birdies * 3;
  total += eagles * 8;
  total += pars * 0.5;
  total += bogeys * -0.5;
  total += doubleBogeys * -1;
  total += holeInOnes * 10;
  total += birdieStreaks * 3;
  if (bogeyFreeRound) {
    total += 3;
  }
  if (under70Rounds >= 4) {
    total += 5;
  }
  total += placementPoints(finishingPosition);
  return round2(total);
}

export type LineupGolferScore = {
  fantasyPoints: number;
};

/** Sum of roster golfer fantasy totals (lineup DFS score). */
export function calculateLineupScore(lineup: LineupGolferScore[]): number {
  const sum = lineup.reduce((s, g) => s + (Number.isFinite(g.fantasyPoints) ? g.fantasyPoints : 0), 0);
  return round2(sum);
}

/** Map DB / API snake_case row to tournament stats for `calculateTournamentScore`. */
export function playerStatsFromGolferScoresRow(row: {
  birdies?: number | null;
  pars?: number | null;
  bogeys?: number | null;
  double_bogeys?: number | null;
  eagles?: number | null;
  albatrosses?: number | null;
  hole_in_ones?: number | null;
  finishing_position?: number | null;
  bogey_free_round?: boolean | null;
  under_70_rounds?: number | null;
  birdie_streaks?: number | null;
}): PlayerTournamentStats {
  return {
    birdies: Math.max(0, Number(row.birdies ?? 0) || 0),
    eagles: Math.max(0, Number(row.eagles ?? 0) || 0),
    pars: Math.max(0, Number(row.pars ?? 0) || 0),
    bogeys: Math.max(0, Number(row.bogeys ?? 0) || 0),
    doubleBogeys: Math.max(0, Number(row.double_bogeys ?? 0) || 0),
    holeInOnes: Math.max(0, Number(row.hole_in_ones ?? 0) || 0),
    finishingPosition: Math.max(0, Number(row.finishing_position ?? 0) || 0),
    bogeyFreeRound: Boolean(row.bogey_free_round),
    under70Rounds: Math.max(0, Math.min(4, Number(row.under_70_rounds ?? 0) || 0)),
    birdieStreaks: Math.max(0, Number(row.birdie_streaks ?? 0) || 0),
  };
}
