import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase.from("updates").select("*").order("created_at", { ascending: false });

    return NextResponse.json({ updates: data || [] });
  } catch (e) {
    console.error("updates GET:", e);
    return NextResponse.json({ updates: [], error: "Server configuration error" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  console.log("🔥 HIT /api/updates POST");

  try {
    console.log("=== /api/updates POST START ===");

    const body = await req.json();
    console.log("Incoming body:", body);

    console.log("ENV CHECK:");
    console.log("SUPABASE_URL:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("updates")
      .insert([
        {
          title: body.title,
          content: body.content,
          tag: body.tag || "general",
          time: body.time || "Now",
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
