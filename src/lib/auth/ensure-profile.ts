import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Ensures `public.profiles` has a row for this user (service role bypasses RLS).
 * Safe to call when env is missing (no-op). Idempotent.
 */
export async function ensureProfileRowForUser(userId: string, email: string | undefined): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;

  const { data: existing, error: selectErr } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (selectErr) {
    console.error("ensureProfileRowForUser select:", selectErr);
    return;
  }
  if (existing) return;

  const { error: insertErr } = await admin.from("profiles").insert({
    id: userId,
    email: email ?? null,
  });

  if (insertErr) {
    if (insertErr.code === "23505") return;
    console.error("ensureProfileRowForUser insert:", insertErr);
  }
}
