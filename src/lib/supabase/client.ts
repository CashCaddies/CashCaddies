import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let singleton: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Browser-oriented Supabase client (also used where this module is imported on the server).
 * Reads `NEXT_PUBLIC_*` from this module so Next.js inlines env into the client bundle.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) {
    throw new Error("Supabase env missing");
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

export const supabase = createClient();
