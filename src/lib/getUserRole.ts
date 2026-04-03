import { supabase } from "@/lib/supabase";

export async function getUserRole(userId: string): Promise<string> {
  const uid = String(userId ?? "").trim();
  if (!uid || !supabase) return "user";
  const { data, error } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (error) return "user";
  const role = String(data?.role ?? "").trim().toLowerCase();
  return role || "user";
}
