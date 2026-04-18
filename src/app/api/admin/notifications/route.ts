import { getServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = getServiceClient();

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
