import { createClient } from "@supabase/supabase-js";

/** Server-only API routes / Node — uses `SUPABASE_SERVICE_ROLE_KEY`. Do not import from client code. */
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
