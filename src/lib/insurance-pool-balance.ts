import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingColumnOrSchemaError,
  isRelationMissingOrNotExposedError,
} from "@/lib/supabase-missing-column";

/**
 * Reads `insurance_pool.total_balance` when the table exists; otherwise returns 0 and `tableMissing`.
 * Does not throw — safe for optional deployments.
 */
export async function fetchInsurancePoolBalanceUsd(
  client: SupabaseClient,
): Promise<{ usd: number; tableMissing: boolean }> {
  try {
    const { data, error } = await client.from("insurance_pool").select("*").limit(1).maybeSingle();
    if (error) {
      const missing =
        isRelationMissingOrNotExposedError(error) || isMissingColumnOrSchemaError(error);
      // Always return a safe balance; never throw (avoids noisy console from callers).
      return { usd: 0, tableMissing: missing };
    }
    if (data == null) {
      return { usd: 0, tableMissing: false };
    }
    const row = data as Record<string, unknown>;
    const n = Number(row.total_balance ?? row.total_amount ?? 0);
    return { usd: Number.isFinite(n) ? n : 0, tableMissing: false };
  } catch {
    return { usd: 0, tableMissing: true };
  }
}
