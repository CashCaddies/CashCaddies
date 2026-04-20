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

type FounderUpdateRow = {
  message?: string | null;
  visibility?: string | null;
};

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)" }, { status: 503 });
    }

    const { updateId } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

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

    for (const email of limitedEmails) {
      const { error: emailError } = await resend.emails.send({
        from: "CashCaddies <onboarding@resend.dev>",
        to: email,
        subject: "CashCaddies Update",
        html: emailHtml,
      });

      if (emailError) {
        console.error(emailError);
        return NextResponse.json({ error: "Email failed" }, { status: 500 });
      }
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
