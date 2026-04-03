import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | null = null;

/**
 * Browser-oriented Supabase client (also used where this module is imported on the server).
 * Reads `NEXT_PUBLIC_*` from this module so Next.js inlines env into the client bundle.
 *
 * Returns `null` when URL/key are missing so callers can degrade gracefully; does not throw.
 */
export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) {
    return null;
  }

  if (!singleton) {
    singleton = createSupabaseClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return singleton;
}

/** Resolved at module load; `null` if public env is not configured (safe for `if (!supabase)`). */
export const supabase = createClient();
