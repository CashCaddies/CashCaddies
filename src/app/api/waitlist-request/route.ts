import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isProfileBetaApproved } from "@/lib/beta-profile-filters";
import { isAdminRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 2000;

async function collectStaffRecipientIds(admin: ReturnType<typeof getServiceClient>): Promise<string[]> {
  const [{ data: byRole }, { data: byFounder }] = await Promise.all([
    admin.from("profiles").select("id").in("role", ["admin", "senior_admin", "founder"]),
    admin.from("profiles").select("id").eq("is_founder", true),
  ]);

  const staffIds = new Set<string>();
  for (const r of [...(byRole ?? []), ...(byFounder ?? [])] as { id?: string }[]) {
    const id = String(r?.id ?? "").trim();
    if (id) staffIds.add(id);
  }
  return [...staffIds];
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.id) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    let message: string | null = null;
    try {
      const body = (await req.json()) as { message?: unknown };
      if (typeof body.message === "string") {
        const t = body.message.trim();
        message = t.length > 0 ? t.slice(0, MAX_MESSAGE) : null;
      }
    } catch {
      message = null;
    }

    const admin = getServiceClient();

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("email,username,beta_status,beta_user,role")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const role = typeof (profile as { role?: string }).role === "string" ? (profile as { role: string }).role : null;
    if (isAdminRole(role)) {
      return NextResponse.json({ error: "Staff accounts do not need waitlist access." }, { status: 400 });
    }

    const row = profile as {
      email?: string | null;
      username?: string | null;
      beta_status?: string | null;
      beta_user?: boolean | null;
    };
    if (isProfileBetaApproved({ beta_status: row.beta_status, beta_user: row.beta_user })) {
      return NextResponse.json({ error: "Your account already has beta access." }, { status: 400 });
    }

    const email =
      typeof row.email === "string" && row.email.trim() !== ""
        ? row.email.trim()
        : typeof user.email === "string" && user.email.trim() !== ""
          ? user.email.trim()
          : "";
    if (!email) {
      return NextResponse.json({ error: "Missing email on account." }, { status: 400 });
    }

    const handleRaw = typeof row.username === "string" ? row.username.trim() : "";
    const handle = handleRaw.length > 0 ? handleRaw : null;

    const { data: existing, error: existErr } = await admin
      .from("waitlist_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existErr) {
      console.error("waitlist-request duplicate check:", existErr);
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({ error: "Already pending" }, { status: 409 });
    }

    const recipients = await collectStaffRecipientIds(admin);
    if (!recipients?.length) {
      console.error("No admin recipients found for waitlist notification");
    }

    const { data: inserted, error: insErr } = await admin
      .from("waitlist_requests")
      .insert({
        user_id: user.id,
        email,
        handle,
        message,
        status: "pending",
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      if (String(insErr?.message ?? "").toLowerCase().includes("duplicate")) {
        return NextResponse.json({ error: "Already pending" }, { status: 409 });
      }
      console.error("waitlist-request insert:", insErr);
      return NextResponse.json({ error: insErr?.message ?? "Could not save request." }, { status: 500 });
    }

    const requestId = String((inserted as { id: string }).id);

    const { error: wlFlagErr } = await admin
      .from("profiles")
      .update({ beta_waitlist: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (wlFlagErr) {
      console.error("waitlist-request beta_waitlist flag:", wlFlagErr);
    }

    const handleLabel = handle ? `@${handle}` : "(no handle)";
    const title = "New waitlist access request";
    const bodyText = `${email} ${handleLabel} submitted a waitlist access request.${message ? ` Note: ${message}` : ""}`;

    if (recipients.length > 0) {
      const notifications = recipients.map((adminId) => ({
        user_id: adminId,
        kind: "waitlist_request",
        title,
        body: bodyText,
        metadata: { waitlist_request_id: requestId, requester_user_id: user.id },
      }));

      const { error: notifyError } = await admin.from("user_notifications").insert(notifications);
      if (notifyError) {
        console.error("Notification insert failed:", notifyError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/waitlist-request:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
