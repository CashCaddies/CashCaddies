import { supabase } from "@/lib/supabase/client";

export async function createContest(contest: any) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("contests")
    .insert({
      name: contest.name,
      entry_fee: contest.entry_fee,
      max_entries: contest.max_entries,
      start_time: contest.start_time,
      status: "filling",
      entry_count: 0,
    })
    .select();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

