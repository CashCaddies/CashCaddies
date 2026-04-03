import { createBrowserClient } from "@supabase/ssr";
import { parsePublicSupabaseEnv } from "./env-public";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

let loggedDevEnv = false;

/**
 * Browser-only Supabase client. Reads `NEXT_PUBLIC_*` from **this module** so Next.js inlines
 * values into the client bundle (required for Turbopack / dev with `.env.local`).
 * Validation matches `requirePublicSupabaseEnv()` via `parsePublicSupabaseEnv`.
 */
export function createClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  const env = parsePublicSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!env) {
    return null;
  }

  if (process.env.NODE_ENV === "development" && !loggedDevEnv) {
    loggedDevEnv = true;
    console.log("[Supabase browser] public env loaded", {
      url: env.url,
      anonKeyPrefix: `${env.key.slice(0, 8)}…`,
    });
  }

  browserClient = createBrowserClient(env.url, env.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
}

/** Eager singleton for client components; null on server or if env is invalid. */
export const supabase = createClient();
