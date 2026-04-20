"use server";

import { revalidatePath } from "next/cache";
import { calculateContestFinancialsSnapshot } from "@/lib/contest-payout-engine";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type RpcJson = Record<string, unknown>;

export type RunFullPayoutResult =
  | {
      ok: true;
      contestId: string;
      settled: RpcJson;
      payouts: RpcJson;
      credited: RpcJson;
    }
  | {
      ok: false;
      step: "auth" | "input" | "config" | "settle" | "financials" | "payouts" | "credit" | "status";
      error: string;
    };

function rpcFailurePayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as RpcJson;
  if (row.ok === false) {
    const err = row.error;
    return typeof err === "string" && err.trim() !== "" ? err : "RPC returned ok: false.";
  }
  return null;
}

/**
 * Runs settlement pipeline: settle_contest_prizes → calculate_contest_financials → run_contest_payouts → credit_contest_winnings.
 * Requires admin secret (same as other settlement actions). Marks contest settled only after all steps succeed.
 */
export async function runFullPayout(formData: FormData): Promise<RunFullPayoutResult> {
  const secret = process.env.ADMIN_SCORING_SECRET;
  if (!secret || formData.get("adminSecret") !== secret) {
    return { ok: false, step: "auth", error: "Invalid or missing admin secret." };
  }

  const contestId = String(formData.get("contestId") ?? "").trim();
  if (!contestId) {
    return { ok: false, step: "input", error: "Select or enter a contest." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, step: "config", error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data: settleRaw, error: settleError } = await admin.rpc("settle_contest_prizes", {
    p_contest_id: contestId,
  });

  if (settleError) {
    return { ok: false, step: "settle", error: settleError.message };
  }

  const settleFail = rpcFailurePayload(settleRaw);
  if (settleFail) {
    return { ok: false, step: "settle", error: settleFail };
  }

  const finRes = await calculateContestFinancialsSnapshot(contestId);
  if (!finRes.ok) {
    return { ok: false, step: "financials", error: finRes.error };
  }

  const { data: payoutRaw, error: payoutError } = await admin.rpc("run_contest_payouts", {
    p_contest_id: contestId,
  });

  if (payoutError) {
    return { ok: false, step: "payouts", error: payoutError.message };
  }

  const payoutFail = rpcFailurePayload(payoutRaw);
  if (payoutFail) {
    return { ok: false, step: "payouts", error: payoutFail };
  }

  const { data: creditRaw, error: creditError } = await admin.rpc("credit_contest_winnings", {
    p_contest_id: contestId,
  });

  if (creditError) {
    return { ok: false, step: "credit", error: creditError.message };
  }

  const creditFail = rpcFailurePayload(creditRaw);
  if (creditFail) {
    return { ok: false, step: "credit", error: creditFail };
  }

  const settled = (settleRaw ?? {}) as RpcJson;
  const payouts = (payoutRaw ?? {}) as RpcJson;
  const credited = (creditRaw ?? {}) as RpcJson;

  const { error: statusErr } = await admin.from("contests").update({ status: "settled" }).eq("id", contestId);
  if (statusErr) {
    return { ok: false, step: "status", error: statusErr.message };
  }

  revalidatePath("/admin/settlement");
  revalidatePath("/lobby", "layout");
  revalidatePath("/dashboard");
  revalidatePath(`/contest/${encodeURIComponent(contestId)}`);

  return {
    ok: true,
    contestId,
    settled,
    payouts,
    credited,
  };
}
