import { fetchContestEntryCountLive } from "@/lib/contest-entry-count-live";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { createClient } from "@/lib/supabase/server";

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
 * Transparency stats for the contest page Safety Pool card (entry total via `contest_entry_count` RPC).
 */
export async function fetchContestSafetyPoolStats(contestIdRaw: string): Promise<ContestSafetyPoolStats | null> {
  const id = contestIdForRpc(contestIdRaw);
  if (!id) {
    return null;
  }

  try {
    const supabase = await createClient();

    const { usd: poolUsd } = await fetchInsurancePoolBalanceUsd(supabase);

    const totalEntries = await fetchContestEntryCountLive(supabase, id);

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
