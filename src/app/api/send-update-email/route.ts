import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { parseUpdate } from "@/utils/parseUpdate";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Title line for email subject — no leading "CashCaddies" (prefix adds it once). */
function subjectTitleFromParsed(title: string): string {
  let s = title.replace(/\s+/g, " ").trim();
  if (!s) {
    return "New Update";
  }
  // Strip repeated brand prefix so we never get "CashCaddies — CashCaddies …"
  for (let n = 0; n < 3; n++) {
    const stripped = s
      .replace(/^cashcaddies\s*([\u2014\-–—:]\s*)?/i, "")
      .replace(/^cashcaddies\s+/i, "")
      .trim();
    if (stripped === s) {
      break;
    }
    s = stripped;
  }
  return s || "New Update";
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

    const rawMessage = String(row.message ?? "");
    const parsed = parseUpdate(rawMessage);
    const headlineTitle =
      parsed.title && parsed.title.trim() ? parsed.title.trim() : "New Update";
    const subtitleEscaped = escapeHtml(headlineTitle);
    const bodySource = parsed.content?.trim() ? parsed.content : rawMessage;
    const bodyHtml = escapeHtml(bodySource).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");

    const title = subjectTitleFromParsed(headlineTitle);
    const subject = `CashCaddies — ${title} (${new Date().toLocaleDateString()})`;

    const html = `
  <div style="background:#0b1220;padding:40px 20px;font-family:Arial,sans-serif;">
    
    <div style="max-width:600px;margin:0 auto;background:#111827;border-radius:12px;padding:30px;border:1px solid #1f2937;">
      
      <!-- HEADER -->
      <h1 style="color:#22c55e;margin-bottom:10px;">
        CashCaddies Update
      </h1>

      <p style="color:#9ca3af;margin-bottom:25px;">
        ${subtitleEscaped}
      </p>

      <hr style="border:none;border-top:1px solid #1f2937;margin:20px 0;" />

      <div style="
  margin-bottom:20px;
  padding:12px;
  background:linear-gradient(90deg,#22c55e,#eab308);
  color:#000;
  font-weight:bold;
  text-align:center;
  border-radius:6px;
  font-size:14px;
">
  Message From The Owner
</div>

      <!-- BODY -->
      <div style="color:#e5e7eb;line-height:1.6;font-size:15px;">
        ${bodyHtml}
      </div>

<div style="margin-top:24px;margin-bottom:24px;">
  <div style="text-align:center;">
    <a href="https://cashcaddies.com"
       style="
         color:#22c55e;
         font-weight:bold;
         text-decoration:underline;
         font-size:15px;
       ">
       Create your account &amp; request beta access
    </a>
  </div>

  <div style="text-align:center;margin-top:16px;">
    <a href="https://cashcaddies.com"
       style="
         display:inline-block;
         padding:14px 28px;
         border-radius:10px;
         font-weight:600;
         text-decoration:none;
         color:#02120b;
         background:linear-gradient(90deg,#22c55e,#eab308);
       ">
       Enter CashCaddies
    </a>
  </div>
</div>

      <!-- FOOTER -->
      <p style="margin-top:30px;color:#6b7280;font-size:12px;text-align:center;">
        © ${new Date().getFullYear()} CashCaddies
      </p>

      <div style="display:none;max-height:0;overflow:hidden;">
        CashCaddies Update CashCaddies Update CashCaddies Update
        Premium Golf DFS Platform CashCaddies.com
      </div>

    </div>
  </div>
`;

    const BATCH_SIZE = 10;

    const isDev = process.env.NODE_ENV !== "production";

    const testEmail = process.env.RESEND_TEST_EMAIL || "koepsell1992@gmail.com";

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    if (isDev) {
      try {
        const { error } = await resend.emails.send({
          from: "CashCaddies <updates@cashcaddies.com>",
          to: testEmail,
          subject,
          html,
          reply_to: "cashcaddies@outlook.com",
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

      return NextResponse.json({ success: true, sent: 1, mode: "dev" });
    }

    for (let i = 0; i < limitedEmails.length; i += BATCH_SIZE) {
      const batch = limitedEmails.slice(i, i + BATCH_SIZE);

      for (const email of batch) {
        try {
          const { error } = await resend.emails.send({
            from: "CashCaddies <updates@cashcaddies.com>",
            to: email,
            subject,
            html,
            reply_to: "cashcaddies@outlook.com",
          });

          await sleep(250);

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
