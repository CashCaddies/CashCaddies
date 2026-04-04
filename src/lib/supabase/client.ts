import { supabase } from "../supabase";

export { supabase };

export function createClient() {
  return supabase;
}
