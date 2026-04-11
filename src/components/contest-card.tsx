"use client";

import { useEffect, useState } from "react";
import {
  type ContestLifecycle,
  contestLifecycleBadgeClassName,
  contestLifecycleBadgeLabel,
  contestLockCountdownLabel,
} from "@/lib/contest-state";

/** Maps `contests.status` (DB) to lobby badge label — no date inference. */
export function contestLifecycleStatusBadgeClassName(status: string): string {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  switch (s) {
    case "filling":
      return "border-emerald-500/40 bg-emerald-950/40 text-emerald-200";
    case "locked":
      return "border-amber-500/40 bg-amber-950/35 text-amber-100";
    case "live":
      return "border-sky-500/40 bg-sky-950/35 text-sky-100";
    case "complete":
      return "border-violet-500/40 bg-violet-950/40 text-violet-100";
    case "settled":
      return "border-slate-500/50 bg-slate-900/80 text-slate-200";
    case "cancelled":
      return "border-rose-500/40 bg-rose-950/40 text-rose-100";
    default:
      return "border-[#3d4550] bg-[#1a1f26] text-[#a8b4c0]";
  }
}

export function contestLifecycleStatusBadgeLabel(status: string): string {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  switch (s) {
    case "filling":
      return "FILLING";
    case "locked":
      return "LOCKED";
    case "live":
      return "LIVE";
    case "complete":
      return "COMPLETE";
    case "settled":
      return "SETTLED";
    case "cancelled":
      return "CANCELLED";
    default:
      return s ? s.toUpperCase() : "—";
  }
}

/** Badge driven only by `contests.status` from Supabase. */
export function ContestLifecycleStatusBadge({ status }: { status: string | null | undefined }) {
  const raw = String(status ?? "").trim();
  if (!raw) {
    return null;
  }
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${contestLifecycleStatusBadgeClassName(raw)}`}
    >
      {contestLifecycleStatusBadgeLabel(raw)}
    </span>
  );
}

export function ContestLifecycleBadge({ lifecycle }: { lifecycle: ContestLifecycle }) {
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide ${contestLifecycleBadgeClassName(lifecycle)}`}
    >
      {contestLifecycleBadgeLabel(lifecycle)}
    </span>
  );
}

/** Capacity full: entries >= max_entries (lobby / contest list). */
export function ContestFullBadge() {
  return (
    <span className="shrink-0 rounded border border-[#ef4444]/40 bg-[#2a1515] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f87171]">
      FULL
    </span>
  );
}

/** Updates every second while mounted (open / upcoming lock countdown). */
export function ContestLockCountdown({
  lifecycle,
  startsAtIso,
}: {
  lifecycle: ContestLifecycle;
  startsAtIso: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const label = contestLockCountdownLabel(lifecycle, startsAtIso, now);
  if (!label) {
    return null;
  }
  return <span className="text-[10px] font-semibold tabular-nums text-[#8b98a5]">{label}</span>;
}

export { ENTRY_PROTECTED_BADGE, ENTRY_PROTECTED_TOOLTIP } from "@/lib/entry-protection";
