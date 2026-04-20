import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FOUNDER_BROADCAST_EMAIL = "cashcaddies@outlook.com";

type FounderUpdateRow = {
  message?: string | null;
  visibility?: string | null;
};

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)" }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { updateId } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: userData, error: authUserError } = await supabaseAuth.auth.getUser(token);

    if (authUserError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    const metaRole = userData.user.user_metadata?.role;
    const userRole =
      typeof callerProfile?.role === "string" && callerProfile.role.trim() !== ""
        ? callerProfile.role.trim().toLowerCase()
        : typeof metaRole === "string"
          ? metaRole.toLowerCase().trim()
          : "user";

    const callerEmail = userData.user.email?.trim().toLowerCase() ?? "";
    const canSend =
      callerEmail === FOUNDER_BROADCAST_EMAIL ||
      ["admin", "senior_admin", "founder"].includes(userRole);

    if (!canSend) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: update, error } = await supabase
      .from("founder_updates")
      .select("*")
      .eq("id", updateId)
      .single();

    if (error || !update) {
      return NextResponse.json({ error: "Update not found" }, { status: 400 });
    }

    const row = update as FounderUpdateRow;

    console.log("USING VISIBILITY:", row.visibility);

    const effectiveAudience = row.visibility || "public";

    const allowed = ["public", "members", "staff", "founders"];

    if (!allowed.includes(effectiveAudience)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }

    console.log("EFFECTIVE AUDIENCE:", effectiveAudience);

    let query = supabase.from("profiles").select("email, role");

    if (effectiveAudience === "staff") {
      query = query.in("role", ["admin", "senior_admin"]);
    } else if (effectiveAudience === "founders") {
      query = query.eq("role", "founder");
    } else if (effectiveAudience === "members") {
      query = query.eq("role", "user");
    } else if (effectiveAudience === "public") {
      // send to all users (no extra filter)
    }

    const { data: users, error: usersError } = await query;

    if (usersError || !users) {
      return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
    }

    const emails = users.map((u) => u.email).filter(Boolean) as string[];

    const limitedEmails = emails.slice(0, 50); // prevent blast

    console.log("RECIPIENT COUNT:", limitedEmails.length);

    if (limitedEmails.length === 0) {
      return NextResponse.json({ error: "No recipient emails" }, { status: 400 });
    }

    const bodyHtml = escapeHtml(String(row.message ?? "")).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");

    const emailHtml = `
      <h2>CashCaddies Update</h2>
      <p>${bodyHtml}</p>
      <br/>
      <a href="https://cashcaddies.com">View Platform</a>
    `;

    const BATCH_SIZE = 10;

    const isDev = process.env.NODE_ENV !== "production";

    if (isDev && !process.env.RESEND_TEST_EMAIL?.trim()) {
      return NextResponse.json(
        { error: "RESEND_TEST_EMAIL is required in development" },
        { status: 503 },
      );
    }

    for (let i = 0; i < limitedEmails.length; i += BATCH_SIZE) {
      const batch = limitedEmails.slice(i, i + BATCH_SIZE);

      for (const email of batch) {
        try {
          const { data, error } = await resend.emails.send({
            from: "CashCaddies <updates@cashcaddies.com>",
            to: isDev ? process.env.RESEND_TEST_EMAIL! : email,
            subject: "CashCaddies Update",
            html: emailHtml,
          });

          if (error) {
            console.error("RESEND ERROR:", error);
            return NextResponse.json({ error: error.message || "Email failed" }, { status: 500 });
          }
        } catch (err) {
          console.error("SEND THROW ERROR:", err);
          const message =
            err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
          return NextResponse.json({ error: message || "Email failed" }, { status: 500 });
        }
      }

      console.log("SENT BATCH:", i / BATCH_SIZE + 1);
    }

    return NextResponse.json({
      success: true,
      sent: limitedEmails.length,
      visibility: effectiveAudience,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
