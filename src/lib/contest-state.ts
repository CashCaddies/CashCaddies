/**
 * Effective DFS lifecycle for display and client-side gating.
 * DB column: `contests.status`; optional `contest_settlements` row → settled via `has_settlement`.
 */

/** Time after `starts_at` before the contest is treated as Live (late swap, live UI). */
export const CONTEST_LIVE_AFTER_START_MS = 5 * 60 * 1000;

export type ContestLifecycle =
  | "upcoming"
  | "filling"
  | "locked"
  | "live"
  | "complete"
  | "settled"
  | "cancelled";

export type ContestLifecycleInput = {
  status?: string | null;
  starts_at: string;
  entries_open_at?: string | null;
  created_at?: string | null;
  has_settlement?: boolean;
  nowMs?: number;
};

function parseMs(iso: string | null | undefined): number {
  if (iso == null || String(iso).trim() === "") return NaN;
  const t = Date.parse(String(iso));
  return Number.isFinite(t) ? t : NaN;
}

/** Map `contests.status` to a canonical lifecycle bucket (before time overlay). */
export function normalizeDbContestStatus(status: string | null | undefined): ContestLifecycle | null {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "settled") return "settled";
  if (s === "complete") return "complete";
  if (s === "live") return "live";
  if (s === "locked") return "locked";
  if (s === "filling") return "filling";
  return null;
}

/**
 * Resolved lifecycle for UI and related gating.
 * Time rules: after `starts_at` until `starts_at + 5m` → locked display when status is still filling;
 * after that window → live when DB has not yet advanced.
 */
export function resolveEffectiveContestLifecycle(input: ContestLifecycleInput): ContestLifecycle {
  const now = input.nowMs ?? Date.now();
  const db = normalizeDbContestStatus(input.status);

  if (db === "cancelled") {
    return "cancelled";
  }
  if (input.has_settlement) {
    return "settled";
  }
  if (db === "settled") {
    return "settled";
  }
  if (db === "complete") {
    return "complete";
  }

  const startMs = parseMs(input.starts_at);
  const openMs = parseMs(input.entries_open_at ?? input.created_at);
  const liveGateMs = Number.isFinite(startMs) ? startMs + CONTEST_LIVE_AFTER_START_MS : NaN;

  if (db === "live") {
    return "live";
  }

  if (
    (db === "filling" || db === "locked" || db == null) &&
    Number.isFinite(liveGateMs) &&
    now >= liveGateMs
  ) {
    return "live";
  }

  if (db === "locked") {
    return "locked";
  }

  if (db === "filling" || db == null) {
    if (Number.isFinite(startMs) && now >= startMs && Number.isFinite(liveGateMs) && now < liveGateMs) {
      return "locked";
    }
    const open = Number.isFinite(openMs) ? openMs : 0;
    if (Number.isFinite(open) && now < open) {
      return "upcoming";
    }
    return "filling";
  }

  return "filling";
}

export function canJoinContestInLifecycle(lifecycle: ContestLifecycle): boolean {
  return lifecycle === "filling";
}

export function contestLifecycleBadgeLabel(lifecycle: ContestLifecycle): string {
  switch (lifecycle) {
    case "upcoming":
      return "Upcoming";
    case "filling":
      return "Filling";
    case "locked":
      return "Locked";
    case "live":
      return "Live";
    case "complete":
      return "Complete";
    case "settled":
      return "Settled";
    case "cancelled":
      return "Cancelled";
    default:
      return "—";
  }
}

export function contestLifecycleBadgeClassName(lifecycle: ContestLifecycle): string {
  switch (lifecycle) {
    case "upcoming":
      return "bg-[#2a3039] text-[#9ca8b4] border-[#3d4550]";
    case "filling":
      return "bg-[#1a2f4a] text-[#7ab8ff] border-[#3d6a9e]";
    case "locked":
      return "bg-[#3d2a1a] text-[#ffb14a] border-[#8b5a2b]";
    case "live":
      return "livePulseBadge border-[#2d7a3a] bg-[#142e1c] text-[#53d769]";
    case "complete":
      return "bg-[#2a1f3d] text-[#c4a8ff] border-[#5c4a7a]";
    case "settled":
      return "bg-[#3d3420] text-[#e8c96a] border-[#8a7630]";
    case "cancelled":
      return "bg-[#2a2323] text-[#9a9a9a] border-[#454545]";
    default:
      return "bg-[#1a1f26] text-[#8b98a5] border-[#3d4550]";
  }
}

/** Countdown target: seconds until lineup lock (`starts_at`) while join window (filling) or pre-open (upcoming). */
export function contestLockCountdownLabel(
  lifecycle: ContestLifecycle,
  startsAtIso: string,
  nowMs?: number,
): string | null {
  if (lifecycle !== "filling" && lifecycle !== "upcoming") {
    return null;
  }
  const start = parseMs(startsAtIso);
  if (!Number.isFinite(start)) return null;
  const now = nowMs ?? Date.now();
  const sec = Math.max(0, Math.ceil((start - now) / 1000));
  if (sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `Locks in ${m}:${s.toString().padStart(2, "0")}`;
}
