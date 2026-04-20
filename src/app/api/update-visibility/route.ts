import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";

const FOUNDER_EMAIL = "cashcaddies@outlook.com";

const ALLOWED = new Set(["public", "members", "staff", "founders"]);

function getSupabaseAuth() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function requireFounderUpdatesAccess(req: Request): Promise<Response | null> {
  const supabaseAuth = getSupabaseAuth();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "No auth" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid user" }, { status: 401 });
  }

  if (userData.user.email !== FOUNDER_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const denied = await requireFounderUpdatesAccess(req);
    if (denied) return denied;

    const { updateId, visibility } = await req.json();

    if (!updateId || typeof visibility !== "string" || !ALLOWED.has(visibility)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { error } = await supabase.from("founder_updates").update({ visibility }).eq("id", updateId);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
