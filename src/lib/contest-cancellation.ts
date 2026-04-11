/**
 * Cancelled contests: `contests.status` must only be set to cancelled
 * after player entries are refunded — use a dedicated admin/refund flow, not lifecycle toggles.
 */

/** Canonical value stored in `contests.status` when a contest is voided after refunds. */
export const CONTEST_STATUS_CANCELLED = "cancelled" as const;

export const CONTEST_CANCELLED_ENTRIES_MESSAGE =
  "This contest was cancelled — entries are closed.";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

/** True when the contest must not accept new entries (UK/US spellings). */
export function isContestCancelled(status: string | null | undefined): boolean {
  const s = norm(status);
  return s === "cancelled" || s === "canceled";
}
