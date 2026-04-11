import { createBrowserClient } from "@supabase/ssr";

/**
 * Single browser Supabase client for the whole app. Import this — do not call
 * createBrowserClient elsewhere (avoids NavigatorLockAcquireTimeoutError from multiple auth locks).
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
