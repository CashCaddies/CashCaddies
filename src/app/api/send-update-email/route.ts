import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { updateId } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data: update, error } = await supabase
      .from("founder_updates")
      .select("*")
      .eq("id", updateId)
      .single();

    if (error || !update) {
      return NextResponse.json({ error: "Update not found" }, { status: 400 });
    }

    const row = update as { message?: string | null; id: string };
    console.log("SENDING EMAIL FOR:", row.message?.slice(0, 120) ?? row.id);

    return NextResponse.json({
      success: true,
      update,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
