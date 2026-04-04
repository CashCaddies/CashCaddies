import { supabase } from "@/lib/supabase/client";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { isDevSimulateScoringAllowed } from "@/lib/dev-simulate-scoring";

function notAllowed(): { ok: false; error: string } {
  return {
    ok: false,
    error: "Scoring simulation is disabled. Enable it with NEXT_PUBLIC_ALLOW_SIMULATE_SCORING=true when appropriate.",
  };
}

export type ContestRef = {
  /** `contests.id` (UUID) — never slug or name */
  id: string;
};

/** DFS simulate: `golfer_scores` + refresh `lineups.total_score` for this contest (browser anon + RPC). */
export async function simulateContestLineupScoresFromBrowser(
  contest: ContestRef,
): Promise<{ ok: true; lineupsUpdated: number } | { ok: false; error: string }> {
  if (!isDevSimulateScoringAllowed()) {
    return notAllowed();
  }

  const sb = supabase;
  if (!sb) {
    return {
      ok: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const p_contest_id = contestIdForRpc(contest.id);
  if (!p_contest_id) {
    return {
      ok: false,
      error: "Missing contests.id for simulate scoring.",
    };
  }

  const { data, error } = await sb.rpc("simulate_contest_lineup_scores", {
    p_contest_id,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes("simulate_contest_lineup_scores") || error.message.includes("function")
          ? " Ensure the latest Supabase migrations are applied."
          : ""),
    };
  }

  const lineupsUpdated = parseRpcInteger(data);
  return { ok: true, lineupsUpdated };
}

/** DFS simulate: `golfer_scores` for all contest lineups, then refresh every `lineups.total_score` (Admin). */
export async function simulateAllLineupScoresFromBrowser(): Promise<
  { ok: true; lineupsUpdated: number } | { ok: false; error: string }
> {
  if (!isDevSimulateScoringAllowed()) {
    return notAllowed();
  }

  const sb = supabase;
  if (!sb) {
    return {
      ok: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const { data, error } = await sb.rpc("simulate_all_lineup_scores");

  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes("simulate_all_lineup_scores") || error.message.includes("function")
          ? " Ensure the latest Supabase migrations are applied."
          : ""),
    };
  }

  const lineupsUpdated = parseRpcInteger(data);
  return { ok: true, lineupsUpdated };
}

/** PostgREST may return smallint/bigint RPC results as string; normalize to integer ≥ 0. */
function parseRpcInteger(data: unknown): number {
  if (typeof data === "number" && Number.isFinite(data)) {
    return Math.max(0, Math.floor(data));
  }
  if (typeof data === "string" && data.trim() !== "") {
    const n = Number.parseInt(data, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  const n = Number(data ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
