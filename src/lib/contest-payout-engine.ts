import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Matches SQL `settle_contest_prizes`: settlement runs when `now() >= starts_at + 3 days`. */
export const CONTEST_SETTLEMENT_AFTER_START_MS = 3 * 24 * 60 * 60 * 1000;

export type ContestPayoutLine = {
  user_id: string;
  rank_place: number;
  amount_usd: number;
  payout_pct: number;
};

export type SettleContestPrizesPayload = {
  ok: true;
  contest_id: string;
  prize_pool_usd: number;
  entry_count: number;
  distributed_usd: number;
  payouts: ContestPayoutLine[];
};

type RpcRow = {
  ok?: boolean;
  error?: string;
  contest_id?: string;
  prize_pool_usd?: number;
  entry_count?: number;
  distributed_usd?: number;
  payouts?: unknown;
};

function parsePayoutLines(raw: unknown): ContestPayoutLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ContestPayoutLine[] = [];
  for (const x of raw) {
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      out.push({
        user_id: String(o.user_id ?? ""),
        rank_place: Math.floor(Number(o.rank_place ?? 0)),
        amount_usd: Number(o.amount_usd ?? 0),
        payout_pct: Number(o.payout_pct ?? 0),
      });
    }
  }
  return out;
}

/**
 * Runs DB `settle_contest_prizes`: sorted leaderboard, `contest_payouts` percentages of prize pool,
 * credits `profiles.account_balance` and `transactions` (type `contest_prize`). Idempotent per contest.
 */
export async function settleContestPrizes(
  contestId: string,
): Promise<{ ok: true; data: SettleContestPrizesPayload } | { ok: false; error: string }> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data, error } = await admin.rpc("settle_contest_prizes", { p_contest_id: id });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as RpcRow | null;
  if (!row || row.ok === false) {
    const msg =
      typeof row?.error === "string" && row.error.trim() !== ""
        ? row.error
        : "Settlement failed.";
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    data: {
      ok: true,
      contest_id: String(row.contest_id ?? id),
      prize_pool_usd: Number(row.prize_pool_usd ?? 0),
      entry_count: Math.floor(Number(row.entry_count ?? 0)),
      distributed_usd: Number(row.distributed_usd ?? 0),
      payouts: parsePayoutLines(row.payouts),
    },
  };
}
