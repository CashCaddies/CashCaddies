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

/**
 * Leaderboard rows from `contest_entries` + embedded `lineups` + `profiles(username)`.
 * Join: `profiles.id` = `contest_entries.user_id` (PostgREST). Display uses `entry_number` per user per contest.
 */
export type LeaderboardDisplayRow = {
  rank: number;
  userId: string;
  userLabel: string;
  /** `contest_entries.id` — used for deep-linking to the edit/view lineup page. */
  entryId: string;
  entryNumber: number;
  totalSalary: number;
  totalScore: number;
  protectionEnabled: boolean;
  /** Automatic protection has triggered for this entry (credit and/or post–Round-1 scoring). */
  protectionTriggered: boolean;
  /** Safety Coverage Credit issued (pre–Round-1 WD/DNS/DQ). */
  protectionTokenIssued: boolean;
  protectedGolferName: string | null;
  /** Leaderboard column: credit issued, eligible, adjusted, or standard. */
  protectionStatusLabel: "Safety Coverage Credit Issued" | "Safety Coverage Eligible" | "Scoring adjusted" | "Standard";
  lineupId?: string;
  /** Entry fee protection (no lineup edit before lock). */
  entryFeeProtected: boolean;
};

type LineupsEmbed = {
  id?: string;
  total_score?: number | string | null;
  total_salary?: number | string | null;
};

type ProfilesEmbed = {
  username?: string | null;
};

type ContestEntryQueryRow = {
  id: string;
  user_id: string;
  /** 1-based index of this user's entry in the contest (from DB). */
  entry_number?: number | null;
  lineup_id?: string | null;
  created_at?: string;
  lineups: LineupsEmbed | LineupsEmbed[] | null;
  profiles: ProfilesEmbed | ProfilesEmbed[] | null;
};

export type LeaderboardForContestResult = {
  rows: LeaderboardDisplayRow[];
};

function firstEmbed<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function trimStr(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t === "" ? "" : t;
}

function lineupFromRow(row: ContestEntryQueryRow): LineupsEmbed | null {
  return firstEmbed(row.lineups);
}

function profilesFromRow(row: ContestEntryQueryRow): ProfilesEmbed | null {
  return firstEmbed(row.profiles);
}

/** Fallback when `entry_number` is missing (legacy rows): order by created_at, id. */
function entryNumberForUser(rowsAll: ContestEntryQueryRow[], row: ContestEntryQueryRow): number {
  const same = rowsAll
    .filter((r) => r.user_id === row.user_id)
    .sort((a, b) => {
      const ta = Date.parse(a.created_at ?? "") || 0;
      const tb = Date.parse(b.created_at ?? "") || 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
  const idx = same.findIndex((r) => r.id === row.id);
  return idx >= 0 ? idx + 1 : 1;
}

function entryNumberFromRow(row: ContestEntryQueryRow, raw: ContestEntryQueryRow[]): number {
  const n = Number(row.entry_number);
  if (Number.isFinite(n) && n >= 1) {
    return Math.floor(n);
  }
  return entryNumberForUser(raw, row);
}

/** Always resolves: empty rows on missing id, query error, or thrown exception (MVP stability). */
export async function getLeaderboardForContest(contestId: string): Promise<LeaderboardForContestResult> {
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

    await ensureContestEntryProtection(supabase, id);

    const selectFull = `${CONTEST_ENTRIES_READ_BASE}, lineups ( id, total_score, total_salary ), profiles ( username )`;

    const selectMinimal = `${CONTEST_ENTRIES_READ_BASE}, lineups ( id, total_score, total_salary )`;

    let data: unknown[] | null = null;
    let error: { message: string } | null = null;

    const q1 = await supabase.from("contest_entries").select(selectFull).eq("contest_id", id);
    data = q1.data;
    error = q1.error;

    if (error && (isPostgrestRelationshipOrEmbedError(error) || isMissingColumnOrSchemaError(error))) {
      const q2 = await supabase.from("contest_entries").select(selectMinimal).eq("contest_id", id);
      data = q2.data;
      error = q2.error;
    }

    if (error) {
      return { rows: [] };
    }

    let raw = (data ?? []) as unknown as ContestEntryQueryRow[];

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

    const sorted = [...raw].sort((a, b) => {
      const la = lineupFromRow(a);
      const lb = lineupFromRow(b);
      const sb = Number(lb?.total_score ?? 0);
      const sa = Number(la?.total_score ?? 0);
      if (sb !== sa) return sb - sa;
      return String(a.id).localeCompare(String(b.id));
    });

    const rows: LeaderboardDisplayRow[] = sorted.map((row, index) => {
      const rank = index + 1;
      const lu = lineupFromRow(row);
      const pr = profilesFromRow(row);
      const name = trimStr(pr?.username);
      const userLabel = name || "—";

      const rawScore = Number(lu?.total_score ?? 0);
      const totalScore = Number.isFinite(rawScore) ? rawScore : 0;
      const rawSal = Number(lu?.total_salary ?? 0);
      const totalSalary = Number.isFinite(rawSal) ? rawSal : 0;

      return {
        rank,
        userId: String(row.user_id ?? ""),
        userLabel,
        entryId: String(row.id ?? ""),
        entryNumber: entryNumberFromRow(row, raw),
        totalSalary,
        totalScore,
        protectionEnabled: false,
        protectionTriggered: false,
        protectionTokenIssued: false,
        protectedGolferName: null,
        protectionStatusLabel: "Standard" as const,
        lineupId: lu?.id ?? row.lineup_id ?? undefined,
        entryFeeProtected: false,
      };
    });

    return { rows };
  } catch {
    return { rows: [] };
  }
}
