import type { SupabaseClient } from "@supabase/supabase-js";
import { parseContestUuid } from "@/lib/contest-id";
import { normalizeContestEntryErrorMessage } from "@/lib/contest-entry-eligibility";
import { loyaltyPointsFromEntryFee, tierFromPoints } from "@/lib/loyalty";
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
 * Contest entry flow (paid or $0):
 * - Default (free, or account-balance-only paid): single DB transaction via `create_contest_entry_atomic`
 *   (contest_entries + wallet + transactions roll back together on failure).
 * - Legacy: site_credits + account_balance split when `accountBalanceOnly === false` and total > 0.
 * Entry billing is fee-only: protection is funded from the entry split, not as an added charge.
 */
export async function chargeContestEntry(
  admin: SupabaseClient,
  params: {
    userId: string;
    contestId: string;
    contestName: string;
    entryFeeUsd: number;
    protectionFeeUsd: number;
    protectionEnabled: boolean;
    /** Set when roster already exists (saved draft or re-link). */
    lineupId?: string | null;
    /**
     * When true, entry fee debit uses `account_balance` only (site_credits untouched).
     * Insufficient balance blocks the entry before any wallet mutation besides rollback.
     */
    accountBalanceOnly?: boolean;
  },
): Promise<{ ok: true; snapshot: DebitSnapshot } | { ok: false; error: string }> {
  const contestId = parseContestUuid(params.contestId.trim());
  if (!contestId) {
    return { ok: false, error: "Invalid contest id." };
  }

  const entryFeeUsd = round2(Math.max(0, params.entryFeeUsd));
  const protectionFeeUsd = 0;
  const total = entryFeeUsd;

  const useAtomicRpc = total <= 0 || params.accountBalanceOnly !== false;

  if (useAtomicRpc) {
    const { data, error } = await admin.rpc("create_contest_entry_atomic", {
      p_user_id: params.userId,
      p_contest_id: contestId,
      p_entry_fee: entryFeeUsd,
      p_protection_fee: protectionFeeUsd,
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

  const { data: maxEn } = await admin
    .from("contest_entries")
    .select("entry_number")
    .eq("user_id", params.userId)
    .eq("contest_id", contestId)
    .order("entry_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextEntryNumber = Math.max(0, Number(maxEn?.entry_number ?? 0)) + 1;

  const { data: contestEntry, error: ceErr } = await admin
    .from("contest_entries")
    .insert({
      user_id: params.userId,
      contest_id: contestId,
      entry_fee: entryFeeUsd,
      protection_fee: protectionFeeUsd,
      total_paid: total,
      protection_enabled: params.protectionEnabled,
      lineup_id: params.lineupId ?? null,
      entry_number: nextEntryNumber,
    })
    .select("id")
    .maybeSingle();

  if (ceErr || !contestEntry?.id) {
    return { ok: false, error: ceErr?.message ?? "Could not create contest entry." };
  }

  const contestEntryId = contestEntry.id as string;

  const { data: walletRow, error: wErr } = await admin
    .from("profiles")
    .select("account_balance, site_credits, protection_credit_balance, loyalty_points, loyalty_tier")
    .eq("id", params.userId)
    .maybeSingle();

  if (wErr) {
    await admin.from("contest_entries").delete().eq("id", contestEntryId);
    return { ok: false, error: wErr.message };
  }

  let wallet = walletRow;

  if (!wallet) {
    const { error: insErr } = await admin.from("profiles").insert({
      id: params.userId,
      beta_status: "pending",
      beta_user: false,
      founding_tester: false,
    });
    if (insErr && insErr.code !== "23505") {
      await admin.from("contest_entries").delete().eq("id", contestEntryId);
      return { ok: false, error: insErr.message };
    }
    const again = await admin
      .from("profiles")
      .select("account_balance, site_credits, protection_credit_balance, loyalty_points, loyalty_tier")
      .eq("id", params.userId)
      .maybeSingle();
    if (again.error || !again.data) {
      await admin.from("contest_entries").delete().eq("id", contestEntryId);
      return { ok: false, error: again.error?.message ?? "Could not load profile." };
    }
    wallet = again.data;
  }

  const startC = round2(Number(wallet.site_credits ?? 0));
  const startB = round2(Number(wallet.account_balance ?? 0));
  const startPc = round2(Number((wallet as { protection_credit_balance?: number }).protection_credit_balance ?? 0));
  const startLoyalty = Math.max(0, Math.floor(Number(wallet.loyalty_points ?? 0)));
  let credits = startC;
  let balance = startB;

  const fromPc = round2(Math.min(total, startPc));
  const fromCash = round2(total - fromPc);
  const fromPcEntry = Math.min(entryFeeUsd, fromPc);
  const fromPcProt = round2(fromPc - fromPcEntry);
  const cashEntry = round2(entryFeeUsd - fromPcEntry);
  const cashProt = round2(protectionFeeUsd - fromPcProt);

  if (fromCash > round2(startC + startB)) {
    await admin.from("contest_entries").delete().eq("id", contestEntryId);
    return {
      ok: false,
      error: "Insufficient funds. Add to your account balance or site credits.",
    };
  }

  function takeFromWallet(amount: number): void {
    let need = round2(amount);
    const useC = round2(Math.min(credits, need));
    credits = round2(credits - useC);
    need = round2(need - useC);
    const useB = round2(Math.min(balance, need));
    balance = round2(balance - useB);
    need = round2(need - useB);
    if (need > 0.001) {
      throw new Error("Wallet deduction failed");
    }
  }

  try {
    takeFromWallet(fromCash);
  } catch {
    await admin.from("contest_entries").delete().eq("id", contestEntryId);
    return { ok: false, error: "Could not process payment. Try again." };
  }

  const creditsRestored = round2(startC - credits);
  const balanceRestored = round2(startB - balance);
  const protectionCreditRestored = fromPc;
  const newPcBal = round2(startPc - fromPc);
  const loyaltyEarned = entryFeeUsd > 0 ? loyaltyPointsFromEntryFee(entryFeeUsd) : 0;
  const newLoyalty = startLoyalty + loyaltyEarned;
  const newTier = tierFromPoints(newLoyalty);

  const txRows: Array<{
    user_id: string;
    amount: number;
    type: "contest_entry" | "safety_coverage_fee" | "protection_credit_spend";
    description: string;
  }> = [];

  if (fromPc > 0) {
    txRows.push({
      user_id: params.userId,
      amount: -fromPc,
      type: "protection_credit_spend",
      description: `Contest entry — ${params.contestName.trim() || "Contest"} (safety coverage credit)`,
    });
  }

  if (cashEntry > 0) {
    txRows.push({
      user_id: params.userId,
      amount: -cashEntry,
      type: "contest_entry",
      description: `Contest Entry Fee — ${params.contestName.trim() || "Contest"}`,
    });
  }

  if (cashProt > 0) {
    txRows.push({
      user_id: params.userId,
      amount: -cashProt,
      type: "safety_coverage_fee",
      description: `Safety Coverage Contribution — ${params.contestName} (${contestId})`,
    });
  }

  const { data: insertedTx, error: txErr } = await admin.from("transactions").insert(txRows).select("id");
  if (txErr) {
    await admin.from("contest_entries").delete().eq("id", contestEntryId);
    return { ok: false, error: txErr.message };
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      site_credits: credits,
      account_balance: balance,
      protection_credit_balance: newPcBal,
      loyalty_points: newLoyalty,
      loyalty_tier: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);

  if (upErr) {
    const ids = (insertedTx ?? []).map((r) => r.id).filter(Boolean);
    if (ids.length > 0) {
      await admin.from("transactions").delete().in("id", ids);
    }
    await admin.from("contest_entries").delete().eq("id", contestEntryId);
    return { ok: false, error: upErr.message };
  }

  return {
    ok: true,
    snapshot: {
      creditsRestored,
      balanceRestored,
      protectionCreditRestored,
      loyaltyPointsEarned: loyaltyEarned,
      contestEntryId,
    },
  };
}

/** Restore wallet after a failed lineup save (reverses chargeContestEntry debits). */
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
