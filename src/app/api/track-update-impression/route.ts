import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    },
  );

  let body: { updateId?: string; sessionId?: string };
  try {
    body = (await req.json()) as { updateId?: string; sessionId?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { updateId, sessionId: sessionIdFromBody } = body;
  if (!updateId || typeof updateId !== "string" || updateId.trim() === "") {
    return NextResponse.json({ success: false, error: "updateId required" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session_id =
    typeof sessionIdFromBody === "string" && sessionIdFromBody.trim() !== ""
      ? sessionIdFromBody.trim()
      : crypto.randomUUID();

  const { error } = await supabase.from("update_impressions").insert({
    update_id: updateId.trim(),
    user_id: user?.id ?? null,
    session_id,
  });

  if (error) {
    console.error("update_impressions insert:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
