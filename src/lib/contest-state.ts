/**
 * Effective DFS lifecycle for display and client-side gating.
 * DB columns: `contest_status`, `entries_open_at`; settlement row → settled.
 */

/** Time after `starts_at` before the contest is treated as Live (late swap, live UI). */
export const CONTEST_LIVE_AFTER_START_MS = 5 * 60 * 1000;

export type ContestLifecycle =
  | "draft"
  | "upcoming"
  | "open"
  /** Legacy DB value; treated like `open` for join + badges. */
  | "filling"
  | "locked"
  | "live"
  | "completed"
  | "settled"
  | "cancelled";

export type ContestLifecycleInput = {
  contest_status?: string | null;
  /** Legacy `contests.status` when `contest_status` absent */
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

/** Normalize DB + legacy status to canonical lifecycle bucket (pre–time overlay). */
export function normalizeDbContestStatus(
  contestStatus: string | null | undefined,
  legacyStatus: string | null | undefined,
): ContestLifecycle | null {
  const raw = String(contestStatus ?? "").trim().toLowerCase();
  if (raw === "draft") return "draft";
  if (raw === "open" || raw === "filling") return "open";
  if (
    raw === "upcoming" ||
    raw === "locked" ||
    raw === "live" ||
    raw === "completed" ||
    raw === "settled" ||
    raw === "cancelled" ||
    raw === "canceled"
  ) {
    return raw === "canceled" ? "cancelled" : (raw as ContestLifecycle);
  }
  const leg = String(legacyStatus ?? "").trim().toLowerCase();
  if (leg === "paid") return "settled";
  if (leg === "open" || leg === "full") return "open";
  if (leg === "locked" || leg === "live" || leg === "completed" || leg === "cancelled" || leg === "canceled") {
    return leg === "canceled" ? "cancelled" : (leg as ContestLifecycle);
  }
  return null;
}

/**
 * Resolved lifecycle for UI and join eligibility (`open` / legacy `filling` only).
 * Time rules: locked from `starts_at` until `starts_at + 5m` (display); live after that until completed/settled.
 */
export function resolveEffectiveContestLifecycle(input: ContestLifecycleInput): ContestLifecycle {
  const now = input.nowMs ?? Date.now();

  if (input.has_settlement) {
    return "settled";
  }

  const db = normalizeDbContestStatus(input.contest_status, input.status);
  if (db === "draft") {
    return "draft";
  }
  if (db === "cancelled") {
    return "cancelled";
  }
  if (db === "settled" || String(input.status ?? "").toLowerCase() === "paid") {
    return "settled";
  }
  if (db === "completed") {
    return "completed";
  }

  const startMs = parseMs(input.starts_at);
  const openMs = parseMs(input.entries_open_at ?? input.created_at);
  const liveGateMs = Number.isFinite(startMs) ? startMs + CONTEST_LIVE_AFTER_START_MS : NaN;

  if (db === "live") {
    return "live";
  }

  if (Number.isFinite(startMs) && Number.isFinite(liveGateMs) && now >= liveGateMs) {
    return "live";
  }

  if (Number.isFinite(startMs) && now >= startMs && now < liveGateMs) {
    return "locked";
  }

  if (db === "locked" && Number.isFinite(startMs) && now < startMs) {
    return "locked";
  }

  if (db === "open" || db === "filling") {
    if (!Number.isFinite(startMs) || now >= startMs) {
      return "locked";
    }
    const open = Number.isFinite(openMs) ? openMs : 0;
    if (now < open) {
      return "upcoming";
    }
    return "open";
  }

  if (db === "upcoming") {
    return "upcoming";
  }

  if (db == null) {
    if (!Number.isFinite(startMs) || now >= startMs) {
      return Number.isFinite(liveGateMs) && now >= liveGateMs ? "live" : "locked";
    }
    return "open";
  }

  return db;
}

export function canJoinContestInLifecycle(lifecycle: ContestLifecycle): boolean {
  return lifecycle === "open" || lifecycle === "filling";
}

export function contestLifecycleBadgeLabel(lifecycle: ContestLifecycle): string {
  switch (lifecycle) {
    case "draft":
      return "Draft";
    case "upcoming":
      return "Upcoming";
    case "open":
    case "filling":
      return "Filling";
    case "locked":
      return "Locked";
    case "live":
      return "Live";
    case "completed":
      return "Completed";
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
    case "draft":
      return "bg-[#252a32] text-[#8b98a5] border-[#3d4550]";
    case "upcoming":
      return "bg-[#2a3039] text-[#9ca8b4] border-[#3d4550]";
    case "open":
    case "filling":
      return "bg-[#1a2f4a] text-[#7ab8ff] border-[#3d6a9e]";
    case "locked":
      return "bg-[#3d2a1a] text-[#ffb14a] border-[#8b5a2b]";
    case "live":
      return "livePulseBadge border-[#2d7a3a] bg-[#142e1c] text-[#53d769]";
    case "completed":
      return "bg-[#2a1f3d] text-[#c4a8ff] border-[#5c4a7a]";
    case "settled":
      return "bg-[#3d3420] text-[#e8c96a] border-[#8a7630]";
    case "cancelled":
      return "bg-[#2a2323] text-[#9a9a9a] border-[#454545]";
    default:
      return "bg-[#1a1f26] text-[#8b98a5] border-[#3d4550]";
  }
}

/** Countdown target: seconds until lineup lock (`starts_at`) while join window (open) or pre-open (upcoming). */
export function contestLockCountdownLabel(
  lifecycle: ContestLifecycle,
  startsAtIso: string,
  nowMs?: number,
): string | null {
  if (lifecycle !== "open" && lifecycle !== "filling" && lifecycle !== "upcoming") {
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
