import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";

type AdminAuthResult = { email: string } | { error: string; status: number };

function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  return (async () => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { error: "No auth", status: 401 };

    const { data } = await supabaseAuth.auth.getUser(token);
    const email = data?.user?.email;

    if (email !== "cashcaddies@outlook.com") {
      return { error: "Unauthorized", status: 403 };
    }

    return { email };
  })();
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
  }

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
