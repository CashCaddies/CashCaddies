import type { SupabaseClient } from "@supabase/supabase-js";
import { getContestDisplay } from "@/lib/contest-lobby-data";
import { type ContestLifecyclePhase, contestLifecyclePhaseFromRow } from "@/lib/contest-lobby-shared";
import { CONTEST_ENTRIES_READ_BASE } from "@/lib/contest-entries-read-columns";
import { splitEntryFeeUsd } from "@/lib/contest-fee-split";
import { isMissingColumnOrSchemaError } from "@/lib/supabase-missing-column";

function phaseToUserLabel(phase: ContestLifecyclePhase): string {
  if (phase === "upcoming") return "Upcoming";
  if (phase === "live") return "Live";
  return "Ended";
}

/** Uses `starts_at` and optional `ends_at`; if `ends_at` is null, completed after starts_at + 3 days. */
export function deriveContestStatusFromStartsAt(
  startsAtIso: string | null,
  endsAtIso?: string | null,
): string {
  if (!startsAtIso) return "Unknown";
  const phase = contestLifecyclePhaseFromRow({
    starts_at: startsAtIso,
    ends_at: endsAtIso ?? null,
  });
  return phaseToUserLabel(phase);
}

export type MyEnteredContestRow = {
  entryId: string;
  contestId: string;
  contestName: string;
  /** 1-based entry index for this user in this contest (`contest_entries.entry_number`). */
  entryNumber: number;
  entryFeeUsd: number;
  lineupSalary: number | null;
  /** True when entry fee > 0 (safety coverage funded from entry split). */
  protectionEnabled: boolean;
  /** 5% of entry fee → protection fund (not an extra charge). */
  protectionFeeUsd: number;
  /** Stabilization: always false (protection columns omitted from reads). */
  hasProtectedEntry: boolean;
  contestStatus: string;
  enteredAt: string;
};

type LineupSalaryEmbed = { total_salary: number | null };

type ContestEntryQueryRow = {
  id: string;
  contest_id: string;
  entry_number?: number | null;
  entry_fee: number | string | null;
  total_paid?: number | string | null;
  status?: string | null;
  created_at: string;
  lineup_id: string | null;
  /** PostgREST may return one object or a single-element array for FK embeds. */
  lineups: LineupSalaryEmbed | LineupSalaryEmbed[] | null;
};

function entryNumberForContestUser(list: ContestEntryQueryRow[], entry: ContestEntryQueryRow): number {
  const n = Number(entry.entry_number);
  if (Number.isFinite(n) && n >= 1) {
    return Math.floor(n);
  }
  const same = list
    .filter((e) => e.contest_id === entry.contest_id)
    .sort((a, b) => {
      const ta = Date.parse(a.created_at) || 0;
      const tb = Date.parse(b.created_at) || 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
  const idx = same.findIndex((e) => e.id === entry.id);
  return idx >= 0 ? idx + 1 : 1;
}

function firstLineupEmbed(
  raw: ContestEntryQueryRow["lineups"],
): LineupSalaryEmbed | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/**
 * `contest_entries` for `user_id`, embedded `lineups(total_salary)`, then `contests` rows merged by `contest_id`
 * (two requests, no polling — RLS still applies; filter matches session user explicitly).
 */
export async function fetchMyEnteredContests(
  client: SupabaseClient,
  userId: string,
): Promise<{ rows: MyEnteredContestRow[]; error: string | null }> {
  const uid = userId.trim();
  if (!uid) {
    return { rows: [], error: "Missing user id." };
  }

  const selectWithLineups = `${CONTEST_ENTRIES_READ_BASE}, lineups ( total_salary )`;

  const selectNoEmbed = CONTEST_ENTRIES_READ_BASE;

  let entries: unknown[] | null = null;
  let entriesErr: { message: string } | null = null;

  const q1 = await client.from("contest_entries").select(selectWithLineups).eq("user_id", uid).order("created_at", { ascending: false });
  entries = q1.data;
  entriesErr = q1.error;

  /* Last resort: no embed (avoids 400 from lineups FK/embed); still filtered by user_id. */
  if (entriesErr) {
    const q3 = await client
      .from("contest_entries")
      .select(selectNoEmbed)
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    entries = q3.data;
    entriesErr = q3.error;
  }

  if (entriesErr) {
    return { rows: [], error: null };
  }

  let list = (entries ?? []) as unknown as ContestEntryQueryRow[];

  const needsLineupSalaries = list.some((e) => e.lineup_id && !firstLineupEmbed(e.lineups));
  if (needsLineupSalaries && list.length > 0) {
    const lids = [...new Set(list.map((e) => e.lineup_id).filter((x): x is string => Boolean(x)))];
    if (lids.length > 0) {
      const { data: luRows, error: luErr } = await client
        .from("lineups")
        .select("id,total_salary")
        .in("id", lids);
      if (!luErr && luRows) {
        const byId = new Map<string, LineupSalaryEmbed>();
        for (const r of luRows) {
          const lid = String((r as { id?: string }).id ?? "");
          if (lid) {
            byId.set(lid, { total_salary: (r as { total_salary?: number | null }).total_salary ?? null });
          }
        }
        list = list.map((e) => {
          if (firstLineupEmbed(e.lineups)) return e;
          const lid = e.lineup_id;
          const lu = lid ? byId.get(lid) : undefined;
          return lu ? { ...e, lineups: lu } : e;
        });
      }
    }
  }
  const contestIds = [...new Set(list.map((e) => e.contest_id).filter(Boolean))];

  const contestMap = new Map<string, { name: string; starts_at: string; ends_at: string | null }>();
  if (contestIds.length > 0) {
    const { data: contests, error: contestsErr } = await client
      .from("contests")
      .select("id, name, starts_at, ends_at")
      .in("id", contestIds);

    if (!contestsErr) {
      for (const c of contests ?? []) {
        contestMap.set(c.id, {
          name: c.name,
          starts_at: c.starts_at,
          ends_at: c.ends_at != null ? String(c.ends_at) : null,
        });
      }
    }
  }

  const rows: MyEnteredContestRow[] = list.map((entry) => {
    const meta = contestMap.get(entry.contest_id);
    const display = getContestDisplay(entry.contest_id);
    const contestName = meta?.name ?? display.name;
    const contestStatus =
      meta?.starts_at != null
        ? deriveContestStatusFromStartsAt(meta.starts_at, meta.ends_at)
        : display.status;

    const rawSalary = firstLineupEmbed(entry.lineups)?.total_salary;
    const lineupSalary =
      rawSalary !== null && rawSalary !== undefined && Number.isFinite(Number(rawSalary))
        ? Number(rawSalary)
        : null;

    const entryFeeUsd = Number(entry.entry_fee ?? 0);
    const split = splitEntryFeeUsd(entryFeeUsd);

    return {
      entryId: entry.id,
      contestId: entry.contest_id,
      contestName,
      entryNumber: entryNumberForContestUser(list, entry),
      entryFeeUsd,
      lineupSalary,
      protectionEnabled: entryFeeUsd > 0,
      protectionFeeUsd: split.protectionAmount,
      hasProtectedEntry: false,
      contestStatus,
      enteredAt: entry.created_at,
    };
  });

  return { rows, error: null };
}
