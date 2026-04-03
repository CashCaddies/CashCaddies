"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { GolferLeaderboardRow } from "@/lib/leaderboard";
import { GolferLeaderboardTableRow } from "@/components/golfer-row";
import { PremiumGate } from "@/components/premium-gate";
import { WavePerformanceStatsPanel } from "@/components/wave-stats";
import {
  computeWavePerformanceStats,
  filterGolfersByWave,
  formatWaveAdvantageLine,
  type WaveFilter,
} from "@/lib/golf-tee-times";

type Props = {
  rows: GolferLeaderboardRow[];
  /** Tee waves, filters, and wave stats require premium or DFS beta tester. */
  hasPremiumToolsAccess: boolean;
  /** Optional crown / beta chips next to the section title (viewer only). */
  statusBadges?: ReactNode;
};

/** Contest-scoped golfer fantasy scoring table with AM/PM wave filters and wave performance box. */
export function GolfLeaderboard({ rows, hasPremiumToolsAccess, statusBadges }: Props) {
  const [waveFilter, setWaveFilter] = useState<WaveFilter>("all");

  const effectiveWaveFilter: WaveFilter = hasPremiumToolsAccess ? waveFilter : "all";

  const waveStats = useMemo(
    () =>
      computeWavePerformanceStats(
        rows.map((r) => ({ wave: r.wave, scoreVsPar: r.teeRoundVsPar })),
      ),
    [rows],
  );

  const advantageLine = formatWaveAdvantageLine(waveStats);
  const amWaveAdvantageStrokes = waveStats.amWaveAdvantageStrokes;

  const filteredRows = useMemo(() => {
    const f = filterGolfersByWave(rows, effectiveWaveFilter);
    return f.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, effectiveWaveFilter]);

  return (
    <section className="border-x border-[#2a3039] bg-[#141920] px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Golfer scoring</h2>
        {statusBadges ? <div className="flex flex-wrap items-center gap-1.5">{statusBadges}</div> : null}
      </div>
      <p className="mt-1 text-xs text-[#6b7684]">
        Tee waves (AM before noon Eastern / PM after) and score-vs-par averages by wave. Filter the table; wave stats
        use the full field. After the R2 cut, MC players stay frozen.
      </p>

      <PremiumGate hasAccess={hasPremiumToolsAccess} className="mt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b98a5]">Wave</span>
            {(["all", "AM", "PM"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setWaveFilter(key)}
                className={`rounded border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  effectiveWaveFilter === key
                    ? key === "AM"
                      ? "border-sky-500/60 bg-sky-950/40 text-sky-100"
                      : key === "PM"
                        ? "border-orange-600/60 bg-orange-950/40 text-orange-100"
                        : "border-[#3d4550] bg-[#1c2128] text-white"
                    : "border-[#2a3039] bg-[#0f1419] text-[#8b98a5] hover:border-[#3d4550] hover:text-[#c5cdd5]"
                }`}
              >
                {key === "all" ? "All" : key}
              </button>
            ))}
          </div>

          <WavePerformanceStatsPanel stats={waveStats} advantageLine={advantageLine} />
        </div>
      </PremiumGate>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[#2a3039] bg-[#0f1419]">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Golfer fantasy leaderboard with tee times and waves
          </caption>
          <thead>
            <tr className="border-b border-[#2a3039] bg-[#1a1f26] text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              <th className="w-[6%] px-4 py-3 pl-5 sm:px-5">Pos</th>
              <th className="w-[22%] px-3 py-3">Golfer</th>
              <th className="w-[14%] px-3 py-3">Tee</th>
              <th className="w-[8%] px-3 py-3">Wave</th>
              <th className="w-[12%] px-3 py-3 text-right">Fantasy</th>
              <th className="w-[8%] px-3 py-3 text-center">Cut</th>
              <th className="w-[8%] px-3 py-3 text-center">Finish</th>
              <th className="w-[10%] px-3 py-3 text-right">Round</th>
              <th className="w-[12%] px-4 py-3 pr-5 text-center sm:px-5">Status</th>
            </tr>
          </thead>
          <tbody className="text-[#e8ecf0]">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[#6b7684]">
                  {rows.length === 0
                    ? "No golfer stats for this contest yet. Use admin tools when enabled."
                    : "No golfers in this wave — try All."}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, i) => (
                <GolferLeaderboardTableRow
                  key={row.golferId}
                  row={row}
                  rowIndex={i}
                  amWaveAdvantageStrokes={amWaveAdvantageStrokes}
                  revealTeeWaveTools={hasPremiumToolsAccess}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
