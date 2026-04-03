"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type CreateContestInput = {
  requesterUserId: string;
  name: string;
  entryFee: number;
  maxEntries: number;
  startDate: string;
  contestType?: string;
  status?: string;
};

export type CreateContestResult = { ok: true } | { ok: false; error: string };

export async function createContestAdmin(input: CreateContestInput): Promise<CreateContestResult> {
  const name = String(input.name ?? "").trim();
  const entryFee = Number(input.entryFee ?? NaN);
  const maxEntries = Math.floor(Number(input.maxEntries ?? NaN));
  const startsAt = String(input.startDate ?? "").trim();
  const requesterUserId = String(input.requesterUserId ?? "").trim();

  if (!name) return { ok: false, error: "Contest name is required." };
  if (!Number.isFinite(entryFee) || entryFee < 0) return { ok: false, error: "Entry fee must be 0 or greater." };
  if (!Number.isFinite(maxEntries) || maxEntries < 1) return { ok: false, error: "Max entries must be at least 1." };
  if (!startsAt) return { ok: false, error: "Start date is required." };
  if (!requesterUserId) return { ok: false, error: "Missing requester user id." };

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", requesterUserId)
    .maybeSingle();
  if (profileError) {
    return { ok: false, error: profileError.message };
  }
  if (String(profile?.role ?? "").trim().toLowerCase() !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  // Keep simple: insert only columns that exist across current schema.
  const createdAt = new Date().toISOString();
  const { error } = await admin.from("contests").insert({
    id: crypto.randomUUID(),
    name,
    entry_fee: Math.round(entryFee * 100) / 100,
    entry_fee_usd: Math.round(entryFee * 100) / 100,
    max_entries: maxEntries,
    entry_count: 0,
    start_time: startsAt,
    status: "open",
    contest_status: "filling",
    entries_open_at: createdAt,
    max_entries_per_user: 1,
    starts_at: startsAt,
    created_by: requesterUserId,
    created_at: createdAt,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  return { ok: true };
}

