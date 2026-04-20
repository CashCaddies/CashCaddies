"use server";

import { revalidatePath } from "next/cache";
import { isDevSimulateScoringAllowed } from "@/lib/dev-simulate-scoring";

/** Server-only cache invalidation after client-side simulate RPC. No Supabase imports. */
export async function revalidateAfterSimulateScoring(contestId: string | undefined) {
  if (!isDevSimulateScoringAllowed()) {
    return;
  }

  revalidatePath("/lobby", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/admin/scoring");
  const id = contestId?.trim();
  if (id) {
    revalidatePath(`/contest/${id}`, "page");
    revalidatePath(`/contest/${id}`, "layout");
  }
}
