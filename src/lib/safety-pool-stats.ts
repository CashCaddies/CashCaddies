import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { createClient } from "@/lib/supabase/server";
import {
  isMissingColumnOrSchemaError,
  isRelationMissingOrNotExposedError,
} from "@/lib/supabase-missing-column";

export type ContestSafetyPoolStats = {
  /** Global `insurance_pool.total_balance`. */
  poolUsd: number;
  totalEntries: number;
  /** Entries with `protection_triggered` (automatic protection applied). */
  protectedCount: number;
  /** Share of contest entries that selected a protected golfer (0–100). */
  protectedPercent: number;
  /** Sum of `protection_fee` for protected entries in this contest. */
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
      .select("*", { count: "exact", head: true })
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

    const totalEntriesRaw = totalQ.count;

    let protectedCountRaw: number | null = null;
    const protQ = await supabase
      .from("contest_entries")
      .select("*", { count: "exact", head: true })
      .eq("contest_id", id)
      .eq("protection_triggered", true);
    if (protQ.error && isMissingColumnOrSchemaError(protQ.error)) {
      protectedCountRaw = 0;
    } else if (protQ.error && isRelationMissingOrNotExposedError(protQ.error)) {
      protectedCountRaw = 0;
    } else if (protQ.error) {
      protectedCountRaw = 0;
    } else {
      protectedCountRaw = protQ.count;
    }

    const feeQ = await supabase
      .from("contest_entries")
      .select("*")
      .eq("contest_id", id);
    let totalProtectionFeesUsd = 0;
    if (!feeQ.error && feeQ.data) {
      totalProtectionFeesUsd = (feeQ.data as { protection_fee?: number }[]).reduce((s, r) => {
        const pf = Number(r.protection_fee ?? 0);
        return s + (pf > 0 ? pf : 0);
      }, 0);
    }

    const totalEntries = Number(totalEntriesRaw ?? 0);
    const protectedCount = Number(protectedCountRaw ?? 0);
    const protectedPercent =
      totalEntries > 0 ? Math.round((protectedCount / totalEntries) * 1000) / 10 : 0;

    return {
      poolUsd: Number.isFinite(poolUsd) ? poolUsd : 0,
      totalEntries,
      protectedCount,
      protectedPercent,
      totalProtectionFeesUsd: Math.round(totalProtectionFeesUsd * 100) / 100,
    };
  } catch {
    return null;
  }
}
