"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createContext, useContext, useEffect } from "react";

/** Single browser client — module scope only; never inside the component body. */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const SupabaseContext = createContext(supabase);

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.href = "/dashboard";
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext);
