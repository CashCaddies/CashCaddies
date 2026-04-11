import { unstable_noStore } from "next/cache";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { createClient } from "@/lib/supabase/server";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";
import {
  isMissingColumnOrSchemaError,
  isPostgrestRelationshipOrEmbedError,
} from "@/lib/supabase-missing-column";

export type ContestLeaderboardRow = {
  rank: number;
  user_id: string;
  score: number;
  /** `null` when the contest is not settled yet (UI shows "-"). */
  winnings: number | null;
};

export type GetContestLeaderboardResult = {
  rows: ContestLeaderboardRow[];
  settled: boolean;
  contestExists: boolean;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function firstEmbed<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/**
 * Entries ordered by `lineups.total_score` DESC; rank 1..n.
 * `winnings` = prize_pool × (contest_payouts.payout_pct / 100) when `contests.status` is `settled`.
 * Prize pool matches settlement: `entry_fee_usd × entry_count × 0.90` (two decimal USD).
 */
export async function getContestLeaderboard(contestIdRaw: string): Promise<GetContestLeaderboardResult> {
  unstable_noStore();

  const contestId = contestIdForRpc(contestIdRaw);
  if (!contestId) {
    return { rows: [], settled: false, contestExists: false };
  }

  try {
    const supabase = await createClient();
    const hasAccess = await currentUserHasContestAccess(supabase);
    if (!hasAccess) {
      return { rows: [], settled: false, contestExists: false };
    }

    const { data: contest, error: contestErr } = await supabase
      .from("contests")
      .select("id, status, entry_fee_usd")
      .eq("id", contestId)
      .maybeSingle();

    if (contestErr || !contest) {
      return { rows: [], settled: false, contestExists: false };
    }

    const settled = String(contest.status ?? "").toLowerCase().trim() === "settled";

    const entryFee = num((contest as { entry_fee_usd?: unknown }).entry_fee_usd);

    const [{ data: payoutRows }, entriesQ] = await Promise.all([
      supabase.from("contest_payouts").select("rank_place, payout_pct").eq("contest_id", contestId),
      supabase
        .from("contest_entries")
        .select("id, user_id, lineup_id, lineups ( total_score ), profiles ( username )")
        .eq("contest_id", contestId),
    ]);

    let entryRows: unknown[] | null = entriesQ.data as unknown[] | null;
    let entriesErr = entriesQ.error;

    if (
      entriesErr &&
      (isPostgrestRelationshipOrEmbedError(entriesErr) || isMissingColumnOrSchemaError(entriesErr))
    ) {
      const retry = await supabase
        .from("contest_entries")
        .select("id, user_id, lineup_id, lineups ( total_score )")
        .eq("contest_id", contestId);
      entryRows = retry.data as unknown[] | null;
      entriesErr = retry.error;
    }

    if (entriesErr) {
      return { rows: [], settled, contestExists: true };
    }

    type RawEntry = {
      id: string;
      user_id: string;
      lineup_id?: string | null;
      lineups?: { total_score?: unknown } | { total_score?: unknown }[] | null;
    };

    const raw = (entryRows ?? []) as RawEntry[];
    const nEntries = raw.length;
    const prizePool = Math.round(entryFee * nEntries * 0.9 * 100) / 100;

    const payoutByPlace = new Map<number, number>();
    for (const p of payoutRows ?? []) {
      const row = p as { rank_place?: unknown; payout_pct?: unknown };
      const place = Math.floor(Number(row.rank_place));
      if (!Number.isFinite(place) || place < 1) continue;
      payoutByPlace.set(place, num(row.payout_pct));
    }

    const scored = raw.map((r) => {
      const lu = firstEmbed(r.lineups ?? null);
      return {
        id: String(r.id),
        user_id: String(r.user_id ?? ""),
        score: num(lu?.total_score),
      };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

    const rows: ContestLeaderboardRow[] = scored.map((r, index) => {
      const rank = index + 1;
      const pct = payoutByPlace.get(rank) ?? 0;
      const winnings = settled ? Math.round(prizePool * (pct / 100) * 100) / 100 : null;

      return {
        rank,
        user_id: r.user_id,
        score: r.score,
        winnings,
      };
    });

    return { rows, settled, contestExists: true };
  } catch {
    return { rows: [], settled: false, contestExists: false };
  }
}
