"use server";

import { revalidatePath } from "next/cache";
import { settleContestPrizes } from "@/lib/contest-payout-engine";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type RunContestSettlementResult =
  | {
      ok: true;
      contestId: string;
      prizePoolUsd: number;
      entryCount: number;
      distributedUsd: number;
      payoutCount: number;
    }
  | { ok: false; error: string };

export async function runContestSettlement(formData: FormData): Promise<RunContestSettlementResult> {
  const secret = process.env.ADMIN_SCORING_SECRET;
  if (!secret || formData.get("adminSecret") !== secret) {
    return { ok: false, error: "Invalid or missing admin secret." };
  }

  const contestId = String(formData.get("contestId") ?? "").trim();
  if (!contestId) {
    return { ok: false, error: "Select or enter a contest." };
  }

  const result = await settleContestPrizes(contestId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const { data } = result;
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Prizes distributed but server role is not configured to mark contest settled." };
  }
  const { error: statusErr } = await admin.from("contests").update({ status: "settled" }).eq("id", data.contest_id);
  if (statusErr) {
    return { ok: false, error: statusErr.message };
  }

  revalidatePath("/admin/settlement");
  revalidatePath("/lobby", "layout");
  revalidatePath("/dashboard");
  revalidatePath(`/contest/${encodeURIComponent(data.contest_id)}`);

  return {
    ok: true,
    contestId: data.contest_id,
    prizePoolUsd: data.prize_pool_usd,
    entryCount: data.entry_count,
    distributedUsd: data.distributed_usd,
    payoutCount: data.payouts.length,
  };
}
