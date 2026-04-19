import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // sessionStorage: not persisted after browser close; survives refresh. (`persistSession: false` is in-memory only and drops session on reload.)
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
  },
});
