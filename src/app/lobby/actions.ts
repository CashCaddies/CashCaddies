"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { refundContestEntryCharge } from "@/lib/contest-entry-payment";
import { splitEntryFeeUsd } from "@/lib/contest-fee-split";
import { resolveContestEntryForSubmit } from "@/lib/contest-resolve";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { contestLockErrorMessage, getContestLineupLockState } from "@/lib/contest-lock-server";
import { parseContestUuid } from "@/lib/contest-id";
import {
  assertClosedBetaApprovedForContestActions,
  assertContestEntryCapacityOk,
  assertContestEntryEligible,
} from "@/lib/contest-entry-eligibility";
import { recordPortalSeasonContributionFromEntryFee } from "@/lib/portal-season-contribution";
import { mapContestEntryFailure } from "@/lib/supabase/queries/enterContest";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ConfirmLobbyEntryResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Client-safe pre-check before navigating to lineup builder or opening the enter flow.
 * Uses the same rules as `assertContestEntryCapacityOk` (`contests.status` = filling, capacity, per-user caps).
 */
export async function precheckContestEntryCapacity(
  contestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = parseContestUuid(contestId.trim());
  if (!id) {
    return { ok: false, error: "Invalid contest id." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }
  const beta = await assertClosedBetaApprovedForContestActions(supabase);
  if (!beta.ok) {
    return beta;
  }
  return assertContestEntryCapacityOk(supabase, { contestId: id, userId: user.id });
}

/**
 * Create contest_entries (with lineup_id), debit entry fee from account_balance,
 * link lineup, and persist protection allocation metadata from the saved roster.
 */
export async function confirmLobbyContestEntry(payload: {
  contestId: string;
  lineupId: string;
}): Promise<ConfirmLobbyEntryResult> {
  const lineupId = payload.lineupId?.trim() ?? "";
  const contestId = parseContestUuid(payload.contestId);
  if (!contestId || !lineupId) {
    return { ok: false, error: "Missing contest or lineup." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }

  const { locked: lobbyContestLocked } = await getContestLineupLockState(supabase, contestId);
  if (lobbyContestLocked) {
    return { ok: false, error: contestLockErrorMessage() };
  }

  const { data: lineup, error: lineupErr } = await supabase
    .from("lineups")
    .select("id, user_id, contest_id, contest_entry_id, protection_enabled")
    .eq("id", lineupId)
    .maybeSingle();

  if (lineupErr || !lineup) {
    return { ok: false, error: "Lineup not found." };
  }
  if (lineup.user_id !== user.id) {
    return { ok: false, error: "Not your lineup." };
  }
  const lineupContestIdNorm = parseContestUuid(
    lineup.contest_id != null ? String(lineup.contest_id) : null,
  );
  if (lineupContestIdNorm != null && lineupContestIdNorm !== contestId) {
    return { ok: false, error: "This lineup is for a different contest." };
  }
  if (lineup.contest_entry_id) {
    return { ok: false, error: "This lineup is already entered in a contest." };
  }

  const protectionEnabled = true;

  const { contestName, entryFeeUsd } = await resolveContestEntryForSubmit(supabase, contestId);
  const fee = round2(Math.max(0, entryFeeUsd));
  const split = splitEntryFeeUsd(fee);
  const protectionFeeUsd = split.protectionAmount;
  const totalPaid = fee;

  const eligLobby = await assertContestEntryEligible(supabase, {
    contestId,
    userId: user.id,
    entryFeeUsd: fee,
    protectionFeeUsd: 0,
    lineupId,
  });
  if (!eligLobby.ok) {
    return { ok: false, error: eligLobby.error };
  }

  const { data: atomicData, error: atomicErr } = await supabase.rpc("create_contest_entry_atomic", {
    p_user_id: user.id,
    p_contest_id: contestId,
    p_entry_fee: fee,
    p_protection_fee: 0,
    p_total_paid: totalPaid,
    p_protection_enabled: protectionEnabled,
    p_lineup_id: lineupId,
    p_contest_name: contestName,
  });

  if (atomicErr) {
    return { ok: false, error: mapContestEntryFailure(atomicErr.message) };
  }

  const atomicRow = atomicData as {
    ok?: boolean;
    error?: string;
    contest_entry_id?: string;
    balance_restored?: number;
    protection_credit_restored?: number;
    loyalty_points_earned?: number;
  } | null;

  if (!atomicRow || atomicRow.ok === false) {
    const raw =
      typeof atomicRow?.error === "string" && atomicRow.error.trim() !== ""
        ? atomicRow.error
        : "Could not create contest entry.";
    return {
      ok: false,
      error: mapContestEntryFailure(raw),
    };
  }

  const entryId = String(atomicRow.contest_entry_id ?? "");
  if (!entryId) {
    return { ok: false, error: "Could not create contest entry." };
  }

  const admin = createServiceRoleClient();

  const { error: luErr } = await supabase
    .from("lineups")
    .update({
      contest_id: contestId,
      contest_entry_id: entryId,
      entry_fee: fee,
      protection_fee: protectionFeeUsd,
      total_paid: totalPaid,
      protection_enabled: protectionEnabled,
    })
    .eq("id", lineupId)
    .eq("user_id", user.id);

  if (luErr) {
    if (admin) {
      const refund = await refundContestEntryCharge(admin, {
        userId: user.id,
        snapshot: {
          creditsRestored: 0,
          balanceRestored: Number(atomicRow.balance_restored ?? totalPaid),
          protectionCreditRestored: Number(atomicRow.protection_credit_restored ?? 0),
          loyaltyPointsEarned: Number(atomicRow.loyalty_points_earned ?? 0),
          contestEntryId: entryId,
        },
        reason: `Refund — could not link lineup to contest entry (${contestId})`,
      });
      if (!refund.ok) {
        /* refund best-effort */
      }
    } else {
      await supabase.from("contest_entries").delete().eq("id", entryId);
    }
    return { ok: false, error: luErr.message };
  }

  await recordPortalSeasonContributionFromEntryFee(supabase, user.id, fee);

  revalidatePath("/lobby");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lineups");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/contests");
  revalidatePath(`/lobby/${contestId}/enter`);
  revalidatePath(`/contest/${contestId}`);

  return {
    ok: true,
    message: `Entered ${contestName}! Charged to your account balance: entry $${fee.toFixed(2)}.`,
  };
}
