import type { SupabaseClient } from "@supabase/supabase-js";
import { parseContestUuid } from "@/lib/contest-id";
import { normalizeContestEntryErrorMessage } from "@/lib/contest-entry-eligibility";
import { tierFromPoints } from "@/lib/loyalty";
import { assertAccountBalanceCreditAllowed } from "@/lib/wallet-limit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DebitSnapshot = {
  creditsRestored: number;
  balanceRestored: number;
  /** Safety Coverage credit applied toward entry; restored on refund. */
  protectionCreditRestored: number;
  /** Points granted from entry fee only; reversed on refund. */
  loyaltyPointsEarned: number;
  /** contest_entries row created at start of entry; removed on refund if lineup save fails. */
  contestEntryId: string;
};

type AtomicRpcRow = {
  ok?: boolean;
  error?: string;
  contest_entry_id?: string;
  credits_restored?: number;
  balance_restored?: number;
  protection_credit_restored?: number;
  loyalty_points_earned?: number;
};

/**
 * Contest entry (paid or $0): always uses `create_contest_entry_atomic` so wallet + `contest_entries`
 * stay consistent. Protection is not an add-on; RPC receives `p_protection_fee = 0` and `p_total_paid` = entry fee.
 * DB trigger `contest_entries_fee_allocation` moves 5% / 5% from `entry_fee` to insurance pool / platform revenue.
 */
export async function chargeContestEntry(
  admin: SupabaseClient,
  params: {
    userId: string;
    contestId: string;
    contestName: string;
    entryFeeUsd: number;
    protectionEnabled: boolean;
    /** Set when roster already exists (saved draft or re-link). */
    lineupId?: string | null;
  },
): Promise<{ ok: true; snapshot: DebitSnapshot } | { ok: false; error: string }> {
  const contestId = parseContestUuid(params.contestId.trim());
  if (!contestId) {
    return { ok: false, error: "Invalid contest id." };
  }

  const entryFeeUsd = round2(Math.max(0, params.entryFeeUsd));
  const total = entryFeeUsd;

  const { data, error } = await admin.rpc("create_contest_entry_atomic", {
    p_user_id: params.userId,
    p_contest_id: contestId,
    p_entry_fee: entryFeeUsd,
    p_protection_fee: 0,
    p_total_paid: total,
    p_protection_enabled: params.protectionEnabled,
    p_lineup_id: params.lineupId ?? null,
    p_contest_name: params.contestName,
  });

  if (error) {
    return { ok: false, error: normalizeContestEntryErrorMessage(error.message) };
  }

  const row = data as AtomicRpcRow | null;
  if (!row || row.ok === false) {
    const msg =
      typeof row?.error === "string" && row.error.trim() !== ""
        ? row.error
        : "Could not create contest entry.";
    return { ok: false, error: normalizeContestEntryErrorMessage(msg) };
  }

  return {
    ok: true,
    snapshot: {
      creditsRestored: Number(row.credits_restored ?? 0),
      balanceRestored: Number(row.balance_restored ?? 0),
      protectionCreditRestored: Number(row.protection_credit_restored ?? 0),
      loyaltyPointsEarned: Number(row.loyalty_points_earned ?? 0),
      contestEntryId: String(row.contest_entry_id ?? ""),
    },
  };
}

/**
 * Restore wallet after a failed lineup save (reverses chargeContestEntry debits).
 * Deletes `contest_entries` last so `contest_entries_fee_allocation` reverses insurance/platform deltas.
 */
export async function refundContestEntryCharge(
  admin: SupabaseClient,
  params: { userId: string; snapshot: DebitSnapshot; reason: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    creditsRestored,
    balanceRestored,
    protectionCreditRestored,
    loyaltyPointsEarned,
    contestEntryId,
  } = params.snapshot;

  const hasMoney = creditsRestored > 0 || balanceRestored > 0 || protectionCreditRestored > 0;
  const hasLoyalty = loyaltyPointsEarned > 0;

  if (!hasMoney && !hasLoyalty) {
    if (contestEntryId) {
      await admin.from("contest_entries").delete().eq("id", contestEntryId);
    }
    return { ok: true };
  }

  const { data: wallet, error: wErr } = await admin
    .from("profiles")
    .select("account_balance, site_credits, protection_credit_balance, loyalty_points, loyalty_tier")
    .eq("id", params.userId)
    .maybeSingle();

  if (wErr) {
    return { ok: false, error: wErr.message };
  }

  const prevC = round2(Number(wallet?.site_credits ?? 0));
  const prevB = round2(Number(wallet?.account_balance ?? 0));
  const prevPc = round2(Number(wallet?.protection_credit_balance ?? 0));
  const prevLoyalty = Math.max(0, Math.floor(Number(wallet?.loyalty_points ?? 0)));
  const prevTier = String(wallet?.loyalty_tier ?? "Bronze").trim() || "Bronze";

  const newCredits = round2(prevC + creditsRestored);
  const newBalance = round2(prevB + balanceRestored);
  const newPc = round2(prevPc + protectionCreditRestored);
  const refundTotal = round2(creditsRestored + balanceRestored + protectionCreditRestored);

  if (balanceRestored > 0) {
    const cap = assertAccountBalanceCreditAllowed(prevB, balanceRestored);
    if (!cap.ok) {
      return { ok: false, error: cap.error };
    }
  }
  const newLoyalty = Math.max(0, prevLoyalty - loyaltyPointsEarned);
  const newTier = tierFromPoints(newLoyalty);

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      site_credits: newCredits,
      account_balance: newBalance,
      protection_credit_balance: newPc,
      loyalty_points: newLoyalty,
      loyalty_tier: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { error: txErr } = await admin.from("transactions").insert({
    user_id: params.userId,
    amount: refundTotal,
    type: "refund",
    description: params.reason,
  });

  if (txErr) {
    await admin
      .from("profiles")
      .update({
        site_credits: prevC,
        account_balance: prevB,
        protection_credit_balance: prevPc,
        loyalty_points: prevLoyalty,
        loyalty_tier: prevTier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.userId);
    return { ok: false, error: txErr.message };
  }

  if (contestEntryId) {
    await admin.from("contest_entries").delete().eq("id", contestEntryId);
  }

  return { ok: true };
}
