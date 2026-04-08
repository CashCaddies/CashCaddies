import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { CONTEST_ENTRIES_READ_BASE } from "@/lib/contest-entries-read-columns";
import {
  isMissingColumnOrSchemaError,
  isPostgrestRelationshipOrEmbedError,
} from "@/lib/supabase-missing-column";

export type ContestEntryRow = {
  id: string;
  contest_id: string;
  user_id: string;
  lineup_id: string | null;
  created_at: string;
  entry_fee?: number | null;
  total_paid?: number | null;
  status?: string | null;
  entry_number?: number | null;
  entry_protected?: boolean | null;
  lineup_edited?: boolean | null;
  entry_protection_forced?: boolean | null;
  lock_timestamp?: string | null;
  profiles?: { username?: string | null; email?: string | null } | { username?: string | null; email?: string | null }[] | null;
};

export async function getContestEntries(
  contestId: string,
  opts?: { userId?: string | null; isAdmin?: boolean; client?: SupabaseClient },
): Promise<ContestEntryRow[]> {
  const id = contestId.trim();
  if (!id) return [];

  const sb = opts?.client ?? supabase;
  if (!sb) return [];

  const selectWithProfiles = `${CONTEST_ENTRIES_READ_BASE}, profiles(username,email)`;
  const selectBare = CONTEST_ENTRIES_READ_BASE;
  const selectMinimal = CONTEST_ENTRIES_READ_BASE;

  let query = sb.from("contest_entries").select(selectWithProfiles).eq("contest_id", id).order("created_at", { ascending: true });

  if (!opts?.isAdmin) {
    const userId = opts?.userId?.trim();
    if (!userId) return [];
    query = query.eq("user_id", userId);
  }

  let data: ContestEntryRow[] | null = null;
  let error: { message: string } | null = null;
  {
    const first = await query;
    data = first.data as ContestEntryRow[] | null;
    error = first.error;
  }

  if (error && isPostgrestRelationshipOrEmbedError(error)) {
    let q2 = sb.from("contest_entries").select(selectBare).eq("contest_id", id).order("created_at", { ascending: true });
    if (!opts?.isAdmin) {
      const userId = opts?.userId?.trim();
      if (!userId) return [];
      q2 = q2.eq("user_id", userId);
    }
    const second = await q2;
    data = second.data as ContestEntryRow[] | null;
    error = second.error;
  }

  if (error && isMissingColumnOrSchemaError(error)) {
    let q3 = sb.from("contest_entries").select(selectMinimal).eq("contest_id", id).order("created_at", { ascending: true });
    if (!opts?.isAdmin) {
      const userId = opts?.userId?.trim();
      if (!userId) return [];
      q3 = q3.eq("user_id", userId);
    }
    const third = await q3;
    data = third.data as ContestEntryRow[] | null;
    error = third.error;
  }

  if (error) {
    return [];
  }

  return Array.isArray(data) ? (data as ContestEntryRow[]) : [];
}
