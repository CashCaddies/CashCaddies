"use client";

import Image from "next/image";
import type { GolferRow } from "@/lib/golfers";

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-4 w-4 text-[#8b98a5]"}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V11a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z" />
    </svg>
  );
}

export type LineupPlayerCardProps = {
  slotIndex: number;
  golfer: GolferRow | undefined;
  /** Server: game started or explicit lock */
  slotLocked: boolean;
  countdownLabel: string | null;
  lateSwapActive: boolean;
  swapTargetActive: boolean;
  /** Full contest lock with no late swap (disables swap/remove) */
  rosterFrozen: boolean;
  onSwap: () => void;
  onRemove: () => void;
};

export function LineupPlayerCard({
  slotIndex,
  golfer,
  slotLocked,
  countdownLabel,
  lateSwapActive,
  swapTargetActive,
  rosterFrozen,
  onSwap,
  onRemove,
}: LineupPlayerCardProps) {
  const lockedVisual = slotLocked && lateSwapActive;

  return (
    <div
      className={`flex items-center gap-2 rounded border px-3 py-2.5 ${
        lockedVisual
          ? "border-[#3d4550] bg-[#1a1f26]/90 opacity-95"
          : swapTargetActive
            ? "border-emerald-500/50 bg-emerald-950/25"
            : "border-[#2a3039] bg-[#141920]"
      }`}
    >
      <span className="w-7 shrink-0 text-xs font-bold uppercase text-[#6b7684]">G{slotIndex + 1}</span>
      {golfer ? (
        <>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#2a3039]">
            {golfer.image_url ? (
              <Image
                src={golfer.image_url}
                alt={golfer.name}
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center text-[10px] font-bold text-[#6b7684]">
                {golfer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${lockedVisual ? "text-[#9aa5b1]" : "text-white"}`}>
              {golfer.name}
            </p>
            <p className={`text-xs tabular-nums ${lockedVisual ? "text-[#6b7684]" : "text-[#53d769]"}`}>
              ${golfer.salary.toLocaleString()}
            </p>
            {lateSwapActive && lockedVisual ? (
              <p className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#8b98a5]">
                <LockIcon className="h-3 w-3" />
                LOCKED
              </p>
            ) : null}
            {lateSwapActive && !slotLocked && countdownLabel ? (
              <p className="mt-0.5 text-[10px] font-medium tabular-nums text-amber-200/90">{countdownLabel}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-1 self-start">
            {lateSwapActive && !rosterFrozen ? (
              <button
                type="button"
                disabled={slotLocked}
                onClick={onSwap}
                className="rounded border border-[#2d7a3a] bg-[#1f8a3b]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#249544] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Swap
              </button>
            ) : null}
            {!lateSwapActive ? (
              <button
                type="button"
                disabled={rosterFrozen}
                onClick={onRemove}
                className="rounded border border-[#5c2a2a] bg-[#2a1818] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-200 hover:bg-[#3d2222] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <span className="flex-1 text-xs text-[#4a5560]">— Open —</span>
      )}
    </div>
  );
}
