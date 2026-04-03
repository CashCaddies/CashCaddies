"use server";

import { createClient } from "@/lib/supabase/server";

export type AddDevTestFundsResult =
  | { ok: true; accountBalance: number }
  | { ok: false; error: string };

/**
 * Development only: calls `public.add_test_funds` ($100, logged as test_credit).
 * Remove this file and UI before production, or set app_config.allow_test_wallet_funding to false and/or revoke RPC.
 */
export async function addDevTestFunds100(): Promise<AddDevTestFundsResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "Not available outside development." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data, error } = await supabase.rpc("add_test_funds", {
    p_user_id: user.id,
    p_amount: 100,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as { ok?: boolean; account_balance?: number | string };
  if (!row || row.ok !== true) {
    return { ok: false, error: "Unexpected response from wallet." };
  }

  const bal = typeof row.account_balance === "number" ? row.account_balance : Number(row.account_balance);
  if (!Number.isFinite(bal)) {
    return { ok: false, error: "Unexpected response from wallet." };
  }

  return { ok: true, accountBalance: bal };
}
