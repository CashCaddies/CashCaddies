import { supabase } from "@/lib/supabase/client";

export type DraftLineupPlayer = {
  id: string;
  name: string;
  /** From draft save — user can change at entry time */
  is_protected: boolean;
};

export type DraftLineupSummary = {
  id: string;
  created_at: string;
  total_salary: number;
  protection_enabled: boolean;
  golfer_names: string[];
  players: DraftLineupPlayer[];
};

export async function fetchDraftLineupsForContest(contestId: string): Promise<{
  lineups: DraftLineupSummary[];
  error: string | null;
}> {
  const id = contestId?.trim();
  if (!id || id === "default") {
    return { lineups: [], error: null };
  }

  try {
        const select = `
        id,
        created_at,
        total_salary,
        protection_enabled,
        lineup_players (
          golfer_id,
          is_protected,
          golfers ( id, name )
        )
      `;
    const [forContest, unassigned] = await Promise.all([
      supabase
        .from("lineups")
        .select(select)
        .eq("contest_id", id)
        .is("contest_entry_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("lineups")
        .select(select)
        .is("contest_id", null)
        .is("contest_entry_id", null)
        .order("created_at", { ascending: false }),
    ]);

    if (forContest.error) {
      return { lineups: [], error: forContest.error.message };
    }
    if (unassigned.error) {
      return { lineups: [], error: unassigned.error.message };
    }

    type DraftQueryRow = {
      id: string;
      created_at: string;
      total_salary: number;
      protection_enabled: boolean | null;
      lineup_players: Array<{
        golfer_id: string;
        is_protected: boolean | null;
        golfers: { id: string; name: string } | { id: string; name: string }[] | null;
      }> | null;
    };
    const byId = new Map<string, DraftQueryRow>();
    for (const row of [...(forContest.data ?? []), ...(unassigned.data ?? [])]) {
      const r = row as unknown as DraftQueryRow;
      byId.set(r.id, r);
    }
    const rows = [...byId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const lineups: DraftLineupSummary[] = rows.map((row) => {
      const lp = row.lineup_players ?? [];
      const players: DraftLineupPlayer[] = lp
        .map((p) => {
          const raw = p.golfers;
          if (!raw) return null;
          const g = Array.isArray(raw) ? raw[0] : raw;
          if (!g?.id || !g.name) return null;
          return {
            id: g.id,
            name: g.name,
            is_protected: Boolean(p.is_protected),
          };
        })
        .filter((p): p is DraftLineupPlayer => p !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      const golfer_names = players.map((p) => p.name);
      return {
        id: row.id,
        created_at: row.created_at,
        total_salary: Number(row.total_salary ?? 0),
        protection_enabled: Boolean(row.protection_enabled),
        golfer_names,
        players,
      };
    });

    return { lineups, error: null };
  } catch (e) {
    return {
      lineups: [],
      error: e instanceof Error ? e.message : "Could not load saved lineups.",
    };
  }
}
