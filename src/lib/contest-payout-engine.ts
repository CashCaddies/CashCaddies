import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Legacy hint for auto-settlement UI (prefer filtering by `contests.status === 'complete'`). */
export const CONTEST_SETTLEMENT_AFTER_START_MS = 3 * 24 * 60 * 60 * 1000;

/** Successful `settle_contest_prizes` RPC payload (contest-level accounting row only). */
export type SettlementResponse = {
  ok: boolean;
  contest_id: string;
  entry_count: number;
  prize_pool_usd: number;
};

type RpcRow = {
  ok?: boolean;
  error?: string;
  contest_id?: string;
  prize_pool_usd?: number;
  entry_count?: number;
};

type FinRpcRow = { ok?: boolean; error?: string };

/**
 * Upserts `contest_financials` for the contest (run after successful `settle_contest_prizes`).
 */
export async function calculateContestFinancialsSnapshot(
  contestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data, error } = await admin.rpc("calculate_contest_financials", { p_contest_id: id });
  if (error) {
    return { ok: false, error: error.message };
  }

  const finRow = data as FinRpcRow | null;
  if (finRow && finRow.ok === false) {
    const msg =
      typeof finRow.error === "string" && finRow.error.trim() !== ""
        ? finRow.error
        : "calculate_contest_financials failed.";
    return { ok: false, error: msg };
  }

  return { ok: true };
}

/**
 * Runs DB `settle_contest_prizes` with `{ p_contest_id }`. Writes one `contest_settlements` row (accounting only).
 */
export async function settleContestPrizes(
  contestId: string,
): Promise<{ ok: true; data: SettlementResponse } | { ok: false; error: string }> {
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

  const finRes = await calculateContestFinancialsSnapshot(id);
  if (!finRes.ok) {
    return {
      ok: false,
      error: `Prizes settled but contest financials failed: ${finRes.error}`,
    };
  }

  return {
    ok: true,
    data: {
      ok: true,
      contest_id: String(row.contest_id ?? id),
      prize_pool_usd: Number(row.prize_pool_usd ?? 0),
      entry_count: Math.floor(Number(row.entry_count ?? 0)),
    },
  };
}
