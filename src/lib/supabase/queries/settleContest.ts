/**
 * Prize settlement: DB `settle_contest_prizes` (requires `contests.status = 'complete'`,
 * idempotent via `contest_settlements`). Ranks entries by `contest_entries.created_at` asc (then id).
 * App then sets `contests.status = 'settled'` in admin flow.
 */
export { settleContestPrizes as settleContest } from "@/lib/contest-payout-engine";
