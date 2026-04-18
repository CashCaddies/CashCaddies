import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";

const FOUNDER_EMAIL = "cashcaddies@outlook.com";

function getSupabaseAuth() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function requireFounderUpdatesAccess(req: Request): Promise<Response | null> {
  const supabaseAuth = getSupabaseAuth();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: "No auth" }), { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ success: false, error: "Invalid user" }), { status: 401 });
  }

  const email = userData.user.email;

  if (email !== FOUNDER_EMAIL) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 403 });
  }

  return null;
}

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase.from("founder_updates").select("*").order("created_at", { ascending: false });

    const formatted =
      data?.map((u) => ({
        id: u.id,
        title: "Update",
        content: u.message,
        created_at: u.created_at,
      })) ?? [];

    return NextResponse.json({ updates: formatted });
  } catch (e) {
    console.error("updates GET:", e);
    return NextResponse.json({ updates: [], error: "Server configuration error" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  console.log("🔥 HIT /api/updates POST");

  try {
    const denied = await requireFounderUpdatesAccess(req);
    if (denied) return denied;

    console.log("=== /api/updates POST START ===");

    const body = await req.json();
    console.log("Incoming body:", body);

    console.log("ENV CHECK:");
    console.log("SUPABASE_URL:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("founder_updates")
      .insert([
        {
          message: body.content || body.title,
        },
      ])
      .select();

    console.log("Supabase response:", { data, error });

    if (error) {
      console.error("INSERT ERROR:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
    });
  } catch (err: any) {
    console.error("SERVER CRASH:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const denied = await requireFounderUpdatesAccess(req);
    if (denied) return denied;

    const body = await req.json();
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("founder_updates")
      .update({
        message: body.message,
      })
      .eq("id", body.id)
      .select();

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await requireFounderUpdatesAccess(req);
    if (denied) return denied;

    const { id } = await req.json();
    const supabase = getServiceClient();

    const { error } = await supabase.from("founder_updates").delete().eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
