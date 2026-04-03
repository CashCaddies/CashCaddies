/**
 * Lineup Intelligence (Feature 3) — derived from Contest Lab simulation_results only.
 * Pure functions; no I/O.
 */

export type SimulationResultRow = {
  scenario: string;
  position_change: number;
  previous_position: number;
  simulated_position: number;
  score_change?: number | null;
};

export type LineupIntelligence = {
  simulationCount: number;
  unlocked: boolean;
  riskLevel: "Safe" | "Balanced" | "Aggressive" | null;
  /** Average absolute position movement; capped 0–10 for display. */
  volatilityScore: number | null;
  wdExposure: "Low" | "Medium" | "High" | null;
  cutRisk: "Low" | "Medium" | "High" | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Rank got worse when simulated_position > previous_position. */
function positionDrop(row: SimulationResultRow): number {
  return Math.max(0, row.simulated_position - row.previous_position);
}

function wdScenario(s: string): boolean {
  return s === "WD" || s === "RANDOM_WD";
}

function cutScenario(s: string): boolean {
  return s === "MISS_CUT";
}

/**
 * Volatility: average absolute position_change; display scale 0–10 (cap).
 * Risk bands on that average: 0–3 Safe, 4–8 Balanced, 9+ Aggressive.
 */
export function computeLineupIntelligence(rows: SimulationResultRow[]): LineupIntelligence {
  const simulationCount = rows.length;
  if (simulationCount < 2) {
    return {
      simulationCount,
      unlocked: false,
      riskLevel: null,
      volatilityScore: null,
      wdExposure: null,
      cutRisk: null,
    };
  }

  const absMoves = rows.map((r) => Math.abs(Number(r.position_change ?? 0)));
  const avgAbs = absMoves.reduce((a, b) => a + b, 0) / absMoves.length;
  const volatilityScore = round1(Math.min(10, avgAbs));

  let riskLevel: LineupIntelligence["riskLevel"];
  if (avgAbs <= 3) {
    riskLevel = "Safe";
  } else if (avgAbs <= 8) {
    riskLevel = "Balanced";
  } else {
    riskLevel = "Aggressive";
  }

  const wdDrops = rows.filter((r) => wdScenario(r.scenario)).map(positionDrop);
  const maxWdDrop = wdDrops.length ? Math.max(...wdDrops) : 0;
  let wdExposure: LineupIntelligence["wdExposure"];
  if (wdDrops.length === 0) {
    wdExposure = "Low";
  } else if (maxWdDrop > 15) {
    wdExposure = "High";
  } else if (maxWdDrop > 8) {
    wdExposure = "Medium";
  } else {
    wdExposure = "Low";
  }

  const cutDrops = rows.filter((r) => cutScenario(r.scenario)).map(positionDrop);
  const maxCutDrop = cutDrops.length ? Math.max(...cutDrops) : 0;
  let cutRisk: LineupIntelligence["cutRisk"];
  if (cutDrops.length === 0) {
    cutRisk = "Low";
  } else if (maxCutDrop > 15) {
    cutRisk = "High";
  } else if (maxCutDrop > 8) {
    cutRisk = "Medium";
  } else {
    cutRisk = "Low";
  }

  return {
    simulationCount,
    unlocked: true,
    riskLevel,
    volatilityScore,
    wdExposure,
    cutRisk,
  };
}
