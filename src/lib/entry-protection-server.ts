import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Idempotent: sets `lock_timestamp` / `entry_protected` on `contest_entries` when the contest is in a locked window.
 * Safe to call from server render paths (leaderboard, contest detail).
 */
export async function ensureContestEntryProtection(
  supabase: SupabaseClient,
  contestId: string,
): Promise<void> {
  const id = contestId.trim();
  if (!id) return;
  try {
    await supabase.rpc("apply_contest_entry_protection", { p_contest_id: id });
  } catch {
    /* missing RPC/column until migration — ignore */
  }
}
