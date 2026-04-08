import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Live `COUNT(*)` from `contest_entries` via `public.contest_entry_count` (SECURITY DEFINER).
 * Avoids stale `contests.entry_count` / `current_entries` and works under RLS for lobby UIs.
 */
export async function fetchContestEntryCountLive(
  client: SupabaseClient,
  contestId: string,
): Promise<number> {
  const id = contestId?.trim();
  if (!id) return 0;
  const { data, error } = await client.rpc("contest_entry_count", { p_contest_id: id });
  if (error) return 0;
  return Math.max(0, Number(data ?? 0));
}

export async function fetchContestEntryCountsLive(
  client: SupabaseClient,
  contestIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(contestIds.map((x) => String(x ?? "").trim()).filter(Boolean))];
  const map = new Map<string, number>();
  await Promise.all(
    unique.map(async (cid) => {
      const n = await fetchContestEntryCountLive(client, cid);
      map.set(cid, n);
    }),
  );
  return map;
}
