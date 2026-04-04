"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True after the initial session has been read from Supabase (client is usable for gated UI). */
  isReady: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Single app-wide auth surface: one `getSession` on mount + one `onAuthStateChange` subscription.
 * Pages and hooks should use `useAuth()` instead of calling Supabase auth per screen.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!cancelled) {
          setSession(data.session ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, s: Session | null) => {
      setSession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isReady,
    }),
    [session, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
