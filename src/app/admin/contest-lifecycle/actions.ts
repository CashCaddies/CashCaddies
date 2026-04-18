"use server";

/**
 * Contest lifecycle: updates `contests.status` only (filling → locked → live → complete → settled).
 * Do not set `cancelled` here — use the dedicated refund/cancel flow.
 */

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/userRoles";
import { settleContestPrizes } from "@/lib/contest-payout-engine";

export type ContestLifecycleActionResult = { ok: true } | { ok: false; error: string };

/** Canonical `contests.status` values (see migration `contests_status_lifecycle_check`). */
export type ContestDbLifecycleStatus =
  | "filling"
  | "locked"
  | "live"
  | "complete"
  | "settled"
  | "upcoming";

async function assertAdminAndServiceRole(): Promise<
  { ok: true; admin: NonNullable<ReturnType<typeof createServiceRoleClient>> } | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }
  if (!isOwner(user.email)) {
    return { ok: false, error: "Admin access required." };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }
  return { ok: true, admin };
}

function mapActionToStatus(phase: ContestDbLifecycleStatus): string {
  switch (phase) {
    case "upcoming":
      return "filling";
    case "filling":
      return "filling";
    case "locked":
      return "locked";
    case "live":
      return "live";
    case "complete":
      return "complete";
    case "settled":
      return "settled";
    default:
      return "filling";
  }
}

async function updateContestStatus(
  contestId: string,
  phase: ContestDbLifecycleStatus,
): Promise<ContestLifecycleActionResult> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const gate = await assertAdminAndServiceRole();
  if (!gate.ok) {
    return gate;
  }
  const status = mapActionToStatus(phase);
  const { error } = await gate.admin.from("contests").update({ status }).eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  revalidatePath(`/contests/${encodeURIComponent(id)}`);
  return { ok: true };
}

export async function adminLockContest(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestStatus(contestId, "locked");
}

export async function adminStartContest(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestStatus(contestId, "live");
}

export async function adminOpenContestForEntries(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestStatus(contestId, "filling");
}

export async function adminMarkContestUpcoming(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestStatus(contestId, "upcoming");
}

export async function adminCompleteContest(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestStatus(contestId, "complete");
}

export async function adminSettleContest(contestId: string): Promise<ContestLifecycleActionResult> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const gate = await assertAdminAndServiceRole();
  if (!gate.ok) {
    return gate;
  }
  const result = await settleContestPrizes(id);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const { error } = await gate.admin.from("contests").update({ status: "settled" }).eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  revalidatePath("/admin/settlement");
  revalidatePath(`/contests/${encodeURIComponent(id)}`);
  return { ok: true };
}

export async function adminSetLateSwapEnabled(
  contestId: string,
  enabled: boolean,
): Promise<ContestLifecycleActionResult> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const gate = await assertAdminAndServiceRole();
  if (!gate.ok) {
    return gate;
  }
  const { error } = await gate.admin.from("contests").update({ late_swap_enabled: enabled }).eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  revalidatePath(`/contests/${encodeURIComponent(id)}`);
  revalidatePath("/lineup");
  return { ok: true };
}
