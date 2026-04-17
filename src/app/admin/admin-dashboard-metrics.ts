"use server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/permissions";

/** Shape of `public.admin_dashboard_metrics()` JSON (snake_case keys from Postgres). */
export type AdminDashboardMetrics = {
  total_users: number;
  total_deposits: number;
  total_entry_fees: number;
  total_payouts: number;
  active_contests: number;
  profit: number;
};

export type GetAdminMetricsResult = { ok: true; data: AdminDashboardMetrics } | { ok: false; error: string };

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Calls `admin_dashboard_metrics` (service role RPC). Requires signed-in admin session.
 */
export async function getAdminMetrics(): Promise<GetAdminMetricsResult> {
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

  const { data, error } = await svc.rpc("admin_dashboard_metrics");
  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return { ok: false, error: "Unexpected response from admin_dashboard_metrics." };
  }

  return {
    ok: true,
    data: {
      total_users: num(row.total_users),
      total_deposits: num(row.total_deposits),
      total_entry_fees: num(row.total_entry_fees),
      total_payouts: num(row.total_payouts),
      active_contests: num(row.active_contests),
      profit: num(row.profit),
    },
  };
}
