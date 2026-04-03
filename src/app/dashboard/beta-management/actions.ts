"use server";

import { getBetaCapacitySnapshot } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type BetaMgmtApproveResult =
  | { ok: true; approvedCount: number; maxBetaUsers: number }
  | { ok: false; error: string };

export type BetaMgmtActionResult = { ok: true } | { ok: false; error: string };

/** Founding-tester RPC path with the same capacity rules as the admin beta queue (`app_config.max_beta_users`). */
export async function approveBetaUser(targetId: string): Promise<BetaMgmtApproveResult> {
  const id = typeof targetId === "string" ? targetId.trim() : "";
  if (!id) {
    return { ok: false, error: "Missing profile id." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const before = await getBetaCapacitySnapshot(admin);
  if (before.approvedCount >= before.maxBetaUsers) {
    return { ok: false, error: "Beta program is at capacity." };
  }

  const { error } = await supabase.rpc("founding_tester_approve_beta", { p_target: id });
  if (error) {
    return { ok: false, error: error.message };
  }

  const after = await getBetaCapacitySnapshot(admin);
  return { ok: true, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
}

export async function toggleFoundingTester(targetId: string): Promise<BetaMgmtActionResult> {
  const id = typeof targetId === "string" ? targetId.trim() : "";
  if (!id) {
    return { ok: false, error: "Missing profile id." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { error } = await supabase.rpc("founding_tester_toggle_founding_tester", { p_target: id });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
