"use server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { isAdmin } from "@/lib/permissions";

export type AdminCommandCenterStatsResult =
  | {
      ok: true;
      totalUsers: number;
      pendingBeta: number;
      approvedBeta: number;
      totalWalletUsd: number;
      protectionFundUsd: number;
      contestCount: number;
    }
  | { ok: false; error: string };

/**
 * Accurate aggregates for the Command Center (service role + verified admin via session cookie).
 */
export async function fetchAdminCommandCenterStats(): Promise<AdminCommandCenterStatsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return { ok: false, error: "Missing Supabase configuration." };
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(profile?.role)) {
    return { ok: false, error: "Admin access required." };
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return { ok: false, error: "Server admin client unavailable." };
  }

  const [totalRes, pendingRes, approvedRes, walletRes, contestsRes] = await Promise.all([
    svc.from("profiles").select("id", { count: "exact", head: true }),
    svc.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "pending"),
    svc.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "approved"),
    svc.from("profiles").select("wallet_balance"),
    svc.from("contests").select("id", { count: "exact", head: true }),
  ]);

  if (totalRes.error || pendingRes.error || approvedRes.error) {
    return { ok: false, error: "Could not load profile metrics." };
  }

  if (walletRes.error) {
    return { ok: false, error: "Could not load wallet totals." };
  }

  const walletRows = (walletRes.data ?? []) as Array<{ wallet_balance?: number | string | null }>;
  const totalWalletUsd = walletRows.reduce((sum, row) => {
    const n = Number(row.wallet_balance ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const pool = await fetchInsurancePoolBalanceUsd(svc);

  return {
    ok: true,
    totalUsers: Number(totalRes.count ?? 0),
    pendingBeta: Number(pendingRes.count ?? 0),
    approvedBeta: Number(approvedRes.count ?? 0),
    totalWalletUsd,
    protectionFundUsd: Number.isFinite(pool.usd) ? pool.usd : 0,
    contestCount: contestsRes.error ? 0 : Number(contestsRes.count ?? 0),
  };
}
