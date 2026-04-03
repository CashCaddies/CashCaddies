"use client";

import {
  TIER_MIN_POINTS,
  TIER_ORDER,
  getTierProgress,
  overallTierJourneyPercent,
  type TierName,
} from "@/lib/loyalty";
import { tierBadgeClass } from "@/lib/wallet";

function tierLabelClass(tier: TierName, current: TierName): string {
  const order = TIER_ORDER.indexOf(tier);
  const cur = TIER_ORDER.indexOf(current);
  if (tier === current) return "font-semibold text-white";
  if (order < cur) return "text-emerald-400/90";
  return "text-slate-500";
}

export function TierProgressBar({
  points,
  variant = "default",
}: {
  points: number;
  variant?: "default" | "compact";
}) {
  const progress = getTierProgress(points);
  const journeyPct = overallTierJourneyPercent(points);
  const isCompact = variant === "compact";

  return (
    <div className={isCompact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-slate-400 ${isCompact ? "text-[11px]" : "text-sm"}`}>Tier progression</p>
        {progress.nextTier && progress.pointsToNextTier !== null ? (
          <p className={`tabular-nums text-slate-500 ${isCompact ? "text-[10px]" : "text-xs"}`}>
            {progress.pointsToNextTier.toLocaleString()} pts to {progress.nextTier}
          </p>
        ) : (
          <p className={`text-emerald-400/90 ${isCompact ? "text-[10px]" : "text-xs"}`}>Maximum tier</p>
        )}
      </div>

      <div
        className={`relative overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700/80 ${isCompact ? "h-2" : "h-3"}`}
        role="progressbar"
        aria-valuenow={Math.round(journeyPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Loyalty tier progress toward Platinum: ${Math.round(journeyPct)} percent`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-slate-300 to-violet-500 transition-[width] duration-500 ease-out"
          style={{ width: `${journeyPct}%` }}
        />
      </div>

      <div
        className={`grid grid-cols-4 gap-1 ${isCompact ? "text-[10px]" : "text-xs"}`}
        aria-hidden
      >
        {TIER_ORDER.map((tier) => (
          <div key={tier} className="text-center">
            <span
              className={`inline-flex max-w-full justify-center truncate rounded px-1 py-0.5 ${tierLabelClass(tier, progress.tier)} ${
                tier === progress.tier ? `ring-1 ${tierBadgeClass(tier)}` : ""
              }`}
            >
              {tier}
            </span>
            <div className={`mt-0.5 tabular-nums text-slate-600 ${isCompact ? "text-[9px]" : "text-[10px]"}`}>
              {TIER_MIN_POINTS[tier].toLocaleString()}
              {tier === "Platinum" ? "+" : ""}
            </div>
          </div>
        ))}
      </div>

      {!isCompact && progress.nextTier && (
        <p className="text-xs text-slate-500">
          Within {progress.tier}: {Math.round(progress.progressPercent)}% to {progress.nextTier} (
          {progress.rangeMin.toLocaleString()}–{progress.rangeMax?.toLocaleString()} pts)
        </p>
      )}
    </div>
  );
}
