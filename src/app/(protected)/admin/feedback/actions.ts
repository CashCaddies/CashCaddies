"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_FEEDBACK_STATUSES,
  type AdminFeedbackStatus,
  type BetaFeedbackAdminRow,
} from "@/app/(protected)/admin/feedback/feedback-admin-types";
import { getAdminClientContext } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function isMissingFunctionError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? "").toLowerCase();
  if (!m) return false;
  if (m.includes("could not find function")) return true;
  if (m.includes("function") && (m.includes("does not exist") || m.includes("not found"))) return true;
  return false;
}

/** Coerce RPC rows from older overloads (e.g. admin_status + legacy text columns) into the inbox row shape. */
function coerceRpcRowsToAdminRows(raw: unknown): BetaFeedbackAdminRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const o = item as Record<string, unknown>;
    if (typeof o.status === "string") {
      return {
        id: String(o.id ?? ""),
        user_id: String(o.user_id ?? ""),
        username: o.username != null ? String(o.username) : null,
        email: o.email != null ? String(o.email) : null,
        feedback_type: o.feedback_type != null ? String(o.feedback_type) : null,
        title: o.title != null ? String(o.title) : null,
        message: o.message != null ? String(o.message) : null,
        issue_page: o.issue_page != null ? String(o.issue_page) : null,
        status: String(o.status),
        created_at: String(o.created_at ?? ""),
      };
    }
    if (typeof o.admin_status === "string") {
      const parts = [o.bug_report, o.feature_request, o.confusion_point]
        .map((x) => (x != null ? String(x).trim() : ""))
        .filter(Boolean);
      return {
        id: String(o.id ?? ""),
        user_id: String(o.user_id ?? ""),
        username: o.username != null ? String(o.username) : null,
        email: o.email != null ? String(o.email) : null,
        feedback_type: null,
        title: null,
        message: parts.length > 0 ? parts.join("\n\n") : "(Legacy feedback)",
        issue_page: null,
        status: String(o.admin_status),
        created_at: String(o.created_at ?? ""),
      };
    }
    return {
      id: String(o.id ?? ""),
      user_id: String(o.user_id ?? ""),
      username: null,
      email: null,
      feedback_type: null,
      title: null,
      message: null,
      issue_page: null,
      status: "new",
      created_at: String(o.created_at ?? ""),
    };
  });
}

type BetaFeedbackJoinRow = {
  id: string;
  user_id: string;
  feedback_type: string | null;
  title: string | null;
  message: string | null;
  issue_page: string | null;
  status: string | null;
  created_at: string;
  profiles: { username: string | null; email: string | null } | { username: string | null; email: string | null }[] | null;
};

function mapJoinRowToAdmin(row: BetaFeedbackJoinRow): BetaFeedbackAdminRow {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    user_id: row.user_id,
    username: p?.username ?? null,
    email: p?.email ?? null,
    feedback_type: row.feedback_type,
    title: row.title,
    message: row.message,
    issue_page: row.issue_page,
    status: row.status != null && String(row.status).trim() !== "" ? String(row.status) : "new",
    created_at: row.created_at,
  };
}

async function listBetaFeedbackAdminFromTables(
  serverSupabase: SupabaseClient,
  filter: "all" | "new",
): Promise<{ rows: BetaFeedbackAdminRow[]; error: string | null }> {
  const service = createServiceRoleClient();
  const client: SupabaseClient = service ?? serverSupabase;

  let q = client
    .from("beta_feedback")
    .select(
      `
      id,
      user_id,
      feedback_type,
      title,
      message,
      issue_page,
      status,
      created_at,
      profiles ( username, email )
    `,
    )
    .order("created_at", { ascending: false });

  if (filter === "new") {
    q = q.eq("status", "new");
  }

  const { data, error } = await q;

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = (data ?? []) as unknown as BetaFeedbackJoinRow[];
  return { rows: rows.map(mapJoinRowToAdmin), error: null };
}

export async function listBetaFeedbackAdmin(
  filter: "all" | "new" = "all",
): Promise<{ ok: true; rows: BetaFeedbackAdminRow[] } | { ok: false; error: string }> {
  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const p_filter = filter === "new" ? "new" : "all";

  const primary = await auth.supabase.rpc("admin_user_list_beta_feedback", {
    p_filter,
  });

  if (!primary.error) {
    const rows = coerceRpcRowsToAdminRows(primary.data);
    if (filter === "new") {
      return { ok: true, rows: rows.filter((r) => r.status === "new") };
    }
    return { ok: true, rows };
  }

  if (isMissingFunctionError(primary.error)) {
    const legacy = await auth.supabase.rpc("admin_user_list_beta_feedback");
    if (!legacy.error && legacy.data != null) {
      let rows = coerceRpcRowsToAdminRows(legacy.data);
      if (filter === "new") {
        rows = rows.filter((r) => r.status === "new");
      }
      return { ok: true, rows };
    }

    const fb = await listBetaFeedbackAdminFromTables(auth.supabase, filter);
    if (!fb.error) {
      return { ok: true, rows: fb.rows };
    }

    return { ok: false, error: fb.error ?? primary.error.message };
  }

  return { ok: false, error: primary.error.message };
}

export async function getAdminNewFeedbackCount(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const { data, error } = await auth.supabase.rpc("admin_user_new_feedback_count");
  if (!error) {
    const n = typeof data === "number" ? data : Number(data ?? 0);
    return { ok: true, count: Number.isFinite(n) ? n : 0 };
  }

  if (!isMissingFunctionError(error)) {
    return { ok: false, error: error.message };
  }

  const service = createServiceRoleClient();
  const client: SupabaseClient = service ?? auth.supabase;

  const { count, error: cErr } = await client
    .from("beta_feedback")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");

  if (cErr) {
    return { ok: false, error: cErr.message };
  }

  return { ok: true, count: Number(count ?? 0) };
}

export async function updateBetaFeedbackAdminStatus(
  feedbackId: string,
  status: AdminFeedbackStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  if (!ADMIN_FEEDBACK_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const { error } = await auth.supabase.rpc("admin_user_update_beta_feedback_status", {
    p_feedback_id: feedbackId,
    p_status: status,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Bulk-set status for multiple feedback rows (admin RPC per id). Use for quick actions on new feedback. */
export async function bulkUpdateFeedbackAdminStatus(
  feedbackIds: string[],
  status: AdminFeedbackStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  if (feedbackIds.length === 0) {
    return { ok: false, error: "No feedback selected." };
  }
  if (status === "new" || !ADMIN_FEEDBACK_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  for (const feedbackId of feedbackIds) {
    const { error } = await auth.supabase.rpc("admin_user_update_beta_feedback_status", {
      p_feedback_id: feedbackId,
      p_status: status,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/dashboard");
  return { ok: true };
}
