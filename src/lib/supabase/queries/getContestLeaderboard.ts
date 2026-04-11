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
  username: string;
  score: number;
  /** Always computed; `null` when contest is not settled (UI shows "-"). */
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

function trimStr(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t === "" ? "" : t;
}

function firstEmbed<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Competition ranking: same score → same rank; next distinct score → rank = index + 1 (skips). */
function assignCompetitionRanks(sortedScores: number[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < sortedScores.length; i++) {
    if (i === 0) {
      ranks.push(1);
    } else if (sortedScores[i] === sortedScores[i - 1]) {
      ranks.push(ranks[i - 1]!);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

/** Sum `payout_pct` for finishing places `startPlace` … `startPlace + span - 1` (inclusive). */
function sumPctForPlaces(payoutByPlace: Map<number, number>, startPlace: number, span: number): number {
  let t = 0;
  for (let k = 0; k < span; k++) {
    t += payoutByPlace.get(startPlace + k) ?? 0;
  }
  return t;
}

/**
 * Entries ordered by `lineups.total_score` DESC (ties keep stable order by entry id).
 * Ranks use competition rules (ties share rank; next rank skips).
 * Tied users split combined prize % for the places they occupy (DFS-style).
 * `winnings` is the computed USD share when settled; otherwise `null` (amount still computed internally).
 * Prize pool: `entry_fee_usd × entry_count × 0.90`.
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
    let usedMinimalEntrySelect = false;

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
      usedMinimalEntrySelect = true;
    }

    if (entriesErr) {
      return { rows: [], settled, contestExists: true };
    }

    type RawEntry = {
      id: string;
      user_id: string;
      lineup_id?: string | null;
      lineups?: { total_score?: unknown } | { total_score?: unknown }[] | null;
      profiles?: { username?: string | null } | { username?: string | null }[] | null;
    };

    const raw = (entryRows ?? []) as RawEntry[];

    type Prelim = {
      id: string;
      user_id: string;
      score: number;
      usernameFromEmbed: string;
    };

    const preliminary: Prelim[] = raw.map((r) => {
      const lu = firstEmbed(r.lineups ?? null);
      const pr = firstEmbed(r.profiles ?? null);
      return {
        id: String(r.id),
        user_id: String(r.user_id ?? ""),
        score: num(lu?.total_score),
        usernameFromEmbed: trimStr(pr?.username),
      };
    });

    const userIds = [...new Set(preliminary.map((p) => p.user_id).filter(Boolean))];
    const needProfileBatch =
      userIds.length > 0 &&
      (usedMinimalEntrySelect || preliminary.some((p) => p.usernameFromEmbed === ""));

    const nameById = new Map<string, string>();
    if (needProfileBatch) {
      const { data: profRows } = await supabase.from("profiles").select("id, username").in("id", userIds);
      for (const p of profRows ?? []) {
        const rec = p as { id?: string; username?: string | null };
        const id = String(rec.id ?? "");
        if (!id) continue;
        nameById.set(id, trimStr(rec.username) || "—");
      }
    }

    const scored = preliminary.map((p) => {
      const u = p.usernameFromEmbed || nameById.get(p.user_id) || "";
      return {
        id: p.id,
        user_id: p.user_id,
        score: p.score,
        username: u === "" ? "—" : u,
      };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

    const nEntries = scored.length;
    const prizePool = Math.round(entryFee * nEntries * 0.9 * 100) / 100;

    const payoutByPlace = new Map<number, number>();
    for (const p of payoutRows ?? []) {
      const row = p as { rank_place?: unknown; payout_pct?: unknown };
      const place = Math.floor(Number(row.rank_place));
      if (!Number.isFinite(place) || place < 1) continue;
      payoutByPlace.set(place, num(row.payout_pct));
    }

    const scores = scored.map((s) => s.score);
    const ranks = assignCompetitionRanks(scores);

    const rows: ContestLeaderboardRow[] = [];

    let i = 0;
    while (i < scored.length) {
      const score = scored[i]!.score;
      const startRank = ranks[i]!;
      let j = i + 1;
      while (j < scored.length && scored[j]!.score === score) {
        j++;
      }
      const group = scored.slice(i, j);
      const m = group.length;
      const totalPct = sumPctForPlaces(payoutByPlace, startRank, m);
      const poolUsd = prizePool * (totalPct / 100);
      const eachUsd = m > 0 ? Math.round((poolUsd / m) * 100) / 100 : 0;

      for (const ent of group) {
        const computed = eachUsd;
        rows.push({
          rank: startRank,
          user_id: ent.user_id,
          username: ent.username,
          score: ent.score,
          winnings: settled ? computed : null,
        });
      }

      i = j;
    }

    return { rows, settled, contestExists: true };
  } catch {
    return { rows: [], settled: false, contestExists: false };
  }
}
