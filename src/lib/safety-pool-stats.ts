import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { entryCountFromContestEntriesRelation } from "@/lib/contest-lobby-shared";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { supabase } from "@/lib/supabase/client";

export type ContestSafetyPoolStats = {
  /** Global `insurance_pool.total_balance`. */
  poolUsd: number;
  totalEntries: number;
  /** Stabilization: always 0 (protection columns omitted from `contest_entries` reads). */
  protectedCount: number;
  /** Share of contest entries that selected a protected golfer (0–100). */
  protectedPercent: number;
  /** Stabilization: always 0. */
  totalProtectionFeesUsd: number;
};

/**
 * Transparency stats for the contest page Safety Pool card (entry total from `contest_entries ( id )` embed).
 */
export async function fetchContestSafetyPoolStats(contestIdRaw: string): Promise<ContestSafetyPoolStats | null> {
  const id = contestIdForRpc(contestIdRaw);
  if (!id) {
    return null;
  }

  try {
        const { usd: poolUsd } = await fetchInsurancePoolBalanceUsd(supabase);

    const { data: ceRow, error: ceErr } = await supabase
      .from("contests")
      .select("contest_entries(id)")
      .eq("id", id)
      .maybeSingle();
    const totalEntries =
      ceErr || !ceRow ? 0 : entryCountFromContestEntriesRelation(ceRow as Record<string, unknown>);

    return {
      poolUsd: Number.isFinite(poolUsd) ? poolUsd : 0,
      totalEntries,
      protectedCount: 0,
      protectedPercent: 0,
      totalProtectionFeesUsd: 0,
    };
  } catch {
    return null;
  }
}
