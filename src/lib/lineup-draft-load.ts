import { supabase } from "@/lib/supabase/client";
import { lineupHasContestEntry } from "@/lib/lineup-permissions";

/** Per-slot state for late swap (entered lineups). */
export type RosterSlotState = {
  lineupPlayerId: string;
  slotIndex: number;
  golferId: string;
  isLocked: boolean;
};

export type DraftLineupEditorData = {
  lineupId: string;
  contestId: string | null;
  golferIds: string[];
  protectionEnabled: boolean;
  protectedGolferIds: string[];
  /** When set, user is editing an already-submitted contest entry roster. */
  editingContestEntryId?: string;
  editingEntryNumber?: number;
  /** Populated for entered lineups when late swap metadata exists. */
  rosterSlots?: RosterSlotState[];
  lateSwapWindowOpen?: boolean;
  lateSwapEnabled?: boolean;
};

export type LoadDraftLineupForEditorResult =
  | { status: "ok"; data: DraftLineupEditorData }
  | { status: "locked" }
  | { status: "not_found" }
  | { status: "unauthorized" };

/**
 * Load the latest lineup for the current user + contest.
 * Query shape:
 *   SELECT * FROM lineups
 *   WHERE user_id = current_user_id AND contest_id = contest_id
 *   ORDER BY created_at DESC
 *   LIMIT 1
 * Then hydrate golfers from lineup_players via loadDraftLineupForEditor.
 */
export async function loadLatestDraftLineupForContest(contestIdRaw: string): Promise<LoadDraftLineupForEditorResult> {
  const contestId = contestIdRaw?.trim();
  if (!contestId) {
    return { status: "not_found" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "unauthorized" };
  }

  const { data: lineup, error } = await supabase
    .from("lineups")
    .select("id")
    .eq("user_id", user.id)
    .eq("contest_id", contestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !lineup?.id) {
    return { status: "not_found" };
  }

  return loadDraftLineupForEditor(String(lineup.id));
}

/**
 * Load a user's lineup for the editor. Entered lineups (contest_entry_id set) are not editable.
 */
export async function loadDraftLineupForEditor(lineupIdRaw: string): Promise<LoadDraftLineupForEditorResult> {
  const lineupId = lineupIdRaw?.trim();
  if (!lineupId) {
    return { status: "not_found" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "unauthorized" };
  }

  const { data: lineup, error } = await supabase
    .from("lineups")
    .select(
      `
      id,
      contest_id,
      contest_entry_id,
      protection_enabled,
      lineup_players ( golfer_id, is_protected )
    `,
    )
    .eq("id", lineupId)
    .maybeSingle();

  if (error || !lineup) {
    return { status: "not_found" };
  }

  if (lineupHasContestEntry({ contest_entry_id: lineup.contest_entry_id })) {
    return { status: "locked" };
  }

  const lps = (lineup.lineup_players ?? []) as { golfer_id: string; is_protected: boolean | null }[];
  const golferIds = [...lps]
    .sort((a, b) => a.golfer_id.localeCompare(b.golfer_id))
    .map((p) => p.golfer_id);
  return {
    status: "ok",
    data: {
      lineupId: lineup.id as string,
      contestId: (lineup.contest_id as string | null) ?? null,
      golferIds,
      protectionEnabled: Boolean(lineup.protection_enabled),
      protectedGolferIds: [],
    },
  };
}
