/** One row from `contest_payouts` (rank → % of prize pool). Loaded with lobby contests. */
export type LobbyContestPayoutRow = {
  rank_place: number;
  payout_pct: number;
};

/** Row from `contests_with_stats` (see supabase/migrations). Safe for client components — no server Supabase import. */
export type LobbyContestRow = {
  id: string;
  name: string;
  entry_fee_usd: number | string;
  entry_fee?: number | string | null;
  max_entries: number;
  max_entries_per_user: number | null;
  /** Filled from `contest_entries ( id )` embed: `contest_entries.length` (PostgREST). */
  entry_count: number;
  starts_at: string;
  /** Optional contest end; when null, UI treats "ended" as starts_at + 3 days. */
  ends_at?: string | null;
  /** Same instant as `starts_at` when migration 036 applied (derived; `starts_at` is authoritative). */
  start_time?: string | null;
  /** `contests.status` from DB only. Capacity "full" is UI-only (use `entry_count` vs `max_entries`). */
  status?: string | null;
  entries_open_at?: string | null;
  created_at?: string | null;
  /** True when a row exists in `contest_settlements`. */
  has_settlement?: boolean;
  /** `true` when `now() >= starts_at` (from view or computed from `starts_at`). Entry closes here only — not at `ends_at`. */
  lineup_locked?: boolean;
  prize_pool?: number | string | null;
  /** Entries with `insured_golfer_id` set (`contests_with_stats`, migration 082+). */
  protected_entries_count?: number;
  /** Global insurance pool balance (USD); merged in `fetchLobbyContests`, same for all rows. */
  safety_pool_usd?: number;
  /** Admin: allow DFS late swap after contest goes live. */
  late_swap_enabled?: boolean | null;
  /** From `contest_payouts` for this contest id (explicit fetch in `fetchLobbyContests` / `fetchLobbyContestById`). */
  payouts: LobbyContestPayoutRow[];
};

/** Rows returned from `contest_entries ( id )` on a contest query; length = entry count (RLS applies). */
export function entryCountFromContestEntriesRelation(row: Record<string, unknown>): number {
  const raw = row.contest_entries;
  if (!Array.isArray(raw)) return 0;
  return raw.length;
}

/** Scoring window after start when `ends_at` is absent (matches settlement / my-contests heuristic). */
export const CONTEST_DEFAULT_END_AFTER_START_MS = 3 * 24 * 60 * 60 * 1000;

export type ContestLifecyclePhase = "upcoming" | "live" | "completed";

/** Upcoming → now &lt; starts_at; Live → started and before end; Completed → at/after ends_at (or heuristic end). */
export function contestLifecyclePhaseFromRow(
  row: Pick<LobbyContestRow, "starts_at" | "ends_at">,
): ContestLifecyclePhase {
  const start = Date.parse(row.starts_at);
  if (!Number.isFinite(start)) return "upcoming";
  const now = Date.now();
  if (now < start) return "upcoming";

  const endIso = row.ends_at;
  if (endIso != null && String(endIso).trim() !== "") {
    const end = Date.parse(String(endIso));
    if (Number.isFinite(end) && now >= end) return "completed";
    return "live";
  }

  const heuristicEnd = start + CONTEST_DEFAULT_END_AFTER_START_MS;
  if (now >= heuristicEnd) return "completed";
  return "live";
}

/** Prefer DB `lineup_locked` when present; else compare `starts_at` to now (client-safe). Entry is blocked only once the contest has started. */
export function isContestLineupLocked(row: Pick<LobbyContestRow, "starts_at" | "lineup_locked">): boolean {
  if (typeof row.lineup_locked === "boolean") return row.lineup_locked;
  const t = Date.parse(row.starts_at);
  return Number.isFinite(t) && Date.now() >= t;
}

/**
 * Contest type badge from `max_entries_per_user` (shown next to contest name in the lobby).
 * - `1` → Single Entry
 * - `3` → 3 Max
 * - `10` → 10 Max
 * - any other positive integer → `${n} Max`
 */
export function formatPerUserEntryLimit(maxPerUser: number | string | null | undefined): string | null {
  if (maxPerUser == null || maxPerUser === "") return null;
  const n = Math.floor(Number(maxPerUser));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) return "Single Entry";
  return `${n} Max`;
}

export function formatLobbyEntryFeeUsd(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

/** Protected share of contest entries for lobby activity (0–100, one decimal when needed). */
export function formatProtectedEntriesPercent(currentEntries: number, protectedCount: number): string {
  const cur = Math.max(0, Math.floor(Number(currentEntries)) || 0);
  const prot = Math.max(0, Math.floor(Number(protectedCount)) || 0);
  if (cur <= 0) return "0";
  const pct = Math.round((prot / cur) * 1000) / 10;
  if (pct % 1 === 0) return String(Math.round(pct));
  return pct.toFixed(1);
}

export function formatContestStartDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return iso;
  }
}
