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

  if (!name) return { ok: false, error: "Contest name is required." };
  if (!Number.isFinite(entryFee) || entryFee < 0) return { ok: false, error: "Entry fee must be 0 or greater." };
  if (!Number.isFinite(maxEntries) || maxEntries < 1) return { ok: false, error: "Max entries must be at least 1." };
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

  /** Insert only columns known to exist on production `contests` (no portal/overlay/prize_pool, etc.). */
  const createdAt = new Date().toISOString();
  const contestId = crypto.randomUUID();
  const row: Record<string, unknown> = {
    id: contestId,
    name,
    entry_fee: Math.round(entryFee * 100) / 100,
    entry_fee_usd: Math.round(entryFee * 100) / 100,
    max_entries: maxEntries,
    start_time: startsAt,
    status: contestState,
    entries_open_at: createdAt,
    starts_at: startsAt,
    created_by: requesterUserId,
    created_at: createdAt,
  };

  const { data: inserted, error } = await admin.from("contests").insert(row).select("id").single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const id = String((inserted as { id?: string } | null)?.id ?? contestId);

  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  return { ok: true, contestId: id };
}

/** TEMP / QA only — creates real `contests` rows via `createContestAdmin`. Remove UI + this export when no longer needed. */
export type SeedTempLobbyTestContestsResult =
  | { ok: true; created: { id: string; name: string }[] }
  | { ok: false; error: string };

export async function seedTempLobbyTestContests(requesterUserId: string): Promise<SeedTempLobbyTestContestsResult> {
  const uid = String(requesterUserId ?? "").trim();
  if (!uid) {
    return { ok: false, error: "Missing requester user id." };
  }

  const gate = await getAdminClientContext();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  if (uid !== gate.userId) {
    return { ok: false, error: "Admin access required." };
  }

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 5);
  start.setUTCHours(20, 0, 0, 0);
  const startDate = start.toISOString();

  const batchTag = `[TEMP ${Date.now()}]`;

  const specs: CreateContestInput[] = [
    {
      requesterUserId: uid,
      name: `${batchTag} Lobby · QA A`,
      entryFee: 5,
      maxEntries: 100,
      startDate,
      status: "filling",
    },
    {
      requesterUserId: uid,
      name: `${batchTag} Lobby · QA B`,
      entryFee: 10,
      maxEntries: 80,
      startDate,
      status: "filling",
    },
    {
      requesterUserId: uid,
      name: `${batchTag} Lobby · QA C`,
      entryFee: 25,
      maxEntries: 40,
      startDate,
      status: "filling",
    },
  ];

  const created: { id: string; name: string }[] = [];
  for (const input of specs) {
    const res = await createContestAdmin(input);
    if (!res.ok) {
      return {
        ok: false,
        error: `Stopped after ${created.length} OK. Last error on "${input.name}": ${res.error}`,
      };
    }
    created.push({ id: res.contestId, name: input.name });
  }

  return { ok: true, created };
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

