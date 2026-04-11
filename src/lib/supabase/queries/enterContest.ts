/**
 * Contest entry hardening — user-facing errors for `create_contest_entry_atomic` and related flows.
 *
 * DB layer (no app-side insert-then-delete):
 * - `trg_enforce_contest_entry_capacity`: BEFORE INSERT, locks `contests` row, rejects when at `max_entries`
 *   or `max_entries_per_user` (serializes races on the same contest).
 * - `create_contest_entry_atomic`: `pg_advisory_xact_lock` per (user_id, contest_id) for concurrent submits.
 * - Unique `contest_entries_user_contest_entry_number_uidx` (user_id, contest_id, entry_number) prevents duplicate slot.
 *
 * We do **not** add UNIQUE(user_id, contest_id) alone: `max_entries_per_user` can be > 1 (multiple rows per pair).
 */

import { normalizeContestEntryErrorMessage } from "@/lib/contest-entry-eligibility";

export const CONTEST_ENTRY_MESSAGES = {
  alreadyEntered: "You're already entered in this contest.",
  contestFull: "This contest is full — all entry spots are taken.",
  genericFailure: "Could not complete contest entry. Please try again.",
} as const;

/**
 * Maps RPC / Postgres errors to stable product copy (duplicate entry, full contest, etc.).
 */
export function mapContestEntryFailure(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return CONTEST_ENTRY_MESSAGES.genericFailure;
  }
  if (/duplicate contest entry|same user, contest, and entry slot/i.test(t)) {
    return CONTEST_ENTRY_MESSAGES.alreadyEntered;
  }
  if (/\bthis contest is full\b/i.test(t)) {
    return CONTEST_ENTRY_MESSAGES.contestFull;
  }
  return normalizeContestEntryErrorMessage(raw);
}
