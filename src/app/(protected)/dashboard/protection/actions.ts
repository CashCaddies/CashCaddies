"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type { LineupPlayerClaimRow } from "@/lib/lineup-players";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertAccountBalanceCreditAllowed } from "@/lib/wallet-limit";

export type ProtectionResolution = "swap" | "refund_credit" | "refund_balance";

export type SubmitProtectionClaimResult =
  | { ok: true }
  | { ok: false; error: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Entry fee amount stored on the lineup at contest entry (used for protection refunds). */
async function entryFeeRefundUsdForLineup(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  lineupId: string,
  userId: string,
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const { data: lineup, error: lErr } = await admin
    .from("lineups")
    .select("entry_fee, user_id, protection_enabled")
    .eq("id", lineupId)
    .maybeSingle();

  if (lErr || !lineup || lineup.user_id !== userId) {
    return { ok: false, error: "Lineup not found." };
  }
  if (!lineup.protection_enabled) {
    return { ok: false, error: "This lineup does not have CashCaddies Safety Coverage." };
  }

  const amount = round2(Math.max(0, Number(lineup.entry_fee ?? 0)));
  if (amount <= 0) {
    return { ok: false, error: "This lineup has no entry fee to refund." };
  }
  return { ok: true, amount };
}

/** Site credits = entry fee when user chooses refund_credit (requires service role). */
async function applyRefundCreditForClaim(opts: {
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>;
  userId: string;
  lineupId: string;
  claimId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fee = await entryFeeRefundUsdForLineup(opts.admin, opts.lineupId, opts.userId);
  if (!fee.ok) return fee;
  const creditAmount = fee.amount;

  const { data: profile, error: pErr } = await opts.admin
    .from("profiles")
    .select("site_credits")
    .eq("id", opts.userId)
    .maybeSingle();

  if (pErr || !profile) {
    return { ok: false, error: pErr?.message ?? "Could not load profile." };
  }

  const prevC = round2(Number(profile.site_credits ?? 0));
  const newC = round2(prevC + creditAmount);

  const { data: txRow, error: txErr } = await opts.admin
    .from("transactions")
    .insert({
      user_id: opts.userId,
      amount: creditAmount,
      type: "credit",
      description: `CashCaddies Safety Coverage — entry fee site credit (withdrawn golfer, claim ${opts.claimId})`,
    })
    .select("id")
    .single();

  if (txErr) {
    return { ok: false, error: txErr.message };
  }

  const { error: upErr } = await opts.admin
    .from("profiles")
    .update({
      site_credits: newC,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.userId);

  if (upErr) {
    if (txRow?.id) {
      await opts.admin.from("transactions").delete().eq("id", txRow.id);
    }
    return { ok: false, error: upErr.message };
  }

  const { error: clErr } = await opts.admin
    .from("insurance_claims")
    .update({ status: "approved", refund_amount_usd: creditAmount })
    .eq("id", opts.claimId)
    .eq("user_id", opts.userId);

  if (clErr) {
    return { ok: false, error: clErr.message };
  }

  return { ok: true };
}

/** Account balance refund = entry fee when user chooses refund_balance (requires service role). */
async function applyRefundBalanceForClaim(opts: {
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>;
  userId: string;
  lineupId: string;
  claimId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fee = await entryFeeRefundUsdForLineup(opts.admin, opts.lineupId, opts.userId);
  if (!fee.ok) return fee;
  const refundAmount = fee.amount;

  const { data: profile, error: pErr } = await opts.admin
    .from("profiles")
    .select("account_balance")
    .eq("id", opts.userId)
    .maybeSingle();

  if (pErr || !profile) {
    return { ok: false, error: pErr?.message ?? "Could not load profile." };
  }

  const prevB = round2(Number(profile.account_balance ?? 0));
  const cap = assertAccountBalanceCreditAllowed(prevB, refundAmount);
  if (!cap.ok) {
    return { ok: false, error: cap.error };
  }
  const newB = cap.nextBalance;

  const { data: txRow, error: txErr } = await opts.admin
    .from("transactions")
    .insert({
      user_id: opts.userId,
      amount: refundAmount,
      type: "refund",
      description: `CashCaddies Safety Coverage — entry fee refund to account balance (withdrawn golfer, claim ${opts.claimId})`,
    })
    .select("id")
    .single();

  if (txErr) {
    return { ok: false, error: txErr.message };
  }

  const { error: upErr } = await opts.admin
    .from("profiles")
    .update({
      account_balance: newB,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.userId);

  if (upErr) {
    if (txRow?.id) {
      await opts.admin.from("transactions").delete().eq("id", txRow.id);
    }
    return { ok: false, error: upErr.message };
  }

  const { error: clErr } = await opts.admin
    .from("insurance_claims")
    .update({ status: "approved", refund_amount_usd: refundAmount })
    .eq("id", opts.claimId)
    .eq("user_id", opts.userId);

  if (clErr) {
    return { ok: false, error: clErr.message };
  }

  return { ok: true };
}

export async function submitProtectionClaim(payload: {
  lineupId: string;
  golferId: string;
  resolution: ProtectionResolution;
}): Promise<SubmitProtectionClaimResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }

  const lineupId = payload.lineupId?.trim();
  const golferId = payload.golferId?.trim();
  const resolution = payload.resolution;

  if (!lineupId || !golferId) {
    return { ok: false, error: "Missing lineup or golfer." };
  }

  if (resolution !== "swap" && resolution !== "refund_credit" && resolution !== "refund_balance") {
    return { ok: false, error: "Choose swap, site credit, or account balance refund." };
  }

  const { data: lineup, error: lineupErr } = await supabase
    .from("lineups")
    .select("id, user_id, protection_enabled")
    .eq("id", lineupId)
    .maybeSingle();

  if (lineupErr || !lineup) {
    return { ok: false, error: "Lineup not found." };
  }

  if (lineup.user_id !== user.id) {
    return { ok: false, error: "Not your lineup." };
  }

  if (!lineup.protection_enabled) {
    return { ok: false, error: "This lineup does not have CashCaddies Safety Coverage." };
  }

  const { data: lpRaw, error: lpErr } = await supabase
    .from("lineup_players")
    .select("golfer_id, is_protected, golfers ( id, withdrawn )")
    .eq("lineup_id", lineupId)
    .eq("golfer_id", golferId)
    .maybeSingle();

  if (lpErr || !lpRaw) {
    return { ok: false, error: "Golfer is not on this lineup." };
  }

  const lp = lpRaw as LineupPlayerClaimRow;

  if (!lp.is_protected) {
    return { ok: false, error: "This golfer is not covered by CashCaddies Safety Coverage on this lineup." };
  }

  const raw = lp.golfers as { id: string; withdrawn: boolean | null } | { id: string; withdrawn: boolean | null }[] | null;
  const g = Array.isArray(raw) ? raw[0] : raw;
  if (!g?.withdrawn) {
    return { ok: false, error: "CashCaddies Safety Coverage claims apply only to withdrawn golfers." };
  }

  const { data: blocking } = await supabase
    .from("insurance_claims")
    .select("id, status")
    .eq("lineup_id", lineupId)
    .eq("golfer_id", golferId)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (blocking) {
    return { ok: false, error: "A claim is already pending or approved for this golfer." };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("insurance_claims")
    .insert({
      user_id: user.id,
      lineup_id: lineupId,
      golfer_id: golferId,
      claim_type: resolution,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    return { ok: false, error: insErr?.message ?? "Could not create claim." };
  }

  if (resolution === "refund_credit" || resolution === "refund_balance") {
    const admin = createServiceRoleClient();
    if (admin) {
      const applied =
        resolution === "refund_credit"
          ? await applyRefundCreditForClaim({
              admin,
              userId: user.id,
              lineupId,
              claimId: inserted.id as string,
            })
          : await applyRefundBalanceForClaim({
              admin,
              userId: user.id,
              lineupId,
              claimId: inserted.id as string,
            });
      if (!applied.ok) {
        await supabase.from("insurance_claims").delete().eq("id", inserted.id);
        return { ok: false, error: applied.error };
      }
    }
  }

  revalidatePath("/dashboard/lineups");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/contests");
  return { ok: true };
}
