import { createClient } from "@/lib/supabase/server";
import { verifyBearerAdmin } from "@/lib/auth/verifyBearerAdmin";

export async function GET(req: Request) {
  const auth = await verifyBearerAdmin(req);
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
  }

  const supabase = await createClient();

  const [approvals, support, bugs] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_beta_tester", false),
    supabase.from("update_responses").select("*", { count: "exact", head: true }).eq("is_read", false),
    supabase.from("update_responses").select("*", { count: "exact", head: true }).eq("tag", "bug").eq("is_read", false),
  ]);

  return new Response(
    JSON.stringify({
      approvals: approvals.count || 0,
      support: support.count || 0,
      bugs: bugs.count || 0,
    }),
    { status: 200 },
  );
}
