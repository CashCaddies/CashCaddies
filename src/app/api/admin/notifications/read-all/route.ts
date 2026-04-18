import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";

async function requireAdmin(req: Request): Promise<boolean> {
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const { data } = await supabaseAuth.auth.getUser(token);
  return data?.user?.email === "cashcaddies@outlook.com";
}

export async function PATCH(req: Request) {
  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase.from("update_responses").update({ is_read: true }).eq("is_read", false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
