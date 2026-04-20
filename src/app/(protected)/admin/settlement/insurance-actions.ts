"use server";

import { revalidatePath } from "next/cache";
import { processContestInsurance } from "@/lib/contest-insurance-engine";

export type RunContestInsuranceResult =
  | { ok: true; contestId: string; totalCreditedUsd: number; lineCount: number }
  | { ok: false; error: string };

export async function runContestInsurance(formData: FormData): Promise<RunContestInsuranceResult> {
  const secret = process.env.ADMIN_SCORING_SECRET;
  if (!secret || formData.get("adminSecret") !== secret) {
    return { ok: false, error: "Invalid or missing admin secret." };
  }

  const contestId = String(formData.get("contestId") ?? "").trim();
  if (!contestId) {
    return { ok: false, error: "Select or enter a contest." };
  }

  const result = await processContestInsurance(contestId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const { data } = result;
  revalidatePath("/admin/settlement");
  revalidatePath("/dashboard");
  revalidatePath(`/contest/${encodeURIComponent(data.contest_id)}`);

  return {
    ok: true,
    contestId: data.contest_id,
    totalCreditedUsd: data.total_credited_usd,
    lineCount: data.lines.length,
  };
}
