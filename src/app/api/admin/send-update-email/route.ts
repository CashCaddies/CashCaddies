import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)" }, { status: 503 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).maybeSingle();

    if (!isAdmin(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { type?: unknown };
    const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";

    const { data: latest, error: latestErr } = await supabase
      .from("updates")
      .select("id, title, content, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      return NextResponse.json({ error: latestErr.message }, { status: 500 });
    }

    if (!latest) {
      return NextResponse.json({ error: "No updates to email" }, { status: 400 });
    }

    const subject = `CashCaddies — ${String(latest.title ?? "Update")}`;
    const html = `<pre style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui;">${String(
      latest.content ?? "",
    )}</pre>`;

    let to: string | string[] = "cashcaddies@outlook.com";

    if (type === "test") {
      to = process.env.RESEND_TEST_EMAIL || "cashcaddies@outlook.com";
    } else if (type === "admin") {
      const adminEmail = typeof profile?.email === "string" ? profile.email.trim() : "";
      if (!adminEmail) {
        return NextResponse.json({ error: "Missing admin email on profile" }, { status: 400 });
      }
      to = adminEmail;
    } else if (type === "all") {
      const { data: rows, error: usersErr } = await supabase.from("profiles").select("email").not("email", "is", null);

      if (usersErr) {
        return NextResponse.json({ error: usersErr.message }, { status: 500 });
      }

      const emails = (rows ?? [])
        .map((r) => (typeof (r as { email?: unknown }).email === "string" ? (r as { email: string }).email.trim() : ""))
        .filter(Boolean);

      if (emails.length === 0) {
        return NextResponse.json({ error: "No recipient emails found" }, { status: 400 });
      }

      to = emails;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from: "CashCaddies <updates@cashcaddies.com>",
      to,
      subject,
      html,
      replyTo: "cashcaddies@outlook.com",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updateId: latest.id, mode: type });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
