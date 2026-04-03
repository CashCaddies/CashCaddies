/**
 * Types for `public.lineup_players` (see supabase/migrations/003_lineups_and_players.sql,
 * 010_lineup_players_protection_slots.sql).
 */

export type LineupPlayerRow = {
  id: string;
  lineup_id: string;
  golfer_id: string;
  /** CashCaddies Safety Coverage covers this golfer; tier caps how many per lineup. */
  is_protected: boolean;
};

/** Insert payload when submitting a lineup (server generates `id`). */
export type LineupPlayerInsert = Pick<LineupPlayerRow, "lineup_id" | "golfer_id" | "is_protected"> & {
  slot_index?: number;
  game_start_time?: string | null;
};

/** Nested row from `lineups` → `lineup_players` select with joined `golfers`. */
export type DashboardLineupPlayerNested = {
  is_protected: boolean;
  golfer_id: string;
  golfers: {
    id: string;
    name: string;
    salary: number;
    withdrawn: boolean | null;
    fantasy_points?: number | null;
  } | null;
};

/** Row from lineup_players + golfer for protection claim validation. */
export type LineupPlayerClaimRow = Pick<LineupPlayerRow, "golfer_id" | "is_protected"> & {
  golfers:
    | { id: string; withdrawn: boolean | null }
    | { id: string; withdrawn: boolean | null }[]
    | null;
};
