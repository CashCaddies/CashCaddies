import { createClient } from "@/lib/supabase/server";
import type { LobbyContestRow } from "@/lib/contest-lobby-shared";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";

export type { LobbyContestRow } from "@/lib/contest-lobby-shared";
export {
  formatContestStartDate,
  formatLobbyEntryFeeUsd,
  formatPerUserEntryLimit,
  isContestLineupLocked,
} from "@/lib/contest-lobby-shared";

export type ContestPayoutRow = { rank_place: number; payout_pct: number };

export async function fetchContestPayoutsForContest(contestId: string): Promise<ContestPayoutRow[]> {
  const id = contestId?.trim();
  if (!id) return [];
  try {
    const supabase = await createClient();
    const hasAccess = await currentUserHasContestAccess(supabase);
    if (!hasAccess) return [];
    const { data, error } = await supabase
      .from("contest_payouts")
      .select("rank_place, payout_pct")
      .eq("contest_id", id)
      .order("rank_place", { ascending: true });
    if (error) return [];
    return (data ?? []) as ContestPayoutRow[];
  } catch {
    return [];
  }
}

export async function fetchLobbyContests(): Promise<{
  contests: LobbyContestRow[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();
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
      .select(
        "id,name,entry_fee,entry_fee_usd,max_entries,entry_count,start_time,starts_at,status,created_at,contest_status,entries_open_at,late_swap_enabled",
      )
      .not("contest_status", "in", "(settled,cancelled)")
      .order("start_time", { ascending: true });

    const data = q.data as Array<Record<string, unknown>> | null;
    if (q.error) {
      return { contests: [], error: q.error.message };
    }

    const rows = (data ?? []).filter((row) => String(row.id ?? "").trim() !== "");
    const ids = rows.map((row) => String(row.id));
    let settledIds = new Set<string>();
    if (ids.length > 0) {
      const { data: stRows } = await supabase.from("contest_settlements").select("contest_id").in("contest_id", ids);
      settledIds = new Set((stRows ?? []).map((r) => String((r as { contest_id: string }).contest_id)));
    }

    const contests = rows
      .map((row) => {
        const id = String(row.id ?? "").trim();
        if (!id) {
          return null;
        }
        const maxEntries = Math.max(1, Number(row.max_entries ?? 100));
        const entryCount = Math.max(
          0,
          Number(row.entry_count ?? 0),
        );
        const computedStatus = entryCount >= maxEntries ? "full" : String(row.status ?? "open");
        const startsAt =
          String(row.start_time ?? row.starts_at ?? row.created_at ?? new Date().toISOString());
        const entryFee = Number(row.entry_fee ?? row.entry_fee_usd ?? 0);
        const createdAt = row.created_at != null ? String(row.created_at) : undefined;
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
          status: computedStatus,
          contest_status: row.contest_status != null ? String(row.contest_status) : null,
          entries_open_at: row.entries_open_at != null ? String(row.entries_open_at) : null,
          created_at: createdAt,
          has_settlement: settledIds.has(id),
          protected_entries_count: 0,
          safety_pool_usd: safetyPoolFinite,
          late_swap_enabled:
            row.late_swap_enabled === undefined || row.late_swap_enabled === null
              ? true
              : Boolean(row.late_swap_enabled),
        };
        return mapped;
      })
      .filter((row): row is LobbyContestRow => row != null);

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

/** Single contest from `contests` for `/contest/[id]` and `/contests/[id]`. */
export async function fetchLobbyContestById(contestId: string): Promise<LobbyContestRow | null> {
  const id = contestId?.trim();
  if (!id) return null;
  try {
    const supabase = await createClient();
    const hasAccess = await currentUserHasContestAccess(supabase);
    // TEMP STABILIZATION MODE: avoid false negatives from disabled server auth.
    if (!hasAccess && process.env.NODE_ENV === "development") {
      console.log("fetchLobbyContestById: bypassing server-side beta gate during stabilization.");
    }
    const { data, error } = await supabase
      .from("contests")
      .select(
        "id,name,entry_fee,entry_fee_usd,max_entries,entry_count,start_time,starts_at,status,created_at,contest_status,entries_open_at,late_swap_enabled",
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    const { data: st } = await supabase.from("contest_settlements").select("contest_id").eq("contest_id", id).maybeSingle();
    const maxEntries = Math.max(1, Number(data.max_entries ?? 100));
    const entryCount = Math.max(0, Number(data.entry_count ?? 0));
    const computedStatus = entryCount >= maxEntries ? "full" : String(data.status ?? "open");
    const startsAt = String(data.start_time ?? data.starts_at ?? data.created_at ?? new Date().toISOString());
    const entryFee = Number(data.entry_fee ?? data.entry_fee_usd ?? 0);
    const createdAt = data.created_at != null ? String(data.created_at) : undefined;
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
      status: computedStatus,
      contest_status: data.contest_status != null ? String(data.contest_status) : null,
      entries_open_at: data.entries_open_at != null ? String(data.entries_open_at) : null,
      created_at: createdAt,
      has_settlement: Boolean(st?.contest_id),
      protected_entries_count: 0,
      safety_pool_usd: 0,
      late_swap_enabled:
        (data as { late_swap_enabled?: boolean | null }).late_swap_enabled !== false,
    };
  } catch {
    return null;
  }
}
