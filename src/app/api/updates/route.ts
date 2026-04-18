import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

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
  try {
    const supabase = getServiceClient();
    const body = (await req.json()) as Record<string, unknown>;
    const row = {
      title: body.title,
      content: body.content,
      tag: body.tag,
      time: body.time,
    };

    const { error } = await supabase.from("updates").insert(row);

    if (error) {
      console.error("updates POST:", error);
      return NextResponse.json({ success: false });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("updates POST:", e);
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
