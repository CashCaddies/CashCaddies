import { createServiceRoleClient } from "@/lib/supabase/admin";

export type PayoutProfileSnippet = {
  username: string | null;
  email: string | null;
};

export type PayoutHistoryRow = {
  id: string;
  contest_id: string;
  entry_id: string;
  user_id: string;
  rank: number;
  winnings_usd: number;
  created_at: string;
  paid: boolean;
  paid_at: string | null;
  profiles: PayoutProfileSnippet | null;
};

export type GetPayoutHistoryResult =
  | { ok: true; rows: PayoutHistoryRow[]; walletCreditedAt: string | null }
  | { ok: false; error: string };

function normalizeProfilesEmbed(raw: unknown): PayoutProfileSnippet | null {
  if (raw == null) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const p = row as { username?: unknown; email?: unknown };
  return {
    username: typeof p.username === "string" ? p.username : null,
    email: typeof p.email === "string" ? p.email : null,
  };
}

export type GetPayoutHistoryOptions = {
  /** When set, filter by `contest_entry_results.paid`. Omit for all rows. */
  paid?: boolean;
};

/**
 * Loads per-entry payout lines for a contest with `profiles` (username, email).
 * Uses the service role so admin reads work under RLS.
 */
export async function getPayoutHistory(
  contestId: string,
  options?: GetPayoutHistoryOptions,
): Promise<GetPayoutHistoryResult> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  let query = admin
    .from("contest_entry_results")
    .select(
      `
      id,
      contest_id,
      entry_id,
      user_id,
      rank,
      winnings_usd,
      created_at,
      paid,
      paid_at,
      profiles ( username, email )
    `,
    )
    .eq("contest_id", id);

  const paidOpt = options?.paid;
  if (paidOpt === true) {
    query = query.eq("paid", true);
  } else if (paidOpt === false) {
    query = query.eq("paid", false);
  }

  const { data, error } = await query.order("rank", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rawRows = data ?? [];
  const rows: PayoutHistoryRow[] = rawRows.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    contest_id: String(row.contest_id ?? ""),
    entry_id: String(row.entry_id ?? ""),
    user_id: String(row.user_id ?? ""),
    rank: Number(row.rank ?? 0),
    winnings_usd: Number(row.winnings_usd ?? 0),
    created_at: String(row.created_at ?? ""),
    paid: Boolean(row.paid),
    paid_at: row.paid_at == null ? null : String(row.paid_at),
    profiles: normalizeProfilesEmbed(row.profiles),
  }));

  const creditRes = await admin
    .from("contest_winnings_credits")
    .select("credited_at")
    .eq("contest_id", id)
    .maybeSingle();

  let walletCreditedAt: string | null = null;
  if (!creditRes.error && creditRes.data) {
    const ca = (creditRes.data as { credited_at?: unknown }).credited_at;
    if (typeof ca === "string") walletCreditedAt = ca;
  }

  return {
    ok: true,
    rows,
    walletCreditedAt,
  };
}
