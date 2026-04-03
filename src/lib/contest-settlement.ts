import { safeWalletNumber } from "@/lib/wallet-persistence";
import type { WalletTransaction } from "@/lib/wallet-transaction";

/** DB `transactions.type` after `settle_contest_prizes`. */
export const CONTEST_PRIZE_TRANSACTION_TYPE = "contest_prize" as const;

/** DB `transactions.type` for entry fee refunds when `contest_entries.entry_protected`. */
export const ENTRY_PROTECTION_REFUND_TRANSACTION_TYPE = "entry_protection_refund" as const;

export type ContestPrizeDbRow = {
  id: string;
  amount: number | string | null;
  type: string;
  created_at: string;
};

/**
 * Mock rule for tests: only first place receives a prize; everyone else $0.
 * (Production settlement uses `contest_payouts` and may pay multiple ranks.)
 */
export function mockWinningsForRank(rank: number, firstPlacePrizeUsd: number): number {
  if (rank === 1) return round2(Math.max(0, firstPlacePrizeUsd));
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Map Supabase `transactions` row → wallet history row (stable id for dedupe). */
export function contestPrizeRowToWalletTransaction(row: ContestPrizeDbRow): WalletTransaction {
  const amt = safeWalletNumber(row.amount);
  const dollars = Math.abs(amt);
  return {
    id: `prize-${row.id}`,
    date: new Date(row.created_at).toISOString(),
    type: "Winnings",
    amount: dollars,
    status: "Completed",
  };
}

/** DB row for `entry_protection_refund` → wallet history (positive amount). */
export function entryProtectionRefundRowToWalletTransaction(row: ContestPrizeDbRow): WalletTransaction {
  const amt = safeWalletNumber(row.amount);
  const dollars = Math.abs(amt);
  return {
    id: `entry-prot-${row.id}`,
    date: new Date(row.created_at).toISOString(),
    type: "Entry Protection",
    amount: dollars,
    status: "Completed",
  };
}

/**
 * Merges local/client transactions with DB-backed contest prizes.
 * DB rows win on id collision (`prize-${uuid}`).
 */
export function mergeWalletTransactionsWithContestPrizes(
  local: WalletTransaction[],
  dbPrizes: WalletTransaction[],
): WalletTransaction[] {
  const byId = new Map<string, WalletTransaction>();
  for (const t of local) {
    byId.set(t.id, t);
  }
  for (const t of dbPrizes) {
    byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function sessionStoragePrizeAnnounceKey(userId: string): string {
  return `cashcaddies_prize_announced:${userId}`;
}
