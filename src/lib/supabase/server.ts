import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parsePublicSupabaseEnv } from "./env-public";

/**
 * TEMP STABILIZATION MODE:
 * SSR auth disabled to stabilize development.
 * Browser auth only.
 * Will re-enable server auth after beta stability.
 */
export async function createClient() {
  const env = parsePublicSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!env) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (see server console).",
    );
  }

  const supabaseUrl = env.url;
  const supabaseAnonKey = env.key;
  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Disable server auth fetches during stabilization to prevent retry loops / ENOTFOUND noise.
  const authAny = client.auth as unknown as {
    getUser: () => Promise<unknown>;
    getSession: () => Promise<unknown>;
    refreshSession: () => Promise<unknown>;
    signOut: () => Promise<unknown>;
  };
  authAny.getUser = async () => ({ data: { user: null }, error: null });
  authAny.getSession = async () => ({ data: { session: null }, error: null });
  authAny.refreshSession = async () => ({ data: { session: null, user: null }, error: null });
  authAny.signOut = async () => ({ error: null });

  return client;
}
