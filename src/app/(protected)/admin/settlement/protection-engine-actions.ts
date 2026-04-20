"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendPendingProtectionActivatedEmails } from "@/lib/send-protection-activated-email";

export type RunProtectionEngineResult =
  | { ok: true; swapMarked: number; protectionApplied: number; skipped: number }
  | { ok: false; error: string };

/**
 * Evaluates WD/DNS/DQ for protected roster slots and applies swap windows or safety coverage credit.
 * Requires the same admin secret as other settlement tools.
 */
export async function runProtectionEngineV1(formData: FormData): Promise<RunProtectionEngineResult> {
  const secret = process.env.ADMIN_SCORING_SECRET;
  if (!secret || formData.get("adminSecret") !== secret) {
    return { ok: false, error: "Invalid or missing admin secret." };
  }

  const contestId = String(formData.get("contestId") ?? "").trim();
  if (!contestId) {
    return { ok: false, error: "Enter a contest id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Service role not configured." };
  }

  const { data, error } = await admin.rpc("process_protection_engine_v1", {
    p_contest_id: contestId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as {
    ok?: boolean;
    swap_marked?: number;
    protection_applied?: number;
    skipped?: number;
  } | null;

  if (!row || row.ok === false) {
    return { ok: false, error: "CashCaddies Safety Coverage engine did not complete." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lineups");
  revalidatePath(`/contest/${encodeURIComponent(contestId)}`);

  void sendPendingProtectionActivatedEmails().catch(() => {
    /* optional email */
  });

  return {
    ok: true,
    swapMarked: Number(row.swap_marked ?? 0),
    protectionApplied: Number(row.protection_applied ?? 0),
    skipped: Number(row.skipped ?? 0),
  };
}
