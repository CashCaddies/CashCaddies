"use server";

import { revalidatePath } from "next/cache";
import { getAdminClientContext } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type WaitlistRequestRow = {
  id: string;
  user_id: string;
  email: string;
  handle: string | null;
  status: string;
  message: string | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type ListWaitlistRequestsResult =
  | { ok: true; rows: WaitlistRequestRow[] }
  | { ok: false; error: string };

export async function listWaitlistRequestsForAdmin(): Promise<ListWaitlistRequestsResult> {
  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data, error } = await admin
    .from("waitlist_requests")
    .select("id,user_id,email,handle,status,message,requested_at,reviewed_at,reviewed_by")
    .order("requested_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id ?? ""),
    user_id: String(r.user_id ?? ""),
    email: typeof r.email === "string" ? r.email : "",
    handle: r.handle != null ? String(r.handle) : null,
    status: typeof r.status === "string" ? r.status : "pending",
    message: r.message != null ? String(r.message) : null,
    requested_at: typeof r.requested_at === "string" ? r.requested_at : "",
    reviewed_at: r.reviewed_at != null ? String(r.reviewed_at) : null,
    reviewed_by: r.reviewed_by != null ? String(r.reviewed_by) : null,
  }));

  rows.sort((a, b) => {
    const pa = a.status === "pending" ? 0 : 1;
    const pb = b.status === "pending" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
  });

  return { ok: true, rows };
}

export type ReviewWaitlistRequestResult = { ok: true } | { ok: false; error: string };

/**
 * Admin-only: mark `waitlist_requests` approved/rejected, and on approve unlock the user via
 * canonical profile beta fields (same outcome as approving via the admin waitlist).
 */
export async function reviewWaitlistRequest(
  requestId: string,
  decision: "approve" | "reject",
): Promise<ReviewWaitlistRequestResult> {
  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const rid = String(requestId ?? "").trim();
  if (!rid) {
    return { ok: false, error: "Invalid request id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: row, error: fetchErr } = await admin
    .from("waitlist_requests")
    .select("id,user_id,status")
    .eq("id", rid)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message ?? "Request not found." };
  }

  const rowUserId = (row as { user_id?: string | null }).user_id;
  if (rowUserId == null || String(rowUserId).trim() === "") {
    console.error("Missing user_id on waitlist request:", rid);
    return { ok: false, error: "Invalid request" };
  }

  const st = String((row as { status?: string }).status ?? "").toLowerCase();
  if (st !== "pending") {
    return { ok: false, error: "This request was already reviewed." };
  }

  const targetUserId = String(rowUserId).trim();

  const now = new Date().toISOString();
  const nextStatus = decision === "approve" ? "approved" : "rejected";

  const { data: updatedRows, error: wlErr } = await admin
    .from("waitlist_requests")
    .update({
      status: nextStatus,
      reviewed_at: now,
      reviewed_by: auth.userId,
    })
    .eq("id", rid)
    .eq("status", "pending")
    .select("id");

  if (wlErr) {
    console.error("waitlist_requests update:", wlErr);
    return { ok: false, error: wlErr.message };
  }
  if (!updatedRows?.length) {
    return { ok: false, error: "Request was already reviewed or could not be updated." };
  }

  if (decision === "approve") {
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        beta_user: true,
        beta_status: "approved",
        beta_waitlist: false,
        beta_access: true,
        beta_approved_at: now,
        updated_at: now,
      })
      .eq("id", targetUserId);

    if (profileErr) {
      console.error("waitlist approve profile update:", profileErr);
      const { error: revertErr } = await admin
        .from("waitlist_requests")
        .update({
          status: "pending",
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", rid);
      if (revertErr) {
        console.error("waitlist approve revert waitlist row failed:", revertErr);
      }
      return { ok: false, error: profileErr.message };
    }

    const { error: logErr } = await admin.from("beta_approvals").insert({
      user_id: targetUserId,
      action: "approved",
      changed_by: auth.userId,
    });
    if (logErr) {
      console.error("waitlist approve beta_approvals (non-fatal):", logErr);
    }
  }

  revalidatePath("/dashboard/admin/waitlist");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/waitlist");
  return { ok: true };
}
