import { supabase } from "@/lib/supabase/client";

/** Browser Supabase client (singleton). */
export function createClient() {
  return supabase;
}
