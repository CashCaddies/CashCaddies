import type { SupabaseClient } from "@supabase/supabase-js";

/** Entry list in contest join order (by `created_at`), for admin/debug. Not used for prize math. */
export type ContestResultRow = {
  entryId: string;
  userId: string;
  lineupId: string | null;
  /** From lineup when present; informational until scoring exists. */
  score: number | null;
};

/**
 * Contest entries ordered like `contest_entries.created_at` asc (then id). No settlement payout fields.
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

  const rows: ContestResultRow[] = scored.map((r) => ({
    entryId: r.entryId,
    userId: r.userId,
    lineupId: r.lineupId,
    score: r.score,
  }));

  return { rows, error: null };
}
