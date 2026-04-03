import { unstable_noStore } from "next/cache";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import type { TeeWave } from "@/lib/golf-tee-times";
import { createClient } from "@/lib/supabase/server";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";

/** Per-golfer contest scoring row for the DFS golfer leaderboard. */
export type GolferLeaderboardRow = {
  rank: number;
  golferId: string;
  golferName: string;
  totalFantasyPoints: number;
  /** Official tournament finishing place (display). */
  finishingPosition: number | null;
  /** Latest / featured round fantasy subtotal when available. */
  roundFantasyPoints: number | null;
  /** After R2 cut: false = missed cut (MC). */
  madeCut: boolean;
  /** Stroke-rank at cut (1 = leader); null before cut. */
  cutPosition: number | null;
  roundsCompleted: number;
  scoringLocked: boolean;
  statusLabel: "Active" | "MC";
  teeTimeIso: string | null;
  wave: TeeWave | null;
  teeTimeRound: number | null;
  courseWeatherRating: number | null;
  teeRoundVsPar: number | null;
};

export type GolferLeaderboardResult = {
  rows: GolferLeaderboardRow[];
};

type ScoresQueryRow = {
  golfer_id: string;
  total_score?: number | string | null;
  finishing_position?: number | null;
  round_fantasy_points?: number | string | null;
  made_cut?: boolean | null;
  cut_position?: number | null;
  rounds_completed?: number | null;
  scoring_locked?: boolean | null;
  tee_time?: string | null;
  wave?: string | null;
  tee_time_round?: number | null;
  course_weather_rating?: number | string | null;
  tee_round_vs_par?: number | string | null;
  golfers?: { name?: string | null } | { name?: string | null }[] | null;
};

function parseWave(raw: string | null | undefined): TeeWave | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "AM" || s === "PM") return s;
  return null;
}

function firstGolferName(raw: ScoresQueryRow["golfers"]): string {
  if (raw == null) return "—";
  const o = Array.isArray(raw) ? raw[0] : raw;
  const n = typeof o?.name === "string" ? o.name.trim() : "";
  return n || "—";
}

/**
 * Golfer-level leaderboard for a contest (`golfer_scores` + names), sorted by fantasy points descending.
 */
export async function getGolferLeaderboardForContest(contestId: string): Promise<GolferLeaderboardResult> {
  unstable_noStore();
  try {
    const id = contestIdForRpc(contestId);
    if (!id) {
      return { rows: [] };
    }

    const supabase = await createClient();
    const hasAccess = await currentUserHasContestAccess(supabase);
    if (!hasAccess) {
      return { rows: [] };
    }

    const { data, error } = await supabase
      .from("golfer_scores")
      .select(
        "golfer_id,total_score,finishing_position,round_fantasy_points,made_cut,cut_position,rounds_completed,scoring_locked,tee_time,wave,tee_time_round,course_weather_rating,tee_round_vs_par,golfers(name)",
      )
      .eq("contest_id", id);

    if (error) {
      return { rows: [] };
    }

    const list = (data ?? []) as ScoresQueryRow[];
    if (list.length === 0) {
      return { rows: [] };
    }

    const mapped = list.map((r) => {
      const ts = Number(r.total_score ?? 0);
      const rf = r.round_fantasy_points != null ? Number(r.round_fantasy_points) : null;
      const fp = Number.isFinite(ts) ? ts : 0;
      const roundOk = rf != null && Number.isFinite(rf);
      const madeCut = r.made_cut !== false;
      const statusLabel: GolferLeaderboardRow["statusLabel"] = madeCut ? "Active" : "MC";
      const teeRaw = r.tee_time != null ? String(r.tee_time) : null;
      const teeTimeIso = teeRaw && teeRaw.trim() !== "" ? teeRaw : null;
      const wr = parseWave(r.wave);
      const tvr = r.tee_round_vs_par != null ? Number(r.tee_round_vs_par) : null;
      const teeRoundVsPar = tvr != null && Number.isFinite(tvr) ? tvr : null;
      const cwr = r.course_weather_rating != null ? Number(r.course_weather_rating) : null;
      const weather =
        cwr != null && Number.isFinite(cwr) ? Math.round(cwr * 10) / 10 : null;
      const tr = r.tee_time_round != null ? Number(r.tee_time_round) : null;
      const teeTimeRound =
        tr != null && Number.isFinite(tr) ? Math.max(1, Math.min(4, Math.floor(tr))) : null;
      return {
        golferId: String(r.golfer_id ?? ""),
        golferName: firstGolferName(r.golfers),
        totalFantasyPoints: fp,
        finishingPosition:
          r.finishing_position != null && Number.isFinite(Number(r.finishing_position))
            ? Math.floor(Number(r.finishing_position))
            : null,
        roundFantasyPoints: roundOk ? rf : null,
        madeCut,
        cutPosition:
          r.cut_position != null && Number.isFinite(Number(r.cut_position))
            ? Math.floor(Number(r.cut_position))
            : null,
        roundsCompleted: Math.max(0, Math.min(4, Number(r.rounds_completed ?? 0) || 0)),
        scoringLocked: Boolean(r.scoring_locked),
        statusLabel,
        teeTimeIso,
        wave: wr,
        teeTimeRound,
        courseWeatherRating: weather,
        teeRoundVsPar,
        _sort: fp,
      };
    });

    mapped.sort((a, b) => {
      if (b._sort !== a._sort) return b._sort - a._sort;
      return a.golferName.localeCompare(b.golferName);
    });

    const rows: GolferLeaderboardRow[] = mapped.map((m, index) => ({
      rank: index + 1,
      golferId: m.golferId,
      golferName: m.golferName,
      totalFantasyPoints: m.totalFantasyPoints,
      finishingPosition: m.finishingPosition,
      roundFantasyPoints: m.roundFantasyPoints,
      madeCut: m.madeCut,
      cutPosition: m.cutPosition,
      roundsCompleted: m.roundsCompleted,
      scoringLocked: m.scoringLocked,
      statusLabel: m.statusLabel,
      teeTimeIso: m.teeTimeIso,
      wave: m.wave,
      teeTimeRound: m.teeTimeRound,
      courseWeatherRating: m.courseWeatherRating,
      teeRoundVsPar: m.teeRoundVsPar,
    }));

    return { rows };
  } catch {
    return { rows: [] };
  }
}
