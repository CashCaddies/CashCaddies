import { NextResponse } from "next/server";
import { verifyBearerAdmin } from "@/lib/auth/verifyBearerAdmin";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Aggregate admin counts and recent in-app notifications for the signed-in admin.
 * `waitlist` = pending in-app access requests (`waitlist_requests`).
 */
export async function GET(req: Request) {
  try {
    const auth = await verifyBearerAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = getServiceClient();

    const [pendingProfiles, unreadResponses, pendingWaitlist] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "pending"),
      admin.from("update_responses").select("id", { count: "exact", head: true }).eq("is_read", false),
      admin.from("waitlist_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const approvals = pendingProfiles.error ? 0 : Number(pendingProfiles.count ?? 0);
    const support = unreadResponses.error ? 0 : Number(unreadResponses.count ?? 0);
    const waitlist = pendingWaitlist.error ? 0 : Number(pendingWaitlist.count ?? 0);

    const { data: rows, error: listErr } = await admin
      .from("user_notifications")
      .select("id, user_id, kind, title, read_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    return NextResponse.json({
      approvals,
      support,
      waitlist,
      data: rows ?? [],
    });
  } catch (err) {
    console.error("GET /api/admin/notifications:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
