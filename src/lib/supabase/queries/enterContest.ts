/**
 * Contest entry helpers: insert-first capacity guard + RPC error mapping.
 *
 * `insertContestEntryWithCapacityGuard` does **not** pre-check “contest full”.
 * It inserts first, then counts; if over capacity it deletes the new row.
 * Duplicate (user_id, contest_id) is detected via unique constraint → “Already entered”.
 */

import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeContestEntryErrorMessage } from "@/lib/contest-entry-eligibility";

export const CONTEST_ENTRY_MESSAGES = {
  alreadyEntered: "You're already entered in this contest.",
  contestFull: "This contest is full — all entry spots are taken.",
  genericFailure: "Could not complete contest entry. Please try again.",
} as const;

function isUniqueViolation(err: PostgrestError | null): boolean {
  return err?.code === "23505";
}

export type ContestEntryInsertRow = Record<string, unknown>;

/**
 * 1. INSERT into `contest_entries` (no prior “is contest full?” check).
 * 2. Unique violation → already entered.
 * 3. Count entries for the contest; if count > maxEntries → DELETE this row → contest full.
 * 4. Otherwise success with `entryId`.
 */
export async function insertContestEntryWithCapacityGuard(
  supabase: SupabaseClient,
  args: {
    row: ContestEntryInsertRow;
    contestId: string;
    maxEntries: number;
  },
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const { data, error: insErr } = await supabase
    .from("contest_entries")
    .insert(args.row)
    .select("id")
    .single();

  if (insErr) {
    if (isUniqueViolation(insErr)) {
      return { ok: false, error: CONTEST_ENTRY_MESSAGES.alreadyEntered };
    }
    return { ok: false, error: normalizeContestEntryErrorMessage(insErr.message) };
  }

  const entryId = data?.id != null ? String(data.id) : "";
  if (!entryId) {
    return { ok: false, error: CONTEST_ENTRY_MESSAGES.genericFailure };
  }

  const { count, error: countErr } = await supabase
    .from("contest_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", args.contestId);

  if (countErr) {
    await supabase.from("contest_entries").delete().eq("id", entryId);
    return { ok: false, error: CONTEST_ENTRY_MESSAGES.genericFailure };
  }

  const cap = Math.max(1, Math.floor(Number(args.maxEntries)));
  if ((count ?? 0) > cap) {
    await supabase.from("contest_entries").delete().eq("id", entryId);
    return { ok: false, error: CONTEST_ENTRY_MESSAGES.contestFull };
  }

  return { ok: true, entryId };
}

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
  if (/\bunique_user_contest\b|duplicate key value violates unique constraint/i.test(t)) {
    return CONTEST_ENTRY_MESSAGES.alreadyEntered;
  }
  if (/\bthis contest is full\b/i.test(t)) {
    return CONTEST_ENTRY_MESSAGES.contestFull;
  }
  return normalizeContestEntryErrorMessage(raw);
}
