import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
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

  const selectWithProfiles =
    "id, contest_id, user_id, lineup_id, created_at, entry_protected, lineup_edited, entry_protection_forced, lock_timestamp, profiles(username,email)";
  const selectBare =
    "id, contest_id, user_id, lineup_id, created_at, entry_protected, lineup_edited, entry_protection_forced, lock_timestamp";
  const selectMinimal = "id, contest_id, user_id, lineup_id, created_at";

  let query = sb.from("contest_entries").select(selectWithProfiles).eq("contest_id", id).order("created_at", { ascending: true });

  if (!opts?.isAdmin) {
    const userId = opts?.userId?.trim();
    if (!userId) return [];
    query = query.eq("user_id", userId);
  }

  let { data, error } = await query;

  if (error && isPostgrestRelationshipOrEmbedError(error)) {
    let q2 = sb.from("contest_entries").select(selectBare).eq("contest_id", id).order("created_at", { ascending: true });
    if (!opts?.isAdmin) {
      const userId = opts?.userId?.trim();
      if (!userId) return [];
      q2 = q2.eq("user_id", userId);
    }
    const second = await q2;
    data = second.data;
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
    data = third.data;
    error = third.error;
  }

  if (error) {
    return [];
  }

  return Array.isArray(data) ? (data as ContestEntryRow[]) : [];
}
