import { fantasyPointsFromDfsCounts } from "@/lib/scoring";

export type SimulationScenario =
  | "WD"
  | "RANDOM_WD"
  | "BAD_ROUND"
  | "HOT_ROUND"
  | "MISS_CUT"
  | "CHAOS";

/** Resolved scenarios stored in DB (CHAOS is resolved server-side before persist). */
export type ResolvedSimulationScenario = Exclude<SimulationScenario, "CHAOS">;

export type GolferSimState = {
  golferId: string;
  /** DFS fantasy points (from golfer_scores.total_score or golfers.fantasy_points). */
  dfsPoints: number;
  finishPositionPoints: number;
  countsAsZero: boolean;
  excludeFinishPosition: boolean;
};

export function contributionFromState(g: GolferSimState, simulatedWdGolferId: string | null): number {
  if (simulatedWdGolferId && g.golferId === simulatedWdGolferId) return 0;
  if (g.countsAsZero) return 0;
  const dfs = Math.max(0, g.dfsPoints);
  const finish = g.excludeFinishPosition ? 0 : Math.max(0, g.finishPositionPoints);
  return round2(dfs + finish);
}

export function lineupTotalFromStates(states: GolferSimState[], simulatedWdGolferId: string | null): number {
  const raw = states.reduce((sum, g) => sum + contributionFromState(g, simulatedWdGolferId), 0);
  return round2(raw);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function pickRandomGolferId(states: GolferSimState[]): string {
  if (states.length === 0) throw new Error("Empty lineup.");
  const i = randomInt(0, states.length - 1);
  return states[i]!.golferId;
}

function cloneStates(states: GolferSimState[]): GolferSimState[] {
  return states.map((s) => ({ ...s }));
}

/**
 * Random chaos weights: WD 25%, Bad round 35%, Miss cut 25%, Hot round 15%.
 * Does not include RANDOM_WD (use the Random WD button for that).
 */
export function pickWeightedChaosScenario(): "WD" | "BAD_ROUND" | "MISS_CUT" | "HOT_ROUND" {
  const r = Math.random() * 100;
  if (r < 25) return "WD";
  if (r < 60) return "BAD_ROUND";
  if (r < 85) return "MISS_CUT";
  return "HOT_ROUND";
}

/**
 * Applies scenario modifiers on a clone; never mutates input `states`.
 * `scenario` must not be CHAOS — resolve CHAOS in the server layer first.
 */
export function applySimulationScenario(
  states: GolferSimState[],
  scenario: ResolvedSimulationScenario,
  targetGolferId: string | null,
): {
  simulatedTotal: number;
  previousTotal: number;
  affectedGolferId: string | null;
  scenarioLabel: string;
  simulatedWdGolferId: string | null;
} {
  const previousTotal = lineupTotalFromStates(states, null);
  let affected: string | null = targetGolferId;
  let simWd: string | null = null;
  const working = cloneStates(states);

  if (scenario === "RANDOM_WD") {
    affected = pickRandomGolferId(working);
    simWd = affected;
    return {
      simulatedTotal: lineupTotalFromStates(working, simWd),
      previousTotal,
      affectedGolferId: affected,
      scenarioLabel: "Random WD",
      simulatedWdGolferId: simWd,
    };
  }

  if (scenario === "WD") {
    if (!affected) {
      throw new Error("Select a golfer for WD.");
    }
    simWd = affected;
    return {
      simulatedTotal: lineupTotalFromStates(working, simWd),
      previousTotal,
      affectedGolferId: affected,
      scenarioLabel: "WD",
      simulatedWdGolferId: simWd,
    };
  }

  if (!affected) {
    affected = pickRandomGolferId(working);
  }

  const idx = working.findIndex((g) => g.golferId === affected);
  if (idx < 0) {
    throw new Error("Golfer not on lineup.");
  }
  const g = working[idx]!;

  if (scenario === "BAD_ROUND") {
    const penalty = randomInt(5, 10);
    g.dfsPoints = Math.max(0, round2(g.dfsPoints - penalty));
    return {
      simulatedTotal: lineupTotalFromStates(working, null),
      previousTotal,
      affectedGolferId: affected,
      scenarioLabel: `Bad round (−${penalty} DFS pts)`,
      simulatedWdGolferId: null,
    };
  }

  if (scenario === "HOT_ROUND") {
    const bonus = randomInt(3, 8);
    g.dfsPoints = round2(g.dfsPoints + bonus);
    return {
      simulatedTotal: lineupTotalFromStates(working, null),
      previousTotal,
      affectedGolferId: affected,
      scenarioLabel: `Hot round (+${bonus} DFS pts)`,
      simulatedWdGolferId: null,
    };
  }

  if (scenario === "MISS_CUT") {
    g.dfsPoints = round2(g.dfsPoints * 0.5);
    if (!g.excludeFinishPosition) {
      g.finishPositionPoints = round2(g.finishPositionPoints * 0.5);
    }
    return {
      simulatedTotal: lineupTotalFromStates(working, null),
      previousTotal,
      affectedGolferId: affected,
      scenarioLabel: "Missed cut (weekend removed ~50%)",
      simulatedWdGolferId: null,
    };
  }

  throw new Error("Unsupported scenario.");
}

/** Rank 1 = best (highest score). Tie-break: entry id ascending. */
export function computePosition(
  scores: Array<{ entryId: string; score: number }>,
  entryId: string,
  overrideScore?: number,
): number {
  const list = scores.map((r) =>
    r.entryId === entryId ? { entryId: r.entryId, score: overrideScore ?? r.score } : r,
  );
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entryId.localeCompare(b.entryId);
  });
  const i = list.findIndex((r) => r.entryId === entryId);
  return i >= 0 ? i + 1 : scores.length + 1;
}

export function dfsFromCounts(row: {
  birdies: number;
  pars: number;
  bogeys: number;
  double_bogeys: number;
  eagles: number;
  albatrosses: number;
}): number {
  return fantasyPointsFromDfsCounts(row);
}
