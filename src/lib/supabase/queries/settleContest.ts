/**
 * Contest settlement: DB `settle_contest_prizes` inserts one `contest_settlements` row (accounting only).
 * App then sets `contests.status = 'settled'` in admin flow.
 */
export { settleContestPrizes as settleContest } from "@/lib/contest-payout-engine";
