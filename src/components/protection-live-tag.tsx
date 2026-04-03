"use client";

import type { ProtectionUiStatus } from "@/lib/dashboard-lineups";

const PROTECTED_HELP =
  "This lineup entry was protected due to a WD, DNS, or DQ event. Your entry fee was returned as Safety Coverage credit.";

const SWAP_HELP =
  "This golfer withdrew before tee time. You may swap to another golfer who has not teed off.";

const TEED_HELP = "This golfer has teed off for this contest.";

function labelFor(status: ProtectionUiStatus): string {
  if (status === "swap_available") return "SWAP AVAILABLE";
  if (status === "protected") return "PROTECTED";
  return "TEE'D OFF";
}

function helpFor(status: ProtectionUiStatus): string {
  if (status === "swap_available") return SWAP_HELP;
  if (status === "protected") return PROTECTED_HELP;
  return TEED_HELP;
}

function colorsFor(status: ProtectionUiStatus): string {
  if (status === "swap_available") {
    return "border-amber-500/60 bg-amber-950/50 text-amber-100";
  }
  if (status === "protected") {
    return "border-emerald-500/60 bg-emerald-950/40 text-emerald-100";
  }
  return "border-slate-600 bg-slate-900 text-slate-400";
}

type Props = {
  status: ProtectionUiStatus;
  /** ISO time when swap window ends (swap_available only). */
  swapAvailableUntil?: string | null;
  /** Compact for roster lists */
  compact?: boolean;
};

export function ProtectionLiveTag({ status, swapAvailableUntil, compact }: Props) {
  const title = helpFor(status);
  const swapNote =
    status === "swap_available" && swapAvailableUntil
      ? ` Swap available until replacement golfer tee time (${formatWhen(swapAvailableUntil)}).`
      : "";

  return (
    <span className={`inline-flex max-w-full items-center gap-1 ${compact ? "" : "mt-1"}`}>
      <span
        className={`inline-flex min-h-[1.5rem] items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colorsFor(status)}`}
        title={title + swapNote}
      >
        {labelFor(status)}
      </span>
      <span
        className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[11px] font-bold text-slate-400"
        title={title + swapNote}
        aria-label="Safety Coverage status details"
      >
        ?
      </span>
    </span>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}
