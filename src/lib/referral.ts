import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type ApplyReferralRpcResult = { ok: true } | { ok: false; error: string };

/** Client-side: uses the shared browser Supabase client (same pattern as other `/lib` helpers). */
export async function applyReferral(userId: string, code: string): Promise<ApplyReferralRpcResult> {
  return applyReferralWithClient(supabase, userId, code);
}

/**
 * When you already have a `SupabaseClient` (e.g. server `createClient()`), pass it here.
 * `apply_referral` requires the session to match `userId` unless using service role.
 */
export async function applyReferralWithClient(
  client: SupabaseClient,
  userId: string,
  code: string,
): Promise<ApplyReferralRpcResult> {
  const { data, error } = await client.rpc("apply_referral", {
    p_user_id: userId,
    p_code: code,
  });

  if (error) throw error;

  const row = data as { ok?: boolean; error?: string } | null;
  if (!row || typeof row.ok !== "boolean") {
    throw new Error("Unexpected apply_referral response");
  }

  if (row.ok) return { ok: true };
  return {
    ok: false,
    error: typeof row.error === "string" ? row.error : "unknown",
  };
}
