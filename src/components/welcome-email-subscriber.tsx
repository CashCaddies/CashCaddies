"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import { requestWelcomeEmail } from "@/app/auth/welcome-email-action";
import { createClient } from "@/lib/supabase/client";

const WELCOME_TRIGGER_EVENTS: AuthChangeEvent[] = [
  "INITIAL_SESSION",
  "SIGNED_IN",
  "TOKEN_REFRESHED",
  "USER_UPDATED",
];

/**
 * After email confirmation, Supabase establishes a session in the browser.
 * We request the welcome email once server-side (idempotent via profiles.welcome_email_sent).
 * Failures are swallowed on the server; login is never blocked.
 */
export function WelcomeEmailSubscriber() {
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    function maybeSend(session: { access_token: string; user: { email_confirmed_at?: string | null } } | null) {
      if (!session?.access_token || !session.user?.email_confirmed_at) return;
      void requestWelcomeEmail(session.access_token);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!WELCOME_TRIGGER_EVENTS.includes(event)) return;
      maybeSend(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
