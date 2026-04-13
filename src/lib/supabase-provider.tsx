"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createContext, useContext } from "react";

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
  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext);
