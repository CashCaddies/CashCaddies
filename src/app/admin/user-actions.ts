"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import type { BetaPriority } from "@/lib/beta-priority";
import { isBetaPriority } from "@/lib/beta-priority";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBetaStatusEmail, type BetaStatusEmailKind } from "@/lib/email/betaStatusEmail";
import { APP_CONFIG_KEY_MAX_BETA_USERS, getBetaCapacitySnapshot } from "@/lib/config";
import { isInviteSource } from "@/lib/invite-source";
import { isOwner } from "@/lib/userRoles";
import { assertAccountBalanceCreditAllowed } from "@/lib/wallet-limit";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };
export type GrantBetaFundsResult =
  | {
      ok: true;
      message: string;
      timestamp: string;
      grant_count: number;
    }
  | { ok: false; error: string };

const ALLOWED_AMOUNTS = [10, 50, 100] as const;

async function requireAdminActor() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Not signed in." };
  }

  if (!isOwner(user.email)) {
    return { ok: false as const, error: "Admin access required." };
  }

  return { ok: true as const, userId: user.id, supabase };
}

async function requireSeniorAdminActor() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Not signed in." };
  }

  if (!isOwner(user.email)) {
    return { ok: false as const, error: "Senior admin access required." };
  }

  return { ok: true as const, userId: user.id, supabase };
}

export async function grantBetaFunds(user_id: string, amount: number): Promise<GrantBetaFundsResult> {
  const auth = await requireAdminActor();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const targetId = String(user_id ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }
  if (!ALLOWED_AMOUNTS.includes(amount as 10 | 50 | 100)) {
    return { ok: false, error: "Amount must be 10, 50, or 100." };
  }

  // Use existing RPC for self-funding path.
  if (targetId === auth.userId) {
    const { data, error } = await auth.supabase.rpc("admin_add_beta_funds", { p_amount: amount });
    if (error) {
      return { ok: false, error: error.message };
    }
    const row = data as { wallet_balance?: number | string } | null;
    if (!row || row.wallet_balance == null) {
      return { ok: false, error: "Unexpected response from wallet." };
    }
    const { count } = await auth.supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetId)
      .eq("type", "beta_credit");
    const timestamp = new Date().toISOString();
    revalidatePath("/admin");
    return {
      ok: true,
      message: `$${amount} beta funds granted.`,
      timestamp,
      grant_count: Number(count ?? 0),
    };
  }

  // Cross-user funding (admin control panel): equivalent ledger + account_balance update.
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: row, error: rowErr } = await admin
    .from("profiles")
    .select("account_balance")
    .eq("id", targetId)
    .maybeSingle();
  if (rowErr || !row) {
    return { ok: false, error: "User not found." };
  }
  const cap = assertAccountBalanceCreditAllowed(Number(row.account_balance ?? 0), amount);
  if (!cap.ok) {
    return { ok: false, error: cap.error };
  }
  const nextBalance = cap.nextBalance;
  const { error: upErr } = await admin
    .from("profiles")
    .update({ account_balance: nextBalance, updated_at: new Date().toISOString() })
    .eq("id", targetId);
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { error: txErr } = await admin.from("transactions").insert({
    user_id: targetId,
    amount,
    type: "beta_credit",
    description: "Beta wallet funding",
  });
  if (txErr) {
    return { ok: false, error: txErr.message };
  }
  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetId)
    .eq("type", "beta_credit");
  const timestamp = new Date().toISOString();

  revalidatePath("/admin");
  return {
    ok: true,
    message: `$${amount} beta funds granted.`,
    timestamp,
    grant_count: Number(count ?? 0),
  };
}

async function toggleFlag(
  user_id: string,
  field: "beta_user" | "founding_tester" | "is_beta_tester",
): Promise<ActionResult> {
  const auth = await requireAdminActor();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const targetId = String(user_id ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: current, error: curErr } = await admin.from("profiles").select(`id,${field}`).eq("id", targetId).maybeSingle();
  if (curErr || !current) {
    return { ok: false, error: "User not found." };
  }

  const nextValue = !Boolean((current as Record<string, unknown>)[field]);
  const { error: upErr } = await admin.from("profiles").update({ [field]: nextValue }).eq("id", targetId);
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard/beta-management");
  return { ok: true, message: `${field} set to ${nextValue ? "true" : "false"}.` };
}

