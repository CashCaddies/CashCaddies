import { supabase } from "@/lib/supabase/client";

export async function deleteContest(id: string) {
  if (!supabase) {
    return { message: "Supabase client is not available." };
  }
  const contestId = String(id ?? "").trim();
  if (!contestId) {
    return { message: "Missing contest id." };
  }
  const { error } = await supabase.from("contests").delete().eq("id", contestId);
  return error;
}
