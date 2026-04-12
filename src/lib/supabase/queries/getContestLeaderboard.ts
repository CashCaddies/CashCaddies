import { unstable_noStore } from "next/cache";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { createClient } from "@/lib/supabase/server";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";
import { compareLivePreliminaryScore } from "@/lib/contest/get-live-leaderboard";
import {
  contestUsesSimPool,
  entryLineupSimTotalScore,
  sumSimFantasyPointsByPlayerId,
} from "@/lib/contest/sim-results-scoring";
import {
  isMissingColumnOrSchemaError,
  isPostgrestRelationshipOrEmbedError,
} from "@/lib/supabase-missing-column";

export type ContestLeaderboardRow = {
  /** 1-based rank by live score (`lineups.total_score`), then entry time, then id — same as payout ordering. */
  order: number;
  /** 1-based position among this user’s entries in the contest. */
  entryNumber: number;
  user_id: string;
  username: string;
  score: number;
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
 * Live entry leaderboard: `lineups.total_score` desc, then `created_at` asc, then entry id (matches payout / `run_contest_payouts`).
 * Uses `contest_entries` + lineups — not `contest_entry_results` (post-settlement only).
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

    const usesSimPool = await contestUsesSimPool(supabase, contestId);
    const simByPlayer = usesSimPool ? await sumSimFantasyPointsByPlayerId(supabase) : null;

    const lineupSelect = usesSimPool
      ? "id, user_id, lineup_id, created_at, entry_number, lineups ( total_score, lineup_players ( golfer_id ) ), profiles ( username )"
      : "id, user_id, lineup_id, created_at, entry_number, lineups ( total_score ), profiles ( username )";

    const entriesQ = await supabase.from("contest_entries").select(lineupSelect).eq("contest_id", contestId);

    let entryRows: unknown[] | null = entriesQ.data as unknown[] | null;
    let entriesErr = entriesQ.error;
    let usedMinimalEntrySelect = false;

    if (
      entriesErr &&
      (isPostgrestRelationshipOrEmbedError(entriesErr) || isMissingColumnOrSchemaError(entriesErr))
    ) {
      const retrySelect = usesSimPool
        ? "id, user_id, lineup_id, created_at, entry_number, lineups ( total_score, lineup_players ( golfer_id ) )"
        : "id, user_id, lineup_id, created_at, entry_number, lineups ( total_score )";
      const retry = await supabase.from("contest_entries").select(retrySelect).eq("contest_id", contestId);
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
      entry_number?: unknown;
      lineups?:
        | { total_score?: unknown; lineup_players?: { golfer_id?: unknown }[] | null }
        | { total_score?: unknown; lineup_players?: { golfer_id?: unknown }[] | null }[]
        | null;
      profiles?: { username?: string | null } | { username?: string | null }[] | null;
    };

    const raw = (entryRows ?? []) as RawEntry[];

    type Prelim = {
      id: string;
      user_id: string;
      score: number;
      usernameFromEmbed: string;
      createdAt: string;
      entryNumber: number;
    };

    const preliminary: Prelim[] = raw.map((r) => {
      const lu = firstEmbed(r.lineups ?? null);
      const pr = firstEmbed(r.profiles ?? null);
      const en = Number((r as RawEntry).entry_number);
      const lps = (lu as { lineup_players?: unknown } | null)?.lineup_players;
      const hasRosterEmbed = Array.isArray(lps) && lps.length > 0;
      const simScore =
        usesSimPool && simByPlayer && hasRosterEmbed
          ? entryLineupSimTotalScore(r as RawEntry, simByPlayer)
          : null;
      return {
        id: String(r.id),
        user_id: String(r.user_id ?? ""),
        score: simScore !== null ? simScore : num(lu?.total_score),
        usernameFromEmbed: trimStr(pr?.username),
        createdAt: typeof r.created_at === "string" ? r.created_at : "",
        entryNumber: Number.isFinite(en) && en >= 1 ? Math.floor(en) : 1,
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
        entryNumber: p.entryNumber,
      };
    });

    scored.sort((a, b) =>
      compareLivePreliminaryScore(
        { score: a.score, createdAt: a.createdAt, id: a.id },
        { score: b.score, createdAt: b.createdAt, id: b.id },
      ),
    );

    const rows: ContestLeaderboardRow[] = scored.map((ent, idx) => ({
      order: idx + 1,
      entryNumber: ent.entryNumber,
      user_id: ent.user_id,
      username: ent.username,
      score: ent.score,
    }));

    return { rows, settled, contestExists: true };
  } catch {
    return { rows: [], settled: false, contestExists: false };
  }
}
