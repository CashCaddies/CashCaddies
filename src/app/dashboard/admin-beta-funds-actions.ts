"use server";

import { createClient } from "@/lib/supabase/server";

export type AddAdminBetaFundsResult =
  | { ok: true; walletBalance: number }
  | { ok: false; error: string };

const ALLOWED_BETA_FUND_AMOUNTS = [10, 50, 100] as const;

export async function addAdminBetaFunds(amount: number): Promise<AddAdminBetaFundsResult> {
  if (!ALLOWED_BETA_FUND_AMOUNTS.includes(amount as 10 | 50 | 100)) {
    return { ok: false, error: "Invalid amount." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data, error } = await supabase.rpc("admin_add_beta_funds", { p_amount: amount });
  if (error) {
    return { ok: false, error: error.message };
  }

  // Accept both shapes:
  // 1) direct: { wallet_balance: number }
  // 2) wrapped: { ok: true, wallet_balance: number }
  const row = data as { ok?: boolean; wallet_balance?: number | string } | null;
  if (!row) {
    return { ok: false, error: "Unexpected response from wallet." };
  }
  if (row.ok === false) {
    return { ok: false, error: "Wallet funding was rejected." };
  }
  if (row.wallet_balance == null) {
    return { ok: false, error: "Unexpected response from wallet." };
  }

  const walletBalance =
    typeof row.wallet_balance === "number" ? row.wallet_balance : Number(row.wallet_balance);
  if (!Number.isFinite(walletBalance)) {
    return { ok: false, error: "Unexpected response from wallet." };
  }

  return { ok: true, walletBalance };
}
