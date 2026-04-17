/**
 * Public Supabase config: only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * URL must parse as a full http(s) URL string (trimmed).
 */

export type PublicSupabaseEnv = { url: string; key: string };

let loggedPublicSupabaseEnvIssue = false;

function warnOnce(message: string): void {
  if (loggedPublicSupabaseEnvIssue) return;
  loggedPublicSupabaseEnvIssue = true;
  console.error(message);
}

/**
 * Validates raw env values (shared by server and browser client).
 * Browser code should call this with `process.env.NEXT_PUBLIC_*` from `client.ts` so Next.js
 * inlines those vars into the client chunk (Turbopack/Webpack-safe).
 */
export function parsePublicSupabaseEnv(
  urlRaw: string | undefined,
  keyRaw: string | undefined,
): PublicSupabaseEnv | null {
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  const key = typeof keyRaw === "string" ? keyRaw.trim() : "";

  if (!url || !key) {
    warnOnce(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set both in your environment and restart the dev server.",
    );
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      warnOnce(
        "[Supabase] Invalid NEXT_PUBLIC_SUPABASE_URL: must be a full URL using http: or https:.",
      );
      return null;
    }
  } catch {
    warnOnce("[Supabase] Invalid NEXT_PUBLIC_SUPABASE_URL: must be a full URL string.");
    return null;
  }

  return { url, key };
}

/**
 * Returns trimmed URL and anon key, or null if missing/invalid.
 * Emits a single console.error for the first failure in this process.
 */
export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  return parsePublicSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function requirePublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (see server console).",
    );
  }
  return env;
}
