import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  entryCountFromContestEntriesRelation,
  type LobbyContestPayoutRow,
  type LobbyContestRow,
} from "@/lib/contest-lobby-shared";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";

export type { LobbyContestRow, LobbyContestPayoutRow } from "@/lib/contest-lobby-shared";
export {
  formatContestStartDate,
  formatLobbyEntryFeeUsd,
  formatPerUserEntryLimit,
  isContestLineupLocked,
} from "@/lib/contest-lobby-shared";

/** @deprecated Use `LobbyContestPayoutRow` from `@/lib/contest-lobby-shared`. */
export type ContestPayoutRow = LobbyContestPayoutRow;

const CONTEST_CARD_SELECT = `
  id,
  name,
  entry_fee,
  entry_fee_usd,
  max_entries,
  start_time,
  starts_at,
  status,
  created_at,
  entries_open_at,
  late_swap_enabled,
  contest_entries ( id )
`;

/** Raw row shape after DB fetch (before contest_id normalization). */
type ContestPayoutDbRow = {
  contest_id?: unknown;
  rank_place?: unknown;
  payout_pct?: unknown;
};

/** Normalized for in-memory matching only (messy DB text → comparable key). */
type NormalizedPayoutRow = {
  contest_id: string;
  rank_place: unknown;
  payout_pct: unknown;
};

/**
 * Fetch all `contest_payouts` rows — no `.in()` / `.eq()` on contest_id; matching is 100% in JS.
 */
async function fetchAllContestPayoutRows(supabase: SupabaseClient): Promise<ContestPayoutDbRow[]> {
  const { data, error } = await supabase
    .from("contest_payouts")
    .select("contest_id, rank_place, payout_pct")
    .order("rank_place", { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("fetchAllContestPayoutRows", error);
    }
    return [];
  }
  return (data ?? []) as ContestPayoutDbRow[];
}

function normalizePayoutRows(payouts: ContestPayoutDbRow[]): NormalizedPayoutRow[] {
  return payouts.map((p) => ({
    contest_id: String(p.contest_id).trim().toLowerCase(),
    rank_place: p.rank_place,
    payout_pct: p.payout_pct,
  }));
}

function toLobbyPayoutRows(rows: NormalizedPayoutRow[]): LobbyContestPayoutRow[] {
  return rows
    .map((p) => ({
      rank_place: Number(p.rank_place),
      payout_pct: Number(p.payout_pct),
    }))
    .filter((r) => Number.isFinite(r.rank_place) && r.rank_place >= 1 && Number.isFinite(r.payout_pct))
    .sort((a, b) => a.rank_place - b.rank_place);
}

/**
 * Attach payouts for one contest using only normalized string equality (DB can be messy).
 */
function payoutsForContest(normalizedPayouts: NormalizedPayoutRow[], contestIdRaw: string): LobbyContestPayoutRow[] {
  const normalizedContestId = String(contestIdRaw).trim().toLowerCase();
  const matched = normalizedPayouts.filter((p) => p.contest_id === normalizedContestId);
  const contestPayouts = toLobbyPayoutRows(matched);

  console.log("MATCH TEST →", {
    contestId: normalizedContestId,
    matched: contestPayouts,
  });

  return contestPayouts;
}

