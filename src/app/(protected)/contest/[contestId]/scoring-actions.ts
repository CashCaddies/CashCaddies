"use server";

import { unstable_noStore } from "next/cache";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { isDevSimulateScoringAllowed } from "@/lib/dev-simulate-scoring";
import { getGolferLeaderboardForContest } from "@/lib/leaderboard";
import { getLeaderboardForContest } from "@/lib/contest-leaderboard-data";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function notAllowed(): { ok: false; error: string } {
  return {
    ok: false,
    error: "Mock / simulate scoring is disabled. Set NEXT_PUBLIC_ALLOW_SIMULATE_SCORING=true or ALLOW_SIMULATE_SCORING=true, or run in development.",
  };
}

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

/**
 * Admin / dev: random birdies, pars, bogeys, finish position (+ related bonuses) and refresh lineup totals.
 * Uses the same DB routine as “Simulate scoring”, PGA-style totals from `golfer_scores` trigger.
 */
export async function generateMockGolfStatsForContest(contestId: string): Promise<
  | { ok: true; lineupsUpdated: number }
  | { ok: false; error: string }
> {
  unstable_noStore();
  if (!isDevSimulateScoringAllowed()) {
    return notAllowed();
  }
  const id = contestIdForRpc(contestId);
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Service role is not configured." };
  }
  const { data, error } = await admin.rpc("simulate_contest_lineup_scores", {
    p_contest_id: id,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes("simulate_contest_lineup_scores") || error.message.includes("function")
          ? " Apply migration 20260402120000_golf_fantasy_scoring_engine.sql if columns are missing."
          : ""),
    };
  }
  return { ok: true, lineupsUpdated: parseRpcInteger(data) };
}

/**
 * Simulates R2 stroke totals, applies PGA top-65 + ties cut, freezes MC lineups’ fantasy (+ contest penalty), refreshes entries.
 */
export async function runPgaCutCalculationForContest(contestId: string): Promise<
  | { ok: true; playersUpdated: number }
  | { ok: false; error: string }
> {
  unstable_noStore();
  if (!isDevSimulateScoringAllowed()) {
    return notAllowed();
  }
  const id = contestIdForRpc(contestId);
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Service role is not configured." };
  }
  const { data, error } = await admin.rpc("run_pga_cut_calculation", {
    p_contest_id: id,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes("run_pga_cut_calculation") || error.message.includes("function")
          ? " Apply migration 20260402140000_pga_cut_system.sql."
          : ""),
    };
  }
  return { ok: true, playersUpdated: parseRpcInteger(data) };
}

export async function generateTeeTimesForContest(contestId: string): Promise<
  | { ok: true; playersUpdated: number }
  | { ok: false; error: string }
> {
  unstable_noStore();
  if (!isDevSimulateScoringAllowed()) {
    return notAllowed();
  }
  const id = contestIdForRpc(contestId);
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Service role is not configured." };
  }
  const { data, error } = await admin.rpc("generate_tee_times_for_contest", {
    p_contest_id: id,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes("generate_tee_times") || error.message.includes("function")
          ? " Apply migration 20260402150000_golf_tee_times_waves.sql."
          : ""),
    };
  }
  return { ok: true, playersUpdated: parseRpcInteger(data) };
}

/** Re-runs wave assignment from stored `tee_time` (e.g. after TZ rule tweaks). */
export async function recalculateWaveAssignmentForContest(contestId: string): Promise<
  | { ok: true; rowsTouched: number }
  | { ok: false; error: string }
> {
  unstable_noStore();
  if (!isDevSimulateScoringAllowed()) {
    return notAllowed();
  }
  const id = contestIdForRpc(contestId);
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Service role is not configured." };
  }
  const { data, error } = await admin.rpc("refresh_golfer_score_waves", {
    p_contest_id: id,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes("refresh_golfer_score_waves") || error.message.includes("function")
          ? " Apply migration 20260402150000_golf_tee_times_waves.sql."
          : ""),
    };
  }
  return { ok: true, rowsTouched: parseRpcInteger(data) };
}

export async function refetchContestScoringLeaderboards(contestId: string) {
  unstable_noStore();
  const id = contestIdForRpc(contestId) ?? "";
  const [entries, golfers] = await Promise.all([
    getLeaderboardForContest(id),
    getGolferLeaderboardForContest(id),
  ]);
  return { entries: entries.rows, golfers: golfers.rows };
}
