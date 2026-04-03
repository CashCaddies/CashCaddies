"use server";

import { createClient } from "@supabase/supabase-js";
import { parsePublicSupabaseEnv } from "@/lib/supabase/env-public";
import { sendWelcomeEmailForUserIfNeeded } from "@/lib/send-welcome-email";

/**
 * Invoked from the client after a confirmed user has a session (e.g. post email verification).
 * Validates the access token with Supabase; never throws to callers.
 */
export async function requestWelcomeEmail(accessToken: string): Promise<void> {
  const token = accessToken?.trim();
  if (!token) return;

  try {
    const env = parsePublicSupabaseEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!env) return;

    const supabase = createClient(env.url, env.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user?.email_confirmed_at || !user.email) {
      return;
    }

    await sendWelcomeEmailForUserIfNeeded(user.id, user.email);
  } catch {
    /* never block login */
  }
}
