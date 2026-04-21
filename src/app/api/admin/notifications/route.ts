import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyBearerAdmin } from "@/lib/auth/verifyBearerAdmin";

export async function GET(req: Request) {
  try {
    const auth = await verifyBearerAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.from("user_notifications").select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