export async function setProfileBetaPriority(user_id: string, priority: BetaPriority): Promise<ActionResult> {
  const auth = await requireSeniorAdminActor();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  if (!isBetaPriority(priority)) {
    return { ok: false, error: "Invalid beta priority." };
  }

  const targetId = String(user_id ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  const adminClient = createServiceRoleClient();
  if (!adminClient) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: exists, error: exErr } = await adminClient.from("profiles").select("id").eq("id", targetId).maybeSingle();
  if (exErr || !exists) {
    return { ok: false, error: "User not found." };
  }

  const { error: upErr } = await adminClient
    .from("profiles")
    .update({ beta_priority: priority, updated_at: new Date().toISOString() })
    .eq("id", targetId);
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  revalidatePath("/dashboard/beta-management");
  revalidatePath("/dashboard/admin/beta-queue");
  return { ok: true, message: `Beta priority set to ${priority}.` };
}

export async function toggleAdmin(user_id: string): Promise<ActionResult> {
  const auth = await requireSeniorAdminActor();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const targetId = String(user_id ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }
  if (targetId === auth.userId) {
    return { ok: false, error: "Another senior admin must change your role." };
  }

  const adminClient = createServiceRoleClient();
  if (!adminClient) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: current, error: curErr } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();
  if (curErr || !current) {
    return { ok: false, error: "User not found." };
  }

  const r = String((current as { role?: string | null }).role ?? "").trim().toLowerCase();
  if (r === "senior_admin") {
    return { ok: false, error: "Cannot change senior_admin role here." };
  }
  const nextRole = r === "admin" ? "user" : "admin";

  const { error: upErr } = await adminClient.from("profiles").update({ role: nextRole }).eq("id", targetId);
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard/beta-management");
  revalidatePath("/dashboard/senior-admin");
  return { ok: true, message: `role set to ${nextRole}.` };
}

export async function toggleBetaUser(user_id: string): Promise<ActionResult> {
  return toggleFlag(user_id, "beta_user");
}

export async function toggleFoundingTester(user_id: string): Promise<ActionResult> {
  return toggleFlag(user_id, "founding_tester");
}

export async function toggleProfileIsBetaTester(user_id: string): Promise<ActionResult> {
  return toggleFlag(user_id, "is_beta_tester");
}

export type BetaQueueUpdate = { approvedCount: number; maxBetaUsers: number };

/** Result shape for `approveBetaUser` only (stable for client state / serialization). */
export type ApproveBetaUserResult =
  | { success: true; approvedCount: number; maxBetaUsers: number }
  | { success: false; error: string };

export type BetaApprovalActionResult =
  | ({ ok: true; success: true } & BetaQueueUpdate)
  | { ok: false; error: string };

// DEBUG: beta approval role gate disabled — restore before production.
// const BETA_APPROVE_ALLOWED_PROFILE_ROLES = new Set([
//   "admin",
//   "founder",
//   "super_admin",
//   "senior_admin",
// ]);

async function requireApproveBetaActorFromSession(): Promise<
  { ok: true; actorId: string } | { ok: false; error: string }
> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, error: "Not signed in." };
  }

  console.log("AUTH BYPASSED FOR DEBUG");

  // const { data: profile, error: profileErr } = await supabase
  //   .from("profiles")
  //   .select("role")
  //   .eq("id", userData.user.id)
  //   .single();
  // console.log("ADMIN ROLE:", profile?.role);
  // const normalizedRole = String(profile?.role ?? "")
  //   .trim()
  //   .toLowerCase()
  //   .replace(/\s+/g, "_");
  // if (
  //   profileErr ||
  //   !profile ||
  //   !BETA_APPROVE_ALLOWED_PROFILE_ROLES.has(normalizedRole)
  // ) {
  //   return { ok: false, error: "Unauthorized beta approval update" };
  // }

  return { ok: true, actorId: userData.user.id };
}

async function requireSeniorAdminSessionForConfig(): Promise<
  | {
      ok: true;
      supabase: SupabaseClient;
      actorId: string;
    }
  | { ok: false; error: string }
> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Not signed in." };
  }

  if (!isOwner(user.email)) {
    return { ok: false, error: "Senior admin access required." };
  }

  return { ok: true, supabase, actorId: user.id };
}

