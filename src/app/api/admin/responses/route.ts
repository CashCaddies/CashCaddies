import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service env");
  return createClient(url, key);
}

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase anon env");
  return createClient(url, key);
}

type AdminAuthResult = { ok: true } | { ok: false; response: NextResponse };

async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseUser = getAnonClient();
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser(token);

  if (userErr || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabaseUser.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(profile?.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true };
}

// GET all responses
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const admin = getServiceClient();
    const { data, error } = await admin
      .from("update_responses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("admin responses:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ responses: data ?? [] });
  } catch (e) {
    console.error("GET /api/admin/responses:", e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}

// UPDATE (mark read / reply)
export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as { id?: string; is_read?: boolean; admin_reply?: string | null };
    const { id, is_read, admin_reply } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof is_read === "boolean") patch.is_read = is_read;
    if (admin_reply !== undefined) patch.admin_reply = admin_reply;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const admin = getServiceClient();
    const { data: updated, error } = await admin
      .from("update_responses")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      console.error("PATCH /api/admin/responses:", error);
      return NextResponse.json({ success: false, error: error?.message ?? "Not found" }, { status: error ? 500 : 404 });
    }

    // If reply exists → send email (body included a non-empty admin_reply)
    if (admin_reply) {
      try {
        const uid = updated.user_id as string | null | undefined;
        if (uid) {
          const { data: userData, error: userErr } = await admin.auth.admin.getUserById(uid);
          if (userErr) {
            console.error("getUserById:", userErr);
          }

          const userEmail = userData?.user?.email;
          if (userEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
              service: "outlook",
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });

            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: userEmail,
              subject: "CashCaddies — Response to Your Feedback",
              text: `You received a reply from CashCaddies:\n\n${admin_reply}\n\n— CashCaddies`,
            });
          }
        }
      } catch (e) {
        console.error("Reply email failed:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH /api/admin/responses:", e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}

// DELETE
export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as { id?: string };
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const admin = getServiceClient();
    const { error } = await admin.from("update_responses").delete().eq("id", id);

    if (error) {
      console.error("DELETE /api/admin/responses:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/admin/responses:", e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}
