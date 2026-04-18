import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = getServiceClient();
    const body = (await req.json()) as {
      update_id?: string;
      user_id?: string | null;
      message?: string;
    };

    const { update_id, user_id, message } = body;

    if (!message || !String(message).trim()) {
      return NextResponse.json({ success: false, error: "Message required" }, { status: 400 });
    }

    const { error } = await supabase.from("update_responses").insert({
      update_id: update_id ?? null,
      user_id: user_id ?? null,
      message: String(message).trim(),
    });

    if (error) {
      console.error("update_responses insert:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailUser && emailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: "outlook",
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });

        await transporter.sendMail({
          from: emailUser,
          to: "cashcaddies@outlook.com",
          subject: "New CashCaddies Update Response",
          text: `User: ${user_id ?? "(none)"}\nUpdate: ${update_id ?? "(none)"}\n\n${String(message).trim()}`,
        });
      } catch (e) {
        console.error("Email failed", e);
      }
    } else {
      console.warn("respond: EMAIL_USER / EMAIL_PASS not set; skipping email");
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("respond POST:", e);
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
