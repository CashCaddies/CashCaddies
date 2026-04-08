import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { createClient } from "@/lib/supabase/server";
import { isRelationMissingOrNotExposedError } from "@/lib/supabase-missing-column";

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
 * Transparency stats for the contest page Safety Pool card (RLS applies).
 */
export async function fetchContestSafetyPoolStats(contestIdRaw: string): Promise<ContestSafetyPoolStats | null> {
  const id = contestIdForRpc(contestIdRaw);
  if (!id) {
    return null;
  }

  try {
    const supabase = await createClient();

    const { usd: poolUsd } = await fetchInsurancePoolBalanceUsd(supabase);

    const totalQ = await supabase
      .from("contest_entries")
      .select("id", { count: "exact", head: true })
      .eq("contest_id", id);
    if (totalQ.error) {
      if (isRelationMissingOrNotExposedError(totalQ.error)) {
        return {
          poolUsd: Number.isFinite(poolUsd) ? poolUsd : 0,
          totalEntries: 0,
          protectedCount: 0,
          protectedPercent: 0,
          totalProtectionFeesUsd: 0,
        };
      }
      return {
        poolUsd: Number.isFinite(poolUsd) ? poolUsd : 0,
        totalEntries: 0,
        protectedCount: 0,
        protectedPercent: 0,
        totalProtectionFeesUsd: 0,
      };
    }

    const totalEntries = Number(totalQ.count ?? 0);

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
