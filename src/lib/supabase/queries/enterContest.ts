/**
 * Contest entry helpers: capacity guard + RPC error mapping.
 *
 * `insertContestEntryWithCapacityGuard` requires `contests.status === 'filling'` and
 * entry_count &lt; max_entries before insert, then insert + post-count rollback if over cap.
 */

import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTEST_FULL_MESSAGE,
  CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE,
  contestStatusIsFilling,
  normalizeContestEntryErrorMessage,
} from "@/lib/contest-entry-eligibility";

export const CONTEST_ENTRY_MESSAGES = {
  alreadyEntered: "You're already entered in this contest.",
  contestFull: "This contest is full — all entry spots are taken.",
  notFilling: CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE,
  genericFailure: "Could not complete contest entry. Please try again.",
} as const;

function isUniqueViolation(err: PostgrestError | null): boolean {
  return err?.code === "23505";
}

export type ContestEntryInsertRow = Record<string, unknown>;

/**
 * 1. Require `contests.status === 'filling'` and entry_count < max_entries.
 * 2. INSERT into `contest_entries`.
 * 3. Unique violation → already entered.
 * 4. Count entries; if count > maxEntries → DELETE this row → contest full.
 * 5. Otherwise success with `entryId`.
 */
export async function insertContestEntryWithCapacityGuard(
  supabase: SupabaseClient,
  args: {
    row: ContestEntryInsertRow;
    contestId: string;
    maxEntries: number;
  },
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const cap = Math.max(1, Math.floor(Number(args.maxEntries)));
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, status, max_entries")
    .eq("id", args.contestId)
    .maybeSingle();

  if (cErr || !contest) {
    return { ok: false, error: normalizeContestEntryErrorMessage(cErr?.message ?? "Contest not found.") };
  }

  const row = contest as { status?: string | null; max_entries?: number | null };
  if (!contestStatusIsFilling(row.status)) {
    return { ok: false, error: CONTEST_ENTRY_MESSAGES.notFilling };
  }

  const maxE = Math.max(1, Math.floor(Number(row.max_entries ?? cap)));
  const { count: preCount, error: preErr } = await supabase
    .from("contest_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", args.contestId);

  if (preErr) {
    return { ok: false, error: normalizeContestEntryErrorMessage(preErr.message) };
  }
  if ((preCount ?? 0) >= maxE) {
    return { ok: false, error: CONTEST_FULL_MESSAGE };
  }

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

  if ((count ?? 0) > maxE) {
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
