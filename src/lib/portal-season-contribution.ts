import type { SupabaseClient } from "@supabase/supabase-js";

const CONTRIBUTION_RATE = 0.1; // 10% beta

/**
 * Credits `profiles.season_contribution` after a confirmed contest entry (10% of entry fee).
 * Does not throw — logs on failure so entry flows are never blocked.
 */
export async function recordPortalSeasonContributionFromEntryFee(
  supabase: SupabaseClient,
  userId: string,
  entryFeeUsd: number,
): Promise<void> {
  const fee = Math.max(0, Number(entryFeeUsd));
  if (!Number.isFinite(fee) || fee <= 0) return;

  const contributionAmount = Math.round(fee * CONTRIBUTION_RATE * 100) / 100;
  if (contributionAmount <= 0) return;

  try {
    const { error } = await supabase.rpc("increment_contribution", {
      user_id: userId,
      amount: contributionAmount,
    });
    if (error) throw error;
  } catch (e) {
    console.error("Contribution failed", e);
  }
}
