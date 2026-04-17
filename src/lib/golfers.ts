import { supabase } from "@/lib/supabase/client";

export type GolferRow = {
  id: string;
  name: string;
  salary: number;
  fantasy_points?: number | null;
  withdrawn?: boolean | null;
  pga_id?: string;
  image_url?: string | null;
};

export async function fetchGolfersForLineup(): Promise<{
  golfers: GolferRow[];
  error: string | null;
}> {
  try {
        const { data, error } = await supabase
      .from("golfers")
      .select("id,name,salary,fantasy_points,withdrawn")
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
