"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/userRoles";

export type ToggleEntryProtectionResult = { ok: true } | { ok: false; error: string };

export async function adminToggleEntryProtectionForced(
  contestId: string,
  entryId: string,
  forced: boolean,
): Promise<ToggleEntryProtectionResult> {
  const cid = contestId.trim();
  const eid = entryId.trim();
  if (!cid || !eid) {
    return { ok: false, error: "Missing contest or entry id." };
  }

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

  const { error } = await admin
    .from("contest_entries")
    .update({ entry_protection_forced: forced })
    .eq("id", eid)
    .eq("contest_id", cid);

  if (error) {
    return { ok: false, error: error.message };
  }

  await admin.rpc("apply_contest_entry_protection", { p_contest_id: cid });

  revalidatePath(`/contests/${encodeURIComponent(cid)}`);
  revalidatePath(`/contest/${encodeURIComponent(cid)}`);
  revalidatePath("/lobby");
  return { ok: true };
}
