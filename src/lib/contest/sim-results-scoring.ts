import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnOrSchemaError } from "@/lib/supabase-missing-column";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** True when the contest uses `sim_players` / `sim_results` for roster and scoring. */
export async function contestUsesSimPool(supabase: SupabaseClient, contestId: string): Promise<boolean> {
  const { data, error } = await supabase.from("contests").select("uses_sim_pool").eq("id", contestId).maybeSingle();
  if (error && isMissingColumnOrSchemaError(error)) {
    return false;
  }
  if (error || !data) {
    return false;
  }
  return Boolean((data as { uses_sim_pool?: boolean }).uses_sim_pool);
}

/** Sum `sim_results.fantasy_points` per `player_id` (all rounds). */
export async function sumSimFantasyPointsByPlayerId(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("sim_results").select("player_id, fantasy_points");
  const m = new Map<string, number>();
  if (error || !data) {
    return m;
  }
  for (const row of data) {
    const pid = String((row as { player_id?: string }).player_id ?? "").trim();
    if (!pid) continue;
    m.set(pid, (m.get(pid) ?? 0) + num((row as { fantasy_points?: unknown }).fantasy_points));
  }
  return m;
}

function firstEmbed<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Total DFS points for a contest entry lineup when scoring comes from `sim_results`. */
export function entryLineupSimTotalScore(
  row: { lineups?: unknown },
  simByPlayer: Map<string, number>,
): number {
  const lu = firstEmbed(row.lineups ?? null) as { lineup_players?: { golfer_id?: unknown }[] | null } | null;
  const lps = lu?.lineup_players;
  if (!Array.isArray(lps) || lps.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const lp of lps) {
    const gid = String(lp.golfer_id ?? "").trim();
    if (!gid) continue;
    sum += simByPlayer.get(gid) ?? 0;
  }
  return sum;
}
