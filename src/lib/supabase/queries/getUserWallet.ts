import { createClient } from "@/lib/supabase/server";

export type UserWalletTransaction = {
  id: string;
  amount: number;
  type: string | null;
  description: string | null;
  created_at: string;
};

export type GetUserWalletResult = {
  account_balance: number;
  transactions: UserWalletTransaction[];
  userId: string | null;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Current session: `profiles.account_balance` and latest 20 `transactions` rows (newest first).
 */
export async function getUserWallet(): Promise<GetUserWalletResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { account_balance: 0, transactions: [], userId: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { account_balance: 0, transactions: [], userId: null };
  }

  const uid = user.id;

  const [profileRes, txRes] = await Promise.all([
    supabase.from("profiles").select("account_balance").eq("id", uid).maybeSingle(),
    supabase
      .from("transactions")
      .select("id, amount, type, description, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const account_balance = num((profileRes.data as { account_balance?: unknown } | null)?.account_balance);

  const rows = (txRes.data ?? []) as Array<{
    id: string;
    amount?: unknown;
    type?: string | null;
    description?: string | null;
    created_at?: string | null;
  }>;

  const transactions: UserWalletTransaction[] = rows.map((r) => ({
    id: String(r.id),
    amount: num(r.amount),
    type: r.type ?? null,
    description: r.description ?? null,
    created_at:
      r.created_at != null && String(r.created_at).trim() !== ""
        ? String(r.created_at)
        : new Date(0).toISOString(),
  }));

  return { account_balance, transactions, userId: uid };
}
