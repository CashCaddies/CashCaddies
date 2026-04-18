export type LineupPerformanceTrend = "Up" | "Down" | "Neutral";

/** Compare latest total to last snapshot; unknown / missing → Neutral. */
export function getTrend(totalScore?: number, prevScore?: number | null): LineupPerformanceTrend {
  if (typeof totalScore !== "number" || typeof prevScore !== "number") return "Neutral";
  if (totalScore > prevScore) return "Up";
  if (totalScore < prevScore) return "Down";
  return "Neutral";
}
