import { unstable_noStore } from "next/cache";
import { contestIdForRpc } from "@/lib/contest-rpc-id";
import { supabase } from "@/lib/supabase/client";
import { currentUserHasContestAccess } from "@/lib/supabase/beta-access";
import { isMissingColumnOrSchemaError } from "@/lib/supabase-missing-column";

export type GolferOwnershipRow = {
  golferId: string;
  golferName: string;
  rosterSlots: number;
  ownershipPct: number;
};

type RpcRow = {
  golfer_id?: string;
  golfer_name?: string | null;
  roster_slots?: number | null;
  ownership_pct?: number | string | null;
};

/**
 * Roster-slot ownership percentages for entered lineups in a contest.
 * Requires contest access (same gate as leaderboards). Uses SECURITY DEFINER RPC.
 */
export async function getContestGolferOwnershipForViewer(contestIdRaw: string): Promise<GolferOwnershipRow[]> {
  unstable_noStore();
  const uuid = contestIdForRpc(contestIdRaw);
  if (!uuid) {
    return [];
  }

  try {
        const hasAccess = await currentUserHasContestAccess(supabase);
    if (!hasAccess) {
      return [];
    }

    const { data, error } = await supabase.rpc("contest_golfer_ownership_stats", {
      p_contest_id: uuid,
    });

    if (error) {
      if (isMissingColumnOrSchemaError(error)) {
        return [];
      }
      return [];
    }

    const list = (data ?? []) as RpcRow[];
    return list.map((r) => {
      const gid = String(r.golfer_id ?? "");
      const name = typeof r.golfer_name === "string" ? r.golfer_name.trim() : "";
      const slots = Number(r.roster_slots ?? 0);
      const pct = Number(r.ownership_pct ?? 0);
      return {
        golferId: gid,
        golferName: name || "—",
        rosterSlots: Number.isFinite(slots) ? Math.max(0, Math.floor(slots)) : 0,
        ownershipPct: Number.isFinite(pct) ? pct : 0,
      };
    });
  } catch {
    return [];
  }
}