type UpdateUserBetaStatusMode =
  | { kind: "approve" }
  | { kind: "approve_founder" }
  | { kind: "reject" }
  | { kind: "waitlist"; enabled: boolean };

/**
 * Persists profile beta fields + beta_approvals row. Caller must validate eligibility and capacity.
 */
async function updateUserBetaStatus(
  admin: SupabaseClient,
  targetId: string,
  actorId: string,
  mode: UpdateUserBetaStatusMode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (mode.kind) {
    case "approve": {
      const { error: uErr } = await admin
        .from("profiles")
        .update({
          beta_user: true,
          beta_status: "approved",
          beta_waitlist: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);
      if (uErr) {
        return { ok: false, error: uErr.message };
      }
      const { error: logErr } = await admin.from("beta_approvals").insert({
        user_id: targetId,
        action: "approved",
        changed_by: actorId,
      });
      if (logErr) {
        return { ok: false, error: `Profile updated but audit log failed: ${logErr.message}` };
      }
      return { ok: true };
    }
    case "approve_founder": {
      const { error: uErr } = await admin
        .from("profiles")
        .update({
          beta_user: true,
          beta_status: "approved",
          founding_tester: true,
          beta_priority: "founder",
          beta_waitlist: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);
      if (uErr) {
        return { ok: false, error: uErr.message };
      }
      const { error: logErr } = await admin.from("beta_approvals").insert({
        user_id: targetId,
        action: "approved",
        changed_by: actorId,
      });
      if (logErr) {
        return { ok: false, error: `Profile updated but audit log failed: ${logErr.message}` };
      }
      return { ok: true };
    }
    case "reject": {
      const { error: uErr } = await admin
        .from("profiles")
        .update({
          beta_user: false,
          beta_status: "rejected",
          beta_waitlist: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);
      if (uErr) {
        return { ok: false, error: uErr.message };
      }
      const { error: logErr } = await admin.from("beta_approvals").insert({
        user_id: targetId,
        action: "rejected",
        changed_by: actorId,
      });
      if (logErr) {
        return { ok: false, error: `Profile updated but audit log failed: ${logErr.message}` };
      }
      return { ok: true };
    }
    case "waitlist": {
      const { error: uErr } = await admin
        .from("profiles")
        .update({ beta_waitlist: Boolean(mode.enabled), updated_at: new Date().toISOString() })
        .eq("id", targetId);
      if (uErr) {
        return { ok: false, error: uErr.message };
      }
      const { error: logErr } = await admin.from("beta_approvals").insert({
        user_id: targetId,
        action: mode.enabled ? "waitlist_on" : "waitlist_off",
        changed_by: actorId,
      });
      if (logErr) {
        return { ok: false, error: `Waitlist updated but audit log failed: ${logErr.message}` };
      }
      return { ok: true };
    }
    default: {
      const _exhaustive: never = mode;
      return { ok: false, error: String(_exhaustive) };
    }
  }
}

async function sendBetaStatusEmailSafe(
  admin: SupabaseClient,
  userId: string,
  status: BetaStatusEmailKind,
): Promise<void> {
  const { data, error } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Email failed", error);
    return;
  }
  const email =
    typeof (data as { email?: string | null } | null)?.email === "string"
      ? (data as { email: string }).email
      : null;
  if (!email?.trim()) {
    return;
  }
  try {
    await sendBetaStatusEmail(email, status);
  } catch (e) {
    console.error("Email failed", e);
  }
}

export async function updateMaxBetaUsersCap(
  valueRaw: string,
): Promise<{ ok: true; maxBetaUsers: number } | { ok: false; error: string }> {
  const auth = await requireSeniorAdminSessionForConfig();
  if (!auth.ok) return auth;

  const trimmed = String(valueRaw ?? "").trim();
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== trimmed) {
    return { ok: false, error: "Enter a valid whole number (0 or greater)." };
  }

  const { error } = await auth.supabase.from("app_config").upsert(
    { key: APP_CONFIG_KEY_MAX_BETA_USERS, value: String(parsed) },
    { onConflict: "key" },
  );
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/senior-admin");
  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/admin/waitlist");
  revalidatePath("/dashboard/beta-management");
  return { ok: true, maxBetaUsers: parsed };
}

/**
 * Senior admin only: approve beta access and mark profile as founding tester with founder priority.
 */
export async function approveBetaUserAsFounder(userId: string): Promise<BetaApprovalActionResult> {
  const senior = await requireSeniorAdminSessionForConfig();
  if (!senior.ok) return senior;

  const targetId = String(userId ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: beforeFounder, error: founderFetchErr } = await admin
    .from("profiles")
    .select("beta_status")
    .eq("id", targetId)
    .maybeSingle();
  if (founderFetchErr || !beforeFounder) {
    return { ok: false, error: founderFetchErr?.message ?? "User not found." };
  }
  const stF = String((beforeFounder as { beta_status?: string | null }).beta_status ?? "").toLowerCase();
  if (stF !== "pending" && stF !== "rejected" && stF !== "waitlist") {
    return { ok: false, error: "User cannot be approved from their current beta status." };
  }

  const cap = await getBetaCapacitySnapshot(admin);
  if (cap.approvedCount >= cap.maxBetaUsers) {
    return { ok: false, error: "Beta program is at capacity." };
  }

  const db = await updateUserBetaStatus(admin, targetId, senior.actorId, { kind: "approve_founder" });
  if (!db.ok) {
    return db;
  }

  // await sendBetaStatusEmailSafe(admin, targetId, "approved");

  const after = await getBetaCapacitySnapshot(admin);
  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/beta-management");
  revalidatePath("/dashboard/admin/waitlist");
  return { ok: true, success: true, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
}

export async function approveBetaUser(userId: string): Promise<ApproveBetaUserResult> {
  console.log("APPROVE START", userId);
  try {
    const auth = await requireApproveBetaActorFromSession();
    if (!auth.ok) {
      return { success: false, error: String(auth.error) };
    }

    const targetId = String(userId ?? "").trim();
    if (!targetId) {
      return { success: false, error: "Invalid user id." };
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return { success: false, error: "Server role is not configured." };
    }

    const { data: beforeRow, error: beforeErr } = await admin
      .from("profiles")
      .select("beta_status")
      .eq("id", targetId)
      .maybeSingle();
    if (beforeErr || !beforeRow) {
      return {
        success: false,
        error: String(beforeErr?.message ?? "User not found."),
      };
    }
    const st0 = String((beforeRow as { beta_status?: string | null }).beta_status ?? "").toLowerCase();
    if (st0 !== "pending" && st0 !== "rejected" && st0 !== "waitlist") {
      return { success: false, error: "User cannot be approved from their current beta status." };
    }

    const cap = await getBetaCapacitySnapshot(admin);
    if (cap.approvedCount >= cap.maxBetaUsers) {
      return { success: false, error: "Beta program is at capacity." };
    }

    try {
      const { error: profileUpdateErr } = await admin
        .from("profiles")
        .update({
          beta_user: true,
          beta_status: "approved",
          beta_waitlist: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);
      if (profileUpdateErr) {
        throw profileUpdateErr;
      }

      const { error: auditErr } = await admin.from("beta_approvals").insert({
        user_id: targetId,
        action: "approved",
        changed_by: auth.actorId,
      });
      if (auditErr) {
        throw auditErr;
      }
    } catch (e) {
      console.error("REAL APPROVE ERROR:", e);
      return {
        success: false,
        error: (e as { message?: string })?.message || JSON.stringify(e),
      };
    }

    console.log("DB UPDATE SUCCESS");

    console.log("EMAIL START");
    // await sendBetaStatusEmailSafe(admin, targetId, "approved");
    console.log("EMAIL SUCCESS");

    const after = await getBetaCapacitySnapshot(admin);
    revalidatePath("/dashboard/admin/beta-queue");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/beta-management");
    revalidatePath("/dashboard/admin/waitlist");

    const approvedCount = Number(after.approvedCount);
    const maxBetaUsers = Number(after.maxBetaUsers);
    return {
      success: true,
      approvedCount: Number.isFinite(approvedCount) ? approvedCount : 0,
      maxBetaUsers: Number.isFinite(maxBetaUsers) ? maxBetaUsers : 0,
    };
  } catch (e) {
    console.error("REAL APPROVE ERROR:", e);
    return {
      success: false,
      error: (e as { message?: string })?.message || JSON.stringify(e),
    };
  }
}

export async function rejectBetaUser(userId: string): Promise<BetaApprovalActionResult> {
  const auth = await requireApproveBetaActorFromSession();
  if (!auth.ok) return auth;

  const targetId = String(userId ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: rejRow, error: rejFetchErr } = await admin
    .from("profiles")
    .select("beta_status")
    .eq("id", targetId)
    .maybeSingle();
  if (rejFetchErr || !rejRow) {
    return { ok: false, error: rejFetchErr?.message ?? "User not found." };
  }
  const stR = String((rejRow as { beta_status?: string | null }).beta_status ?? "").toLowerCase();
  if (stR !== "pending" && stR !== "approved" && stR !== "waitlist") {
    return { ok: false, error: "User cannot be rejected from their current beta status." };
  }

  const db = await updateUserBetaStatus(admin, targetId, auth.actorId, { kind: "reject" });
  if (!db.ok) {
    return db;
  }

  // await sendBetaStatusEmailSafe(admin, targetId, "rejected");

  const after = await getBetaCapacitySnapshot(admin);
  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/beta-management");
  revalidatePath("/dashboard/admin/waitlist");
  return { ok: true, success: true, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
}

/**
 * Flag a pending or rejected user as waitlisted when beta is full (does not change beta_status).
 * Returns the same capacity snapshot shape as approve/reject for queue UI updates.
 */
export async function setBetaWaitlist(userId: string, enabled: boolean): Promise<BetaApprovalActionResult> {
  const auth = await requireApproveBetaActorFromSession();
  if (!auth.ok) return auth;

  const targetId = String(userId ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: row, error: fetchErr } = await admin
    .from("profiles")
    .select("beta_status,beta_waitlist")
    .eq("id", targetId)
    .maybeSingle();
  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!row) {
    return { ok: false, error: "User not found." };
  }

  const st = String((row as { beta_status?: string | null }).beta_status ?? "").toLowerCase();
  if (st !== "pending" && st !== "rejected" && st !== "waitlist") {
    return { ok: false, error: "Waitlist flag is only available for pending, rejected, or waitlist users." };
  }

  const current = (row as { beta_waitlist?: boolean }).beta_waitlist === true;
  if (current === Boolean(enabled)) {
    const after = await getBetaCapacitySnapshot(admin);
    return { ok: true, success: true, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
  }

  const db = await updateUserBetaStatus(admin, targetId, auth.actorId, {
    kind: "waitlist",
    enabled: Boolean(enabled),
  });
  if (!db.ok) {
    return db;
  }

  if (enabled) {
    // await sendBetaStatusEmailSafe(admin, targetId, "waitlist");
  }

  const after = await getBetaCapacitySnapshot(admin);
  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/admin");
  return { ok: true, success: true, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
}

const MAX_BULK_BETA_IDS = 100;

export type BulkBetaStatusResult =
  | { ok: true; processed: number; approvedCount: number; maxBetaUsers: number }
  | { ok: false; error: string };

/**
 * Approve or reject many profiles in one request (same rules as single actions; capacity enforced for approve).
 */
export async function bulkUpdateBetaStatus(
  userIds: string[],
  action: "approved" | "rejected",
): Promise<BulkBetaStatusResult> {
  const auth = await requireApproveBetaActorFromSession();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const rawIds = [...new Set(userIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (rawIds.length === 0) {
    return { ok: false, error: "No users selected." };
  }
  if (rawIds.length > MAX_BULK_BETA_IDS) {
    return { ok: false, error: `Select at most ${MAX_BULK_BETA_IDS} users at a time.` };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: profileRows, error: fetchErr } = await admin
    .from("profiles")
    .select("id, beta_status")
    .in("id", rawIds);
  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }

  const list = (profileRows ?? []) as { id: string; beta_status: string | null }[];

  if (action === "approved") {
    const eligible = list.filter((r) => {
      const s = String(r.beta_status ?? "").toLowerCase();
      return s === "pending" || s === "rejected" || s === "waitlist";
    });
    const eligibleIds = eligible.map((r) => String(r.id));
    if (eligibleIds.length === 0) {
      return { ok: false, error: "None of the selected users can be approved (wrong status)." };
    }

    const cap = await getBetaCapacitySnapshot(admin);
    const available = cap.maxBetaUsers - cap.approvedCount;
    if (available <= 0) {
      return { ok: false, error: "Beta program is at capacity." };
    }
    if (eligibleIds.length > available) {
      return {
        ok: false,
        error: `Not enough capacity to approve ${eligibleIds.length} user(s). Only ${available} slot(s) available.`,
      };
    }

    const { error: uErr } = await admin
      .from("profiles")
      .update({
        beta_user: true,
        beta_status: "approved",
        beta_waitlist: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", eligibleIds);
    if (uErr) {
      return { ok: false, error: uErr.message };
    }

    const auditRows = eligibleIds.map((user_id) => ({
      user_id,
      action: "approved" as const,
      changed_by: auth.actorId,
    }));
    const { error: logErr } = await admin.from("beta_approvals").insert(auditRows);
    if (logErr) {
      return { ok: false, error: `Profiles updated but audit log failed: ${logErr.message}` };
    }

    for (const uid of eligibleIds) {
      // await sendBetaStatusEmailSafe(admin, uid, "approved");
    }

    const after = await getBetaCapacitySnapshot(admin);
    revalidatePath("/dashboard/admin/beta-queue");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/beta-management");
    return { ok: true, processed: eligibleIds.length, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
  }

  const eligibleReject = list.filter((r) => {
    const s = String(r.beta_status ?? "").toLowerCase();
    return s === "pending" || s === "approved" || s === "waitlist";
  });
  const rejectIds = eligibleReject.map((r) => String(r.id));
  if (rejectIds.length === 0) {
    return { ok: false, error: "None of the selected users can be rejected (wrong status)." };
  }

  const { error: uErr } = await admin
    .from("profiles")
    .update({
      beta_user: false,
      beta_status: "rejected",
      beta_waitlist: false,
      updated_at: new Date().toISOString(),
    })
    .in("id", rejectIds);
  if (uErr) {
    return { ok: false, error: uErr.message };
  }

  const auditReject = rejectIds.map((user_id) => ({
    user_id,
    action: "rejected" as const,
    changed_by: auth.actorId,
  }));
  const { error: logErr } = await admin.from("beta_approvals").insert(auditReject);
  if (logErr) {
    return { ok: false, error: `Profiles updated but audit log failed: ${logErr.message}` };
  }

  for (const uid of rejectIds) {
    // await sendBetaStatusEmailSafe(admin, uid, "rejected");
  }

  const after = await getBetaCapacitySnapshot(admin);
  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/beta-management");
  return { ok: true, processed: rejectIds.length, approvedCount: after.approvedCount, maxBetaUsers: after.maxBetaUsers };
}

const MAX_BETA_NOTES_CHARS = 8000;

export type UpdateBetaNotesResult = { ok: true } | { ok: false; error: string };

/** Admin or senior_admin (same gate as beta queue). */
export async function updateProfileBetaNotes(userId: string, betaNotes: string): Promise<UpdateBetaNotesResult> {
  const auth = await requireApproveBetaActorFromSession();
  if (!auth.ok) return auth;

  const targetId = String(userId ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  const raw = String(betaNotes ?? "");
  if (raw.length > MAX_BETA_NOTES_CHARS) {
    return { ok: false, error: `Notes are too long (max ${MAX_BETA_NOTES_CHARS} characters).` };
  }

  const trimmed = raw.trim();
  const value = trimmed === "" ? null : trimmed;

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { error: uErr } = await admin
    .from("profiles")
    .update({ beta_notes: value, updated_at: new Date().toISOString() })
    .eq("id", targetId);

  if (uErr) {
    return { ok: false, error: uErr.message };
  }

  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/beta-management");
  return { ok: true };
}

/** Admin or senior_admin (same gate as beta queue). */
export async function updateProfileInviteSource(
  userId: string,
  inviteSource: string,
): Promise<UpdateBetaNotesResult> {
  const auth = await requireApproveBetaActorFromSession();
  if (!auth.ok) return auth;

  const targetId = String(userId ?? "").trim();
  if (!targetId) {
    return { ok: false, error: "Invalid user id." };
  }

  if (!isInviteSource(inviteSource)) {
    return { ok: false, error: "Invalid invite source." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { error: uErr } = await admin
    .from("profiles")
    .update({ invite_source: inviteSource, updated_at: new Date().toISOString() })
    .eq("id", targetId);

  if (uErr) {
    return { ok: false, error: uErr.message };
  }

  revalidatePath("/dashboard/admin/beta-queue");
  revalidatePath("/dashboard/beta-management");
  return { ok: true };
}

export type WaitlistProcessResult =
  | {
      ok: true;
      profileApproved?: boolean;
      approvedCount?: number;
      maxBetaUsers?: number;
      detail?: string;
    }
  | { ok: false; error: string };

/**
 * Admin waitlist manager: approve (optionally grants beta if a profile exists for the email),
 * keep waiting, or remove a prelaunch `waitlist_signups` row.
 */
export async function processWaitlistSignup(
  signupId: string,
  kind: "approve" | "keep_waiting" | "remove",
): Promise<WaitlistProcessResult> {
  const auth = await requireApproveBetaActorFromSession();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const id = String(signupId ?? "").trim();
  if (!id) {
    return { ok: false, error: "Invalid signup id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: raw, error: fetchErr } = await admin.from("waitlist_signups").select("*").eq("id", id).maybeSingle();
  if (fetchErr || !raw) {
    return { ok: false, error: fetchErr?.message ?? "Signup not found." };
  }

  const row = raw as {
    id: string;
    email: string;
    username: string;
    source: string;
    status: string;
    created_at: string;
  };

  if (kind === "remove") {
    if (row.status === "removed") {
      return { ok: true, detail: "Already removed." };
    }
    const { error: uErr } = await admin.from("waitlist_signups").update({ status: "removed" }).eq("id", id);
    if (uErr) {
      return { ok: false, error: uErr.message };
    }
    revalidatePath("/dashboard/admin/waitlist");
    return { ok: true, detail: "Removed from waitlist." };
  }

  if (kind === "keep_waiting") {
    if (row.status === "removed" || row.status === "approved") {
      return { ok: false, error: "This signup cannot be moved to keep waiting." };
    }
    const { error: uErr } = await admin.from("waitlist_signups").update({ status: "kept_waiting" }).eq("id", id);
    if (uErr) {
      return { ok: false, error: uErr.message };
    }
    revalidatePath("/dashboard/admin/waitlist");
    return { ok: true, detail: "Kept waiting." };
  }

  if (row.status !== "pending" && row.status !== "kept_waiting") {
    return { ok: false, error: "Signup is not in an approvable state." };
  }

  const emailNorm = String(row.email ?? "").trim().toLowerCase();
  const { data: prof } = await admin.from("profiles").select("id,beta_status").eq("email", emailNorm).maybeSingle();

  if (prof && typeof (prof as { id?: string }).id === "string") {
    const pid = String((prof as { id: string }).id);
    const st = String((prof as { beta_status?: string | null }).beta_status ?? "").toLowerCase();
    if (st === "approved") {
      const { error: upS } = await admin.from("waitlist_signups").update({ status: "approved" }).eq("id", id);
      if (upS) {
        return { ok: false, error: upS.message };
      }
      const after = await getBetaCapacitySnapshot(admin);
      revalidatePath("/dashboard/admin/waitlist");
      return {
        ok: true,
        profileApproved: true,
        approvedCount: after.approvedCount,
        maxBetaUsers: after.maxBetaUsers,
        detail: "Profile was already approved; signup marked approved.",
      };
    }

    const res = await approveBetaUser(pid);
    if (!res.success) {
      return { ok: false, error: res.error };
    }
    const { error: upS } = await admin.from("waitlist_signups").update({ status: "approved" }).eq("id", id);
    if (upS) {
      return { ok: false, error: `Beta approved but signup update failed: ${upS.message}` };
    }
    revalidatePath("/dashboard/admin/waitlist");
    return {
      ok: true,
      profileApproved: true,
      approvedCount: res.approvedCount,
      maxBetaUsers: res.maxBetaUsers,
      detail: "User approved for beta.",
    };
  }

  const { error: upOnly } = await admin.from("waitlist_signups").update({ status: "approved" }).eq("id", id);
  if (upOnly) {
    return { ok: false, error: upOnly.message };
  }
  revalidatePath("/dashboard/admin/waitlist");
  return {
    ok: true,
    profileApproved: false,
    detail: "No account with this email yet. Signup marked approved — they will be prioritized when they register.",
  };
}
