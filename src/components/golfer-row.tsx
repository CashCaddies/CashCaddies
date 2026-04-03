"use client";

import type { ReactNode } from "react";
import type { GolferLeaderboardRow } from "@/lib/leaderboard";
import {
  formatTeeTimeDisplay,
  type TeeWave,
  waveWeatherEmoji,
  waveWeatherHintForPlayer,
} from "@/lib/golf-tee-times";

type Props = {
  row: GolferLeaderboardRow;
  rowIndex: number;
  /** From full field (not filtered); null if not computable. */
  amWaveAdvantageStrokes: number | null;
  /** Premium / DFS beta: show tee, wave, and weather hint; otherwise blur and lock. */
  revealTeeWaveTools: boolean;
};

function WaveBadge({ wave }: { wave: TeeWave | null | undefined }) {
  if (wave === "AM") {
    return (
      <span className="inline-flex shrink-0 rounded border border-sky-500/45 bg-sky-950/50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-200">
        AM
      </span>
    );
  }
  if (wave === "PM") {
    return (
      <span className="inline-flex shrink-0 rounded border border-orange-600/50 bg-orange-950/45 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-200">
        PM
      </span>
    );
  }
  return <span className="text-[10px] text-[#6b7684]">—</span>;
}

function BlurredLockCell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[1.25rem] overflow-hidden">
      <div className="pointer-events-none select-none blur-[4px]" aria-hidden="true">
        {children}
      </div>
      <span
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-xs text-amber-400/90"
        aria-hidden="true"
      >
        🔒
      </span>
    </div>
  );
}

/** Single golfer row on the contest DFS leaderboard (tee / wave / scoring). */
export function GolferLeaderboardTableRow({
  row,
  rowIndex,
  amWaveAdvantageStrokes,
  revealTeeWaveTools,
}: Props) {
  const isMc = row.statusLabel === "MC";
  const baseRow = rowIndex % 2 === 0 ? "bg-[#0f1419]" : "bg-[#0c1015]";
  const weatherHint = waveWeatherHintForPlayer(row.wave, amWaveAdvantageStrokes);
  const weatherIcon = revealTeeWaveTools ? waveWeatherEmoji(weatherHint) : null;

  return (
    <tr className={`border-b border-[#232a33] ${baseRow} ${isMc ? "opacity-[0.88]" : ""}`}>
      <td className="px-4 py-3.5 pl-5 align-middle tabular-nums sm:px-5">
        <span className={`font-bold ${isMc ? "text-[#9aa5b1]" : "text-white"}`}>{row.rank}</span>
      </td>
      <td className="max-w-0 px-3 py-3.5 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          {weatherIcon ? (
            <span className="shrink-0 text-base leading-none" title={weatherHint}>
              {weatherIcon}
            </span>
          ) : null}
          {isMc ? (
            <span
              className="shrink-0 rounded border border-red-600/60 bg-red-950/50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-200"
              title="Missed cut"
            >
              MC
            </span>
          ) : null}
          <span
            className={`block min-w-0 truncate font-medium ${isMc ? "text-[#9aa5b1]" : "text-white"}`}
            title={row.golferName}
          >
            {row.golferName}
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3.5 align-middle text-xs tabular-nums text-[#c5cdd5]">
        {revealTeeWaveTools ? (
          <>
            {formatTeeTimeDisplay(row.teeTimeIso)}
            {row.teeTimeRound != null ? (
              <span className="ml-1 text-[10px] text-[#6b7684]">R{row.teeTimeRound}</span>
            ) : null}
          </>
        ) : (
          <BlurredLockCell>
            <span>
              {formatTeeTimeDisplay(row.teeTimeIso)}
              {row.teeTimeRound != null ? (
                <span className="ml-1 text-[10px] text-[#6b7684]">R{row.teeTimeRound}</span>
              ) : null}
            </span>
          </BlurredLockCell>
        )}
      </td>
      <td className="px-3 py-3.5 align-middle">
        {revealTeeWaveTools ? (
          <WaveBadge wave={row.wave} />
        ) : (
          <BlurredLockCell>
            <WaveBadge wave={row.wave} />
          </BlurredLockCell>
        )}
      </td>
      <td
        className={`px-3 py-3.5 align-middle text-right tabular-nums font-bold ${
          isMc ? "text-[#7a8a7a]" : "text-[#53d769]"
        }`}
      >
        {row.totalFantasyPoints.toFixed(1)}
      </td>
      <td className="px-3 py-3.5 text-center align-middle tabular-nums text-[#c5cdd5]">
        {row.cutPosition != null ? row.cutPosition : "—"}
      </td>
      <td className="px-3 py-3.5 text-center align-middle tabular-nums text-[#c5cdd5]">
        {row.finishingPosition != null ? row.finishingPosition : "—"}
      </td>
      <td className="px-3 py-3.5 text-right align-middle tabular-nums text-[#c5cdd5]">
        {row.roundFantasyPoints != null ? row.roundFantasyPoints.toFixed(1) : "—"}
      </td>
      <td className="px-4 py-3.5 pr-5 text-center align-middle sm:px-5">
        <span
          className={`text-xs font-bold uppercase tracking-wide ${
            isMc ? "text-red-300/95" : "text-emerald-200/90"
          }`}
        >
          {row.statusLabel}
        </span>
      </td>
    </tr>
  );
}
