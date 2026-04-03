import { createClient } from "@/lib/supabase/server";

export type GolferRow = {
  id: string;
  name: string;
  salary: number;
  pga_id: string;
  image_url: string | null;
  fantasy_points?: number;
  /** Tee / round start for late-swap lock (optional until backfilled). */
  game_start_time?: string | null;
};

export async function fetchGolfersForLineup(): Promise<{
  golfers: GolferRow[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("golfers")
      .select("id,name,salary,pga_id,image_url")
      .order("salary", { ascending: false });

    if (error) {
      return { golfers: [], error: error.message };
    }
    return { golfers: (data ?? []) as GolferRow[], error: null };
  } catch {
    return {
      golfers: [],
      error: "Could not load golfers. Add Supabase env vars and run the golfers migration.",
    };
  }
}
