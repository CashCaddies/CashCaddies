import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures a `profiles` row exists for the given auth user. Safe to call repeatedly.
 * Does not throw — callers rely on counts/UI even if insert fails (RLS, etc.).
 */
export async function ensureProfileRowForUser(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existing) return;
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      beta_status: "pending",
      beta_user: false,
      founding_tester: false,
    });
    if (error && error.code !== "23505") {
      console.error("[ensureProfileRowForUser]", error.message);
    }
  } catch (e) {
    console.error("[ensureProfileRowForUser]", e);
  }
}
