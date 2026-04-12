import { unstable_noStore } from "next/cache";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { CONTEST_ENTRIES_READ_BASE } from "@/lib/contest-entries-read-columns";
import { ensureContestEntryProtection } from "@/lib/entry-protection-server";
import { createClient } from "@/lib/supabase/server";
import {
  isMissingColumnOrSchemaError,
  isPostgrestRelationshipOrEmbedError,
} from "@/lib/supabase-missing-column";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";
import {
  contestUsesSimPool,
  entryLineupSimTotalScore,
  sumSimFantasyPointsByPlayerId,
} from "@/lib/contest/sim-results-scoring";

/**
 * Same tie-break order as `run_contest_payouts` (lineups.total_score desc, entry created_at asc, entry id asc).
 * Sim contests: totals match sum of `sim_results.fantasy_points` per roster player (kept in sync on `lineups.total_score`).
 * Use for any live / in-progress leaderboard — not `contest_entry_results` (post-settlement only).
 */
/** Per-golfer row for expandable live leaderboard (from `lineup_players` + contest `golfer_scores` or `sim_results`). */
export type LiveLineupPlayerBreakdown = {
  golferId: string;
  playerName: string;
  /** Live: `golfer_scores.total_score`, else `golfers.fantasy_points`. Sim pool: sum of `sim_results.fantasy_points` per player. */
  score: number;
};

export type LiveLeaderboardRow = {
  rank: number;
  entryId: string;
  userId: string;
  username: string;
  /** From `lineups.total_score` */
  totalScore: number;
  createdAt: string | null;
  /** Roster breakdown; empty if embed blocked or no rows. */
  players: LiveLineupPlayerBreakdown[];
};

type LineupsEmbed = { total_score?: unknown; lineup_players?: unknown } | null;
type ProfilesEmbed = { username?: string | null } | null;

type ContestEntryQueryRow = {
  id: string;
  user_id: string;
  created_at?: string | null;
  lineups: LineupsEmbed | LineupsEmbed[] | null;
  profiles: ProfilesEmbed | ProfilesEmbed[] | null;
};

const LINEUPS_WITH_PLAYERS = `id, total_score, lineup_players ( slot_index, golfer_id, golfers ( name, fantasy_points ) )`;

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

function lineupScoreFromRow(row: ContestEntryQueryRow): number {
  const lu = firstEmbed(row.lineups ?? null);
  return num((lu as { total_score?: unknown } | null)?.total_score);
}

type LineupPlayerRaw = {
  slot_index?: unknown;
  golfer_id?: unknown;
  golfers?: { name?: unknown; fantasy_points?: unknown } | { name?: unknown; fantasy_points?: unknown }[] | null;
};

function playersForEntryRow(
  row: ContestEntryQueryRow,
  scoreByGolfer: Map<string, number>,
  simOpts?: { usesSimPool: boolean; simByPlayer: Map<string, number> },
): LiveLineupPlayerBreakdown[] {
  const lu = firstEmbed(row.lineups ?? null) as { lineup_players?: LineupPlayerRaw[] | null } | null;
  const lps = lu?.lineup_players;
  if (!Array.isArray(lps) || lps.length === 0) return [];

  const usesSim = Boolean(simOpts?.usesSimPool && simOpts?.simByPlayer);

  const withSlots = lps.map((lp, idx) => {
    const gid = String(lp.golfer_id ?? "").trim();
    const g = firstEmbed(lp.golfers ?? null);
    const name = trimStr((g as { name?: unknown } | null)?.name) || "—";
    const fromSim = usesSim && gid ? simOpts!.simByPlayer.get(gid) : undefined;
    const fromGs = !usesSim && gid ? scoreByGolfer.get(gid) : undefined;
    const fp = num((g as { fantasy_points?: unknown } | null)?.fantasy_points);
    const score = usesSim ? (fromSim !== undefined ? fromSim : 0) : fromGs !== undefined ? fromGs : fp;
    const sn = Number(lp.slot_index);
    const slotIndex = Number.isFinite(sn) ? sn : idx;
    return { slotIndex, golferId: gid, playerName: name, score };
  });

  withSlots.sort((a, b) => {
    if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
    return a.playerName.localeCompare(b.playerName);
  });

  return withSlots.map((x) => ({
    golferId: x.golferId,
    playerName: x.playerName,
    score: x.score,
  }));
}

export function lineupLiveScoreFromRow(
  row: ContestEntryQueryRow,
  opts?: { usesSimPool: boolean; simByPlayer: Map<string, number> },
): number {
  if (opts?.usesSimPool && opts.simByPlayer) {
    return entryLineupSimTotalScore(row, opts.simByPlayer);
  }
  return lineupScoreFromRow(row);
}

/**
 * Deterministic sort for live DFS standings (contest_entries + lineups.total_score, or sim_results sum for sim contests).
 */
