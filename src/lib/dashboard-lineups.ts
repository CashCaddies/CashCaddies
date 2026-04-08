import type { SupabaseClient } from "@supabase/supabase-js";
import { getContestDisplay } from "@/lib/contest-lobby-data";
import { contestLifecyclePhaseFromRow, isContestLineupLocked } from "@/lib/contest-lobby-shared";
export { lineupHasContestEntry } from "@/lib/lineup-permissions";
import type { DashboardLineupPlayerNested } from "@/lib/lineup-players";
import { lineupTotalScore } from "@/lib/scoring";
import {
  isMissingColumnOrSchemaError,
  isPostgrestRelationshipOrEmbedError,
  isRelationMissingOrNotExposedError,
} from "@/lib/supabase-missing-column";

/** Row from `public.contests` joined by `lineups.contest_id`. */
export type DashboardLineupContestMeta = {
  id: string;
  name: string;
  entry_fee_usd: number;
  starts_at: string;
  ends_at?: string | null;
};

export function formatContestCatalogEntryFee(usd: number): string {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function contestCatalogStatusLabel(
  startsAt: string | null | undefined,
  endsAt?: string | null | undefined,
): string {
  if (!startsAt) return "Open";
  const phase = contestLifecyclePhaseFromRow({
    starts_at: startsAt,
    ends_at: endsAt ?? null,
  });
  if (phase === "upcoming") return "Open";
  if (phase === "live") return "Live";
  return "Ended";
}

/**
 * Contest column for dashboard / My Lineups: prefer `contests` table when joined.
 */
export function dashboardLineupContestPresentation(l: DashboardLineup): {
  contestName: string;
  entryFeeLabel: string;
  statusLabel: string;
} {
  if (l.contest_id == null) {
    return {
      contestName: "Draft",
      entryFeeLabel: "—",
      statusLabel: "Draft",
    };
  }
  if (l.contest) {
    return {
      contestName: l.contest.name,
      entryFeeLabel: formatContestCatalogEntryFee(l.contest.entry_fee_usd),
      statusLabel: contestCatalogStatusLabel(l.contest.starts_at, l.contest.ends_at),
    };
  }
  const d = getContestDisplay(l.contest_id);
  return {
    contestName: d.name,
    entryFeeLabel: d.entryFee,
    statusLabel: d.status,
  };
}

export type ProtectionUiStatus = "none" | "swap_available" | "protected" | "teed_off";

export type DashboardPlayer = {
  id: string;
  name: string;
  salary: number;
  withdrawn?: boolean;
  /** Sum of these per lineup = leaderboard total_score */
  fantasy_points?: number;
  /** Covered by CashCaddies Safety Coverage on this lineup */
  protected?: boolean;
  /** LIVE: engine / swap state for this roster slot */
  protectionUiStatus?: ProtectionUiStatus | null;
  swapAvailableUntil?: string | null;
};

export type DashboardLineup = {
  id: string;
  contest_id: string | null;
  /** Set when the user has completed contest entry; roster is locked. */
  contest_entry_id: string | null;
  /** Golfer who triggered automatic protection (`contest_entries.protected_golfer_id`). */
  insured_golfer_id: string | null;
  /** True when a Safety Coverage Credit was issued for this entry (pre–Round-1 WD/DNS/DQ). */
  safety_token_issued: boolean;
  /** Entered contest with safety coverage fee — eligible for automatic credit rules. */
  safety_coverage_eligible: boolean;
  /** True when a paid contest entry exists for this lineup. */
  valid_contest_entry: boolean;
  /** Populated from `public.contests` when `contest_id` matches a catalog row. */
  contest: DashboardLineupContestMeta | null;
  total_salary: number;
  /** Sum of golfer fantasy_points on this roster */
  total_score: number;
  created_at: string;
  entry_fee: number;
  protection_fee: number;
  total_paid: number;
  protection_enabled: boolean;
  players: DashboardPlayer[];
};

/** My Lineups card entry-status badge (mutually exclusive). */
export type LineupEntryStatusKind = "draft" | "protected" | "standard" | "locked";

/**
 * Draft → no valid paid entry. Locked → contest started (lineup locked). Protected / Standard → entered,
 * contest not yet started (coverage vs entry-only).
 */
export function resolveLineupEntryStatus(row: DashboardLineup): {
  kind: LineupEntryStatusKind;
  label: string;
} {
  if (!row.valid_contest_entry) {
    return { kind: "draft", label: "Draft" };
  }
  if (row.contest && isContestLineupLocked({ starts_at: row.contest.starts_at, lineup_locked: undefined })) {
    return { kind: "locked", label: "Locked Entry" };
  }
  const hasProtection =
    row.insured_golfer_id != null || row.protection_fee > 0 || row.protection_enabled;
  if (hasProtection) {
    return { kind: "protected", label: "Safety Coverage Eligible" };
  }
  return { kind: "standard", label: "Standard Entry" };
}

type LineupsQueryRow = {
  id: string;
  contest_id: string | null;
  contest_entry_id: string | null;
  total_salary: number;
  total_score: number | string | null;
  created_at: string;
  entry_fee: number | null;
  protection_fee: number | null;
  total_paid: number | null;
  protection_enabled: boolean | null;
  lineup_players: DashboardLineupPlayerNested[] | null;
};

type ContestEntryProtectionRow = {
  id: string;
  protected_golfer_id?: string | null;
  protection_token_issued?: boolean | null;
  [key: string]: unknown;
};

/** Only columns guaranteed on stabilized `lineups` / `lineup_players` / `golfers` (no optional engine columns). */
const LINEUPS_SELECT = `
      id,
      contest_id,
      contest_entry_id,
      total_salary,
      total_score,
      created_at,
      entry_fee,
      protection_fee,
      total_paid,
      protection_enabled,
      lineup_players (
        is_protected,
        golfer_id,
        golfers ( id, name, salary, withdrawn, fantasy_points )
      )
    `;

export async function fetchDashboardLineups(
  client: SupabaseClient,
  userId: string,
): Promise<{ lineups: DashboardLineup[]; error: string | null }> {
  const uid = userId.trim();
  if (!uid) {
    return { lineups: [], error: null };
  }

  try {
  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  /** Own lineups only; drafts (`contest_id` null, `contest_entry_id` null) included — no status column filter. */
  const q1 = await client
    .from("lineups")
    .select(LINEUPS_SELECT)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  data = q1.data;
  error = q1.error;

  if (
    error &&
    (isMissingColumnOrSchemaError(error) ||
      isRelationMissingOrNotExposedError(error))
  ) {
    return { lineups: [], error: null };
  }

  if (error) {
    return { lineups: [], error: null };
  }

  const rows = (data ?? []) as unknown as LineupsQueryRow[];

  const contestIds = [...new Set(rows.map((r) => r.contest_id).filter((id): id is string => Boolean(id)))];
  const contestById = new Map<string, DashboardLineupContestMeta>();

  if (contestIds.length > 0) {
    const { data: contestRows, error: contestsErr } = await client
      .from("contests")
      .select("id,name,entry_fee_usd,starts_at,ends_at")
      .in("id", contestIds);

    if (!contestsErr) {
      for (const c of contestRows ?? []) {
        contestById.set(c.id, {
          id: c.id,
          name: c.name,
          entry_fee_usd: Number(c.entry_fee_usd),
          starts_at: c.starts_at,
          ends_at: c.ends_at != null ? String(c.ends_at) : null,
        });
      }
    }
  }

  const contestEntryIds = [
    ...new Set(rows.map((r) => r.contest_entry_id).filter((id): id is string => Boolean(id))),
  ];
  const entryMetaById = new Map<
    string,
    { protectedGolferId: string | null; safetyTokenIssued: boolean }
  >();
  if (contestEntryIds.length > 0) {
    const ceFull = "id,protected_golfer_id,protection_token_issued";
    const ceSafe = "id,protected_golfer_id,protection_token_issued";
    const ceMinimal = "id,protected_golfer_id";

    let ceRows: ContestEntryProtectionRow[] | null = null;
    let ceErr: { message: string } | null = null;

    const c1 = await client.from("contest_entries").select(ceFull).in("id", contestEntryIds);
    ceRows = (c1.data ?? null) as ContestEntryProtectionRow[] | null;
    ceErr = c1.error;

    if (ceErr && isRelationMissingOrNotExposedError(ceErr)) {
      ceRows = [];
      ceErr = null;
    } else if (ceErr && isMissingColumnOrSchemaError(ceErr)) {
      const c2 = await client.from("contest_entries").select(ceSafe).in("id", contestEntryIds);
      ceRows = (c2.data ?? null) as ContestEntryProtectionRow[] | null;
      ceErr = c2.error;
    }
    if (ceErr && isMissingColumnOrSchemaError(ceErr)) {
      const c3 = await client.from("contest_entries").select(ceMinimal).in("id", contestEntryIds);
      ceRows = (c3.data ?? null) as ContestEntryProtectionRow[] | null;
      ceErr = c3.error;
    }
    if (ceErr && isRelationMissingOrNotExposedError(ceErr)) {
      ceRows = [];
      ceErr = null;
    } else if (ceErr && isPostgrestRelationshipOrEmbedError(ceErr)) {
      ceRows = [];
      ceErr = null;
    }
    if (ceErr) {
      ceRows = [];
    }

    for (const ce of ceRows ?? []) {
      const protId =
        ce.protected_golfer_id != null && String(ce.protected_golfer_id).trim() !== ""
          ? String(ce.protected_golfer_id)
          : null;
      entryMetaById.set(ce.id, {
        protectedGolferId: protId,
        safetyTokenIssued: Boolean(ce.protection_token_issued),
      });
    }
  }

  const lineups: DashboardLineup[] = rows.map((row) => {
    const lp = row.lineup_players ?? [];
    const players: DashboardPlayer[] = lp
      .map((p) => {
        const g = p.golfers;
        if (!g) return null;
        const fp = Number(g.fantasy_points ?? 0);
        const player: DashboardPlayer = {
          id: g.id,
          name: g.name,
          salary: g.salary,
          withdrawn: Boolean(g.withdrawn),
          fantasy_points: Number.isFinite(fp) ? fp : 0,
          protected: Boolean(p.is_protected),
          protectionUiStatus: "none",
          swapAvailableUntil: null,
        };
        return player;
      })
      .filter((row): row is DashboardPlayer => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    const fromLineup = Number(row.total_score ?? NaN);
    const total_score = Number.isFinite(fromLineup)
      ? Math.round(fromLineup * 100) / 100
      : lineupTotalScore(players);
    const contestMeta =
      row.contest_id != null ? (contestById.get(row.contest_id) ?? null) : null;
    const entryMeta =
      row.contest_entry_id != null ? entryMetaById.get(row.contest_entry_id) : undefined;
    const insuredGolferId = entryMeta?.protectedGolferId ?? null;
    const safetyTokenIssued = entryMeta?.safetyTokenIssued ?? false;
    const validContestEntry = row.contest_entry_id != null;
    const safetyCoverageEligible =
      validContestEntry && (Boolean(row.protection_enabled) || Number(row.protection_fee ?? 0) > 0);
    return {
      id: row.id,
      contest_id: row.contest_id,
      contest_entry_id: row.contest_entry_id ?? null,
      insured_golfer_id: insuredGolferId,
      safety_token_issued: safetyTokenIssued,
      safety_coverage_eligible: safetyCoverageEligible,
      valid_contest_entry: validContestEntry,
      contest: contestMeta,
      total_salary: row.total_salary,
      total_score,
      created_at: row.created_at,
      entry_fee: Number(row.entry_fee ?? 0),
      protection_fee: Number(row.protection_fee ?? 0),
      total_paid: Number(row.total_paid ?? 0),
      protection_enabled: Boolean(row.protection_enabled),
      players,
    };
  });

  return { lineups, error: null };
  } catch {
    return { lineups: [], error: null };
  }
}
