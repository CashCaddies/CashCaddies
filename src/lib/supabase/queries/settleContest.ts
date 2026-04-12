/**
 * Prize settlement: DB `settle_contest_prizes` inserts one `contest_settlements` row (MVP, no per-user payouts).
 * App then sets `contests.status = 'settled'` in admin flow.
 */
export { settleContestPrizes as settleContest } from "@/lib/contest-payout-engine";
