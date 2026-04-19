import { getServiceClient } from "@/lib/supabase/service";
import { verifyBearerAdmin } from "@/lib/auth/verifyBearerAdmin";

export async function PATCH(req: Request) {
  const auth = await verifyBearerAdmin(req);
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
  }

  const supabase = getServiceClient();

  const { error } = await supabase.from("update_responses").update({ is_read: true }).eq("is_read", false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
