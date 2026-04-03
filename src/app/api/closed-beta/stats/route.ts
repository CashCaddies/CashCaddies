import { NextResponse } from "next/server";
import { APP_CONFIG_DEFAULT_MAX_BETA_USERS, getBetaCapacitySnapshot } from "@/lib/config";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({
      approved: 0,
      waiting: 0,
      founders: 0,
      maxBetaUsers: APP_CONFIG_DEFAULT_MAX_BETA_USERS,
      approvedUsers: [],
    });
  }

  try {
    const [cap, waitingRes, foundersRes, approvedUsersRes] = await Promise.all([
      getBetaCapacitySnapshot(admin),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "pending"),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("founding_tester", true),
      admin
        .from("profiles")
        .select("username,email")
        .eq("beta_status", "approved")
        .order("created_at", { ascending: true }),
    ]);

    const approved = cap.approvedCount;
    const maxBetaUsers = cap.maxBetaUsers;
    const waiting = waitingRes.error ? 0 : Number(waitingRes.count ?? 0);
    const founders = foundersRes.error ? 0 : Number(foundersRes.count ?? 0);
    const approvedUsers = approvedUsersRes.error
      ? []
      : (approvedUsersRes.data ?? []).map((u) => ({
          username: typeof u.username === "string" ? u.username : "",
          email: typeof u.email === "string" ? u.email : "",
        }));

    return NextResponse.json({ approved, waiting, founders, maxBetaUsers, approvedUsers });
  } catch {
    return NextResponse.json({
      approved: 0,
      waiting: 0,
      founders: 0,
      maxBetaUsers: APP_CONFIG_DEFAULT_MAX_BETA_USERS,
      approvedUsers: [],
    });
  }
}

