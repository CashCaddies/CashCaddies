import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { updateId } = await req.json();

    if (!updateId) {
      return new Response(JSON.stringify({ error: "Missing updateId" }), { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data: update, error } = await supabase
      .from("founder_updates")
      .select("id, message")
      .eq("id", updateId)
      .single();

    if (error || !update) {
      return new Response(JSON.stringify({ error: "Update not found" }), { status: 404 });
    }

    console.log("SEND EMAIL:", (update as { message?: string }).message ?? update.id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("send-update-email error:", err);
    return new Response(JSON.stringify({ error: "server error" }), { status: 500 });
  }
}
