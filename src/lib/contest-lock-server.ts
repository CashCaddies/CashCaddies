import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTEST_LOCKED_MESSAGE } from "@/lib/contest-entry-eligibility";

/** Server-side guard: contests table `starts_at` is the lock instant. */
export async function getContestLineupLockState(
  supabase: SupabaseClient,
  contestId: string | null | undefined,
): Promise<{ locked: boolean; startsAtIso: string | null }> {
  const id = contestId?.trim();
  if (!id || id === "default") {
    return { locked: false, startsAtIso: null };
  }

  const { data, error } = await supabase.from("contests").select("starts_at").eq("id", id).maybeSingle();

  if (error || !data?.starts_at) {
    return { locked: false, startsAtIso: null };
  }

  const iso = String(data.starts_at);
  const t = Date.parse(iso);
  const locked = Number.isFinite(t) && Date.now() >= t;
  return { locked, startsAtIso: iso };
}

export function contestLockErrorMessage(): string {
  return CONTEST_LOCKED_MESSAGE;
}

/**
 * Block lineup saves when any relevant contest is past start: URL contest and/or existing draft’s `contest_id`.
 */
export async function assertContestLineupUnlockedForDraft(
  supabase: SupabaseClient,
  opts: {
    resolvedContestId: string | null | undefined;
    existingLineupId: string | null | undefined;
  },
): Promise<string | null> {
  const err = CONTEST_LOCKED_MESSAGE;
  const cidFromUrl = opts.resolvedContestId?.trim();
  if (cidFromUrl && cidFromUrl !== "default") {
    const { locked } = await getContestLineupLockState(supabase, cidFromUrl);
    if (locked) return err;
  }
  const lid = opts.existingLineupId?.trim();
  if (lid) {
    const { data: lu } = await supabase.from("lineups").select("contest_id").eq("id", lid).maybeSingle();
    const cid = lu?.contest_id != null ? String(lu.contest_id).trim() : "";
    if (cid && cid !== "default") {
      const { locked } = await getContestLineupLockState(supabase, cid);
      if (locked) return err;
    }
  }
  return null;
}
