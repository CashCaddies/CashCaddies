"use server";

/**
 * Contest lifecycle updates (open/lock/live/complete). Do not set `contest_status` to
 * `cancelled` here — cancellation belongs only in an admin flow that refunds entries first.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/permissions";
import { settleContestPrizes } from "@/lib/contest-payout-engine";

export type ContestLifecycleActionResult = { ok: true } | { ok: false; error: string };

type DbLifecycle = "upcoming" | "filling" | "locked" | "live" | "completed";

function legacyStatusFor(contestStatus: DbLifecycle): string {
  switch (contestStatus) {
    case "upcoming":
      return "open";
    case "filling":
      return "open";
    case "locked":
      return "locked";
    case "live":
      return "live";
    case "completed":
      return "completed";
    default:
      return "open";
  }
}

async function assertAdminAndServiceRole(): Promise<
  { ok: true; admin: NonNullable<ReturnType<typeof createServiceRoleClient>> } | { ok: false; error: string }
> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Supabase is not configured." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(prof?.role)) {
    return { ok: false, error: "Admin access required." };
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server role is not configured." };
  }
  return { ok: true, admin };
}

async function updateContestLifecycle(
  contestId: string,
  contestStatus: DbLifecycle,
): Promise<ContestLifecycleActionResult> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }
  const gate = await assertAdminAndServiceRole();
  if (!gate.ok) {
    return gate;
  }
  const { error } = await gate.admin
    .from("contests")
    .update({
      contest_status: contestStatus,
      status: legacyStatusFor(contestStatus),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/lobby");
  revalidatePath("/admin/contests");
  revalidatePath(`/contests/${encodeURIComponent(id)}`);
  return { ok: true };
}

export async function adminLockContest(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestLifecycle(contestId, "locked");
}

export async function adminStartContest(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestLifecycle(contestId, "live");
}

export async function adminOpenContestForEntries(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestLifecycle(contestId, "filling");
}

export async function adminMarkContestUpcoming(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestLifecycle(contestId, "upcoming");
}

export async function adminCompleteContest(contestId: string): Promise<ContestLifecycleActionResult> {
  return updateContestLifecycle(contestId, "completed");
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
