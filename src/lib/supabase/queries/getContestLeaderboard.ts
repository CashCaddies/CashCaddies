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
  /** 1-based position in the sorted leaderboard (unique per row; multiple entries per user get Entry 1, 2, …). */
  entryNumber: number;
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

/**
 * Entries ordered like `settle_contest_prizes`: `contest_entries.created_at` asc, then entry id.
 * Display score comes from the lineup when present but does not determine rank or prizes.
 * `winnings` is the computed USD share when settled; otherwise `null` (amount still computed internally).
 * Prize pool (display): `0.90 × sum(contest_entries.entry_fee)` to match `settle_contest_prizes`.
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
      .select("id, status")
      .eq("id", contestId)
      .maybeSingle();

    if (contestErr || !contest) {
      return { rows: [], settled: false, contestExists: false };
    }

    const settled = String(contest.status ?? "").toLowerCase().trim() === "settled";

    const [{ data: payoutRows }, entriesQ] = await Promise.all([
      supabase.from("contest_payouts").select("rank_place, payout_pct").eq("contest_id", contestId),
      supabase
        .from("contest_entries")
        .select("id, user_id, lineup_id, created_at, entry_fee, lineups ( total_score ), profiles ( username )")
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
        .select("id, user_id, lineup_id, created_at, entry_fee, lineups ( total_score )")
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
      created_at?: string | null;
      entry_fee?: unknown;
      lineups?: { total_score?: unknown } | { total_score?: unknown }[] | null;
      profiles?: { username?: string | null } | { username?: string | null }[] | null;
    };

    const raw = (entryRows ?? []) as RawEntry[];

    type Prelim = {
      id: string;
      user_id: string;
      score: number;
      usernameFromEmbed: string;
      createdAt: string;
    };

    const preliminary: Prelim[] = raw.map((r) => {
      const lu = firstEmbed(r.lineups ?? null);
      const pr = firstEmbed(r.profiles ?? null);
      return {
        id: String(r.id),
        user_id: String(r.user_id ?? ""),
        score: num(lu?.total_score),
        usernameFromEmbed: trimStr(pr?.username),
        createdAt: typeof r.created_at === "string" ? r.created_at : "",
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
        createdAt: p.createdAt,
      };
    });

    scored.sort((a, b) => {
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

    const sumEntryFees = raw.reduce((acc, r) => acc + num((r as RawEntry).entry_fee), 0);
    const prizePool = Math.round(sumEntryFees * 0.9 * 100) / 100;

    const payoutByPlace = new Map<number, number>();
    for (const p of payoutRows ?? []) {
      const row = p as { rank_place?: unknown; payout_pct?: unknown };
      const place = Math.floor(Number(row.rank_place));
      if (!Number.isFinite(place) || place < 1) continue;
      payoutByPlace.set(place, num(row.payout_pct));
    }

    const rows: ContestLeaderboardRow[] = [];

    let entryNumber = 1;
    for (let idx = 0; idx < scored.length; idx++) {
      const ent = scored[idx]!;
      const rank = idx + 1;
      const pct = payoutByPlace.get(rank) ?? 0;
      const poolUsd = prizePool * (pct / 100);
      const eachUsd = Math.round(poolUsd * 100) / 100;
      rows.push({
        rank,
        entryNumber: entryNumber++,
        user_id: ent.user_id,
        username: ent.username,
        score: ent.score,
        winnings: settled ? eachUsd : null,
      });
    }

    return { rows, settled, contestExists: true };
  } catch {
    return { rows: [], settled: false, contestExists: false };
  }
}
