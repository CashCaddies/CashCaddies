import type { SupabaseClient } from "@supabase/supabase-js";
import type { GolferSimState } from "@/lib/contest-lab/simulation-engine";

/**
 * Loads golfer contribution inputs for a contest lineup (read-only; mirrors lineup scoring rules).
 */
export async function loadGolferStatesForLineup(
  supabase: SupabaseClient,
  contestId: string,
  lineupId: string,
): Promise<{ ok: true; states: GolferSimState[] } | { ok: false; error: string }> {
  const { data: lpRows, error: lpErr } = await supabase
    .from("lineup_players")
    .select("golfer_id, counts_as_zero_for_scoring, exclude_finish_position_points")
    .eq("lineup_id", lineupId);

  if (lpErr) {
    return { ok: false, error: lpErr.message };
  }
  if (!lpRows?.length) {
    return { ok: false, error: "Lineup has no golfers." };
  }

  const golferIds = lpRows.map((r) => r.golfer_id as string);

  const [{ data: gsRows, error: gsErr }, { data: gRows, error: gErr }] = await Promise.all([
    supabase
      .from("golfer_scores")
      .select("golfer_id, total_score, finish_position_points")
      .eq("contest_id", contestId)
      .in("golfer_id", golferIds),
    supabase.from("golfers").select("id, fantasy_points").in("id", golferIds),
  ]);

  if (gsErr) {
    return { ok: false, error: gsErr.message };
  }
  if (gErr) {
    return { ok: false, error: gErr.message };
  }

  const gsByGolfer = new Map(
    (gsRows ?? []).map((r) => [
      r.golfer_id as string,
      {
        total: Number(r.total_score ?? 0),
        finish: Number((r as { finish_position_points?: number }).finish_position_points ?? 0),
      },
    ]),
  );
  const fpByGolfer = new Map(
    (gRows ?? []).map((r) => [r.id as string, Number(r.fantasy_points ?? 0)]),
  );

  const states: GolferSimState[] = lpRows.map((row) => {
    const gid = row.golfer_id as string;
    const gs = gsByGolfer.get(gid);
    const dfs = gs ? gs.total : (fpByGolfer.get(gid) ?? 0);
    const finish = gs ? gs.finish : 0;
    return {
      golferId: gid,
      dfsPoints: dfs,
      finishPositionPoints: finish,
      countsAsZero: Boolean(row.counts_as_zero_for_scoring),
      excludeFinishPosition: Boolean(row.exclude_finish_position_points),
    };
  });

  return { ok: true, states };
}

export async function loadContestEntryScores(
  supabase: SupabaseClient,
  contestId: string,
): Promise<{ ok: true; scores: Array<{ entryId: string; score: number }> } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("contest_entries")
    .select("id, lineups(total_score)")
    .eq("contest_id", contestId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const scores = (data ?? []).map((row) => {
    const rawLu = row.lineups as
      | { total_score?: number | string | null }
      | { total_score?: number | string | null }[]
      | null;
    const lu = Array.isArray(rawLu) ? rawLu[0] : rawLu;
    const raw = lu != null && typeof lu === "object" && "total_score" in lu ? lu.total_score : null;
    const n = Number(raw ?? 0);
    return {
      entryId: String(row.id),
      score: Number.isFinite(n) ? n : 0,
    };
  });

  return { ok: true, scores };
}
