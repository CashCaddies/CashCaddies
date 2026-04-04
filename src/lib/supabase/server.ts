import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parsePublicSupabaseEnv } from "./env-public";

/**
 * Server Supabase client (@supabase/ssr) — uses Next.js cookies for auth session.
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

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Server Component — cookies may be read-only; middleware may refresh session */
        }
      },
    },
  });
}
