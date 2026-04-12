"use client"

import { createContext, useContext, useEffect } from "react"
import { supabase } from "./supabase/client"

const SupabaseContext = createContext(supabase)

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.href = "/dashboard"
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => useContext(SupabaseContext)