export async function fetchLobbyContests(): Promise<{
  contests: LobbyContestRow[];
  error: string | null;
}> {
  try {
    const hasAccess = await currentUserHasContestAccess(supabase);
    // TEMP STABILIZATION MODE:
    // Server auth is disabled, so `hasAccess` can be false even for valid users.
    // Do not hard-block contest visibility at the server query layer.
    if (!hasAccess && process.env.NODE_ENV === "development") {
      console.log("fetchLobbyContests: bypassing server-side beta gate during stabilization.");
    }
    const { usd: safetyPoolFinite } = await fetchInsurancePoolBalanceUsd(supabase);

    const q = await supabase
      .from("contests")
      .select(CONTEST_CARD_SELECT)
      .in("status", ["filling", "full", "locked", "live", "complete"])
      .order("start_time", { ascending: true });

    const data = q.data as Array<Record<string, unknown>> | null;
    if (q.error) {
      return { contests: [], error: q.error.message };
    }

    const rows = (data ?? []).filter((row) => String(row.id ?? "").trim() !== "");
    const ids = rows.map((row) => String(row.id).trim()).filter(Boolean);

    let settledIds = new Set<string>();
    if (ids.length > 0) {
      const { data: stRows } = await supabase.from("contest_settlements").select("contest_id").in("contest_id", ids);
      settledIds = new Set((stRows ?? []).map((r) => String((r as { contest_id: string }).contest_id)));
    }

    const rawPayouts = await fetchAllContestPayoutRows(supabase);
    const normalizedPayouts = normalizePayoutRows(rawPayouts);

    const contests = rows
      .map((row) => {
        const id = String(row.id ?? "").trim();
        if (!id) {
          return null;
        }
        const maxEntries = Math.max(1, Number(row.max_entries ?? 100));
        const entryCount = entryCountFromContestEntriesRelation(row as Record<string, unknown>);
        const rawStatusStr = String(row.status ?? "");
        const startsAt =
          String(row.start_time ?? row.starts_at ?? row.created_at ?? new Date().toISOString());
        const entryFee = Number(row.entry_fee ?? row.entry_fee_usd ?? 0);
        const createdAt = row.created_at != null ? String(row.created_at) : undefined;
        const payouts = payoutsForContest(normalizedPayouts, id);
        const mapped: LobbyContestRow = {
          id,
          name: String(row.name ?? "Contest"),
          entry_fee_usd: Number.isFinite(entryFee) ? entryFee : 0,
          entry_fee: Number.isFinite(entryFee) ? entryFee : 0,
          max_entries: maxEntries,
          max_entries_per_user: 1,
          entry_count: entryCount,
          starts_at: startsAt,
          start_time: startsAt,
          status: rawStatusStr,
          entries_open_at: row.entries_open_at != null ? String(row.entries_open_at) : null,
          created_at: createdAt,
          has_settlement: settledIds.has(id),
          protected_entries_count: 0,
          safety_pool_usd: safetyPoolFinite,
          late_swap_enabled:
            row.late_swap_enabled === undefined || row.late_swap_enabled === null
              ? true
              : Boolean(row.late_swap_enabled),
          payouts,
        };
        return mapped;
      })
      .filter((row): row is LobbyContestRow => row != null);

    console.log("LOBBY DATA:", contests);

    return { contests, error: null };
  } catch (e) {
    let message = e instanceof Error ? e.message : "Could not load contests.";
    if (/fetch failed/i.test(message)) {
      message =
        "Could not connect to Supabase (network or configuration). Confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local have no extra spaces or quotes, then restart the dev server.";
    }
    return { contests: [], error: message };
  }
}

/** Single contest from `contests` for `/contest/[id]` and `/contests/[id]` and `/lobby/[contestId]`. */
export async function fetchLobbyContestById(contestId: string): Promise<LobbyContestRow | null> {
  const id = contestId?.trim();
  if (!id) return null;
  try {
    const hasAccess = await currentUserHasContestAccess(supabase);
    // TEMP STABILIZATION MODE: avoid false negatives from disabled server auth.
    if (!hasAccess && process.env.NODE_ENV === "development") {
      console.log("fetchLobbyContestById: bypassing server-side beta gate during stabilization.");
    }
    const { data, error } = await supabase.from("contests").select(CONTEST_CARD_SELECT).eq("id", id).maybeSingle();

    if (error || !data) {
      return null;
    }
    const { data: st } = await supabase.from("contest_settlements").select("contest_id").eq("contest_id", id).maybeSingle();
    const maxEntries = Math.max(1, Number(data.max_entries ?? 100));
    const entryCount = entryCountFromContestEntriesRelation(data as Record<string, unknown>);
    const rawStatusStr = String(data.status ?? "filling");
    const startsAt = String(data.start_time ?? data.starts_at ?? data.created_at ?? new Date().toISOString());
    const entryFee = Number(data.entry_fee ?? data.entry_fee_usd ?? 0);
    const createdAt = data.created_at != null ? String(data.created_at) : undefined;

    const rawPayouts = await fetchAllContestPayoutRows(supabase);
    const normalizedPayouts = normalizePayoutRows(rawPayouts);
    const payouts = payoutsForContest(normalizedPayouts, String(data.id));

    return {
      id: String(data.id),
      name: String(data.name),
      entry_fee_usd: Number.isFinite(entryFee) ? entryFee : 0,
      entry_fee: Number.isFinite(entryFee) ? entryFee : 0,
      max_entries: maxEntries,
      max_entries_per_user: 1,
      entry_count: entryCount,
      starts_at: startsAt,
      start_time: startsAt,
      status: rawStatusStr,
      entries_open_at: data.entries_open_at != null ? String(data.entries_open_at) : null,
      created_at: createdAt,
      has_settlement: Boolean(st?.contest_id),
      protected_entries_count: 0,
      safety_pool_usd: 0,
      late_swap_enabled:
        (data as { late_swap_enabled?: boolean | null }).late_swap_enabled !== false,
      payouts,
    };
  } catch {
    return null;
  }
}
