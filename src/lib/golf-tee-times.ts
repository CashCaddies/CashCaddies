/**
 * PGA tee-sheet waves (AM/PM) and aggregate “wave advantage” for DFS-style tooling.
 * Noon boundary uses the same zone as the DB trigger (`America/New_York`) by default.
 */

export type TeeWave = "AM" | "PM";

export const DEFAULT_TEE_TIMEZONE = "America/New_York";
/** Local hour 0–11 => AM; 12–23 => PM (12:00 PM is PM). */
export const WAVE_NOON_HOUR_LOCAL = 12;

/**
 * Assign wave from an instant: before local noon => AM, else PM.
 */
export function assignWaveFromTeeTime(
  teeTimeMs: number,
  timeZone: string = DEFAULT_TEE_TIMEZONE,
): TeeWave | null {
  if (!Number.isFinite(teeTimeMs)) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(teeTimeMs));
  const hourStr = parts.find((p) => p.type === "hour")?.value;
  const hour = hourStr != null ? Number.parseInt(hourStr, 10) : NaN;
  if (!Number.isFinite(hour)) {
    return null;
  }
  return hour < WAVE_NOON_HOUR_LOCAL ? "AM" : "PM";
}

export type WaveStatInput = {
  wave: TeeWave | null | undefined;
  /** Score vs par for the tee round (lower is better). Omit/null rows from averages. */
  scoreVsPar: number | null | undefined;
};

export type WavePerformanceStats = {
  amAverageVsPar: number | null;
  pmAverageVsPar: number | null;
  /** Positive => AM side scored better vs par (lower numbers); PM avg minus AM avg. */
  amWaveAdvantageStrokes: number | null;
  amCount: number;
  pmCount: number;
};

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return Math.round((s / nums.length) * 10) / 10;
}

/**
 * Average `tee_round_vs_par` (or equivalent) by wave; advantage = PM_avg − AM_avg
 * (positive means AM group was better vs par).
 */
export function computeWavePerformanceStats(rows: WaveStatInput[]): WavePerformanceStats {
  const amScores: number[] = [];
  const pmScores: number[] = [];
  for (const r of rows) {
    if (r.scoreVsPar == null || !Number.isFinite(r.scoreVsPar)) continue;
    if (r.wave === "AM") amScores.push(r.scoreVsPar);
    else if (r.wave === "PM") pmScores.push(r.scoreVsPar);
  }
  const amAverageVsPar = mean(amScores);
  const pmAverageVsPar = mean(pmScores);
  let amWaveAdvantageStrokes: number | null = null;
  if (amAverageVsPar != null && pmAverageVsPar != null) {
    amWaveAdvantageStrokes = Math.round((pmAverageVsPar - amAverageVsPar) * 10) / 10;
  }
  return {
    amAverageVsPar,
    pmAverageVsPar,
    amWaveAdvantageStrokes,
    amCount: amScores.length,
    pmCount: pmScores.length,
  };
}

/** e.g. "AM wave advantage: +2.1 strokes" */
export function formatWaveAdvantageLine(stats: WavePerformanceStats): string | null {
  if (stats.amWaveAdvantageStrokes == null) {
    return null;
  }
  const v = stats.amWaveAdvantageStrokes;
  const sign = v > 0 ? "+" : "";
  return `AM wave advantage: ${sign}${v.toFixed(1)} strokes`;
}

export type WaveWeatherHint = "favorable" | "difficult" | "neutral";

/**
 * Optional polish: if AM has advantage, AM tee group “favorable”; PM favorable if AM disadvantage.
 */
export function waveWeatherHintForPlayer(
  wave: TeeWave | null | undefined,
  amWaveAdvantageStrokes: number | null | undefined,
): WaveWeatherHint {
  if (wave !== "AM" && wave !== "PM") return "neutral";
  if (amWaveAdvantageStrokes == null || amWaveAdvantageStrokes === 0) return "neutral";
  if (amWaveAdvantageStrokes > 0) {
    return wave === "AM" ? "favorable" : "difficult";
  }
  return wave === "PM" ? "favorable" : "difficult";
}

export function waveWeatherEmoji(hint: WaveWeatherHint): string {
  switch (hint) {
    case "favorable":
      return "🌤️";
    case "difficult":
      return "🌧️";
    default:
      return "";
  }
}

/** Short local tee time label (Eastern default, matches wave trigger). */
export function formatTeeTimeDisplay(
  teeTimeIso: string | null | undefined,
  timeZone: string = DEFAULT_TEE_TIMEZONE,
): string {
  if (teeTimeIso == null || String(teeTimeIso).trim() === "") {
    return "—";
  }
  const t = Date.parse(String(teeTimeIso));
  if (!Number.isFinite(t)) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(t);
}

export type WaveFilter = "all" | "AM" | "PM";

export function filterGolfersByWave<T extends { wave?: TeeWave | null }>(
  rows: T[],
  filter: WaveFilter,
): T[] {
  if (filter === "all") return rows;
  return rows.filter((r) => r.wave === filter);
}
