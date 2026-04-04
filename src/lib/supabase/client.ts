import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (@supabase/ssr).
 * Single instance; `createClient()` returns the same reference for call sites that expect a factory.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function createClient() {
  return supabase;
}
