"use server";

import { revalidatePath } from "next/cache";
import { normalizeContestStateForInsert } from "@/lib/contest-admin-state";
import { getAdminClientContext } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type CreateContestInput = {
  requesterUserId: string;
  name: string;
  entryFee: number;
  maxEntries: number;
  startDate: string;
  contestType?: string;
  status?: string;
  isPortal?: boolean;
  portalFrequency?: "weekly" | "biweekly" | "monthly";
  overlayAmount?: number;
  /** Optional prize pool (USD); stored on `contests.prize_pool` when present. */
  prizePool?: number;
};

export type CreateContestResult =
  | { ok: true; contestId: string }
  | { ok: false; error: string };

export async function createContestAdmin(input: CreateContestInput): Promise<CreateContestResult> {
  const name = String(input.name ?? "").trim();
  const entryFee = Number(input.entryFee ?? NaN);
  const maxEntries = Math.floor(Number(input.maxEntries ?? NaN));
  const startsAt = String(input.startDate ?? "").trim();
  const requesterUserId = String(input.requesterUserId ?? "").trim();
  const contestState = normalizeContestStateForInsert(input.status);
  const isPortal = Boolean(input.isPortal);
  const overlayAmount = Number(input.overlayAmount ?? 0);
  const portalFrequency = isPortal ? input.portalFrequency ?? null : null;
  const prizePool = input.prizePool != null ? Number(input.prizePool) : NaN;
  const prizePoolRounded =
    Number.isFinite(prizePool) && prizePool >= 0 ? Math.round(prizePool * 100) / 100 : null;

  if (!name) return { ok: false, error: "Contest name is required." };
  if (!Number.isFinite(entryFee) || entryFee < 0) return { ok: false, error: "Entry fee must be 0 or greater." };
  if (!Number.isFinite(maxEntries) || maxEntries < 1) return { ok: false, error: "Max entries must be at least 1." };
  if (!Number.isFinite(overlayAmount) || overlayAmount < 0) {
    return { ok: false, error: "Overlay amount must be 0 or greater." };
  }
  if (
    portalFrequency &&
    portalFrequency !== "weekly" &&
    portalFrequency !== "biweekly" &&
    portalFrequency !== "monthly"
  ) {
    return { ok: false, error: "Portal frequency must be weekly, biweekly, or monthly." };
  }
  if (!startsAt) return { ok: false, error: "Start date is required." };
  if (!requesterUserId) return { ok: false, error: "Missing requester user id." };

  const gate = await getAdminClientContext();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  if (requesterUserId !== gate.userId) {
    return { ok: false, error: "Admin access required." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  // Keep simple: insert only columns that exist across current schema.
  const createdAt = new Date().toISOString();
  const contestId = crypto.randomUUID();
  const row: Record<string, unknown> = {
    id: contestId,
    name,
    entry_fee: Math.round(entryFee * 100) / 100,
    entry_fee_usd: Math.round(entryFee * 100) / 100,
    max_entries: maxEntries,
    entry_count: 0,
    start_time: startsAt,
    status: contestState,
    entries_open_at: createdAt,
    max_entries_per_user: 1,
    starts_at: startsAt,
    created_by: requesterUserId,
    created_at: createdAt,
    is_portal: isPortal,
    portal_frequency: portalFrequency,
    overlay_amount: Math.round(overlayAmount * 100) / 100,
    is_featured: isPortal,
  };
  if (prizePoolRounded != null) {
    row.prize_pool = prizePoolRounded;
  }

  const { data: inserted, error } = await admin.from("contests").insert(row).select("id").single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const id = String((inserted as { id?: string } | null)?.id ?? contestId);

  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  return { ok: true, contestId: id };
}

async function getServiceClientForOwnerRequester(
  requesterUserId: string,
): Promise<{ ok: true; admin: NonNullable<ReturnType<typeof createServiceRoleClient>> } | { ok: false; error: string }> {
  const uid = String(requesterUserId ?? "").trim();
  if (!uid) return { ok: false, error: "Missing requester user id." };

  const gate = await getAdminClientContext();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  if (uid !== gate.userId) {
    return { ok: false, error: "Admin access required." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }
  return { ok: true, admin };
}

export async function updateContestAdmin(
  requesterUserId: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await getServiceClientForOwnerRequester(requesterUserId);
  if (!gate.ok) return gate;

  const { error } = await gate.admin.from("contests").update(updates).eq("id", id.trim());

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  return { ok: true };
}

export async function deleteContestAdmin(
  requesterUserId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await getServiceClientForOwnerRequester(requesterUserId);
  if (!gate.ok) return gate;

  const { error } = await gate.admin.from("contests").delete().eq("id", id.trim());

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  return { ok: true };
}

