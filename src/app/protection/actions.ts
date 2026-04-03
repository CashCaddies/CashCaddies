"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRelationMissingOrNotExposedError } from "@/lib/supabase-missing-column";

export async function markProtectionNotificationRead(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = notificationId?.trim();
  if (!id) {
    return { ok: false, error: "Missing notification." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Server error." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (isRelationMissingOrNotExposedError(error)) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export type SwapProtectedGolferResult = { ok: true } | { ok: false; error: string };

export async function swapProtectedGolferAction(input: {
  lineupId: string;
  contestId: string;
  oldGolferId: string;
  newGolferId: string;
}): Promise<SwapProtectedGolferResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Server error." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data, error } = await supabase.rpc("swap_protected_lineup_golfer_atomic", {
    p_user_id: user.id,
    p_lineup_id: input.lineupId.trim(),
    p_old_golfer_id: input.oldGolferId.trim(),
    p_new_golfer_id: input.newGolferId.trim(),
    p_contest_id: input.contestId.trim(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as { ok?: boolean; error?: string } | null;
  if (!row || row.ok === false) {
    const msg =
      typeof row?.error === "string" && row.error.trim() !== "" ? row.error : "Could not swap golfer.";
    return { ok: false, error: msg };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lineups");
  revalidatePath(`/contest/${encodeURIComponent(input.contestId.trim())}`);
  return { ok: true };
}
