"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { settleContestPrizes } from "@/lib/contest-payout-engine";

export type TriggerAutoContestSettlementResult =
  | {
      ok: true;
      contestId: string;
      contestName: string;
      prizePoolUsd: number;
      entryCount: number;
      distributedUsd: number;
      payoutCount: number;
    }
  | { ok: false; error: string };

/**
 * Picks the earliest contest with status complete, not yet settled, and runs prize settlement.
 * For admin testing / ops (same RPC as manual settlement form).
 */
export async function triggerAutoContestSettlement(adminSecret: string): Promise<TriggerAutoContestSettlementResult> {
  const secret = process.env.ADMIN_SCORING_SECRET;
  if (!secret || adminSecret !== secret) {
    return { ok: false, error: "Invalid or missing admin secret." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data: settledRows, error: sErr } = await admin.from("contest_settlements").select("contest_id");
  if (sErr) {
    return { ok: false, error: sErr.message };
  }
  const settled = new Set((settledRows ?? []).map((r) => String(r.contest_id)));

  const { data: contests, error: cErr } = await admin
    .from("contests")
    .select("id, name, starts_at, status")
    .order("starts_at", { ascending: true });

  if (cErr) {
    return { ok: false, error: cErr.message };
  }

  const eligible = (contests ?? []).filter((c) => {
    if (!c.id || settled.has(String(c.id))) return false;
    return String(c.status ?? "").trim().toLowerCase() === "complete";
  });

  const pick = eligible[0];
  if (!pick?.id) {
    return {
      ok: false,
      error:
        "No eligible contest found. Need: status complete, not yet settled (or use manual settlement for a specific contest).",
    };
  }

  const contestName = typeof pick.name === "string" && pick.name.trim() !== "" ? pick.name.trim() : pick.id;

  const result = await settleContestPrizes(String(pick.id));
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const { data } = result;
  const { error: statusErr } = await admin.from("contests").update({ status: "settled" }).eq("id", data.contest_id);
  if (statusErr) {
    return { ok: false, error: statusErr.message };
  }

  revalidatePath("/admin/settlement");
  revalidatePath("/admin");
  revalidatePath("/lobby", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/wallet");
  revalidatePath(`/contest/${encodeURIComponent(data.contest_id)}`);

  return {
    ok: true,
    contestId: data.contest_id,
    contestName,
    prizePoolUsd: data.prize_pool_usd,
    entryCount: data.entry_count,
    distributedUsd: data.distributed_usd,
    payoutCount: data.payouts.length,
  };
}
