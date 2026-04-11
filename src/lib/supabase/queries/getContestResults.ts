import type { SupabaseClient } from "@supabase/supabase-js";

/** Leaderboard row for settlement preview / admin (same ordering as `settle_contest_prizes`). */
export type ContestResultRow = {
  entryId: string;
  userId: string;
  lineupId: string | null;
  rank: number;
  /** From lineup when present; informational until scoring exists. */
  score: number | null;
};

/**
 * Contest results for settlement preview: same order as DB settlement (`contest_entries.created_at` asc, then id).
 * Lineup score is included when available but does not determine rank.
 */
export async function getContestResults(
  supabase: SupabaseClient,
  contestId: string,
): Promise<{ rows: ContestResultRow[]; error: string | null }> {
  const id = contestId?.trim();
  if (!id) {
    return { rows: [], error: "Missing contest id." };
  }

  const { data, error } = await supabase
    .from("contest_entries")
    .select("id, user_id, lineup_id, created_at, lineups ( total_score )")
    .eq("contest_id", id);

  if (error) {
    return { rows: [], error: error.message };
  }

  type Raw = {
    id: string;
    user_id: string;
    lineup_id: string | null;
    created_at?: string | null;
    lineups: { total_score: number | null } | { total_score: number | null }[] | null;
  };

  const rawRows = (data ?? []) as Raw[];
  const scored = rawRows.map((r) => {
    const lu = r.lineups;
    const embed = Array.isArray(lu) ? lu[0] : lu;
    const score =
      embed != null && embed.total_score != null && Number.isFinite(Number(embed.total_score))
        ? Number(embed.total_score)
        : null;
    return {
      entryId: String(r.id),
      userId: String(r.user_id),
      lineupId: r.lineup_id != null ? String(r.lineup_id) : null,
      score,
      createdAt: typeof r.created_at === "string" ? r.created_at : "",
    };
  });

  scored.sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    if (ta !== tb) return ta - tb;
    return a.entryId.localeCompare(b.entryId);
  });

  const rows: ContestResultRow[] = scored.map((r, i) => ({
    entryId: r.entryId,
    userId: r.userId,
    lineupId: r.lineupId,
    rank: i + 1,
    score: r.score,
  }));

  return { rows, error: null };
}