export function compareContestEntriesLiveScoring(
  a: ContestEntryQueryRow,
  b: ContestEntryQueryRow,
  opts?: { usesSimPool: boolean; simByPlayer: Map<string, number> },
): number {
  const scoreA = lineupLiveScoreFromRow(a, opts);
  const scoreB = lineupLiveScoreFromRow(b, opts);
  if (scoreB !== scoreA) return scoreB - scoreA;
  const ta = Date.parse(a.created_at ?? "") || 0;
  const tb = Date.parse(b.created_at ?? "") || 0;
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

/** Same ordering as `compareContestEntriesLiveScoring`, for pre-aggregated `{ score, createdAt, id }` rows. */
export function compareLivePreliminaryScore(
  a: { score: number; createdAt: string; id: string },
  b: { score: number; createdAt: string; id: string },
): number {
  if (b.score !== a.score) return b.score - a.score;
  const ta = Date.parse(a.createdAt) || 0;
  const tb = Date.parse(b.createdAt) || 0;
  if (ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

export type GetLiveLeaderboardResult =
  | { ok: true; rows: LiveLeaderboardRow[] }
  | { ok: false; error: string };

/**
 * Real-time entry leaderboard for a contest: `contest_entries` + `lineups.total_score` + `profiles.username`.
 * Does not read `contest_entry_results`.
 */
export async function getLiveLeaderboard(contestIdRaw: string): Promise<GetLiveLeaderboardResult> {
  unstable_noStore();

  const contestId = contestIdForRpc(contestIdRaw);
  if (!contestId) {
    return { ok: false, error: "Missing contest id." };
  }

  try {
    const supabase = await createClient();
    const hasAccess = await currentUserHasContestAccess(supabase);
    if (!hasAccess) {
      return { ok: false, error: "No access." };
    }

    await ensureContestEntryProtection(supabase, contestId);

    const usesSimPool = await contestUsesSimPool(supabase, contestId);
    const simByPlayer = usesSimPool ? await sumSimFantasyPointsByPlayerId(supabase) : null;
    const simOpts =
      usesSimPool && simByPlayer ? { usesSimPool: true as const, simByPlayer } : undefined;

    const selectWithPlayers = `${CONTEST_ENTRIES_READ_BASE}, lineups ( ${LINEUPS_WITH_PLAYERS} ), profiles ( username )`;
    const selectFull = `${CONTEST_ENTRIES_READ_BASE}, lineups ( total_score ), profiles ( username )`;
    const selectMinimal = `${CONTEST_ENTRIES_READ_BASE}, lineups ( total_score )`;

    let data: ContestEntryQueryRow[] | null = null;
    let error: { message: string } | null = null;

    const q0 = await supabase.from("contest_entries").select(selectWithPlayers).eq("contest_id", contestId);
    data = q0.data as ContestEntryQueryRow[] | null;
    error = q0.error;

    if (error && (isPostgrestRelationshipOrEmbedError(error) || isMissingColumnOrSchemaError(error))) {
      const q1 = await supabase.from("contest_entries").select(selectFull).eq("contest_id", contestId);
      data = q1.data as ContestEntryQueryRow[] | null;
      error = q1.error;
    }

    if (error && (isPostgrestRelationshipOrEmbedError(error) || isMissingColumnOrSchemaError(error))) {
      const q2 = await supabase.from("contest_entries").select(selectMinimal).eq("contest_id", contestId);
      data = q2.data as ContestEntryQueryRow[] | null;
      error = q2.error;
    }

    if (error) {
      return { ok: false, error: error.message };
    }

    let raw = [...(data ?? [])];
    const needsProfileLabels = raw.some((row) => !firstEmbed(row.profiles ?? null));
    if (needsProfileLabels && raw.length > 0) {
      const ids = [...new Set(raw.map((r) => String(r.user_id ?? "")).filter((x) => x.length > 0))];
      const { data: profRows } = await supabase.from("profiles").select("id,username").in("id", ids);
      const byUser = new Map<string, { username?: string | null }>();
      for (const p of profRows ?? []) {
        const pid = String((p as { id?: string }).id ?? "");
        if (pid) byUser.set(pid, p as { username?: string | null });
      }
      raw = raw.map((row) => {
        if (firstEmbed(row.profiles ?? null)) return row;
        const u = byUser.get(String(row.user_id ?? ""));
        return u ? { ...row, profiles: u } : row;
      });
    }

    const scoreByGolfer = new Map<string, number>();
    if (!usesSimPool) {
      const gsRes = await supabase.from("golfer_scores").select("golfer_id, total_score").eq("contest_id", contestId);
      if (!gsRes.error) {
        for (const gs of gsRes.data ?? []) {
          const gid = String((gs as { golfer_id?: string }).golfer_id ?? "");
          if (gid) scoreByGolfer.set(gid, num((gs as { total_score?: unknown }).total_score));
        }
      }
    }

    const sorted = [...raw].sort((a, b) => compareContestEntriesLiveScoring(a, b, simOpts));

    const rows: LiveLeaderboardRow[] = sorted.map((row, i) => {
      const pr = firstEmbed(row.profiles ?? null);
      const name = trimStr((pr as ProfilesEmbed | null)?.username);
      return {
        rank: i + 1,
        entryId: String(row.id ?? ""),
        userId: String(row.user_id ?? ""),
        username: name || "—",
        totalScore: lineupLiveScoreFromRow(row, simOpts),
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        players: playersForEntryRow(row, scoreByGolfer, simOpts),
      };
    });

    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: msg };
  }
}
