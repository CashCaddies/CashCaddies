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

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)" }, { status: 503 });
    }

    const { updateId, audience } = await req.json();

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

    let query = supabase.from("profiles").select("email, role");

    if (audience === "staff") {
      query = query.eq("role", "staff");
    } else if (audience === "founders") {
      query = query.eq("role", "founder");
    } else if (audience === "misc") {
      query = query.eq("role", "misc");
    }

    const { data: users, error: usersError } = await query;

    if (usersError || !users) {
      return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
    }

    const emails = users.map((u) => u.email).filter(Boolean) as string[];

    const limitedEmails = emails.slice(0, 50); // prevent blast

    if (limitedEmails.length === 0) {
      return NextResponse.json({ error: "No recipient emails" }, { status: 400 });
    }

    const row = update as { message?: string | null };
    const bodyHtml = escapeHtml(String(row.message ?? "")).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");

    const emailHtml = `
      <h2>CashCaddies Update</h2>
      <p>${bodyHtml}</p>
      <br/>
      <a href="https://cashcaddies.com">View Platform</a>
    `;

    const { data, error: emailError } = await resend.emails.send({
      from: "CashCaddies <onboarding@resend.dev>",
      to: limitedEmails,
      subject: "CashCaddies Update",
      html: emailHtml,
    });

    if (emailError) {
      console.error(emailError);
      return NextResponse.json({ error: "Email failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
