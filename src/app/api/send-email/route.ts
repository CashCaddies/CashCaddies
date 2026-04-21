import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: body.to,
      subject: body.subject,
      html: body.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
