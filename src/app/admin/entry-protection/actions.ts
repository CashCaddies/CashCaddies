"use server";

import { revalidatePath } from "next/cache";
import { getAdminClientContext } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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

  const auth = await getAdminClientContext();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
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
